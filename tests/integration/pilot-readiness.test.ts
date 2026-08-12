import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "./database-safety";

type AdminService = typeof import("@/lib/services/admin.service");
type CustomerService = typeof import("@/lib/services/customer.service");

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET =
    "salonbook-pilot-readiness-integration-secret-over-32-bytes";
} else {
  console.warn(
    "[integration] SKIP: TEST_DATABASE_URL is absent; pilot readiness tests are disabled."
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("pilot readiness boundaries", () => {
  let pool: Pool;
  let applicationPool: Pool;
  let adminService: AdminService;
  let customerService: CustomerService;

  async function assertSafeDatabase(): Promise<void> {
    const result = await pool.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    const target = result.rows[0];
    if (!target) throw new Error("Pilot readiness database check returned no row");
    assertSafeConnectedDatabase(target.database_name, target.server_address);
  }

  async function cleanDatabase(): Promise<void> {
    await assertSafeDatabase();
    await pool.query(`TRUNCATE TABLE
      notification_logs,
      reviews,
      client_notes,
      customer_tags,
      client_tags,
      bookings,
      blocked_dates,
      staff_services,
      promotions,
      staff,
      customers,
      services,
      admins,
      businesses,
      rate_limit_windows
      CASCADE`);
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 3 });
    await assertSafeDatabase();
    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
    adminService = await import("@/lib/services/admin.service");
    customerService = await import("@/lib/services/customer.service");
  });

  beforeEach(cleanDatabase);

  afterAll(async () => {
    if (pool) await cleanDatabase();
    await Promise.all([applicationPool?.end(), pool?.end()]);
  });

  it("rejects incomplete activation and activates a complete listing", async () => {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO businesses
         (name, slug, email, password_hash, phone, location, status)
       VALUES
         ('Pilot Studio', 'pilot-studio', 'owner@pilot.test', 'hash',
          '+254712345678', 'Westlands, Nairobi', 'pending')
       RETURNING id`
    );
    const businessId = inserted.rows[0].id;

    await expect(
      adminService.updateBusinessStatus(businessId, "active")
    ).rejects.toBeInstanceOf(adminService.BusinessActivationError);
    expect(
      (await pool.query<{ status: string }>(
        "SELECT status FROM businesses WHERE id = $1",
        [businessId]
      )).rows[0].status
    ).toBe("pending");

    await pool.query(
      `UPDATE businesses
       SET category = 'hair-salon',
           description = 'A calm appointment-led studio in Westlands.'
       WHERE id = $1`,
      [businessId]
    );
    await pool.query(
      `INSERT INTO services
         (business_id, name, price, duration_minutes, active)
       VALUES ($1, 'Silk press', 2500, 60, true)`,
      [businessId]
    );

    await expect(
      adminService.updateBusinessStatus(businessId, "active")
    ).resolves.toMatchObject({ id: businessId, status: "active" });
  });

  it("enforces the business cancellation window using Nairobi wall time", async () => {
    const business = await pool.query<{ id: string }>(
      `INSERT INTO businesses
         (name, slug, email, password_hash, phone, location, status,
          cancellation_hours)
       VALUES
         ('Policy Studio', 'policy-studio', 'owner@policy.test', 'hash',
          '+254700000001', 'Nairobi', 'active', 24)
       RETURNING id`
    );
    const service = await pool.query<{ id: string }>(
      `INSERT INTO services
         (business_id, name, price, duration_minutes, active)
       VALUES ($1, 'Policy service', 1000, 30, true)
       RETURNING id`,
      [business.rows[0].id]
    );
    const customer = await pool.query<{ id: string }>(
      `INSERT INTO customers (name, phone, email, password_hash)
       VALUES ('Policy Customer', '+254700000002', 'customer@policy.test', 'hash')
       RETURNING id`
    );

    const bookings = await pool.query<{ id: string; boundary: string }>(
      `INSERT INTO bookings
         (business_id, service_id, customer_id, date, time, end_time, status,
          service_name_snapshot, service_price_snapshot, discount_amount,
          final_price, notes)
       SELECT $1, $2, $3,
              appointment_at::date,
              appointment_at::time,
              (appointment_at + INTERVAL '30 minutes')::time,
              'Booked', 'Policy service', 1000, 0, 1000, boundary
       FROM (VALUES
         ((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi') + INTERVAL '26 hours', 'outside'),
         ((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi') + INTERVAL '22 hours', 'inside')
       ) AS fixture(appointment_at, boundary)
       RETURNING id, notes AS boundary`,
      [business.rows[0].id, service.rows[0].id, customer.rows[0].id]
    );
    const outside = bookings.rows.find((booking) => booking.boundary === "outside");
    const inside = bookings.rows.find((booking) => booking.boundary === "inside");
    expect(outside && inside).toBeTruthy();

    await expect(
      customerService.cancelCustomerBooking(outside!.id, customer.rows[0].id)
    ).resolves.toMatchObject({ status: "Cancelled" });
    await expect(
      customerService.cancelCustomerBooking(inside!.id, customer.rows[0].id)
    ).rejects.toMatchObject({
      name: "CustomerBookingActionError",
      status: 409,
    });
  });
});
