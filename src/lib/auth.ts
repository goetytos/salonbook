import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import {
  SESSION_COOKIE_NAMES,
  type SessionRole,
} from "@/lib/auth-session";

const JWT_ALGORITHM = "HS256" as const;
const JWT_ISSUER = "salonbook";
const JWT_AUDIENCE = "salonbook-web";
const MINIMUM_JWT_SECRET_BYTES = 32;
const DISALLOWED_JWT_SECRETS = new Set([
  "dev-secret-change-in-production",
  "change-me",
  "changeme",
  "secret",
  "your-secret-key-min-32-characters-long",
]);

export type UserRole = "business" | "customer" | "admin";

export interface JWTPayload {
  id: string;
  email?: string;
  role: UserRole;
  // Legacy alias — business routes read this
  businessId?: string;
}

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;

  if (
    !secret ||
    secret !== secret.trim() ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_JWT_SECRET_BYTES ||
    DISALLOWED_JWT_SECRETS.has(secret.toLowerCase())
  ) {
    throw new Error(
      `JWT_SECRET must be configured with at least ${MINIMUM_JWT_SECRET_BYTES} bytes and must not be a placeholder`
    );
  }

  return secret;
}

function assertJwtPayload(payload: unknown): asserts payload is JWTPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }

  const candidate = payload as Record<string, unknown>;
  const validRole =
    candidate.role === "business" ||
    candidate.role === "customer" ||
    candidate.role === "admin";

  if (
    typeof candidate.id !== "string" ||
    candidate.id.trim().length === 0 ||
    (candidate.email !== undefined &&
      (typeof candidate.email !== "string" ||
        candidate.email.trim().length === 0 ||
        candidate.email.length > 320 ||
        !candidate.email.includes("@"))) ||
    !validRole ||
    (candidate.businessId !== undefined &&
      (typeof candidate.businessId !== "string" ||
        candidate.businessId.trim().length === 0))
  ) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }
}

/** Hash a plaintext password */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Verify a password against a hash */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Sign a JWT */
export function signToken(payload: JWTPayload): string {
  assertJwtPayload(payload);

  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };

  return jwt.sign(payload as object, getJwtSecret(), options);
}

/** Verify and decode a JWT */
export function verifyToken(token: string): JWTPayload {
  const payload = jwt.verify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  assertJwtPayload(payload);
  return payload;
}

function verifyPossibleToken(token: string | undefined): JWTPayload | null {
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

function bearerPayload(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyPossibleToken(authHeader.slice(7));
}

function cookiePayload(
  request: NextRequest,
  role: SessionRole
): JWTPayload | null {
  const payload = verifyPossibleToken(
    request.cookies.get(SESSION_COOKIE_NAMES[role])?.value
  );
  return payload?.role === role ? payload : null;
}

function rolePayload(
  request: NextRequest,
  role: SessionRole
): { payload: JWTPayload; source: "bearer" | "cookie" } | null {
  const bearer = bearerPayload(request);
  if (bearer?.role === role) return { payload: bearer, source: "bearer" };

  const cookie = cookiePayload(request, role);
  return cookie ? { payload: cookie, source: "cookie" } : null;
}

function isSafeRequestMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function requireRolePayload(
  request: NextRequest,
  role: SessionRole
): JWTPayload | null {
  const resolved = rolePayload(request, role);
  if (!resolved) return null;

  // Bearer credentials are not ambient. Cookie credentials are, so every
  // state-changing cookie-authenticated request must prove same-origin intent.
  if (
    resolved.source === "cookie" &&
    !isSafeRequestMethod(request.method) &&
    !hasSameOrigin(request)
  ) {
    throw new Response(JSON.stringify({ error: "Cross-site request rejected" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return resolved.payload;
}

/** Parse a supported bearer or role-specific session cookie. */
export function getAuthPayload(request: NextRequest): JWTPayload | null {
  return (
    bearerPayload(request) ||
    cookiePayload(request, "business") ||
    cookiePayload(request, "customer") ||
    cookiePayload(request, "admin")
  );
}

/** Extract business ID from request (backward-compatible helper) */
export function getAuthBusinessId(request: NextRequest): string | null {
  const payload = rolePayload(request, "business")?.payload;
  if (!payload) return null;
  return payload.businessId || payload.id;
}

/**
 * Resolve a business token against the current account lifecycle state.
 * Pending businesses may finish setup; suspended or deleted businesses cannot
 * keep using an older, otherwise-valid token.
 */
export async function getAuthorizedBusinessId(
  request: NextRequest
): Promise<string | null> {
  const businessId = getAuthBusinessId(request);
  if (!businessId) return null;

  const business = await queryOne<{ status: string }>(
    "SELECT status FROM businesses WHERE id = $1",
    [businessId]
  );

  return business && business.status !== "suspended" ? businessId : null;
}

/** Require business-owner authentication — throws Response if unauthorized */
export async function requireAuth(request: NextRequest): Promise<string> {
  const payload = requireRolePayload(request, "business");
  const tokenBusinessId = payload?.businessId || payload?.id || null;
  if (!tokenBusinessId) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const businessId = await getAuthorizedBusinessId(request);
  if (!businessId) {
    throw new Response(JSON.stringify({ error: "Business account is unavailable" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return businessId;
}

/** Require customer authentication — throws Response if unauthorized */
export function requireCustomerAuth(request: NextRequest): string {
  const payload = requireRolePayload(request, "customer");
  if (!payload) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return payload.id;
}

/** Require a still-existing admin account, invalidating stale deleted tokens. */
export async function requireAdminAuth(request: NextRequest): Promise<string> {
  const payload = requireRolePayload(request, "admin");
  if (!payload) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const admin = await queryOne<{ id: string }>(
    "SELECT id FROM admins WHERE id = $1",
    [payload.id]
  );
  if (!admin) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return admin.id;
}
