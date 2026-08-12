import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryOneMock } = vi.hoisted(() => ({ queryOneMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ queryOne: queryOneMock }));

import {
  RateLimitUnavailableError,
  enforceRateLimit,
  rateLimitExceededResponse,
  rateLimitUnavailableResponse,
} from "@/lib/security/rate-limit";

const STRONG_RATE_LIMIT_SECRET =
  "salonbook-unit-rate-limit-secret-that-is-longer-than-thirty-two-bytes";
const POLICY = { scope: "test.login", limit: 5, windowSeconds: 900 };

afterEach(() => {
  queryOneMock.mockReset();
  vi.unstubAllEnvs();
});

describe("distributed rate limiter", () => {
  it("passes only HMAC digests for the trusted Vercel address and principal", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    queryOneMock.mockResolvedValue({
      exceeded: false,
      max_count: 1,
      retry_after_seconds: 742,
    });
    const request = new NextRequest("https://salonbook.test/api/auth/login", {
      headers: { "x-vercel-forwarded-for": "203.0.113.45, 10.0.0.1" },
    });

    const result = await enforceRateLimit(request, POLICY, [
      { kind: "email", value: "owner@example.test" },
    ]);

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 742 });
    expect(queryOneMock).toHaveBeenCalledTimes(2);
    const networkParameters = queryOneMock.mock.calls[0][1] as unknown[];
    const pairParameters = queryOneMock.mock.calls[1][1] as unknown[];
    expect(networkParameters[0]).toEqual(["test.login.network"]);
    expect(networkParameters[1]).toEqual([
      expect.stringMatching(/^[0-9a-f]{64}$/),
    ]);
    expect(networkParameters[2]).toEqual([5]);
    expect(networkParameters.slice(3)).toEqual([900, true]);
    expect(pairParameters[0]).toEqual(["test.login.pair"]);
    expect(pairParameters[1]).toEqual([
      expect.stringMatching(/^[0-9a-f]{64}$/),
    ]);
    expect(pairParameters[2]).toEqual([5]);
    expect(pairParameters.slice(3)).toEqual([900, false]);
    const serializedParameters = JSON.stringify([
      networkParameters,
      pairParameters,
    ]);
    expect(serializedParameters).not.toContain("203.0.113.45");
    expect(serializedParameters).not.toContain("owner@example.test");
  });

  it("fails closed when the HMAC key or trusted Vercel address is unavailable", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", "short");
    await expect(
      enforceRateLimit(new NextRequest("https://salonbook.test"), POLICY)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);

    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    await expect(
      enforceRateLimit(new NextRequest("https://salonbook.test"), POLICY)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(queryOneMock).not.toHaveBeenCalled();
  });

  it("rejects the documented placeholder and a reused JWT signing key", async () => {
    vi.stubEnv(
      "RATE_LIMIT_HMAC_SECRET",
      "your-separate-rate-limit-key-min-32-bytes"
    );
    await expect(
      enforceRateLimit(new NextRequest("https://salonbook.test"), POLICY)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);

    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    vi.stubEnv("JWT_SECRET", STRONG_RATE_LIMIT_SECRET);
    await expect(
      enforceRateLimit(new NextRequest("https://salonbook.test"), POLICY)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(queryOneMock).not.toHaveBeenCalled();
  });

  it("refuses a non-Vercel production proxy boundary", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");

    await expect(
      enforceRateLimit(
        new NextRequest("https://salonbook.test", {
          headers: { "x-forwarded-for": "203.0.113.45" },
        }),
        POLICY
      )
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(queryOneMock).not.toHaveBeenCalled();
  });

  it("ignores spoofable forwarding headers outside production", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "");
    queryOneMock.mockResolvedValue({
      exceeded: false,
      max_count: 1,
      retry_after_seconds: 60,
    });

    await enforceRateLimit(
      new NextRequest("https://salonbook.test", {
        headers: {
          "x-forwarded-for": "203.0.113.45",
          "x-vercel-forwarded-for": "198.51.100.20",
        },
      }),
      POLICY
    );

    const parameters = queryOneMock.mock.calls[0][1] as unknown[];
    expect(JSON.stringify(parameters)).not.toContain("203.0.113.45");
    expect(JSON.stringify(parameters)).not.toContain("198.51.100.20");
  });

  it("fails closed when PostgreSQL cannot consume the quota", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    queryOneMock.mockRejectedValue(new Error("database unavailable"));

    await expect(
      enforceRateLimit(new NextRequest("https://salonbook.test"), POLICY)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it("bounds Retry-After and emits non-cacheable 429 and 503 responses", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    queryOneMock.mockResolvedValue({
      exceeded: true,
      max_count: "6",
      retry_after_seconds: "999999",
    });

    const result = await enforceRateLimit(
      new NextRequest("https://salonbook.test"),
      POLICY
    );
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 900 });

    const exceeded = rateLimitExceededResponse(result);
    expect(exceeded.status).toBe(429);
    expect(exceeded.headers.get("Retry-After")).toBe("900");
    expect(exceeded.headers.get("Cache-Control")).toBe("no-store");

    const unavailable = rateLimitUnavailableResponse();
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("Retry-After")).toBe("30");
  });

  it("uses a higher shared-network ceiling and network-bound principal quotas", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    queryOneMock.mockResolvedValue({
      exceeded: false,
      max_count: 1,
      retry_after_seconds: 60,
    });
    const policy = {
      scope: "test.booking",
      limit: 10,
      networkLimit: 100,
      principalLimit: 50,
      windowSeconds: 600,
    };

    const result = await enforceRateLimit(
      new NextRequest("https://salonbook.test/api/bookings"),
      policy,
      [{ kind: "phone", value: "+254712345678" }]
    );

    expect(result.allowed).toBe(true);
    expect(queryOneMock).toHaveBeenCalledTimes(3);
    const networkParameters = queryOneMock.mock.calls[0][1] as unknown[];
    const pairParameters = queryOneMock.mock.calls[1][1] as unknown[];
    const principalParameters = queryOneMock.mock.calls[2][1] as unknown[];
    expect(networkParameters[0]).toEqual(["test.booking.network"]);
    expect(networkParameters[2]).toEqual([100]);
    expect(pairParameters[0]).toEqual(["test.booking.pair"]);
    expect(pairParameters[2]).toEqual([10]);
    expect(principalParameters[0]).toEqual(["test.booking.principal"]);
    expect(principalParameters[2]).toEqual([50]);
    const serialized = JSON.stringify(queryOneMock.mock.calls);
    expect(serialized).not.toContain("+254712345678");
    expect(serialized).not.toContain("local-development-client");
  });

  it("does not create identity buckets after the shared network is blocked", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    queryOneMock.mockResolvedValue({
      exceeded: true,
      max_count: 11,
      retry_after_seconds: 60,
    });

    const result = await enforceRateLimit(
      new NextRequest("https://salonbook.test/api/bookings"),
      {
        scope: "test.booking",
        limit: 10,
        networkLimit: 100,
        principalLimit: 50,
        windowSeconds: 600,
      },
      [{ kind: "phone", value: "+254712345678" }]
    );

    expect(result.allowed).toBe(false);
    expect(queryOneMock).toHaveBeenCalledOnce();
    expect((queryOneMock.mock.calls[0][1] as unknown[])[0]).toEqual([
      "test.booking.network",
    ]);
  });

  it("does not burn a principal quota after its strict pair is blocked", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
    queryOneMock
      .mockResolvedValueOnce({
        exceeded: false,
        max_count: 11,
        retry_after_seconds: 60,
      })
      .mockResolvedValueOnce({
        exceeded: true,
        max_count: 11,
        retry_after_seconds: 60,
      });

    const result = await enforceRateLimit(
      new NextRequest("https://salonbook.test/api/bookings"),
      {
        scope: "test.booking",
        limit: 10,
        networkLimit: 100,
        principalLimit: 50,
        windowSeconds: 600,
      },
      [{ kind: "phone", value: "+254712345678" }]
    );

    expect(result.allowed).toBe(false);
    expect(queryOneMock).toHaveBeenCalledTimes(2);
    expect((queryOneMock.mock.calls[0][1] as unknown[])[0]).toEqual([
      "test.booking.network",
    ]);
    expect((queryOneMock.mock.calls[1][1] as unknown[])[0]).toEqual([
      "test.booking.pair",
    ]);
  });
});
