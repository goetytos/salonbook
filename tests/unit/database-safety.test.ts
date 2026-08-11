import { afterEach, describe, expect, it } from "vitest";
import { assertSafeConnectedDatabase } from "../integration/database-safety";

const originalCi = process.env.CI;
const originalGithubActions = process.env.GITHUB_ACTIONS;
const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

afterEach(() => {
  if (originalCi === undefined) delete process.env.CI;
  else process.env.CI = originalCi;
  if (originalGithubActions === undefined) delete process.env.GITHUB_ACTIONS;
  else process.env.GITHUB_ACTIONS = originalGithubActions;
  if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
  else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
});

describe("integration database server safety", () => {
  it("rejects private-network PostgreSQL servers outside GitHub Actions", () => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5432/salonbook_test_ci";

    expect(() =>
      assertSafeConnectedDatabase("salonbook_test_ci", "172.18.0.2")
    ).toThrow(/server is not local/);
  });

  it("allows a service-container address only for a local GitHub Actions URL", () => {
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5432/salonbook_test_ci";

    expect(() =>
      assertSafeConnectedDatabase("salonbook_test_ci", "198.51.100.8")
    ).not.toThrow();
  });

  it("still rejects non-local URLs and non-test databases in CI", () => {
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    process.env.TEST_DATABASE_URL = "postgresql://example.com/salonbook_test_ci";

    expect(() =>
      assertSafeConnectedDatabase("salonbook_test_ci", "8.8.8.8")
    ).toThrow(/server is not local/);

    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5432/salonbook_test_ci";
    expect(() =>
      assertSafeConnectedDatabase("salonbook", "172.18.0.2")
    ).toThrow(/not a SalonBook test database/);
  });
});
