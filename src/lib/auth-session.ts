import { NextResponse } from "next/server";

export type SessionRole = "business" | "customer" | "admin";

export const SESSION_COOKIE_NAMES: Record<SessionRole, string> = {
  business: "salonbook_business_session",
  customer: "salonbook_customer_session",
  admin: "salonbook_admin_session",
};

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Authentication endpoints create or clear ambient credentials, so they must
 * accept only deliberate same-origin JSON requests. This also blocks login
 * CSRF through cross-site simple requests such as text/plain forms or fetches.
 */
export function sameOriginJsonMutationGuard(request: Request): Response | null {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return Response.json(
      { error: "Content-Type must be application/json" },
      { status: 415, headers: { "Cache-Control": "no-store" } }
    );
  }

  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return Response.json(
        { error: "Cross-site request rejected" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch {
    return Response.json(
      { error: "Cross-site request rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  return null;
}

export const authenticationMutationGuard = sameOriginJsonMutationGuard;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}

/** Build an authentication response without exposing its JWT to JavaScript. */
export function authenticatedJsonResponse<T>(
  data: T,
  role: SessionRole,
  token: string,
  status: number = 200
): NextResponse<T> {
  const response = NextResponse.json(data, { status });
  response.cookies.set(SESSION_COOKIE_NAMES[role], token, sessionCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Clear one role-specific session. Logout is intentionally idempotent. */
export function clearedSessionResponse(role: SessionRole): NextResponse {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAMES[role], "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
