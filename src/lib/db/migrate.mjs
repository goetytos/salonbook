/**
 * Versioned database migration runner.
 * Usage: node src/lib/db/migrate.mjs
 * Prefers MIGRATION_DATABASE_URL and falls back to DATABASE_URL.
 *
 * Tracks applied migrations in a `schema_migrations` table.
 * Each migration file is run at most once (idempotent tracking).
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connectionVariable = process.env.MIGRATION_DATABASE_URL
    ? "MIGRATION_DATABASE_URL"
    : "DATABASE_URL";
  const rawConnectionString = process.env[connectionVariable];
  if (!rawConnectionString) {
    console.error(
      "ERROR: MIGRATION_DATABASE_URL or DATABASE_URL environment variable is required."
    );
    process.exitCode = 1;
    return;
  }

  // Vercel values copied from a shell can accidentally retain a trailing
  // escaped newline. Normalize only that suffix and ordinary whitespace.
  const connectionString = rawConnectionString.replace(/\\n$/, "").trim();
  let connectionUrl;
  try {
    connectionUrl = new URL(connectionString);
  } catch {
    console.error(`ERROR: ${connectionVariable} must be a valid PostgreSQL URL.`);
    process.exitCode = 1;
    return;
  }

  if (!["postgres:", "postgresql:"].includes(connectionUrl.protocol)) {
    console.error(`ERROR: ${connectionVariable} must use postgres:// or postgresql://.`);
    process.exitCode = 1;
    return;
  }

  const hostname = connectionUrl.hostname.toLowerCase();
  const isSupabase =
    hostname === "supabase.co" ||
    hostname.endsWith(".supabase.co") ||
    hostname === "supabase.com" ||
    hostname.endsWith(".supabase.com");
  const port = connectionUrl.port || "5432";

  // A session advisory lock cannot safely span statements through Supavisor's
  // transaction-mode pooler because the underlying Postgres session can change.
  if (isSupabase && port === "6543") {
    console.error(
      `ERROR: ${connectionVariable} uses Supabase transaction mode (port 6543). ` +
        "Set MIGRATION_DATABASE_URL to a direct or session-mode connection on port 5432."
    );
    process.exitCode = 1;
    return;
  }
  if (isSupabase && port !== "5432") {
    console.error(
      `ERROR: ${connectionVariable} uses unsupported Supabase port ${port}. ` +
        "Migrations require a direct or session-mode connection on port 5432."
    );
    process.exitCode = 1;
    return;
  }

  let ssl;
  if (isSupabase) {
    const ca = process.env.SUPABASE_DB_CA_CERT?.replace(/\\n/g, "\n").trim();
    if (
      !ca ||
      !ca.startsWith("-----BEGIN CERTIFICATE-----") ||
      !ca.endsWith("-----END CERTIFICATE-----")
    ) {
      console.error(
        "ERROR: SUPABASE_DB_CA_CERT is required for Supabase migrations."
      );
      process.exitCode = 1;
      return;
    }
    for (const key of [
      "ssl",
      "sslmode",
      "sslcert",
      "sslkey",
      "sslrootcert",
      "uselibpqcompat",
    ]) {
      connectionUrl.searchParams.delete(key);
    }
    ssl = { ca, rejectUnauthorized: true };
  }

  const client = new pg.Client({
    connectionString: connectionUrl.toString(),
    ssl,
    connectionTimeoutMillis: 10_000,
    application_name: "salonbook-migrate",
  });
  let migrationLockHeld = false;

  try {
    await client.connect();
    console.log("Connected to database.");

    // Fail safely instead of waiting indefinitely behind application traffic or
    // a stale concurrent migration. These remain in force for the session.
    await client.query("SET lock_timeout = '15s'");
    await client.query("SET statement_timeout = '5min'");

    await client.query("SELECT pg_advisory_lock(hashtext('salonbook:schema-migrations'))");
    migrationLockHeld = true;

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        checksum VARCHAR(64),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)"
    );

    // Read migration files sorted by name
    const migrationsDir = resolve(__dirname, "migrations");
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    // Get already-applied migrations
    const applied = await client.query(
      "SELECT version, checksum FROM schema_migrations"
    );
    const appliedByVersion = new Map(
      applied.rows.map((row) => [row.version, row.checksum])
    );

    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const appliedChecksum = appliedByVersion.get(file);

      if (appliedByVersion.has(file)) {
        if (appliedChecksum && appliedChecksum !== checksum) {
          throw new Error(
            `Checksum mismatch for applied migration ${file}. ` +
              "Create a new forward-only migration instead of editing history."
          );
        }
        if (!appliedChecksum) {
          await client.query(
            "UPDATE schema_migrations SET checksum = $2 WHERE version = $1 AND checksum IS NULL",
            [file, checksum]
          );
        }
        console.log(`  SKIP  ${file} (already applied)`);
        continue;
      }

      console.log(`  APPLY ${file}...`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [file, checksum]
        );
        await client.query("COMMIT");
        console.log(`  OK    ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`FAIL ${file}: ${error.message}`, { cause: error });
      }
    }

    console.log("All migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (migrationLockHeld) {
      await client
        .query("SELECT pg_advisory_unlock(hashtext('salonbook:schema-migrations'))")
        .catch(() => undefined);
    }
    await client.end();
  }
}

migrate();
