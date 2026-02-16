/**
 * SMS Notification Module (Stub)
 *
 * Integration target: Africa's Talking SMS API
 * This module is ready for activation once API credentials are configured.
 *
 * Required env vars:
 *   AFRICASTALKING_API_KEY
 *   AFRICASTALKING_USERNAME
 */

export interface SmsMessage {
  to: string;
  message: string;
}

export async function sendSms(msg: SmsMessage): Promise<{ success: boolean; messageId?: string }> {
  console.log(`[SMS Stub] Would send to ${msg.to}: ${msg.message}`);

  // TODO: Replace with actual Africa's Talking API call
  // const response = await fetch('https://api.africastalking.com/version1/messaging', {
  //   method: 'POST',
  //   headers: {
  //     'apiKey': process.env.AFRICASTALKING_API_KEY!,
  //     'Content-Type': 'application/x-www-form-urlencoded',
  //   },
  //   body: new URLSearchParams({
  //     username: process.env.AFRICASTALKING_USERNAME!,
  //     to: msg.to,
  //     message: msg.message,
  //   }),
  // });

  return { success: true };
}

export function formatBookingConfirmation(
  businessName: string,
  serviceName: string,
  date: string,
  time: string
): string {
  return `Your appointment at ${businessName} for ${serviceName} on ${date} at ${time} has been confirmed. - SalonBook`;
}
