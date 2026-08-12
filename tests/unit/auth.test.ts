import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryOneMock } = vi.hoisted(() => ({
  queryOneMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryOne: queryOneMock,
}));

import {
  getAuthBusinessId,
  getAuthPayload,
  requireAdminAuth,
  requireAuth,
  requireCustomerAuth,
  signToken,
  verifyToken,
} from "@/lib/auth";
import { SESSION_COOKIE_NAMES } from "@/lib/auth-session";

const strongSecret = "salonbook-test-secret-that-is-more-than-32-bytes";

afterEach(() => {
  vi.unstubAllEnvs();
  queryOneMock.mockReset();
});

describe("JWT authentication", () => {
  it("round-trips a constrained business token", () => {
    vi.stubEnv("JWT_SECRET", strongSecret);

    const token = signToken({
      id: "business-1",
      businessId: "business-1",
      email: "owner@example.com",
      role: "business",
    });

    expect(verifyToken(token)).toMatchObject({
      id: "business-1",
      businessId: "business-1",
      email: "owner@example.com",
      role: "business",
    });
  });

  it.each([
    undefined,
    "short",
    "dev-secret-change-in-production",
    "your-secret-key-min-32-characters-long",
  ])(
    "fails closed for an unsafe secret (%s)",
    (secret) => {
      if (secret === undefined) vi.stubEnv("JWT_SECRET", "");
      else vi.stubEnv("JWT_SECRET", secret);

      expect(() =>
        signToken({ id: "1", email: "owner@example.com", role: "business" })
      ).toThrow(/JWT_SECRET/);
    }
  );

  it("rejects tokens signed with an unapproved algorithm", () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const token = jwt.sign(
      { id: "1", email: "owner@example.com", role: "business" },
      strongSecret,
      {
        algorithm: "HS384",
        issuer: "salonbook",
        audience: "salonbook-web",
      }
    );

    expect(() => verifyToken(token)).toThrow();
  });

  it("extracts only the role authorized for a request", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const businessToken = signToken({
      id: "business-1",
      email: "owner@example.com",
      role: "business",
    });
    const request = new NextRequest("https://salonbook.test/api/auth/me", {
      headers: { authorization: `Bearer ${businessToken}` },
    });

    expect(getAuthPayload(request)?.role).toBe("business");
    expect(getAuthBusinessId(request)).toBe("business-1");
    await expect(requireAdminAuth(request)).rejects.toBeInstanceOf(Response);
  });

  it("returns null for malformed bearer tokens", () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const request = new NextRequest("https://salonbook.test/api/auth/me", {
      headers: { authorization: "Bearer definitely-not-a-jwt" },
    });

    expect(getAuthPayload(request)).toBeNull();
  });

  it("invalidates an old business token after the business is suspended", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    queryOneMock.mockResolvedValue({ status: "suspended" });
    const token = signToken({
      id: "business-1",
      email: "owner@example.com",
      role: "business",
    });
    const request = new NextRequest("https://salonbook.test/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(requireAuth(request)).rejects.toMatchObject({ status: 403 });
  });

  it("allows a pending business to finish setup", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    queryOneMock.mockResolvedValue({ status: "pending" });
    const token = signToken({
      id: "business-1",
      email: "owner@example.com",
      role: "business",
    });
    const request = new NextRequest("https://salonbook.test/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(requireAuth(request)).resolves.toBe("business-1");
  });

  it("accepts a role-specific HttpOnly session cookie on safe requests", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    queryOneMock.mockResolvedValue({ status: "active" });
    const token = signToken({
      id: "business-1",
      businessId: "business-1",
      role: "business",
    });
    const request = new NextRequest("https://salonbook.test/api/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAMES.business}=${token}`,
      },
    });

    await expect(requireAuth(request)).resolves.toBe("business-1");
  });

  it("rejects cookie-authenticated mutations without a same-origin intent signal", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const token = signToken({ id: "customer-1", role: "customer" });
    const request = new NextRequest(
      "https://salonbook.test/api/customer/bookings/booking-1",
      {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAMES.customer}=${token}`,
        },
      }
    );

    expect(() => requireCustomerAuth(request)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  it("rejects cookie-authenticated mutations from another origin", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const token = signToken({ id: "customer-1", role: "customer" });
    const request = new NextRequest(
      "https://salonbook.test/api/customer/bookings/booking-1",
      {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAMES.customer}=${token}`,
          origin: "https://attacker.example",
        },
      }
    );

    expect(() => requireCustomerAuth(request)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  it("allows same-origin cookie mutations and non-ambient bearer clients", () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const token = signToken({ id: "customer-1", role: "customer" });
    const cookieRequest = new NextRequest(
      "https://salonbook.test/api/customer/bookings/booking-1",
      {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAMES.customer}=${token}`,
          origin: "https://salonbook.test",
        },
      }
    );
    const bearerRequest = new NextRequest(
      "https://salonbook.test/api/customer/bookings/booking-1",
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
      }
    );

    expect(requireCustomerAuth(cookieRequest)).toBe("customer-1");
    expect(requireCustomerAuth(bearerRequest)).toBe("customer-1");
  });

  it("does not let a valid cookie for one role authorize another role", async () => {
    vi.stubEnv("JWT_SECRET", strongSecret);
    const token = signToken({ id: "customer-1", role: "customer" });
    const request = new NextRequest("https://salonbook.test/api/admin/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAMES.customer}=${token}`,
      },
    });

    await expect(requireAdminAuth(request)).rejects.toMatchObject({ status: 401 });
    expect(queryOneMock).not.toHaveBeenCalled();
  });
});
