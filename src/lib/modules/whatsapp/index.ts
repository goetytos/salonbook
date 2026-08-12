/**
 * WhatsApp remains intentionally unavailable until approved Meta templates,
 * credentials, consent handling, and delivery status callbacks exist.
 */

export interface WhatsAppMessage {
  to: string;
  templateName: string;
  templateParams: string[];
}

export interface WhatsAppDisabledResult {
  success: false;
  status: "disabled";
  errorCode: "integration_not_configured";
}

export async function sendWhatsAppMessage(
  _message: WhatsAppMessage
): Promise<WhatsAppDisabledResult> {
  return {
    success: false,
    status: "disabled",
    errorCode: "integration_not_configured",
  };
}

export function sendBookingConfirmation(
  phone: string,
  businessName: string,
  serviceName: string,
  date: string,
  time: string
): Promise<WhatsAppDisabledResult> {
  return sendWhatsAppMessage({
    to: phone,
    templateName: "booking_confirmation",
    templateParams: [businessName, serviceName, date, time],
  });
}
