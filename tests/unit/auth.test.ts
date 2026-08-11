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
  signToken,
  verifyToken,
} from "@/lib/auth";

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

  it.each([undefined, "short", "dev-secret-change-in-production"])(
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
});
