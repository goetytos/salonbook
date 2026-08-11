import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  assertSafeConnectedDatabase,
  assertSafeTestDatabaseUrl,
  safeTestDatabaseConnectionString,
} from "./database-safety";

type CreateBooking =
  typeof import("@/lib/services/booking.service").createBooking;

interface BookingFixture {
  businessId: string;
  serviceId: string;
  staffId: string;
}

const FUTURE_DATE = "2099-08-11";
const SECOND_FUTURE_DATE = "2099-08-12";

function workingHours(open = "09:00", close = "17:00") {
  return Object.fromEntries(
    [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].map((day) => [day, { open, close, closed: false }])
  );
}

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
} else {
  console.warn(
    "[integration] SKIP: TEST_DATABASE_URL is absent; booking PostgreSQL tests are disabled."
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describe("integration database safety gate", () => {
  it("accepts the dedicated local SalonBook test database", () => {
    expect(
      assertSafeTestDatabaseUrl("postgresql:///salonbook_test_20260811")
    ).toBe("postgresql:///salonbook_test_20260811");
    expect(
      safeTestDatabaseConnectionString(
        "postgresql:///salonbook_test_20260811"
      )
    ).toContain("host=%2Fvar%2Frun%2Fpostgresql");
  });

  it("rejects remote hosts and non-test database names", () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://db.example.com/salonbook_test_20260811"
      )
    ).toThrow(/host must be local/);
    expect(() =>
      assertSafeTestDatabaseUrl("postgresql:///salonbook_production")
    ).toThrow(/must contain salonbook_test/);
    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql:///salonbook_test_20260811?host=db.example.com"
      )
    ).toThrow(/override must be local/);
  });
});

describeWithDatabase("booking integrity against PostgreSQL", () => {
  let fixtureCounter = 0;
  let testPool: Pool;
  let applicationPool: Pool;
  let createBooking: CreateBooking;

  async function assertConnectedToSafeDatabase(pool: Pool): Promise<void> {
    const result = await pool.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    const target = result.rows[0];

    if (!target) throw new Error("Integration database target check returned no row");
    assertSafeConnectedDatabase(target.database_name, target.server_address);
  }

  async function cleanDatabase(): Promise<void> {
    await assertConnectedToSafeDatabase(testPool);
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

  async function addStaff(
    businessId: string,
    serviceId: string,
    hours = workingHours()
  ): Promise<string> {
    fixtureCounter += 1;
    const result = await testPool.query<{ id: string }>(
      `INSERT INTO staff
         (business_id, name, email, role, working_hours, active)
       VALUES ($1, $2, $3, 'stylist', $4::jsonb, true)
       RETURNING id`,
      [
        businessId,
        `Integration Stylist ${fixtureCounter}`,
        `stylist-${fixtureCounter}@integration.test`,
        JSON.stringify(hours),
      ]
    );
    const staffId = result.rows[0].id;
    await testPool.query(
      `INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2)`,
      [staffId, serviceId]
    );
    return staffId;
  }

  async function seedFixture(options?: {
    price?: string;
    serviceBuffer?: number;
    businessBuffer?: number;
    staffHours?: ReturnType<typeof workingHours>;
  }): Promise<BookingFixture> {
    fixtureCounter += 1;
    const suffix = fixtureCounter;
    const business = await testPool.query<{ id: string }>(
      `INSERT INTO businesses
         (name, slug, email, password_hash, phone, location, working_hours,
          buffer_minutes, status)
       VALUES ($1, $2, $3, 'integration-test-hash', '+254700000000',
               'Nairobi', $4::jsonb, $5, 'active')
       RETURNING id`,
      [
        `Integration Salon ${suffix}`,
        `integration-salon-${suffix}`,
        `salon-${suffix}@integration.test`,
        JSON.stringify(workingHours()),
        options?.businessBuffer ?? 5,
      ]
    );
    const businessId = business.rows[0].id;

    const service = await testPool.query<{ id: string }>(
      `INSERT INTO services
         (business_id, name, price, duration_minutes, buffer_minutes, active)
       VALUES ($1, 'Silk Press', $2::numeric, 60, $3, true)
       RETURNING id`,
      [businessId, options?.price ?? "1250.00", options?.serviceBuffer ?? 15]
    );
    const serviceId = service.rows[0].id;
    const staffId = await addStaff(
      businessId,
      serviceId,
      options?.staffHours
    );

    return { businessId, serviceId, staffId };
  }

  async function addPromotion(
    fixture: BookingFixture,
    code: string,
    maxUses: number,
    discountType: "percentage" | "fixed" = "percentage",
    discountValue = "10.00"
  ): Promise<string> {
    const result = await testPool.query<{ id: string }>(
      `INSERT INTO promotions
         (business_id, code, discount_type, discount_value, valid_from,
          valid_to, max_uses, applicable_services, active)
       VALUES ($1, $2, $3, $4::numeric, '2099-01-01', '2099-12-31', $5,
               ARRAY[$6::uuid], true)
       RETURNING id`,
      [
        fixture.businessId,
        code,
        discountType,
        discountValue,
        maxUses,
        fixture.serviceId,
      ]
    );
    return result.rows[0].id;
  }

  function rejectedReason(results: PromiseSettledResult<unknown>[]): unknown {
    return results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )?.reason;
  }

  beforeAll(async () => {
    testPool = new Pool({
      connectionString: testDatabaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
    });
    await assertConnectedToSafeDatabase(testPool);

    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
    ({ createBooking } = await import("@/lib/services/booking.service"));
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    if (testPool) await cleanDatabase();
    await Promise.all([
      applicationPool?.end(),
      testPool?.end(),
    ]);
  });

  it("persists immutable price snapshots and an authoritative promoted final price", async () => {
    const fixture = await seedFixture({ price: "1250.00" });
    const promotionId = await addPromotion(fixture, "SAVE10", 5);

    const booking = await createBooking(
      fixture.businessId,
      fixture.serviceId,
      "Amina Wanjiku",
      "0712 345 678",
      FUTURE_DATE,
      "10:00",
      fixture.staffId,
      "Integration booking",
      "save10"
    );

    await testPool.query(
      "UPDATE services SET name = 'Changed Service', price = 9999 WHERE id = $1",
      [fixture.serviceId]
    );

    const stored = await testPool.query<{
      service_name_snapshot: string;
      service_price_snapshot: string;
      discount_amount: string;
      final_price: string;
      promotion_id: string;
      customer_phone: string;
    }>(
      `SELECT b.service_name_snapshot,
              b.service_price_snapshot::text,
              b.discount_amount::text,
              b.final_price::text,
              b.promotion_id,
              c.phone AS customer_phone
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       WHERE b.id = $1`,
      [booking.id]
    );
    const row = stored.rows[0];

    expect(row).toMatchObject({
      service_name_snapshot: "Silk Press",
      service_price_snapshot: "1250.00",
      discount_amount: "125.00",
      final_price: "1125.00",
      promotion_id: promotionId,
      customer_phone: "+254712345678",
    });

    const promotion = await testPool.query<{ current_uses: number }>(
      "SELECT current_uses FROM promotions WHERE id = $1",
      [promotionId]
    );
    expect(promotion.rows[0].current_uses).toBe(1);
  });

  it("allows only one concurrent booking for the same staff slot", async () => {
    const fixture = await seedFixture();

    const results = await Promise.allSettled([
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Client One",
        "0712000001",
        FUTURE_DATE,
        "10:00",
        fixture.staffId
      ),
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Client Two",
        "0712000002",
        FUTURE_DATE,
        "10:00",
        fixture.staffId
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rejectedReason(results)).toMatchObject({ status: 409 });

    const count = await testPool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bookings"
    );
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("canonicalizes UUID spellings so concurrent buffer-only conflicts share one lock", async () => {
    const fixture = await seedFixture({ serviceBuffer: 15, businessBuffer: 0 });

    const results = await Promise.allSettled([
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Buffer Client One",
        "0712000003",
        FUTURE_DATE,
        "10:00",
        fixture.staffId
      ),
      createBooking(
        fixture.businessId.toUpperCase(),
        fixture.serviceId.toUpperCase(),
        "Buffer Client Two",
        "0712000004",
        FUTURE_DATE,
        "11:00",
        fixture.staffId.toUpperCase()
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rejectedReason(results)).toMatchObject({ status: 409 });

    const count = await testPool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bookings"
    );
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("reserves a max-use promotion atomically across different booking locks", async () => {
    const fixture = await seedFixture();
    const secondStaffId = await addStaff(fixture.businessId, fixture.serviceId);
    const promotionId = await addPromotion(fixture, "LASTONE", 1, "fixed", "100.00");

    const results = await Promise.allSettled([
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Promo Client One",
        "0712000005",
        FUTURE_DATE,
        "12:00",
        fixture.staffId,
        undefined,
        "LASTONE"
      ),
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Promo Client Two",
        "0712000006",
        FUTURE_DATE,
        "12:00",
        secondStaffId,
        undefined,
        "LASTONE"
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rejectedReason(results)).toMatchObject({
      status: 409,
      message: "Promotion usage limit has been reached",
    });

    const state = await testPool.query<{
      current_uses: number;
      booking_count: number;
    }>(
      `SELECT p.current_uses,
              (SELECT COUNT(*)::int FROM bookings WHERE promotion_id = p.id)
                AS booking_count
       FROM promotions p
       WHERE p.id = $1`,
      [promotionId]
    );
    expect(state.rows[0]).toMatchObject({ current_uses: 1, booking_count: 1 });
  });

  it("rejects services and staff that belong to another business", async () => {
    const first = await seedFixture();
    const second = await seedFixture();

    await expect(
      createBooking(
        first.businessId,
        second.serviceId,
        "Wrong Service",
        "0712000007",
        FUTURE_DATE,
        "13:00"
      )
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      createBooking(
        first.businessId,
        first.serviceId,
        "Wrong Staff",
        "0712000008",
        FUTURE_DATE,
        "13:00",
        second.staffId
      )
    ).rejects.toMatchObject({ status: 404 });

    const count = await testPool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bookings"
    );
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it("enforces staff working hours plus partial and full blocked dates", async () => {
    const fixture = await seedFixture({
      staffHours: workingHours("10:00", "16:00"),
    });

    await expect(
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Early Client",
        "0712000009",
        FUTURE_DATE,
        "09:30",
        fixture.staffId
      )
    ).rejects.toMatchObject({ status: 409, message: /outside working hours/ });

    await testPool.query(
      `INSERT INTO blocked_dates
         (business_id, staff_id, date, start_time, end_time, reason)
       VALUES ($1, $2, $3, '11:00', '12:00', 'Staff unavailable')`,
      [fixture.businessId, fixture.staffId, FUTURE_DATE]
    );
    await expect(
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Partially Blocked Client",
        "0712000010",
        FUTURE_DATE,
        "11:30",
        fixture.staffId
      )
    ).rejects.toMatchObject({ status: 409, message: /blocked/ });

    await testPool.query(
      `INSERT INTO blocked_dates (business_id, date, reason)
       VALUES ($1, $2, 'Salon closed')`,
      [fixture.businessId, SECOND_FUTURE_DATE]
    );
    await expect(
      createBooking(
        fixture.businessId,
        fixture.serviceId,
        "Fully Blocked Client",
        "0712000011",
        SECOND_FUTURE_DATE,
        "10:30",
        fixture.staffId
      )
    ).rejects.toMatchObject({ status: 409, message: /blocked/ });

    const count = await testPool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bookings"
    );
    expect(Number(count.rows[0].count)).toBe(0);
  });
});
