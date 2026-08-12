import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createInvitationMock, requireAdminAuthMock } = vi.hoisted(() => ({
  createInvitationMock: vi.fn(),
  requireAdminAuthMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminAuth: requireAdminAuthMock }));
vi.mock("@/lib/services/business-invitation.service", () => ({
  BusinessInvitationError: class BusinessInvitationError extends Error {
    constructor(message: string, public readonly status = 403) {
      super(message);
    }
  },
  DEFAULT_BUSINESS_INVITATION_HOURS: 72,
  createBusinessInvitation: createInvitationMock,
}));

import { POST } from "@/app/api/admin/business-invitations/route";

function request(
  origin = "https://salonbook.test",
  body: Record<string, unknown> = { email: "Owner@Studio.co.ke" }
) {
  return new NextRequest(
    "https://salonbook.test/api/admin/business-invitations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    }
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("admin business invitation route", () => {
  it("rejects cross-site generation before admin auth or mutation", async () => {
    const response = await POST(request("https://attacker.example"));

    expect(response.status).toBe(403);
    expect(requireAdminAuthMock).not.toHaveBeenCalled();
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("requires a current administrator", async () => {
    requireAdminAuthMock.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("returns a no-store fragment link and the raw token exactly once", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pilot.salonbook.test");
    requireAdminAuthMock.mockResolvedValue(
      "11111111-1111-4111-8111-111111111111"
    );
    const rawToken = "a".repeat(43);
    createInvitationMock.mockResolvedValue({
      invitation: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "owner@studio.co.ke",
        expires_at: "2026-08-15T12:00:00.000Z",
        created_at: "2026-08-12T12:00:00.000Z",
      },
      token: rawToken,
    });

    const response = await POST(
      request("https://salonbook.test", {
        email: "Owner@Studio.co.ke",
        expires_in_hours: 72,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(createInvitationMock).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "owner@studio.co.ke",
      72
    );
    expect(body.token).toBeUndefined();
    const link = new URL(body.signup_link);
    expect(link.origin).toBe("https://pilot.salonbook.test");
    expect(link.pathname).toBe("/auth/signup");
    expect(link.search).toBe("");
    expect(new URLSearchParams(link.hash.slice(1)).get("invite")).toBe(rawToken);
    expect(JSON.stringify(body.invitation)).not.toContain(rawToken);
    expect(JSON.stringify(body).split(rawToken)).toHaveLength(2);
  });
});
