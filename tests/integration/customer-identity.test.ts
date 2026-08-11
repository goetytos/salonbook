import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "./database-safety";

type CreateBooking =
  typeof import("@/lib/services/booking.service").createBooking;
type SignupRoute = typeof import("@/app/api/customer/auth/signup/route").POST;

const TEST_JWT_SECRET =
  "salonbook-customer-identity-integration-secret-over-32-bytes";
const migration005 = readFileSync(
  fileURLToPath(
    new URL(
      "../../src/lib/db/migrations/005_customer_identity_boundary.sql",
      import.meta.url
    )
  ),
  "utf8"
);
const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
} else {
  console.warn(
    "[integration] SKIP: TEST_DATABASE_URL is absent; customer identity tests are disabled."
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("guest and credentialed customer identity", () => {
  let testPool: Pool;
  let applicationPool: Pool;
  let createBooking: CreateBooking;
  let signup: SignupRoute;
  let businessId: string;
  let serviceId: string;

  async function assertSafeDatabase(): Promise<void> {
    const result = await testPool.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    const target = result.rows[0];
    if (!target) throw new Error("Customer identity database check returned no row");
    assertSafeConnectedDatabase(target.database_name, target.server_address);
  }

  async function cleanDatabase(): Promise<void> {
    await assertSafeDatabase();
    await testPool.query(`TRUNCATE TABLE
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
      businesses
      CASCADE`);
  }

  async function seedBookableBusiness(): Promise<void> {
    const hours = JSON.stringify(
      Object.fromEntries(
        [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ].map((day) => [day, { open: "09:00", close: "17:00", closed: false }])
      )
    );
    const business = await testPool.query<{ id: string }>(
      `INSERT INTO businesses
         (name, slug, email, password_hash, phone, location, working_hours, status)
       VALUES
         ('Identity Test Salon', 'identity-test-salon',
          'owner@identity.integration.test', 'integration-test-hash',
          '+254700000000', 'Nairobi', $1::jsonb, 'active')
       RETURNING id`,
      [hours]
    );
    businessId = business.rows[0].id;

    const service = await testPool.query<{ id: string }>(
      `INSERT INTO services
         (business_id, name, price, duration_minutes, buffer_minutes, active)
       VALUES ($1, 'Guest Identity Service', 1500, 60, 0, true)
       RETURNING id`,
      [businessId]
    );
    serviceId = service.rows[0].id;
  }

  beforeAll(async () => {
    testPool = new Pool({
      connectionString: testDatabaseUrl,
      max: 3,
      connectionTimeoutMillis: 5_000,
    });
    await assertSafeDatabase();

    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
    ({ createBooking } = await import("@/lib/services/booking.service"));
    ({ POST: signup } = await import("@/app/api/customer/auth/signup/route"));
  });

  beforeEach(async () => {
    await cleanDatabase();
    await seedBookableBusiness();
  });

  afterAll(async () => {
    if (testPool) await cleanDatabase();
    await Promise.all([applicationPool?.end(), testPool?.end()]);
  });

  it("preserves an existing guest row and booking while applying migration 005", async () => {
    const booking = await createBooking(
      businessId,
      serviceId,
      "Existing Guest",
      "+254711111111",
      "2099-08-10",
      "10:00"
    );
    const before = await testPool.query<{
      booking_id: string;
      customer_id: string;
      email: string | null;
      password_hash: string | null;
    }>(
      `SELECT booking.id AS booking_id, customer.id AS customer_id,
              customer.email, customer.password_hash
       FROM bookings AS booking
       JOIN customers AS customer ON customer.id = booking.customer_id
       WHERE booking.id = $1`,
      [booking.id]
    );

    const client = await testPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DROP INDEX public.customers_guest_name_phone_uidx"
      );
      await client.query(
        `ALTER TABLE public.customers
         ADD CONSTRAINT customers_name_phone_key UNIQUE (name, phone)`
      );
      await client.query(migration005);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const after = await testPool.query<{
      booking_id: string;
      customer_id: string;
      email: string | null;
      password_hash: string | null;
    }>(
      `SELECT booking.id AS booking_id, customer.id AS customer_id,
              customer.email, customer.password_hash
       FROM bookings AS booking
       JOIN customers AS customer ON customer.id = booking.customer_id
       WHERE booking.id = $1`,
      [booking.id]
    );

    expect(after.rows).toEqual(before.rows);
    expect(after.rows[0]).toMatchObject({
      booking_id: booking.id,
      email: null,
      password_hash: null,
    });
  });

  it("keeps guest bookings isolated when the same person details register", async () => {
    const name = "Njeri Kamau";
    const phone = "+254712345678";

    const firstBooking = await createBooking(
      businessId,
      serviceId,
      name,
      phone,
      "2099-08-11",
      "10:00"
    );
    const firstGuest = await testPool.query<{ customer_id: string }>(
      "SELECT customer_id FROM bookings WHERE id = $1",
      [firstBooking.id]
    );
    const guestId = firstGuest.rows[0].customer_id;

    const signupResponse = await signup(
      new NextRequest("https://salonbook.test/api/customer/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email: "njeri@identity.integration.test",
          password: "StrongPass123!",
          phone: "0712 345 678",
        }),
      })
    );
    const signupBody = (await signupResponse.json()) as {
      customer: { id: string };
    };

    expect(signupResponse.status).toBe(201);
    expect(signupBody.customer.id).not.toBe(guestId);

    const secondBooking = await createBooking(
      businessId,
      serviceId,
      name,
      phone,
      "2099-08-12",
      "10:00"
    );

    const identities = await testPool.query<{
      email: string | null;
      id: string;
      password_hash: string | null;
    }>(
      `SELECT id, email, password_hash
       FROM customers
       WHERE name = $1 AND phone = $2
       ORDER BY email NULLS FIRST`,
      [name, phone]
    );
    expect(identities.rows).toHaveLength(2);
    expect(identities.rows[0]).toMatchObject({
      id: guestId,
      email: null,
      password_hash: null,
    });
    expect(identities.rows[1].id).toBe(signupBody.customer.id);
    expect(identities.rows[1].email).toBe("njeri@identity.integration.test");
    expect(identities.rows[1].password_hash).toBeTruthy();

    const bookingOwners = await testPool.query<{ customer_id: string }>(
      `SELECT customer_id FROM bookings
       WHERE id = ANY($1::uuid[])
       ORDER BY date`,
      [[firstBooking.id, secondBooking.id]]
    );
    expect(bookingOwners.rows.map((row) => row.customer_id)).toEqual([
      guestId,
      guestId,
    ]);

    const accountBookings = await testPool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM bookings WHERE customer_id = $1",
      [signupBody.customer.id]
    );
    expect(accountBookings.rows[0].count).toBe(0);

    const duplicateResponse = await signup(
      new NextRequest("https://salonbook.test/api/customer/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Different Display Name",
          email: "njeri@identity.integration.test",
          password: "StrongPass123!",
          phone: "0700000001",
        }),
      })
    );
    expect(duplicateResponse.status).toBe(409);
    await expect(duplicateResponse.json()).resolves.toEqual({
      error: "Email already registered",
    });
  });

  it("installs only a guest-scoped name and phone uniqueness rule", async () => {
    const broadConstraint = await testPool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.customers'::regclass
           AND conname = 'customers_name_phone_key'
       ) AS exists`
    );
    expect(broadConstraint.rows[0].exists).toBe(false);

    const partialIndex = await testPool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'customers_guest_name_phone_uidx'`
    );
    expect(partialIndex.rows[0].indexdef).toContain("UNIQUE INDEX");
    expect(partialIndex.rows[0].indexdef).toContain("(name, phone)");
    expect(partialIndex.rows[0].indexdef).toContain(
      "((email IS NULL) AND (password_hash IS NULL))"
    );
  });
});
