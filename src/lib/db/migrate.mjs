/**
 * Database migration runner.
 * Usage: node src/lib/db/migrate.mjs
 * Requires DATABASE_URL environment variable.
 */
import { readFileSync } from "fs";
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

  const ssl = connectionString.includes("supabase.com")
    ? { rejectUnauthorized: false }
    : undefined;

  const client = new pg.Client({ connectionString, ssl });

  try {
    await client.connect();
    console.log("Connected to database.");

    const schemaPath = resolve(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    await client.query(schema);
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
