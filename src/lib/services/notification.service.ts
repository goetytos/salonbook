import { queryOne } from "@/lib/db";
import type { NotificationLog } from "@/types";

/** Log a notification event */
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

/** Send booking confirmation (stub — logs the event) */
export async function sendBookingConfirmation(
  bookingId: string,
  businessId: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<void> {
  const message = `Hi ${customerName}, your booking for ${serviceName} on ${date} at ${time} is confirmed!`;

  // Stub: log to console and notification_logs
  console.log(`[SMS Stub] To: ${customerPhone} — ${message}`);

  await logNotification({
    type: "booking_confirmation",
    recipient: customerPhone,
    channel: "sms",
    status: "stub_sent",
    booking_id: bookingId,
    business_id: businessId,
    payload: { message, customer_name: customerName, service: serviceName, date, time },
  });
}

/** Send booking cancellation notification (stub) */
export async function sendBookingCancellation(
  bookingId: string,
  businessId: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<void> {
  const message = `Hi ${customerName}, your booking for ${serviceName} on ${date} at ${time} has been cancelled.`;

  console.log(`[SMS Stub] To: ${customerPhone} — ${message}`);

  await logNotification({
    type: "booking_cancellation",
    recipient: customerPhone,
    channel: "sms",
    status: "stub_sent",
    booking_id: bookingId,
    business_id: businessId,
    payload: { message, customer_name: customerName, service: serviceName, date, time },
  });
}
