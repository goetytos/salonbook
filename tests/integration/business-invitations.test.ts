import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "./database-safety";

type InvitationService =
  typeof import("@/lib/services/business-invitation.service");
type BusinessService = typeof import("@/lib/services/business.service");
type SignupRoute = typeof import("@/app/api/auth/signup/route").POST;

const migrationPath = fileURLToPath(
  new URL(
    "../../src/lib/db/migrations/008_business_invitations.sql",
    import.meta.url
  )
);
const migrationChecksum = createHash("sha256")
  .update(readFileSync(migrationPath, "utf8"))
  .digest("hex");

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET =
    "salonbook-business-invitation-integration-secret-over-32-bytes";
} else {
  console.warn(
    "[integration] SKIP: TEST_DATABASE_URL is absent; business invitation PostgreSQL tests are disabled."
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("invitation-only business onboarding against PostgreSQL 17", () => {
  let pool: Pool;
  let applicationPool: Pool;
  let invitationService: InvitationService;
  let businessService: BusinessService;
  let signupRoute: SignupRoute;
  let adminId: string;
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
    if (!row) throw new Error("Invitation test target check returned no row");
    assertSafeConnectedDatabase(row.database_name, row.server_address);
  }

  async function cleanDatabase(): Promise<void> {
    await assertSafeTarget();
    await pool.query(`TRUNCATE TABLE
      business_invitations,
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
      businesses,
      rate_limit_windows
      CASCADE`);
    const admin = await pool.query<{ id: string }>(
      `INSERT INTO public.admins (email, password_hash, name)
       VALUES ('pilot-admin@integration.test', 'not-used', 'Pilot Admin')
       RETURNING id`
    );
    adminId = admin.rows[0].id;
    counter += 1;
  }

  function businessInput(email: string, suffix = `${counter}`) {
    return {
      name: `Invitation Studio ${suffix}`,
      email,
      password: "integration-password",
      phone: "+254712345678",
      location: "Westlands, Nairobi",
    };
  }

  async function register(
    rawToken: string,
    email: string,
    suffix?: string
  ) {
    const input = businessInput(email, suffix);
    return businessService.registerBusiness(
      input.name,
      input.email,
      input.password,
      input.phone,
      input.location,
      rawToken
    );
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 6 });
    await assertSafeTarget();
    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
    invitationService = await import(
      "@/lib/services/business-invitation.service"
    );
    businessService = await import("@/lib/services/business.service");
    ({ POST: signupRoute } = await import("@/app/api/auth/signup/route"));
  });

  beforeEach(cleanDatabase);

  afterAll(async () => {
    if (pool) {
      await assertSafeTarget();
      await pool.query(`TRUNCATE TABLE business_invitations CASCADE`);
    }
    await Promise.all([applicationPool?.end(), pool?.end()]);
  });

  it("tracks migration 008 with RLS, private privileges, constraints and indexes", async () => {
    const tracker = await pool.query<{ version: string; checksum: string }>(
      `SELECT version, checksum
       FROM public.schema_migrations
       WHERE version = '008_business_invitations.sql'`
    );
    expect(tracker.rows).toEqual([
      { version: "008_business_invitations.sql", checksum: migrationChecksum },
    ]);

    const table = await pool.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity
       FROM pg_class
       WHERE oid = 'public.business_invitations'::regclass`
    );
    expect(table.rows[0]?.relrowsecurity).toBe(true);

    const exposedPrivileges = await pool.query<{ grantee: string }>(
      `SELECT DISTINCT COALESCE(role.rolname, 'PUBLIC') AS grantee
       FROM pg_catalog.pg_class AS relation
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
       ) AS privilege
       LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = privilege.grantee
       WHERE relation.oid = 'public.business_invitations'::regclass
         AND (privilege.grantee = 0 OR role.rolname IN ('anon', 'authenticated'))`
    );
    expect(exposedPrivileges.rows).toEqual([]);

    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename IN ('business_invitations', 'businesses')`
    );
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        "business_invitations_open_email_uidx",
        "business_invitations_expiry_idx",
        "businesses_email_normalized_uidx",
      ])
    );

    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'business_invitations'`
    );
    expect(columns.rows.map(({ column_name }) => column_name)).not.toContain(
      "token"
    );
  });

  it("creates a pending account through the signup route and never persists or echoes the raw token", async () => {
    const created = await invitationService.createBusinessInvitation(
      adminId,
      " Owner@Studio.co.ke ",
      24
    );
    const input = businessInput("owner@studio.co.ke", "happy");
    const response = await signupRoute(
      new NextRequest("https://salonbook.test/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://salonbook.test",
        },
        body: JSON.stringify({ ...input, invitation_token: created.token }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toMatch(
      /salonbook_business_session=.*HttpOnly/i
    );
    expect(JSON.stringify(body)).not.toContain(created.token);
    expect(body.business).toMatchObject({
      email: "owner@studio.co.ke",
      status: "pending",
    });

    const invitation = await pool.query<{
      token_digest: string;
      consumed_at: string | null;
      business_id: string | null;
    }>(
      `SELECT token_digest, consumed_at, business_id
       FROM public.business_invitations WHERE id = $1`,
      [created.invitation.id]
    );
    expect(invitation.rows[0]).toMatchObject({
      token_digest: invitationService.digestBusinessInvitationToken(
        created.token
      ),
      business_id: body.business.id,
    });
    expect(invitation.rows[0].consumed_at).not.toBeNull();
    expect(JSON.stringify(invitation.rows[0])).not.toContain(created.token);
  });

  it("rejects cross-email use without consuming the invitation", async () => {
    const created = await invitationService.createBusinessInvitation(
      adminId,
      "intended@studio.co.ke"
    );

    await expect(register(created.token, "other@studio.co.ke")).rejects.toMatchObject({
      name: "BusinessInvitationError",
      status: 422,
    });
    const state = await pool.query<{ consumed_at: string | null }>(
      "SELECT consumed_at FROM business_invitations WHERE id = $1",
      [created.invitation.id]
    );
    expect(state.rows[0].consumed_at).toBeNull();
    expect(
      (await pool.query("SELECT id FROM businesses WHERE email = $1", [
        "other@studio.co.ke",
      ])).rowCount
    ).toBe(0);
  });

  it("rejects expired invitations without creating an account", async () => {
    const created = await invitationService.createBusinessInvitation(
      adminId,
      "expired@studio.co.ke"
    );
    await pool.query(
      `UPDATE business_invitations
       SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 hours',
           expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
       WHERE id = $1`,
      [created.invitation.id]
    );

    await expect(register(created.token, "expired@studio.co.ke")).rejects.toMatchObject({
      name: "BusinessInvitationError",
      status: 403,
    });
    expect(
      (await pool.query("SELECT id FROM businesses WHERE email = $1", [
        "expired@studio.co.ke",
      ])).rowCount
    ).toBe(0);
  });

  it("permits exactly one committed use under concurrent replay", async () => {
    const created = await invitationService.createBusinessInvitation(
      adminId,
      "race@studio.co.ke"
    );

    const attempts = await Promise.allSettled([
      register(created.token, "race@studio.co.ke", "race-a"),
      register(created.token, "race@studio.co.ke", "race-b"),
    ]);

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const rows = await pool.query(
      "SELECT id FROM businesses WHERE email = 'race@studio.co.ke'"
    );
    expect(rows.rowCount).toBe(1);
  });

  it("rolls back the account and preserves the invitation when signup fails", async () => {
    const created = await invitationService.createBusinessInvitation(
      adminId,
      "rollback@studio.co.ke"
    );

    await expect(
      invitationService.redeemBusinessInvitation(
        created.token,
        "rollback@studio.co.ke",
        async (client) => {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO businesses
               (name, slug, email, password_hash, phone, location, status)
             VALUES
               ('Rollback Studio', 'rollback-studio', 'rollback@studio.co.ke',
                'hash', '+254712345678', 'Nairobi', 'pending')
             RETURNING id`
          );
          throw Object.assign(new Error("forced signup failure"), {
            businessId: inserted.rows[0].id,
          });
        }
      )
    ).rejects.toThrow("forced signup failure");

    const invitation = await pool.query<{
      consumed_at: string | null;
      business_id: string | null;
    }>(
      "SELECT consumed_at, business_id FROM business_invitations WHERE id = $1",
      [created.invitation.id]
    );
    expect(invitation.rows[0]).toEqual({
      consumed_at: null,
      business_id: null,
    });
    expect(
      (await pool.query(
        "SELECT id FROM businesses WHERE email = 'rollback@studio.co.ke'"
      )).rowCount
    ).toBe(0);
  });

  it("supersedes the previous unused invitation for the same normalized email", async () => {
    const first = await invitationService.createBusinessInvitation(
      adminId,
      "replace@studio.co.ke"
    );
    const second = await invitationService.createBusinessInvitation(
      adminId,
      " Replace@Studio.co.ke "
    );

    const previous = await pool.query<{
      revoked_at: string | null;
      revoked_by_admin_id: string | null;
      revocation_reason: string | null;
    }>(
      `SELECT revoked_at, revoked_by_admin_id, revocation_reason
       FROM business_invitations WHERE id = $1`,
      [first.invitation.id]
    );
    expect(previous.rows[0]).toMatchObject({
      revoked_by_admin_id: adminId,
      revocation_reason: "superseded",
    });
    expect(previous.rows[0].revoked_at).not.toBeNull();

    await expect(register(first.token, "replace@studio.co.ke", "old")).rejects.toMatchObject({
      name: "BusinessInvitationError",
    });
    await expect(register(second.token, "replace@studio.co.ke", "new")).resolves.toMatchObject({
      business: { email: "replace@studio.co.ke", status: "pending" },
    });
  });
});
