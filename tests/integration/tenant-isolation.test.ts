import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "./database-safety";

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;

if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("tenant isolation against PostgreSQL", () => {
  let testPool: Pool;
  let applicationPool: Pool;
  let counter = 0;

  async function cleanDatabase(): Promise<void> {
    const target = await testPool.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    assertSafeConnectedDatabase(
      target.rows[0].database_name,
      target.rows[0].server_address
    );
    await testPool.query(`TRUNCATE TABLE
      notification_logs, reviews, client_notes, customer_tags, client_tags,
      bookings, blocked_dates, staff_services, promotions, staff, customers,
      services, admins, businesses CASCADE`);
  }

  async function seedBusiness(): Promise<{ businessId: string; serviceId: string }> {
    counter += 1;
    const business = await testPool.query<{ id: string }>(
      `INSERT INTO businesses
         (name, slug, email, password_hash, phone, location, status)
       VALUES ($1, $2, $3, 'test-hash', '+254700000000', 'Nairobi', 'active')
       RETURNING id`,
      [
        `Isolation Salon ${counter}`,
        `isolation-salon-${counter}`,
        `isolation-${counter}@example.test`,
      ]
    );
    const businessId = business.rows[0].id;
    const service = await testPool.query<{ id: string }>(
      `INSERT INTO services
         (business_id, name, price, duration_minutes, active)
       VALUES ($1, 'Consultation', 1000, 60, true)
       RETURNING id`,
      [businessId]
    );
    return { businessId, serviceId: service.rows[0].id };
  }

  beforeAll(async () => {
    testPool = new Pool({ connectionString: testDatabaseUrl, max: 3 });
    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
  });

  beforeEach(cleanDatabase);

  afterAll(async () => {
    if (testPool) await cleanDatabase();
    await Promise.all([applicationPool?.end(), testPool?.end()]);
  });

  it("keeps staff assignments within the owner business and hides staff PII publicly", async () => {
    const first = await seedBusiness();
    const second = await seedBusiness();
    const { createStaff, getPublicStaff, getPublicStaffById, getStaff } =
      await import("@/lib/services/staff.service");

    await expect(
      createStaff(first.businessId, {
        name: "Cross Tenant",
        service_ids: [second.serviceId],
      })
    ).rejects.toThrow(/unavailable for this business/);

    const createdStaff = await createStaff(first.businessId, {
      name: "Amina",
      email: "amina@example.test",
      phone: "+254712345678",
      service_ids: [first.serviceId],
    });
    const publicStaff = await getPublicStaff(first.businessId);

    expect(publicStaff).toHaveLength(1);
    expect(publicStaff[0]).toMatchObject({ name: "Amina" });
    expect(publicStaff[0]).not.toHaveProperty("email");
    expect(publicStaff[0]).not.toHaveProperty("phone");
    expect(publicStaff[0]).not.toHaveProperty("service_ids_arr");

    await testPool.query(
      "UPDATE businesses SET status = 'pending' WHERE id = $1",
      [first.businessId]
    );
    await expect(getPublicStaff(first.businessId)).resolves.toEqual([]);
    await expect(
      getPublicStaffById(createdStaff.id, first.businessId)
    ).resolves.toBeNull();
    await expect(getStaff(first.businessId)).resolves.toHaveLength(1);

    await testPool.query(
      "UPDATE businesses SET status = 'suspended' WHERE id = $1",
      [first.businessId]
    );
    await expect(getPublicStaff(first.businessId)).resolves.toEqual([]);
    await expect(
      getPublicStaffById(createdStaff.id, first.businessId)
    ).resolves.toBeNull();

    const staffCount = await testPool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM staff WHERE business_id = $1",
      [first.businessId]
    );
    expect(staffCount.rows[0].count).toBe(1);
  });

  it("scopes notes and customer tags through an actual business relationship", async () => {
    const first = await seedBusiness();
    const second = await seedBusiness();
    const customer = await testPool.query<{ id: string }>(
      `INSERT INTO customers (name, phone)
       VALUES ('Customer One', '+254712300001') RETURNING id`
    );
    const customerId = customer.rows[0].id;
    await testPool.query(
      `INSERT INTO bookings
         (business_id, service_id, customer_id, date, time, end_time, status)
       VALUES ($1, $2, $3, '2099-01-01', '10:00', '11:00', 'Booked')`,
      [first.businessId, first.serviceId, customerId]
    );
    const {
      addClientNote,
      createTag,
      tagCustomer,
    } = await import("@/lib/services/client.service");

    await expect(
      addClientNote(second.businessId, customerId, "Wrong tenant")
    ).rejects.toThrow(/not found for this business/);
    await expect(
      addClientNote(first.businessId, customerId, "Consultation preference")
    ).resolves.toMatchObject({ customer_id: customerId });

    const firstTag = await createTag(first.businessId, "Returning");
    const secondTag = await createTag(second.businessId, "Other tenant");
    await expect(
      tagCustomer(first.businessId, customerId, secondTag.id)
    ).resolves.toBe(false);
    await expect(
      tagCustomer(first.businessId, customerId, firstTag.id)
    ).resolves.toBe(true);
  });

  it("rejects cross-business services in promotion create and update", async () => {
    const first = await seedBusiness();
    const second = await seedBusiness();
    const { createPromotion, updatePromotion } = await import(
      "@/lib/services/promotion.service"
    );
    const base = {
      code: "OWN10",
      discount_type: "percentage" as const,
      discount_value: 10,
      valid_from: "2099-01-01",
      valid_to: "2099-12-31",
    };

    await expect(
      createPromotion(first.businessId, {
        ...base,
        applicable_services: [second.serviceId],
      })
    ).rejects.toThrow(/unavailable for this business/);

    const promotion = await createPromotion(first.businessId, {
      ...base,
      applicable_services: [first.serviceId],
    });
    await expect(
      updatePromotion(promotion.id, first.businessId, {
        applicable_services: [second.serviceId],
      })
    ).rejects.toThrow(/unavailable for this business/);

    const stored = await testPool.query<{ applicable_services: string[] }>(
      "SELECT applicable_services FROM promotions WHERE id = $1",
      [promotion.id]
    );
    expect(stored.rows[0].applicable_services).toEqual([first.serviceId]);
  });

  it("uses the appointment date consistently for promotion validation and reservation", async () => {
    const fixture = await seedBusiness();
    const { createPromotion, reservePromotionUsage, validatePromotion } =
      await import("@/lib/services/promotion.service");
    const promotion = await createPromotion(fixture.businessId, {
      code: "DATE10",
      discount_type: "percentage",
      discount_value: 10,
      valid_from: "2099-08-11",
      valid_to: "2099-08-11",
      max_uses: 3,
      applicable_services: [fixture.serviceId],
    });

    async function reservationStatus(bookingDate: string): Promise<string> {
      const client = await testPool.connect();
      try {
        await client.query("BEGIN");
        const result = await reservePromotionUsage(
          client,
          fixture.businessId,
          promotion.code,
          fixture.serviceId,
          bookingDate
        );
        await client.query("ROLLBACK");
        return result.status;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    for (const [bookingDate, expectedValidation, expectedReservation] of [
      ["2099-08-10", false, "invalid"],
      ["2099-08-11", true, "reserved"],
      ["2099-08-12", false, "invalid"],
    ] as const) {
      const validated = await validatePromotion(
        fixture.businessId,
        promotion.code,
        bookingDate,
        fixture.serviceId
      );
      expect(Boolean(validated), bookingDate).toBe(expectedValidation);
      await expect(reservationStatus(bookingDate)).resolves.toBe(
        expectedReservation
      );
    }
  });
});
