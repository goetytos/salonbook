const LOCAL_HOSTS = new Set(["", "localhost", "127.0.0.1", "::1", "[::1]"]);
const LOCAL_SERVER_ADDRESSES = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);

function isLocalHost(value: string): boolean {
  return LOCAL_HOSTS.has(value.toLowerCase());
}

function isTrustedGitHubActionsService(): boolean {
  if (
    process.env.CI !== "true" ||
    process.env.GITHUB_ACTIONS !== "true"
  ) {
    return false;
  }

  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl) return false;
  try {
    assertSafeTestDatabaseUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

/** Refuse to connect unless the target is unmistakably a local test database. */
export function assertSafeTestDatabaseUrl(rawUrl: string): string {
  const connectionString = rawUrl.trim();
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "Refusing integration database: TEST_DATABASE_URL must be a valid PostgreSQL URL"
    );
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(
      "Refusing integration database: TEST_DATABASE_URL must use PostgreSQL"
    );
  }

  if (!isLocalHost(url.hostname)) {
    throw new Error(
      "Refusing integration database: TEST_DATABASE_URL host must be local"
    );
  }

  for (const key of ["host", "hostaddr"]) {
    const override = url.searchParams.get(key);
    if (
      override &&
      !override.startsWith("/") &&
      !isLocalHost(override.replace(/^\[|\]$/g, ""))
    ) {
      throw new Error(
        `Refusing integration database: ${key} override must be local`
      );
    }
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!databaseName.toLowerCase().includes("salonbook_test")) {
    throw new Error(
      "Refusing integration database: database name must contain salonbook_test"
    );
  }

  return connectionString;
}

/** Make hostless local URLs use PostgreSQL's standard Unix socket with node-postgres. */
export function safeTestDatabaseConnectionString(rawUrl: string): string {
  const connectionString = assertSafeTestDatabaseUrl(rawUrl);
  const url = new URL(connectionString);

  if (!url.hostname && !url.searchParams.has("host")) {
    url.searchParams.set("host", "/var/run/postgresql");
    return url.toString();
  }

  return connectionString;
}

/** Verify the server-reported target before migrations or destructive cleanup. */
export function assertSafeConnectedDatabase(
  databaseName: string,
  serverAddress: string | null
): void {
  if (!databaseName.toLowerCase().includes("salonbook_test")) {
    throw new Error(
      "Refusing integration database: connected database name is not a SalonBook test database"
    );
  }

  // PostgreSQL reports NULL for a local Unix-domain socket connection.
  if (
    serverAddress !== null &&
    !LOCAL_SERVER_ADDRESSES.has(serverAddress) &&
    !isTrustedGitHubActionsService()
  ) {
    throw new Error(
      "Refusing integration database: connected PostgreSQL server is not local"
    );
  }
}
