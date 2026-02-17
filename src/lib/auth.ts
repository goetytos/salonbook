import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const JWT_SECRET: Secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export type UserRole = "business" | "customer";

export interface JWTPayload {
  id: string;
  email: string;
  role: UserRole;
  // Legacy alias — business routes read this
  businessId?: string;
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
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as string & SignOptions["expiresIn"] };
  return jwt.sign(payload as object, JWT_SECRET, options);
}

/** Verify and decode a JWT */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/** Parse the JWT from an Authorization header. Returns null if missing/invalid. */
export function getAuthPayload(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    return verifyToken(token);
  } catch {
    return null;
  }
}

/** Extract business ID from request (backward-compatible helper) */
export function getAuthBusinessId(request: NextRequest): string | null {
  const payload = getAuthPayload(request);
  if (!payload || payload.role !== "business") return null;
  return payload.businessId || payload.id;
}

/** Require business-owner authentication — throws Response if unauthorized */
export function requireAuth(request: NextRequest): string {
  const businessId = getAuthBusinessId(request);
  if (!businessId) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return businessId;
}

/** Require customer authentication — throws Response if unauthorized */
export function requireCustomerAuth(request: NextRequest): string {
  const payload = getAuthPayload(request);
  if (!payload || payload.role !== "customer") {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return payload.id;
}
