import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool, type PoolClient } from "pg";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "../integration/database-safety";

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;
const runId = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`;
const syntheticSlug = `e2e-canary-${runId}`;
const syntheticEmail = `e2e-canary-${runId}@example.invalid`;
const syntheticCustomerPhone = `+2541${randomBytes(4)
  .readUInt32BE(0)
  .toString()
  .padStart(9, "0")
  .slice(0, 8)}`;
const allDayHours = Object.fromEntries(
  [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ].map((day) => [day, { open: "00:00", close: "23:59", closed: false }]),
);

interface CanaryRows {
  businessId: string;
  serviceId: string;
  staffId: string;
}

async function assertSafeDatabase(client: PoolClient): Promise<void> {
  const target = await client.query<{
    database_name: string;
    server_address: string | null;
  }>(
    `SELECT current_database() AS database_name,
            inet_server_addr()::text AS server_address`,
  );
  const row = target.rows[0];
  if (!row) throw new Error("Real-stack canary database check returned no row");
  assertSafeConnectedDatabase(row.database_name, row.server_address);
}

async function seedCanary(client: PoolClient): Promise<CanaryRows> {
  await assertSafeDatabase(client);

  const businessId = randomUUID();
  const serviceId = randomUUID();
  const staffId = randomUUID();
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO public.businesses
         (id, name, slug, email, password_hash, phone, location,
          working_hours, description, category, status, buffer_minutes)
       VALUES
         ($1, 'E2E Canary Studio', $2, $3, 'e2e-not-a-login-hash',
          '+254700000099', 'Synthetic test location, Nairobi', $4::jsonb,
          'Synthetic Firefox real-stack booking canary only.', 'hair-salon',
          'active', 0)`,
      [businessId, syntheticSlug, syntheticEmail, JSON.stringify(allDayHours)],
    );
    await client.query(
      `INSERT INTO public.services
         (id, business_id, name, price, duration_minutes, description,
          buffer_minutes, active)
       VALUES
         ($1, $2, 'Canary trim', 1250, 30,
          'Synthetic real-stack test service', 0, true)`,
      [serviceId, businessId],
    );
    await client.query(
      `INSERT INTO public.staff
         (id, business_id, name, role, specialties, working_hours, active)
       VALUES
         ($1, $2, 'Canary Stylist', 'stylist', '["canary"]'::jsonb,
          $3::jsonb, true)`,
      [staffId, businessId, JSON.stringify(allDayHours)],
    );
    await client.query(
      `INSERT INTO public.staff_services (staff_id, service_id)
       VALUES ($1, $2)`,
      [staffId, serviceId],
    );
    await client.query("COMMIT");
    return { businessId, serviceId, staffId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function cleanCanary(client: PoolClient): Promise<void> {
  await assertSafeDatabase(client);
  // The business cascade owns every seeded or UI-created child row. Match both
  // independent synthetic markers so teardown cannot broaden accidentally.
  await client.query(
    `DELETE FROM public.businesses
     WHERE slug = $1 AND email = $2`,
    [syntheticSlug, syntheticEmail],
  );
  await client.query(
    `DELETE FROM public.customers
     WHERE name = 'Canary Customer' AND phone = $1
       AND email IS NULL AND password_hash IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.bookings WHERE customer_id = customers.id
       )`,
    [syntheticCustomerPhone],
  );
}

test.describe("real booking stack", () => {
  test.skip(
    !testDatabaseUrl,
    "TEST_DATABASE_URL is absent; the real PostgreSQL canary is disabled.",
  );

  let pool: Pool;
  let seeded: CanaryRows;

  test.beforeAll(async () => {
    pool = new Pool({
      connectionString: testDatabaseUrl!,
      max: 2,
      connectionTimeoutMillis: 5_000,
    });
    const client = await pool.connect();
    try {
      await cleanCanary(client);
      seeded = await seedCanary(client);
    } finally {
      client.release();
    }
  });

  test.afterAll(async () => {
    if (!pool) return;
    const client = await pool.connect();
    try {
      await cleanCanary(client);
    } finally {
      client.release();
      await pool.end();
    }
  });

  test("Firefox books through the UI and commits two durable intents", async ({
    page,
  }) => {
    // The spawned production-mode app intentionally fails closed unless it is
    // behind Vercel's trusted client-IP boundary. This header simulates the
    // platform-provided value; application code still rejects it elsewhere.
    await page.setExtraHTTPHeaders({ "x-vercel-forwarded-for": "127.0.0.1" });

    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 14);
    const bookingDate = date.toISOString().slice(0, 10);

    await page.goto(`/book/${syntheticSlug}`);
    await page.getByRole("button", { name: /Canary trim/i }).click();
    await page.getByRole("button", { name: /Canary Stylist/i }).click();
    await page.getByLabel("Appointment date").fill(bookingDate);
    await page.getByRole("button", { name: "10:00", exact: true }).click();
    await page.getByRole("button", { name: "Continue to details" }).click();
    await page.getByLabel("Your name").fill("Canary Customer");
    await page.getByLabel("Phone number").fill(syntheticCustomerPhone);

    const bookingResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/bookings") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirm appointment" }).click();
    const bookingResponse = await bookingResponsePromise;
    expect(bookingResponse.status()).toBe(201);
    const payload = (await bookingResponse.json()) as { id?: unknown };
    expect(payload.id).toEqual(expect.any(String));
    const bookingId = payload.id as string;

    await expect(
      page.getByRole("heading", { name: "Your time is reserved." }),
    ).toBeVisible();
    await expect(
      page.getByText(`Reference ${bookingId.slice(-8).toUpperCase()}`),
    ).toBeVisible();

    const client = await pool.connect();
    try {
      await assertSafeDatabase(client);
      const booking = await client.query<{
        id: string;
        business_id: string;
        service_id: string;
        staff_id: string;
        customer_phone: string;
        date: string;
        time: string;
        status: string;
      }>(
        `SELECT booking.id, booking.business_id, booking.service_id,
                booking.staff_id, customer.phone AS customer_phone,
                booking.date::text, to_char(booking.time, 'HH24:MI') AS time,
                booking.status
         FROM public.bookings AS booking
         JOIN public.customers AS customer ON customer.id = booking.customer_id
         WHERE booking.id = $1`,
        [bookingId],
      );
      expect(booking.rows).toEqual([
        {
          id: bookingId,
          business_id: seeded.businessId,
          service_id: seeded.serviceId,
          staff_id: seeded.staffId,
          customer_phone: syntheticCustomerPhone,
          date: bookingDate,
          time: "10:00",
          status: "Booked",
        },
      ]);

      const intents = await client.query<{
        type: string;
        status: string;
        attempt_count: number;
      }>(
        `SELECT type, status, attempt_count
         FROM public.notification_outbox
         WHERE booking_id = $1
         ORDER BY type`,
        [bookingId],
      );
      expect(intents.rows).toEqual([
        {
          type: "booking_confirmation",
          status: "pending",
          attempt_count: 0,
        },
        {
          type: "booking_owner_alert",
          status: "pending",
          attempt_count: 0,
        },
      ]);
    } finally {
      client.release();
    }
  });
});
