import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  assertSafeConnectedDatabase,
  safeTestDatabaseConnectionString,
} from "./database-safety";

const INTEGRATION_RATE_LIMIT_SECRET =
  "salonbook-integration-rate-limit-secret-that-is-longer-than-thirty-two-bytes";

export async function setup(): Promise<void> {
  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl) {
    console.warn(
      "[integration] SKIP: TEST_DATABASE_URL is absent; PostgreSQL integration tests will not run."
    );
    return;
  }

  const connectionString = safeTestDatabaseConnectionString(rawUrl);
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

  // Protected routes must have their independent HMAC key before Vitest
  // evaluates any integration test module, regardless of file order.
  process.env.RATE_LIMIT_HMAC_SECRET = INTEGRATION_RATE_LIMIT_SECRET;

  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await client.connect();
    const target = await client.query<{
      database_name: string;
      server_address: string | null;
    }>(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address`
    );
    const row = target.rows[0];
    if (!row) throw new Error("Integration database target check returned no row");
    assertSafeConnectedDatabase(row.database_name, row.server_address);
  } finally {
    await client.end();
  }

  execFileSync(process.execPath, ["src/lib/db/migrate.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      MIGRATION_DATABASE_URL: connectionString,
    },
    stdio: "inherit",
  });
}
