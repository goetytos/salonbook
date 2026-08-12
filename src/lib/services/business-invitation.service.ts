import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { transaction } from "@/lib/db";
import { validateEmail } from "@/lib/validation";

const INVITATION_TOKEN_BYTES = 32;
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const DEFAULT_BUSINESS_INVITATION_HOURS = 72;
export const MAX_BUSINESS_INVITATION_HOURS = 168;

export interface CreatedBusinessInvitation {
  invitation: {
    id: string;
    email: string;
    expires_at: string;
    created_at: string;
  };
  token: string;
}

interface LockedInvitation {
  id: string;
  email: string;
  revoked_at: string | null;
  consumed_at: string | null;
  expired: boolean;
}

export class BusinessInvitationError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 409 | 422 = 403
  ) {
    super(message);
    this.name = "BusinessInvitationError";
  }
}

/** Normalize exactly as the business-signup boundary does. */
export function normalizeBusinessInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Hash a raw capability token before any database interaction. */
export function digestBusinessInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function assertInvitationEmail(email: string): string {
  const normalized = normalizeBusinessInvitationEmail(email);
  if (
    normalized.length > 255 ||
    normalized.length < 3 ||
    !validateEmail(normalized)
  ) {
    throw new BusinessInvitationError("Enter a valid invitation email address.", 422);
  }
  return normalized;
}

function assertExpiryHours(hours: number): number {
  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > MAX_BUSINESS_INVITATION_HOURS
  ) {
    throw new BusinessInvitationError(
      `Invitation expiry must be between 1 and ${MAX_BUSINESS_INVITATION_HOURS} hours.`,
      422
    );
  }
  return hours;
}

/**
 * Create a one-time invitation and supersede any previous unused invitation
 * for the same normalized email. Only the digest crosses the database boundary.
 */
export async function createBusinessInvitation(
  adminId: string,
  email: string,
  expiresInHours: number = DEFAULT_BUSINESS_INVITATION_HOURS
): Promise<CreatedBusinessInvitation> {
  const normalizedEmail = assertInvitationEmail(email);
  const validHours = assertExpiryHours(expiresInHours);
  const token = randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
  const tokenDigest = digestBusinessInvitationToken(token);

  const invitation = await transaction(async (client) => {
    // Serialize replacement requests for one email even when no prior row exists.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended('salonbook:business-invite:' || $1, 0)
       )`,
      [normalizedEmail]
    );

    const existingBusiness = await client.query<{ id: string }>(
      "SELECT id FROM public.businesses WHERE lower(btrim(email)) = $1",
      [normalizedEmail]
    );
    if (existingBusiness.rows[0]) {
      throw new BusinessInvitationError(
        "A business account already uses this email address.",
        409
      );
    }

    await client.query(
      `UPDATE public.business_invitations
       SET revoked_at = CURRENT_TIMESTAMP,
           revoked_by_admin_id = $2,
           revocation_reason = 'superseded'
       WHERE email = $1
         AND revoked_at IS NULL
         AND consumed_at IS NULL`,
      [normalizedEmail, adminId]
    );

    const inserted = await client.query<
      CreatedBusinessInvitation["invitation"]
    >(
      `INSERT INTO public.business_invitations
         (email, token_digest, expires_at, created_by_admin_id)
       VALUES
         ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 hour'), $4)
       RETURNING id, email, expires_at, created_at`,
      [normalizedEmail, tokenDigest, validHours, adminId]
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("Failed to create business invitation");
    return row;
  });

  return { invitation, token };
}

/**
 * Redeem an invitation around the caller's business insert. The invitation row
 * lock, callback writes, and final consumption update share one transaction, so
 * a callback failure restores the invitation and concurrent requests permit
 * exactly one committed use.
 */
export async function redeemBusinessInvitation<T extends { businessId: string }>(
  rawToken: string,
  email: string,
  createBusiness: (client: PoolClient) => Promise<T>
): Promise<T> {
  const normalizedEmail = assertInvitationEmail(email);
  if (!INVITATION_TOKEN_PATTERN.test(rawToken)) {
    throw new BusinessInvitationError("A valid business invitation is required.");
  }
  const tokenDigest = digestBusinessInvitationToken(rawToken);

  return transaction(async (client) => {
    // Invitation generation and redemption take the same email-scoped lock.
    // This prevents a generator from checking for an account immediately
    // before a concurrent redemption creates that account.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended('salonbook:business-invite:' || $1, 0)
       )`,
      [normalizedEmail]
    );

    const locked = await client.query<LockedInvitation>(
      `SELECT id, email, revoked_at, consumed_at,
              (expires_at <= CURRENT_TIMESTAMP) AS expired
       FROM public.business_invitations
       WHERE token_digest = $1
       FOR UPDATE`,
      [tokenDigest]
    );
    const invitation = locked.rows[0];

    if (
      !invitation ||
      invitation.revoked_at !== null ||
      invitation.consumed_at !== null ||
      invitation.expired
    ) {
      throw new BusinessInvitationError(
        "This business invitation is invalid, expired, revoked, or already used."
      );
    }
    if (invitation.email !== normalizedEmail) {
      throw new BusinessInvitationError(
        "Use the email address this invitation was created for.",
        422
      );
    }

    const result = await createBusiness(client);
    const consumed = await client.query<{ id: string }>(
      `UPDATE public.business_invitations
       SET consumed_at = CURRENT_TIMESTAMP,
           business_id = $2
       WHERE id = $1
         AND revoked_at IS NULL
         AND consumed_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING id`,
      [invitation.id, result.businessId]
    );
    if (!consumed.rows[0]) {
      throw new BusinessInvitationError(
        "This business invitation is no longer available."
      );
    }
    return result;
  });
}
