/**
 * WhatsApp Notification Module (Stub)
 *
 * Integration target: WhatsApp Business Cloud API (Meta)
 * This module is ready for activation once API credentials are configured.
 *
 * Required env vars:
 *   WHATSAPP_API_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 */

export interface WhatsAppMessage {
  to: string;
  templateName: string;
  templateParams: string[];
}

export async function sendWhatsAppMessage(
  msg: WhatsAppMessage
): Promise<{ success: boolean }> {
  console.log(
    `[WhatsApp Stub] Would send template "${msg.templateName}" to ${msg.to}`
  );

  // TODO: Implement WhatsApp Cloud API call
  // POST https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages
  // Headers: Authorization: Bearer {WHATSAPP_API_TOKEN}
  // Body: { messaging_product: "whatsapp", to, type: "template", template: { name, language, components } }

  return { success: true };
}

export function sendBookingConfirmation(
  phone: string,
  businessName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<{ success: boolean }> {
  return sendWhatsAppMessage({
    to: phone,
    templateName: "booking_confirmation",
    templateParams: [businessName, serviceName, date, time],
  });
}
