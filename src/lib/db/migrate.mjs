/**
 * Versioned database migration runner.
 * Usage: node src/lib/db/migrate.mjs
 * Requires DATABASE_URL environment variable.
 *
 * Tracks applied migrations in a `schema_migrations` table.
 * Each migration file is run at most once (idempotent tracking).
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const ssl = connectionString.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : undefined;

  const client = new pg.Client({ connectionString, ssl });

  try {
    await client.connect();
    console.log("Connected to database.");

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Read migration files sorted by name
    const migrationsDir = resolve(__dirname, "migrations");
    let files;
    try {
      files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    } catch {
      console.log("No migrations directory found. Running schema.sql directly...");
      const schemaPath = resolve(__dirname, "schema.sql");
      const schema = readFileSync(schemaPath, "utf-8");
      await client.query(schema);
      console.log("Schema applied successfully.");
      return;
    }

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    // Get already-applied migrations
    const applied = await client.query("SELECT version FROM schema_migrations");
    const appliedSet = new Set(applied.rows.map((r) => r.version));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  SKIP  ${file} (already applied)`);
        continue;
      }

      console.log(`  APPLY ${file}...`);
      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`  OK    ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`  FAIL  ${file}: ${error.message}`);
        process.exit(1);
      }
    }

    console.log("All migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
