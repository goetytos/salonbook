import { queryOne } from "@/lib/db";
import { sendSms, type SmsSendResult } from "@/lib/modules/sms";
import { normalizeKenyanPhone } from "@/lib/validation";
import type { NotificationLog } from "@/types";

/** Log a notification event. Recipient is retained by the existing audit schema. */
export async function logNotification(data: {
  type: string;
  recipient: string;
  channel: "sms" | "email" | "whatsapp";
  status: string;
  booking_id?: string;
  business_id?: string;
  payload?: Record<string, unknown>;
  error_msg?: string;
}): Promise<NotificationLog> {
  const result = await queryOne<NotificationLog>(
    `INSERT INTO notification_logs (type, recipient, channel, status, booking_id, business_id, payload, error_msg)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.type,
      data.recipient,
      data.channel,
      data.status,
      data.booking_id || null,
      data.business_id || null,
      JSON.stringify(data.payload || {}),
      data.error_msg || null,
    ]
  );
  if (!result) throw new Error("Failed to log notification");
  return result;
}

function auditRecipient(phone: string): string {
  return normalizeKenyanPhone(phone) ?? "invalid-recipient";
}

function auditPayload(result: SmsSendResult): Record<string, unknown> {
  return {
    provider: result.provider,
    ...(result.messageId ? { provider_message_id: result.messageId } : {}),
  };
}

async function sendAndLogBookingSms(data: {
  type:
    | "booking_confirmation"
    | "booking_cancellation"
    | "booking_owner_alert";
  bookingId: string;
  businessId: string;
  customerPhone: string;
  message: string;
}): Promise<SmsSendResult> {
  const result = await sendSms({ to: data.customerPhone, message: data.message });

  await logNotification({
    type: data.type,
    recipient: auditRecipient(data.customerPhone),
    channel: "sms",
    status: result.status,
    booking_id: data.bookingId,
    business_id: data.businessId,
    payload: auditPayload(result),
    error_msg: result.errorCode,
  });

  return result;
}

/** Submit and audit a booking confirmation without claiming handset delivery. */
export async function sendBookingConfirmation(
  bookingId: string,
  businessId: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<SmsSendResult> {
  const message = `Hi ${customerName}, your booking for ${serviceName} on ${date} at ${time} is confirmed!`;

  return sendAndLogBookingSms({
    type: "booking_confirmation",
    bookingId,
    businessId,
    customerPhone,
    message,
  });
}

/** Submit and audit a booking cancellation without claiming handset delivery. */
export async function sendBookingCancellation(
  bookingId: string,
  businessId: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<SmsSendResult> {
  const message = `Hi ${customerName}, your booking for ${serviceName} on ${date} at ${time} has been cancelled.`;

  return sendAndLogBookingSms({
    type: "booking_cancellation",
    bookingId,
    businessId,
    customerPhone,
    message,
  });
}

/** Submit and audit a new-booking alert to the business owner. */
export async function sendBookingOwnerAlert(
  bookingId: string,
  businessId: string,
  ownerPhone: string,
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<SmsSendResult> {
  const message = `New SalonBook booking: ${customerName}, ${serviceName}, ${date} at ${time}.`;

  return sendAndLogBookingSms({
    type: "booking_owner_alert",
    bookingId,
    businessId,
    customerPhone: ownerPhone,
    message,
  });
}
