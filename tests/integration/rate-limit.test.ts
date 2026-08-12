import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "./database-safety";

type EnforceRateLimit =
  typeof import("@/lib/security/rate-limit").enforceRateLimit;

const migration006Path = fileURLToPath(
  new URL(
    "../../src/lib/db/migrations/006_distributed_rate_limits.sql",
    import.meta.url
  )
);
const migration006 = readFileSync(migration006Path, "utf8");
const migration006Checksum = createHash("sha256")
  .update(migration006)
  .digest("hex");
const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = rawTestDatabaseUrl
  ? safeTestDatabaseConnectionString(rawTestDatabaseUrl)
  : undefined;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  delete process.env.VERCEL;
} else {
  console.warn(
    "[integration] SKIP: TEST_DATABASE_URL is absent; rate-limit tests are disabled."
  );
}

const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("distributed PostgreSQL rate limits", () => {
  let testPool: Pool;
  let applicationPool: Pool;
  let enforceRateLimit: EnforceRateLimit;

  async function assertSafeDatabase(): Promise<void> {
    const result = await testPool.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    const target = result.rows[0];
    if (!target) throw new Error("Rate-limit database check returned no row");
    assertSafeConnectedDatabase(target.database_name, target.server_address);
  }

  beforeAll(async () => {
    testPool = new Pool({
      connectionString: testDatabaseUrl,
      max: 4,
      connectionTimeoutMillis: 5_000,
    });
    await assertSafeDatabase();

    const databaseModule = await import("@/lib/db");
    applicationPool = databaseModule.getPool();
    ({ enforceRateLimit } = await import("@/lib/security/rate-limit"));
  });

  beforeEach(async () => {
    await assertSafeDatabase();
    await testPool.query("TRUNCATE TABLE public.rate_limit_windows");
  });

  afterAll(async () => {
    if (testPool) {
      await assertSafeDatabase();
      await testPool.query("TRUNCATE TABLE public.rate_limit_windows");
    }
    await Promise.all([applicationPool?.end(), testPool?.end()]);
  });

  it("installs tracked private storage and remains safe to execute twice", async () => {
    const schema = await testPool.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relrowsecurity, relforcerowsecurity
       FROM pg_catalog.pg_class
       WHERE oid = 'public.rate_limit_windows'::regclass`
    );
    expect(schema.rows[0]).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: false,
    });

    const constraints = await testPool.query<{ conname: string }>(
      `SELECT conname
       FROM pg_catalog.pg_constraint
       WHERE conrelid = 'public.rate_limit_windows'::regclass
       ORDER BY conname`
    );
    expect(constraints.rows.map((row) => row.conname)).toEqual([
      "rate_limit_windows_expiry_check",
      "rate_limit_windows_identifier_hash_check",
      "rate_limit_windows_pkey",
      "rate_limit_windows_request_count_check",
      "rate_limit_windows_scope_check",
    ]);

    const exposedPrivileges = await testPool.query<{ grantee: string }>(
      `SELECT DISTINCT COALESCE(role.rolname, 'PUBLIC') AS grantee
       FROM pg_catalog.pg_class AS relation
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(
           relation.relacl,
           pg_catalog.acldefault('r', relation.relowner)
         )
       ) AS privilege
       LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = privilege.grantee
       WHERE relation.oid = 'public.rate_limit_windows'::regclass
         AND (
           privilege.grantee = 0
           OR role.rolname IN ('anon', 'authenticated')
         )`
    );
    expect(exposedPrivileges.rows).toEqual([]);

    const tracker = await testPool.query<{
      checksum: string;
      version: string;
    }>(
      `SELECT version, checksum
       FROM public.schema_migrations
       WHERE version = '006_distributed_rate_limits.sql'`
    );
    expect(tracker.rows).toEqual([
      {
        version: "006_distributed_rate_limits.sql",
        checksum: migration006Checksum,
      },
    ]);

    const client = await testPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration006);
      await client.query(migration006);
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  it("deletes only one bounded batch of expired counters per cleanup", async () => {
    const expiredRows = Array.from({ length: 300 }, (_, index) => [
      "test.expired",
      createHash("sha256").update(`expired-${index}`).digest("hex"),
    ]);
    const values: unknown[] = [];
    const placeholders = expiredRows.map(([scope, digest], index) => {
      values.push(scope, digest);
      const offset = index * 2;
      return `($${offset + 1}, $${offset + 2}, NOW() - INTERVAL '3 hours', 1, NOW() - INTERVAL '2 hours')`;
    });
    await testPool.query(
      `INSERT INTO public.rate_limit_windows
         (scope, identifier_hash, window_started_at, request_count, expires_at)
       VALUES ${placeholders.join(", ")}`,
      values
    );

    await enforceRateLimit(
      new Request("http://localhost/api/test"),
      { scope: "test.cleanup", limit: 10, windowSeconds: 60 }
    );

    const remaining = await testPool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM public.rate_limit_windows
       WHERE expires_at < NOW()`
    );
    expect(remaining.rows[0].count).toBe("50");
  });

  it("atomically enforces concurrent quotas without storing raw identities", async () => {
    const scope = `test.concurrent.${Date.now()}`;
    const policy = { scope, limit: 5, windowSeconds: 60 };
    const rawEmail = "private.customer@example.test";
    const attempts = await Promise.all(
      Array.from({ length: 12 }, () =>
        enforceRateLimit(new Request("http://localhost/api/test"), policy, [
          { kind: "email", value: rawEmail },
        ])
      )
    );

    expect(attempts.filter((attempt) => attempt.allowed)).toHaveLength(5);
    expect(attempts.filter((attempt) => !attempt.allowed)).toHaveLength(7);
    expect(
      attempts.every(
        (attempt) =>
          attempt.retryAfterSeconds >= 1 && attempt.retryAfterSeconds <= 60
      )
    ).toBe(true);

    const stored = await testPool.query<{
      scope: string;
      identifier_hash: string;
      request_count: number;
    }>(
      `SELECT scope, identifier_hash, request_count
       FROM public.rate_limit_windows
       WHERE scope IN ($1, $2)
       ORDER BY scope`,
      [`${scope}.network`, `${scope}.pair`]
    );
    expect(stored.rows).toHaveLength(2);
    expect(stored.rows).toEqual([
      {
        scope: `${scope}.network`,
        identifier_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        request_count: 6,
      },
      {
        scope: `${scope}.pair`,
        identifier_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        request_count: 5,
      },
    ]);
    expect(JSON.stringify(stored.rows)).not.toContain(rawEmail);
    expect(JSON.stringify(stored.rows)).not.toContain("local-development-client");
  });

  it("caps identity-row growth after a shared network is exhausted", async () => {
    const scope = `test.rowcap.${Date.now()}`;
    const policy = {
      scope,
      limit: 2,
      networkLimit: 3,
      principalLimit: 100,
      windowSeconds: 60,
    };

    for (let index = 0; index < 3; index += 1) {
      const result = await enforceRateLimit(
        new Request("http://localhost/api/test"),
        policy,
        [{ kind: "phone", value: `+254700000${String(index).padStart(3, "0")}` }]
      );
      expect(result.allowed).toBe(true);
    }

    const beforeFlood = await testPool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM public.rate_limit_windows
       WHERE scope LIKE $1`,
      [`${scope}.%`]
    );

    for (let index = 0; index < 200; index += 1) {
      const result = await enforceRateLimit(
        new Request("http://localhost/api/test"),
        policy,
        [{ kind: "phone", value: `+254711${String(index).padStart(6, "0")}` }]
      );
      expect(result.allowed).toBe(false);
    }

    const afterFlood = await testPool.query<{
      count: string;
      network_count: number;
    }>(
      `SELECT count(*)::text AS count,
              max(request_count) FILTER (WHERE scope = $2)::int AS network_count
       FROM public.rate_limit_windows
       WHERE scope LIKE $1`,
      [`${scope}.%`, `${scope}.network`]
    );
    expect(beforeFlood.rows[0].count).toBe("7");
    expect(afterFlood.rows[0]).toEqual({ count: "7", network_count: 4 });
  });

  it("does not share a submitted-identity quota between different networks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    try {
      const policy = {
        scope: `test.bound.${Date.now()}`,
        limit: 2,
        networkLimit: 20,
        principalLimit: 10,
        windowSeconds: 60,
      };
      const victimPhone = "+254712345678";
      const attackerRequest = new Request("https://salonbook.test/api/test", {
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
      });
      const victimRequest = new Request("https://salonbook.test/api/test", {
        headers: { "x-vercel-forwarded-for": "198.51.100.20" },
      });

      const attackerAttempts = await Promise.all(
        Array.from({ length: 3 }, () =>
          enforceRateLimit(attackerRequest, policy, [
            { kind: "phone", value: victimPhone },
          ])
        )
      );
      const legitimateAttempt = await enforceRateLimit(victimRequest, policy, [
        { kind: "phone", value: victimPhone },
      ]);

      expect(attackerAttempts.filter((attempt) => attempt.allowed)).toHaveLength(2);
      expect(attackerAttempts.filter((attempt) => !attempt.allowed)).toHaveLength(1);
      expect(legitimateAttempt.allowed).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      process.env.DATABASE_URL = testDatabaseUrl;
      delete process.env.VERCEL;
    }
  });
});
