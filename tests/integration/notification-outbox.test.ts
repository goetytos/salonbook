import { createHash } from "node:crypto";
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
type ClaimJobs =
  typeof import("@/lib/services/notification-outbox.service").claimNotificationOutboxJobs;
type DispatchJobs =
  typeof import("@/lib/services/notification-outbox.service").dispatchNotificationOutbox;
type UpdateBookingStatus =
  typeof import("@/lib/services/booking.service").updateBookingStatus;
type CancelCustomerBooking =
  typeof import("@/lib/services/customer.service").cancelCustomerBooking;

const FUTURE_DATE = "2099-09-15";
const migrationPath = fileURLToPath(
  new URL(
    "../../src/lib/db/migrations/007_notification_outbox.sql",
    import.meta.url
  )
);
const migrationChecksum = createHash("sha256")
  .update(readFileSync(migrationPath, "utf8"))
  .digest("hex");

function workingHours() {
  return Object.fromEntries(
    [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].map((day) => [day, { open: "09:00", close: "17:00", closed: false }])
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
    "[integration] SKIP: TEST_DATABASE_URL is absent; notification outbox PostgreSQL tests are disabled."
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("notification outbox against PostgreSQL 17", () => {
  let pool: Pool;
  let applicationPool: Pool;
  let createBooking: CreateBooking;
  let claimJobs: ClaimJobs;
  let dispatchJobs: DispatchJobs;
  let updateBookingStatus: UpdateBookingStatus;
  let cancelCustomerBooking: CancelCustomerBooking;
  let counter = 0;

  async function assertSafeTarget(): Promise<void> {
    const result = await pool.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    const row = result.rows[0];
    if (!row) throw new Error("Outbox test target check returned no row");
    assertSafeConnectedDatabase(row.database_name, row.server_address);
  }

  async function cleanDatabase(): Promise<void> {
    await assertSafeTarget();
    await pool.query(`TRUNCATE TABLE
      notification_outbox,
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

  async function seedBookingFixture(): Promise<{
    businessId: string;
    serviceId: string;
  }> {
    counter += 1;
    const business = await pool.query<{ id: string }>(
      `INSERT INTO businesses
         (name, slug, email, password_hash, phone, location, working_hours,
          buffer_minutes, status)
       VALUES ($1, $2, $3, 'integration-test-hash', '+254700000001',
               'Nairobi', $4::jsonb, 0, 'active')
       RETURNING id`,
      [
        `Outbox Salon ${counter}`,
        `outbox-salon-${counter}`,
        `outbox-${counter}@integration.test`,
        JSON.stringify(workingHours()),
      ]
    );
    const businessId = business.rows[0].id;
    const service = await pool.query<{ id: string }>(
      `INSERT INTO services
         (business_id, name, price, duration_minutes, buffer_minutes, active)
       VALUES ($1, 'Braids', 1500, 60, 0, true)
       RETURNING id`,
      [businessId]
    );

    return { businessId, serviceId: service.rows[0].id };
  }

  async function bookAt(
    businessId: string,
    serviceId: string,
    time: string,
    phoneSuffix: string
  ) {
    return createBooking(
      businessId,
      serviceId,
      `Customer ${phoneSuffix}`,
      `07123${phoneSuffix.padStart(5, "0")}`,
      FUTURE_DATE,
      time
    );
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: testDatabaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
    });
    await assertSafeTarget();

    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
    ({ createBooking, updateBookingStatus } = await import(
      "@/lib/services/booking.service"
    ));
    ({
      claimNotificationOutboxJobs: claimJobs,
      dispatchNotificationOutbox: dispatchJobs,
    } = await import("@/lib/services/notification-outbox.service"));
    ({ cancelCustomerBooking } = await import(
      "@/lib/services/customer.service"
    ));
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    if (pool) await cleanDatabase();
    await Promise.all([applicationPool?.end(), pool?.end()]);
  });

  it("tracks migration 007 with RLS and queue indexes", async () => {
    const migration = await pool.query<{ version: string; checksum: string }>(
      `SELECT version, checksum
       FROM schema_migrations
       WHERE version = '007_notification_outbox.sql'`
    );
    expect(migration.rows).toEqual([
      {
        version: "007_notification_outbox.sql",
        checksum: migrationChecksum,
      },
    ]);

    const table = await pool.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity
       FROM pg_class
       WHERE oid = 'public.notification_outbox'::regclass`
    );
    expect(table.rows[0]?.relrowsecurity).toBe(true);

    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'notification_outbox'`
    );
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        "notification_outbox_booking_type_key",
        "idx_notification_outbox_ready",
        "idx_notification_outbox_expired_leases",
      ])
    );
  });

  it("commits a booking only with both PII-minimized notification intents", async () => {
    const fixture = await seedBookingFixture();
    const booking = await bookAt(
      fixture.businessId,
      fixture.serviceId,
      "10:00",
      "00001"
    );

    const intents = await pool.query<{
      booking_id: string;
      type: string;
      status: string;
    }>(
      `SELECT booking_id, type, status
       FROM notification_outbox
       WHERE booking_id = $1
       ORDER BY type`,
      [booking.id]
    );
    expect(intents.rows).toEqual([
      {
        booking_id: booking.id,
        type: "booking_confirmation",
        status: "pending",
      },
      {
        booking_id: booking.id,
        type: "booking_owner_alert",
        status: "pending",
      },
    ]);

    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'notification_outbox'`
    );
    expect(columns.rows.map(({ column_name }) => column_name)).not.toEqual(
      expect.arrayContaining([
        "phone",
        "recipient",
        "customer_name",
        "message",
        "payload",
      ])
    );
  });

  it("rolls back the booking when either durable intent cannot be inserted", async () => {
    const fixture = await seedBookingFixture();
    await pool.query(`
      CREATE FUNCTION public.reject_owner_outbox_for_test()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.type = 'booking_owner_alert' THEN
          RAISE EXCEPTION 'forced outbox test failure';
        END IF;
        RETURN NEW;
      END
      $function$;

      CREATE TRIGGER reject_owner_outbox_for_test
      BEFORE INSERT ON public.notification_outbox
      FOR EACH ROW EXECUTE FUNCTION public.reject_owner_outbox_for_test();
    `);

    try {
      await expect(
        bookAt(fixture.businessId, fixture.serviceId, "10:00", "00002")
      ).rejects.toThrow(/forced outbox test failure/);
    } finally {
      await pool.query(`
        DROP TRIGGER IF EXISTS reject_owner_outbox_for_test
          ON public.notification_outbox;
        DROP FUNCTION IF EXISTS public.reject_owner_outbox_for_test();
      `);
    }

    const counts = await pool.query<{ bookings: string; intents: string }>(
      `SELECT
         (SELECT count(*) FROM bookings)::text AS bookings,
         (SELECT count(*) FROM notification_outbox)::text AS intents`
    );
    expect(counts.rows[0]).toEqual({ bookings: "0", intents: "0" });
  });

  it("leases disjoint bounded batches across concurrent workers", async () => {
    const fixture = await seedBookingFixture();
    await Promise.all([
      bookAt(fixture.businessId, fixture.serviceId, "10:00", "00003"),
      bookAt(fixture.businessId, fixture.serviceId, "12:00", "00004"),
    ]);

    const [first, second] = await Promise.all([
      claimJobs({ batchSize: 2 }),
      claimJobs({ batchSize: 2 }),
    ]);
    const allIds = [...first, ...second].map(({ id }) => id);

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(new Set(allIds).size).toBe(4);
    expect([...first, ...second].every((job) => job.attempt_count === 1)).toBe(
      true
    );
  });

  it("recovers expired leases and dead-letters stale pending notifications", async () => {
    const fixture = await seedBookingFixture();
    const booking = await bookAt(
      fixture.businessId,
      fixture.serviceId,
      "10:00",
      "00005"
    );
    const rows = await pool.query<{ id: string; type: string }>(
      `SELECT id, type FROM notification_outbox WHERE booking_id = $1 ORDER BY type`,
      [booking.id]
    );
    const recoverable = rows.rows[0];
    const stale = rows.rows[1];

    await pool.query(
      `UPDATE notification_outbox
       SET status = 'processing', attempt_count = 1,
           lease_token = gen_random_uuid(),
           lease_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'
       WHERE id = $1`,
      [recoverable.id]
    );
    await pool.query(
      `UPDATE notification_outbox
       SET created_at = CURRENT_TIMESTAMP - INTERVAL '3 hours'
       WHERE id = $1`,
      [stale.id]
    );

    const claimed = await claimJobs({ batchSize: 2, bookingId: booking.id });
    expect(claimed).toHaveLength(1);
    expect(claimed[0].id).toBe(recoverable.id);
    expect(claimed[0].attempt_count).toBe(2);

    const staleStatus = await pool.query<{
      status: string;
      last_error_code: string;
    }>(
      `SELECT status, last_error_code
       FROM notification_outbox WHERE id = $1`,
      [stale.id]
    );
    expect(staleStatus.rows[0]).toEqual({
      status: "dead",
      last_error_code: "stale_notification",
    });
  });

  it("outage then cancellation never replays stale creation alerts on recovery", async () => {
    const fixture = await seedBookingFixture();
    const booking = await bookAt(
      fixture.businessId,
      fixture.serviceId,
      "10:00",
      "00006"
    );

    const previousSmsFlag = process.env.SMS_NOTIFICATIONS_ENABLED;
    process.env.SMS_NOTIFICATIONS_ENABLED = "false";
    const unavailable = await dispatchJobs({
      batchSize: 2,
      bookingId: booking.id,
    }).finally(() => {
      if (previousSmsFlag === undefined) {
        delete process.env.SMS_NOTIFICATIONS_ENABLED;
      } else {
        process.env.SMS_NOTIFICATIONS_ENABLED = previousSmsFlag;
      }
    });
    expect(unavailable.status).toBe("transport_unavailable");
    expect(unavailable.claimed).toBe(0);

    const cancelled = await updateBookingStatus(
      booking.id,
      fixture.businessId,
      "Cancelled"
    );
    expect(cancelled?.status).toBe("Cancelled");

    const claimed = await claimJobs({ batchSize: 3, bookingId: booking.id });
    expect(claimed.map(({ type }) => type)).toEqual(["booking_cancellation"]);

    const states = await pool.query<{
      type: string;
      status: string;
      last_error_code: string;
    }>(
      `SELECT type, status, last_error_code
       FROM notification_outbox
       WHERE booking_id = $1
         AND type IN ('booking_confirmation', 'booking_owner_alert')
       ORDER BY type`,
      [booking.id]
    );
    expect(states.rows).toEqual([
      {
        type: "booking_confirmation",
        status: "dead",
        last_error_code: "booking_not_booked",
      },
      {
        type: "booking_owner_alert",
        status: "dead",
        last_error_code: "booking_not_booked",
      },
    ]);
  });

  it("creates exactly one cancellation intent and rejects terminal alternation", async () => {
    const fixture = await seedBookingFixture();
    const booking = await bookAt(
      fixture.businessId,
      fixture.serviceId,
      "10:00",
      "00007"
    );

    const first = await updateBookingStatus(
      booking.id,
      fixture.businessId,
      "Cancelled"
    );
    const replay = await updateBookingStatus(
      booking.id,
      fixture.businessId,
      "Cancelled"
    );

    expect(first?.status).toBe("Cancelled");
    expect(replay?.status).toBe("Cancelled");
    await expect(
      updateBookingStatus(booking.id, fixture.businessId, "Completed")
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateBookingStatus(booking.id, fixture.businessId, "Booked")
    ).rejects.toMatchObject({ status: 409 });

    const cancellationCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM notification_outbox
       WHERE booking_id = $1 AND type = 'booking_cancellation'`,
      [booking.id]
    );
    expect(cancellationCount.rows[0]?.count).toBe("1");
  });

  it("rolls back cancellation when its durable intent cannot be inserted", async () => {
    const fixture = await seedBookingFixture();
    const booking = await bookAt(
      fixture.businessId,
      fixture.serviceId,
      "10:00",
      "00009"
    );
    await pool.query(`
      CREATE FUNCTION public.reject_cancellation_outbox_for_test()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.type = 'booking_cancellation' THEN
          RAISE EXCEPTION 'forced cancellation outbox test failure';
        END IF;
        RETURN NEW;
      END
      $function$;

      CREATE TRIGGER reject_cancellation_outbox_for_test
      BEFORE INSERT ON public.notification_outbox
      FOR EACH ROW EXECUTE FUNCTION public.reject_cancellation_outbox_for_test();
    `);

    try {
      await expect(
        updateBookingStatus(booking.id, fixture.businessId, "Cancelled")
      ).rejects.toThrow(/forced cancellation outbox test failure/);
    } finally {
      await pool.query(`
        DROP TRIGGER IF EXISTS reject_cancellation_outbox_for_test
          ON public.notification_outbox;
        DROP FUNCTION IF EXISTS public.reject_cancellation_outbox_for_test();
      `);
    }

    const state = await pool.query<{ status: string; cancellations: string }>(
      `SELECT booking.status,
              count(outbox.id) FILTER (
                WHERE outbox.type = 'booking_cancellation'
              )::text AS cancellations
       FROM bookings AS booking
       LEFT JOIN notification_outbox AS outbox
         ON outbox.booking_id = booking.id
       WHERE booking.id = $1
       GROUP BY booking.status`,
      [booking.id]
    );
    expect(state.rows[0]).toEqual({ status: "Booked", cancellations: "0" });
  });

  it("customer cancellation atomically invalidates creation alerts and enqueues once", async () => {
    const fixture = await seedBookingFixture();
    const booking = await bookAt(
      fixture.businessId,
      fixture.serviceId,
      "10:00",
      "00008"
    );
    const customer = await pool.query<{ customer_id: string }>(
      `SELECT customer_id FROM bookings WHERE id = $1`,
      [booking.id]
    );
    const customerId = customer.rows[0].customer_id;

    const cancelled = await cancelCustomerBooking(booking.id, customerId);
    const replay = await cancelCustomerBooking(booking.id, customerId);

    expect(cancelled?.status).toBe("Cancelled");
    expect(replay).toBeNull();
    const states = await pool.query<{ type: string; status: string }>(
      `SELECT type, status
       FROM notification_outbox
       WHERE booking_id = $1
       ORDER BY type`,
      [booking.id]
    );
    expect(states.rows).toEqual([
      { type: "booking_cancellation", status: "pending" },
      { type: "booking_confirmation", status: "dead" },
      { type: "booking_owner_alert", status: "dead" },
    ]);
  });
});
