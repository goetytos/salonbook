import { describe, expect, it } from "vitest";
import { databaseConnectionConfig } from "@/lib/db/config";

const CA = "-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----";

describe("database connection configuration", () => {
  it("requires a configured PostgreSQL URL", () => {
    expect(() => databaseConnectionConfig("", undefined)).toThrow(
      "DATABASE_URL is required"
    );
    expect(() => databaseConnectionConfig("https://example.com", undefined)).toThrow(
      "must use postgres:// or postgresql://"
    );
  });

  it("leaves non-Supabase connections to their URL-defined TLS policy", () => {
    expect(
      databaseConnectionConfig("postgresql://localhost/salonbook_test", undefined)
    ).toEqual({ connectionString: "postgresql://localhost/salonbook_test" });
  });

  it.each([
    "db.project-ref.supabase.co",
    "aws-0-eu-west-1.pooler.supabase.com",
  ])("requires the Supabase CA for %s", (hostname) => {
    expect(() =>
      databaseConnectionConfig(`postgresql://user:pass@${hostname}:6543/postgres`, undefined)
    ).toThrow("SUPABASE_DB_CA_CERT is required");
  });

  it("normalizes escaped CA newlines and verifies Supabase with that CA", () => {
    const config = databaseConnectionConfig(
      "postgresql://user:pass@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
      CA.replace(/\n/g, "\\n")
    );

    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it("removes URL SSL options that would override the strict CA configuration", () => {
    const config = databaseConnectionConfig(
      "postgresql://user:pass@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&sslrootcert=other&application_name=test",
      CA
    );
    const url = new URL(config.connectionString);

    expect(url.searchParams.get("sslmode")).toBeNull();
    expect(url.searchParams.get("sslrootcert")).toBeNull();
    expect(url.searchParams.get("application_name")).toBe("test");
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it("removes an accidental trailing escaped newline from the URL", () => {
    const config = databaseConnectionConfig(
      "postgresql://localhost/salonbook_test\\n",
      undefined
    );

    expect(config.connectionString).toBe("postgresql://localhost/salonbook_test");
  });
});
