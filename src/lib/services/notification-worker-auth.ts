import { createHash, timingSafeEqual } from "node:crypto";

const MINIMUM_SECRET_BYTES = 32;
const MAXIMUM_SECRET_BYTES = 512;
const MAXIMUM_AUTHORIZATION_BYTES = 1_024;

export type NotificationWorkerAuthorization =
  | "authorized"
  | "unauthorized"
  | "not_configured";

function validConfiguredSecret(value: string | undefined): value is string {
  if (!value || !/^[\x21-\x7E]+$/.test(value)) return false;
  const length = Buffer.byteLength(value, "utf8");
  return length >= MINIMUM_SECRET_BYTES && length <= MAXIMUM_SECRET_BYTES;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Validate the Vercel-standard Bearer CRON_SECRET in constant-time digests. */
export function authorizeNotificationWorker(
  authorizationHeader: string | null
): NotificationWorkerAuthorization {
  const configuredSecret = process.env.CRON_SECRET;
  if (!validConfiguredSecret(configuredSecret)) return "not_configured";

  const header = authorizationHeader || "";
  const headerIsBounded =
    Buffer.byteLength(header, "utf8") <= MAXIMUM_AUTHORIZATION_BYTES;
  const match = /^Bearer ([\x21-\x7E]+)$/.exec(headerIsBounded ? header : "");
  const candidate = match?.[1] || "";

  const matches = timingSafeEqual(digest(configuredSecret), digest(candidate));
  return match && matches ? "authorized" : "unauthorized";
}
