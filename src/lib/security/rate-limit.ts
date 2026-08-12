import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { queryOne } from "@/lib/db";

const MINIMUM_HMAC_SECRET_BYTES = 32;
const MAX_LIMIT = 10_000;
const MAX_WINDOW_SECONDS = 86_400;
const MAX_BASE_SCOPE_LENGTH = 54;
const CLEANUP_INTERVAL_REQUESTS = 32;
const CLEANUP_BATCH_SIZE = 250;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const IDENTITY_KIND_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const DISALLOWED_HMAC_SECRETS = new Set([
  "change-me",
  "changeme",
  "secret",
  "your-separate-rate-limit-key-min-32-bytes",
]);

let requestsUntilCleanup = 0;

export interface RateLimitPolicy {
  scope: string;
  /** Strict quota for one trusted-network + submitted-identity pair. */
  limit: number;
  windowSeconds: number;
  /** Higher ceiling shared by every caller on one trusted network. */
  networkLimit?: number;
  /** Higher distributed-abuse ceiling for one submitted identity. */
  principalLimit?: number;
}

export interface RateLimitIdentity {
  kind: string;
  value: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitRow {
  exceeded: boolean;
  max_count: number | string;
  retry_after_seconds: number | string;
}

export class RateLimitUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Rate limiting is temporarily unavailable", options);
    this.name = "RateLimitUnavailableError";
  }
}

export const BUSINESS_LOGIN_RATE_LIMIT = Object.freeze({
  scope: "auth.business.login",
  limit: 10,
  networkLimit: 100,
  principalLimit: 50,
  windowSeconds: 15 * 60,
}) satisfies RateLimitPolicy;

export const CUSTOMER_LOGIN_RATE_LIMIT = Object.freeze({
  scope: "auth.customer.login",
  limit: 10,
  networkLimit: 100,
  principalLimit: 50,
  windowSeconds: 15 * 60,
}) satisfies RateLimitPolicy;

export const ADMIN_LOGIN_RATE_LIMIT = Object.freeze({
  scope: "auth.admin.login",
  limit: 5,
  networkLimit: 50,
  principalLimit: 25,
  windowSeconds: 15 * 60,
}) satisfies RateLimitPolicy;

export const BUSINESS_SIGNUP_RATE_LIMIT = Object.freeze({
  scope: "auth.business.signup",
  limit: 5,
  networkLimit: 30,
  windowSeconds: 60 * 60,
}) satisfies RateLimitPolicy;

export const CUSTOMER_SIGNUP_RATE_LIMIT = Object.freeze({
  scope: "auth.customer.signup",
  limit: 5,
  networkLimit: 30,
  principalLimit: 20,
  windowSeconds: 60 * 60,
}) satisfies RateLimitPolicy;

export const PUBLIC_BOOKING_RATE_LIMIT = Object.freeze({
  scope: "booking.public.create",
  limit: 10,
  networkLimit: 100,
  windowSeconds: 10 * 60,
}) satisfies RateLimitPolicy;

const CONSUME_RATE_LIMIT_SQL = `
  WITH request_clock AS (
    SELECT clock_timestamp() AS now_at
  ),
  buckets AS (
    SELECT scope, identifier_hash, quota_limit
    FROM unnest($1::text[], $2::text[], $3::int[])
      AS bucket(scope, identifier_hash, quota_limit)
  ),
  settings AS (
    SELECT
      request_clock.now_at,
      to_timestamp(
        floor(extract(epoch FROM request_clock.now_at) / $4::int) * $4::int
      ) AS window_started_at
    FROM request_clock
  ),
  cleanup AS (
    DELETE FROM public.rate_limit_windows
    WHERE ctid IN (
      SELECT ctid
      FROM public.rate_limit_windows
      WHERE expires_at < (SELECT now_at FROM settings)
      ORDER BY expires_at
      LIMIT CASE WHEN $5::boolean THEN ${CLEANUP_BATCH_SIZE} ELSE 0 END
      FOR UPDATE SKIP LOCKED
    )
    RETURNING 1
  ),
  consumed AS (
    INSERT INTO public.rate_limit_windows (
      scope,
      identifier_hash,
      window_started_at,
      request_count,
      expires_at
    )
    SELECT
      buckets.scope,
      buckets.identifier_hash,
      settings.window_started_at,
      1,
      settings.window_started_at + make_interval(secs => $4::int * 2)
    FROM buckets
    CROSS JOIN settings
    ON CONFLICT (scope, identifier_hash, window_started_at)
    DO UPDATE SET
      request_count = LEAST(
        public.rate_limit_windows.request_count + 1,
        (
          SELECT quota_limit + 1
          FROM buckets
          WHERE buckets.scope = EXCLUDED.scope
            AND buckets.identifier_hash = EXCLUDED.identifier_hash
        )
      ),
      expires_at = GREATEST(
        public.rate_limit_windows.expires_at,
        EXCLUDED.expires_at
      )
    RETURNING scope, identifier_hash, request_count
  )
  SELECT
    COALESCE(BOOL_OR(consumed.request_count > buckets.quota_limit), false)
      AS exceeded,
    COALESCE(MAX(request_count), 0)::int AS max_count,
    CEIL(
      EXTRACT(
        EPOCH FROM (
          (SELECT window_started_at FROM settings)
          + make_interval(secs => $4::int)
          - clock_timestamp()
        )
      )
    )::int AS retry_after_seconds
  FROM consumed
  JOIN buckets USING (scope, identifier_hash)
`;

function getHmacSecret(): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET;
  if (
    !secret ||
    secret !== secret.trim() ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_HMAC_SECRET_BYTES ||
    DISALLOWED_HMAC_SECRETS.has(secret.toLowerCase()) ||
    secret === process.env.JWT_SECRET
  ) {
    throw new RateLimitUnavailableError();
  }
  return secret;
}

function assertPolicy(policy: RateLimitPolicy): void {
  if (
    !SCOPE_PATTERN.test(policy.scope) ||
    policy.scope.length > MAX_BASE_SCOPE_LENGTH ||
    !Number.isInteger(policy.limit) ||
    policy.limit < 1 ||
    policy.limit > MAX_LIMIT ||
    (policy.networkLimit !== undefined &&
      (!Number.isInteger(policy.networkLimit) ||
        policy.networkLimit < policy.limit ||
        policy.networkLimit > MAX_LIMIT)) ||
    (policy.principalLimit !== undefined &&
      (!Number.isInteger(policy.principalLimit) ||
        policy.principalLimit < policy.limit ||
        policy.principalLimit > MAX_LIMIT)) ||
    !Number.isInteger(policy.windowSeconds) ||
    policy.windowSeconds < 1 ||
    policy.windowSeconds > MAX_WINDOW_SECONDS
  ) {
    throw new RateLimitUnavailableError();
  }
}

function getNetworkIdentity(request: Request): string {
  if (process.env.NODE_ENV === "production") {
    if (process.env.VERCEL !== "1") {
      throw new RateLimitUnavailableError();
    }
    const forwarded = request.headers.get("x-vercel-forwarded-for");
    const candidate = forwarded?.split(",", 1)[0]?.trim();
    if (!candidate || isIP(candidate) === 0) {
      throw new RateLimitUnavailableError();
    }
    return candidate.toLowerCase();
  }

  // Local development and tests have no trusted proxy boundary. A constant
  // identity is deliberately conservative and ignores spoofable proxy headers.
  return "local-development-client";
}

function hashIdentity(
  secret: string,
  scope: string,
  identity: RateLimitIdentity
): string {
  if (
    !IDENTITY_KIND_PATTERN.test(identity.kind) ||
    typeof identity.value !== "string" ||
    identity.value.length < 1 ||
    identity.value.length > 512
  ) {
    throw new RateLimitUnavailableError();
  }

  return createHmac("sha256", secret)
    .update("salonbook-rate-limit-v1\0")
    .update(scope)
    .update("\0")
    .update(identity.kind)
    .update("\0")
    .update(identity.value)
    .digest("hex");
}

function shouldRunCleanup(): boolean {
  if (requestsUntilCleanup <= 0) {
    requestsUntilCleanup = CLEANUP_INTERVAL_REQUESTS - 1;
    return true;
  }
  requestsUntilCleanup -= 1;
  return false;
}

function boundedRetryAfter(value: unknown, windowSeconds: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return windowSeconds;
  return Math.max(1, Math.min(windowSeconds, Math.ceil(parsed)));
}

interface QuotaBucket {
  scope: string;
  identifierHash: string;
  limit: number;
}

async function consumeQuotaBuckets(
  buckets: QuotaBucket[],
  windowSeconds: number,
  cleanup: boolean
): Promise<RateLimitResult> {
  const row = await queryOne<RateLimitRow>(CONSUME_RATE_LIMIT_SQL, [
    buckets.map((bucket) => bucket.scope),
    buckets.map((bucket) => bucket.identifierHash),
    buckets.map((bucket) => bucket.limit),
    windowSeconds,
    cleanup,
  ]);
  if (!row) throw new RateLimitUnavailableError();
  const count = Number(row.max_count);
  if (!Number.isInteger(count) || count < 1 || typeof row.exceeded !== "boolean") {
    throw new RateLimitUnavailableError();
  }
  return {
    allowed: !row.exceeded,
    retryAfterSeconds: boundedRetryAfter(
      row.retry_after_seconds,
      windowSeconds
    ),
  };
}

/**
 * Consume the shared trusted-network ceiling before creating any
 * principal-specific rows. Then enforce the strict network/principal pair and,
 * where configured, a distributed-principal ceiling. A blocked network cannot
 * amplify storage by rotating identities, and a blocked pair cannot burn a
 * victim's broader quota. Only keyed HMAC digests cross the database boundary.
 */
export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  additionalIdentities: RateLimitIdentity[] = []
): Promise<RateLimitResult> {
  try {
    assertPolicy(policy);
    const secret = getHmacSecret();
    const network = getNetworkIdentity(request);
    const networkScope = `${policy.scope}.network`;
    const pairScope = `${policy.scope}.pair`;
    const principalScope = `${policy.scope}.principal`;
    const networkHash = hashIdentity(secret, networkScope, {
      kind: "network",
      value: network,
    });
    // Additional quotas bind the submitted identity to the trusted network.
    // An unrelated network can no longer burn a victim's global phone/email
    // allowance, while repeated abuse of the same pair is still constrained.
    const networkLimit = policy.networkLimit ?? policy.limit;
    const networkBuckets = new Map<string, QuotaBucket>();
    const pairBuckets = new Map<string, QuotaBucket>();
    const principalBuckets = new Map<string, QuotaBucket>();
    const addBucket = (
      target: Map<string, QuotaBucket>,
      scope: string,
      identifierHash: string,
      limit: number
    ) => {
      target.set(`${scope}:${identifierHash}`, { scope, identifierHash, limit });
    };
    addBucket(networkBuckets, networkScope, networkHash, networkLimit);

    for (const identity of additionalIdentities) {
      addBucket(
        pairBuckets,
        pairScope,
        hashIdentity(secret, pairScope, {
          kind: "pair",
          value: `${network}\0${identity.kind}\0${identity.value}`,
        }),
        policy.limit
      );
      if (policy.principalLimit !== undefined) {
        addBucket(
          principalBuckets,
          principalScope,
          hashIdentity(secret, principalScope, {
            kind: "principal",
            value: `${identity.kind}\0${identity.value}`,
          }),
          policy.principalLimit
        );
      }
    }

    const networkResult = await consumeQuotaBuckets(
      [...networkBuckets.values()],
      policy.windowSeconds,
      shouldRunCleanup()
    );
    if (!networkResult.allowed) return networkResult;

    let pairResult: RateLimitResult | undefined;
    if (pairBuckets.size > 0) {
      pairResult = await consumeQuotaBuckets(
        [...pairBuckets.values()],
        policy.windowSeconds,
        false
      );
      if (!pairResult.allowed) return pairResult;
    }

    if (principalBuckets.size > 0) {
      return await consumeQuotaBuckets(
        [...principalBuckets.values()],
        policy.windowSeconds,
        false
      );
    }

    return pairResult ?? networkResult;
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) throw error;
    throw new RateLimitUnavailableError({ cause: error });
  }
}

export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
        "Cache-Control": "no-store",
      },
    }
  );
}

export function rateLimitUnavailableResponse(): Response {
  return Response.json(
    { error: "Request protection is temporarily unavailable. Please try again." },
    {
      status: 503,
      headers: { "Retry-After": "30", "Cache-Control": "no-store" },
    }
  );
}
