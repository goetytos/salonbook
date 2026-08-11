const SUPABASE_HOST_SUFFIXES = [".supabase.co", ".supabase.com"];
const SSL_QUERY_KEYS = [
  "ssl",
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "uselibpqcompat",
] as const;

export interface DatabaseConnectionConfig {
  connectionString: string;
  ssl?: {
    ca: string;
    rejectUnauthorized: true;
  };
}

function normalizeConnectionString(value: string | undefined): string {
  const normalized = value?.replace(/\\n$/, "").trim();
  if (!normalized) {
    throw new Error("DATABASE_URL is required for database operations");
  }
  return normalized;
}

function isSupabaseHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "supabase.co" ||
    normalized === "supabase.com" ||
    SUPABASE_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function normalizeCertificate(value: string | undefined): string {
  const certificate = value?.replace(/\\n/g, "\n").trim();
  if (
    !certificate ||
    !certificate.startsWith("-----BEGIN CERTIFICATE-----") ||
    !certificate.endsWith("-----END CERTIFICATE-----")
  ) {
    throw new Error("SUPABASE_DB_CA_CERT is required for Supabase database operations");
  }
  return certificate;
}

/** Build a strict, CA-verified database connection without exposing credentials. */
export function databaseConnectionConfig(
  rawConnectionString: string | undefined = process.env.DATABASE_URL,
  rawCaCertificate: string | undefined = process.env.SUPABASE_DB_CA_CERT
): DatabaseConnectionConfig {
  const connectionString = normalizeConnectionString(rawConnectionString);
  let connectionUrl: URL;
  try {
    connectionUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!['postgres:', 'postgresql:'].includes(connectionUrl.protocol)) {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  }

  if (!isSupabaseHostname(connectionUrl.hostname)) {
    return { connectionString };
  }

  const ca = normalizeCertificate(rawCaCertificate);
  for (const key of SSL_QUERY_KEYS) connectionUrl.searchParams.delete(key);

  return {
    connectionString: connectionUrl.toString(),
    ssl: { ca, rejectUnauthorized: true },
  };
}
