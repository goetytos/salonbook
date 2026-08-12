import type { PoolClient } from "pg";
import { query, transaction } from "@/lib/db";
import {
  getSmsTransportReadiness,
  type SmsSendResult,
} from "@/lib/modules/sms";
import {
  sendBookingCancellation,
  sendBookingConfirmation,
  sendBookingOwnerAlert,
} from "@/lib/services/notification.service";
import { logServerError } from "@/lib/server/logging";
import { validateUuid } from "@/lib/validation";

export const NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 5;
export const NOTIFICATION_OUTBOX_MAX_BATCH = 10;
const DEFAULT_BATCH_SIZE = 5;
const MAINTENANCE_BATCH_SIZE = 50;

export type NotificationOutboxType =
  | "booking_confirmation"
  | "booking_owner_alert"
  | "booking_cancellation";

export interface ClaimedNotificationJob {
  id: string;
  booking_id: string;
  type: NotificationOutboxType;
  attempt_count: number;
  lease_token: string;
  business_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  owner_phone: string | null;
  service_name: string | null;
  booking_date: string | null;
  booking_time: string | null;
}

export interface NotificationDispatchSummary {
  status: "processed" | "transport_unavailable";
  claimed: number;
  accepted: number;
  retried: number;
  dead: number;
  lease_lost: number;
}

function boundedBatchSize(value: number | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(value, NOTIFICATION_OUTBOX_MAX_BATCH);
}

/** Insert both booking-created notification intents inside the booking transaction. */
export async function enqueueBookingNotificationIntents(
  client: PoolClient,
  bookingId: string
): Promise<void> {
  const result = await client.query(
    `INSERT INTO notification_outbox (booking_id, type)
     VALUES ($1, 'booking_confirmation'), ($1, 'booking_owner_alert')
     RETURNING id`,
    [bookingId]
  );

  if (result.rowCount !== 2) {
    throw new Error("Booking notification intents were not durably inserted");
  }
}

/** Ensure the first cancellation transition has one durable customer intent. */
export async function enqueueBookingCancellationIntent(
  client: PoolClient,
  bookingId: string
): Promise<void> {
  const result = await client.query(
    `WITH inserted AS (
       INSERT INTO notification_outbox (booking_id, type)
       VALUES ($1, 'booking_cancellation')
       ON CONFLICT (booking_id, type) DO NOTHING
       RETURNING id
     )
     SELECT id FROM inserted
     UNION ALL
     SELECT id FROM notification_outbox
     WHERE booking_id = $1 AND type = 'booking_cancellation'
     LIMIT 1`,
    [bookingId]
  );

  if (result.rowCount !== 1) {
    throw new Error("Booking cancellation intent was not durably inserted");
  }
}

/**
 * Atomically lease a bounded job batch. The transaction commits before any
 * provider call, so workers never hold database row locks during the network.
 */
export async function claimNotificationOutboxJobs(options?: {
  batchSize?: number;
  bookingId?: string;
}): Promise<ClaimedNotificationJob[]> {
  const batchSize = boundedBatchSize(options?.batchSize);
  const bookingId = options?.bookingId;
  if (bookingId !== undefined && !validateUuid(bookingId)) {
    throw new Error("Invalid outbox booking identifier");
  }

  return transaction(async (client) => {
    // Creation alerts are meaningful only while the booking is still Booked.
    // Invalidate them before leasing so transport re-enabled after an outage
    // cannot send stale confirmations or owner alerts.
    await client.query(
      `WITH invalid AS (
         SELECT outbox.id
         FROM notification_outbox AS outbox
         JOIN bookings AS booking ON booking.id = outbox.booking_id
         WHERE outbox.status IN ('pending', 'processing')
           AND (
             (
               outbox.type IN ('booking_confirmation', 'booking_owner_alert')
               AND booking.status <> 'Booked'
             )
             OR
             (
               outbox.type = 'booking_cancellation'
               AND booking.status <> 'Cancelled'
             )
           )
         ORDER BY outbox.updated_at, outbox.id
         LIMIT $1
         FOR UPDATE OF outbox SKIP LOCKED
       )
       UPDATE notification_outbox AS outbox
       SET status = 'dead',
           lease_token = NULL,
           lease_expires_at = NULL,
           last_error_code = 'booking_not_booked',
           updated_at = CURRENT_TIMESTAMP
       FROM invalid
       WHERE outbox.id = invalid.id`,
      [MAINTENANCE_BATCH_SIZE]
    );

    await client.query(
      `WITH expired AS (
         SELECT id
         FROM notification_outbox
         WHERE status = 'processing'
           AND lease_expires_at <= CURRENT_TIMESTAMP
         ORDER BY lease_expires_at, id
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       UPDATE notification_outbox AS outbox
       SET status = CASE
             WHEN outbox.attempt_count >= $1
               OR outbox.created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
             THEN 'dead'
             ELSE 'pending'
           END,
           available_at = CASE
             WHEN outbox.attempt_count >= $1
               OR outbox.created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
             THEN outbox.available_at
             ELSE CURRENT_TIMESTAMP
           END,
           lease_token = NULL,
           lease_expires_at = NULL,
           last_error_code = CASE
             WHEN outbox.attempt_count >= $1 THEN 'attempts_exhausted'
             WHEN outbox.created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
               THEN 'stale_notification'
             ELSE 'lease_expired'
           END,
           updated_at = CURRENT_TIMESTAMP
       FROM expired
       WHERE outbox.id = expired.id`,
      [NOTIFICATION_OUTBOX_MAX_ATTEMPTS, MAINTENANCE_BATCH_SIZE]
    );

    await client.query(
      `WITH exhausted AS (
         SELECT id
         FROM notification_outbox
         WHERE status = 'pending'
           AND (
             attempt_count >= $1
             OR created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
           )
         ORDER BY created_at, id
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       UPDATE notification_outbox AS outbox
       SET status = 'dead',
           lease_token = NULL,
           lease_expires_at = NULL,
           last_error_code = CASE
             WHEN outbox.attempt_count >= $1 THEN 'attempts_exhausted'
             ELSE 'stale_notification'
           END,
           updated_at = CURRENT_TIMESTAMP
       FROM exhausted
       WHERE outbox.id = exhausted.id`,
      [NOTIFICATION_OUTBOX_MAX_ATTEMPTS, MAINTENANCE_BATCH_SIZE]
    );

    const result = await client.query<ClaimedNotificationJob>(
      `WITH candidates AS (
         SELECT outbox.id
         FROM notification_outbox AS outbox
         JOIN bookings AS booking ON booking.id = outbox.booking_id
         WHERE outbox.status = 'pending'
           AND (
             (
               outbox.type IN ('booking_confirmation', 'booking_owner_alert')
               AND booking.status = 'Booked'
             )
             OR
             (
               outbox.type = 'booking_cancellation'
               AND booking.status = 'Cancelled'
             )
           )
           AND outbox.available_at <= CURRENT_TIMESTAMP
           AND outbox.attempt_count < $1
           AND outbox.created_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
           AND ($3::uuid IS NULL OR outbox.booking_id = $3::uuid)
         ORDER BY outbox.available_at, outbox.created_at, outbox.id
         LIMIT $2
         FOR UPDATE OF outbox SKIP LOCKED
       ), claimed AS (
         UPDATE notification_outbox AS outbox
         SET status = 'processing',
             attempt_count = outbox.attempt_count + 1,
             lease_token = gen_random_uuid(),
             lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '2 minutes',
             last_error_code = NULL,
             updated_at = CURRENT_TIMESTAMP
         FROM candidates
         WHERE outbox.id = candidates.id
         RETURNING outbox.id, outbox.booking_id, outbox.type,
                   outbox.attempt_count, outbox.lease_token
       )
       SELECT claimed.id, claimed.booking_id, claimed.type,
              claimed.attempt_count, claimed.lease_token,
              booking.business_id,
              customer.name AS customer_name,
              customer.phone AS customer_phone,
              business.phone AS owner_phone,
              COALESCE(booking.service_name_snapshot, service.name) AS service_name,
              booking.date::text AS booking_date,
              to_char(booking.time, 'HH24:MI') AS booking_time
       FROM claimed
       LEFT JOIN bookings AS booking ON booking.id = claimed.booking_id
       LEFT JOIN customers AS customer ON customer.id = booking.customer_id
       LEFT JOIN businesses AS business ON business.id = booking.business_id
       LEFT JOIN services AS service ON service.id = booking.service_id
       ORDER BY claimed.id`,
      [NOTIFICATION_OUTBOX_MAX_ATTEMPTS, batchSize, bookingId || null]
    );

    return result.rows;
  });
}

async function updateClaimedJob(
  job: ClaimedNotificationJob,
  sql: string,
  additionalParams: unknown[] = []
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `${sql}
     WHERE id = $1 AND status = 'processing' AND lease_token = $2::uuid
     RETURNING id`,
    [job.id, job.lease_token, ...additionalParams]
  );
  return rows.length === 1;
}

async function markAccepted(
  job: ClaimedNotificationJob,
  messageId: string
): Promise<boolean> {
  return updateClaimedJob(
    job,
    `UPDATE notification_outbox
     SET status = 'accepted',
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = NULL,
         provider_message_id = $3,
         accepted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
    [messageId]
  );
}

async function markDead(
  job: ClaimedNotificationJob,
  errorCode: string
): Promise<boolean> {
  return updateClaimedJob(
    job,
    `UPDATE notification_outbox
     SET status = 'dead',
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = $3,
         provider_message_id = NULL,
         accepted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
    [errorCode]
  );
}

function retryDelaySeconds(attemptCount: number): number {
  return Math.min(60 * 5 ** Math.max(0, attemptCount - 1), 3_600);
}

async function markRetry(
  job: ClaimedNotificationJob,
  errorCode: string
): Promise<boolean> {
  return updateClaimedJob(
    job,
    `UPDATE notification_outbox
     SET status = 'pending',
         lease_token = NULL,
         lease_expires_at = NULL,
         available_at = CURRENT_TIMESTAMP + ($4::int * INTERVAL '1 second'),
         last_error_code = $3,
         provider_message_id = NULL,
         accepted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
    [errorCode, retryDelaySeconds(job.attempt_count)]
  );
}

async function releaseForUnavailableTransport(
  job: ClaimedNotificationJob,
  errorCode: string
): Promise<boolean> {
  return updateClaimedJob(
    job,
    `UPDATE notification_outbox
     SET status = 'pending',
         attempt_count = GREATEST(attempt_count - 1, 0),
         lease_token = NULL,
         lease_expires_at = NULL,
         available_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
         last_error_code = $3,
         provider_message_id = NULL,
         accepted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
    [errorCode]
  );
}

function hasResolvedCustomerJobData(job: ClaimedNotificationJob): boolean {
  return Boolean(
    job.business_id &&
      job.customer_name &&
      job.customer_phone &&
      job.service_name &&
      job.booking_date &&
      job.booking_time
  );
}

async function preflightClaimedJob(
  job: ClaimedNotificationJob
): Promise<"dispatchable" | "status_mismatch" | "lease_lost"> {
  const rows = await query<{ booking_status: string }>(
    `SELECT booking.status AS booking_status
     FROM notification_outbox AS outbox
     JOIN bookings AS booking ON booking.id = outbox.booking_id
     WHERE outbox.id = $1
       AND outbox.status = 'processing'
       AND outbox.lease_token = $2::uuid`,
    [job.id, job.lease_token]
  );
  const status = rows[0]?.booking_status;
  if (!status) return "lease_lost";

  const expectedStatus =
    job.type === "booking_cancellation" ? "Cancelled" : "Booked";
  return status === expectedStatus ? "dispatchable" : "status_mismatch";
}

async function submitNotificationJob(
  job: ClaimedNotificationJob
): Promise<SmsSendResult> {
  if (
    !hasResolvedCustomerJobData(job) ||
    (job.type === "booking_owner_alert" && !job.owner_phone)
  ) {
    return {
      success: false,
      status: "failed",
      provider: "none",
      errorCode: "invalid_message",
    };
  }

  if (job.type === "booking_confirmation") {
    return sendBookingConfirmation(
      job.booking_id,
      job.business_id!,
      job.customer_phone!,
      job.customer_name!,
      job.service_name!,
      job.booking_date!,
      job.booking_time!
    );
  }

  if (job.type === "booking_cancellation") {
    return sendBookingCancellation(
      job.booking_id,
      job.business_id!,
      job.customer_phone!,
      job.customer_name!,
      job.service_name!,
      job.booking_date!,
      job.booking_time!
    );
  }

  return sendBookingOwnerAlert(
    job.booking_id,
    job.business_id!,
    job.owner_phone!,
    job.customer_name!,
    job.service_name!,
    job.booking_date!,
    job.booking_time!
  );
}

async function settleFailedResult(
  job: ClaimedNotificationJob,
  result: SmsSendResult
): Promise<"retried" | "dead" | "lease_lost"> {
  const errorCode = result.errorCode || "notification_dispatch_error";

  if (result.status === "disabled" || result.status === "not_configured") {
    return (await releaseForUnavailableTransport(job, errorCode))
      ? "retried"
      : "lease_lost";
  }

  const terminal =
    result.status === "invalid_recipient" ||
    result.status === "invalid_message" ||
    job.attempt_count >= NOTIFICATION_OUTBOX_MAX_ATTEMPTS;
  if (terminal) {
    return (await markDead(job, errorCode)) ? "dead" : "lease_lost";
  }

  return (await markRetry(job, errorCode)) ? "retried" : "lease_lost";
}

/**
 * Dispatch a bounded batch with at-least-once submission semantics.
 * A crash after provider acceptance but before markAccepted can cause a retry.
 */
export async function dispatchNotificationOutbox(options?: {
  batchSize?: number;
  bookingId?: string;
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    status: "processed",
    claimed: 0,
    accepted: 0,
    retried: 0,
    dead: 0,
    lease_lost: 0,
  };

  const readiness = getSmsTransportReadiness();
  if (!readiness.ready) {
    return { ...summary, status: "transport_unavailable" };
  }

  const jobs = await claimNotificationOutboxJobs(options);
  summary.claimed = jobs.length;

  await Promise.all(
    jobs.map(async (job) => {
      let result: SmsSendResult;
      try {
        // Re-check the lease and current status immediately before network I/O.
        // A status transition clears the lease and suppresses stale creation
        // alerts; cancellation jobs are valid only while status is Cancelled.
        const preflight = await preflightClaimedJob(job);
        if (preflight === "lease_lost") {
          summary.lease_lost += 1;
          return;
        }
        if (preflight === "status_mismatch") {
          if (await markDead(job, "booking_status_mismatch")) {
            summary.dead += 1;
          } else {
            summary.lease_lost += 1;
          }
          return;
        }

        result = await submitNotificationJob(job);
      } catch (error) {
        logServerError("notification_outbox.dispatch", error);
        const outcome =
          job.attempt_count >= NOTIFICATION_OUTBOX_MAX_ATTEMPTS
            ? ((await markDead(job, "notification_dispatch_error"))
                ? "dead"
                : "lease_lost")
            : ((await markRetry(job, "notification_dispatch_error"))
                ? "retried"
                : "lease_lost");
        summary[outcome] += 1;
        return;
      }

      if (result.success && result.status === "accepted" && result.messageId) {
        if (await markAccepted(job, result.messageId)) summary.accepted += 1;
        else summary.lease_lost += 1;
        return;
      }

      const outcome = await settleFailedResult(job, result);
      summary[outcome] += 1;
    })
  );

  return summary;
}
