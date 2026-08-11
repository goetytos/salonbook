import { Pool } from "pg";
import { logServerError } from "@/lib/server/logging";

let pool: Pool | null = null;

function normalizedConnectionString(): string {
  const value = process.env.DATABASE_URL?.replace(/\\n$/, "").trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for database operations");
  }
  return value;
}

function configuredPoolSize(): number {
  const parsed = Number.parseInt(process.env.DB_POOL_MAX || "3", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10) : 3;
}

/** Lazily create the server-side pool so builds never fall back to a local DB. */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = normalizedConnectionString();
  pool = new Pool({
    connectionString,
    max: configuredPoolSize(),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    statement_timeout: 15_000,
    allowExitOnIdle: true,
    application_name: "salonbook-web",
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: true }
      : undefined,
  });

  pool.on("error", (error) => {
    logServerError("database.pool.idle-client", error);
  });

  return pool;
}

// Helper to run a single query
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

// Helper to run a single query and return one row
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await getPool().query(text, params);
  return (result.rows[0] as T) ?? null;
}

// Transaction helper
export async function transaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
