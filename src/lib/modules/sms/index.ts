import { normalizeKenyanPhone } from "@/lib/validation";

const AFRICAS_TALKING_PRODUCTION_URL =
  "https://api.africastalking.com/version1/messaging";
const AFRICAS_TALKING_SANDBOX_URL =
  "https://api.sandbox.africastalking.com/version1/messaging";
const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_LENGTH = 480;
const MAX_PROVIDER_RESPONSE_LENGTH = 64 * 1024;

export interface SmsMessage {
  to: string;
  message: string;
}

export type SmsDeliveryStatus =
  | "accepted"
  | "disabled"
  | "not_configured"
  | "invalid_recipient"
  | "invalid_message"
  | "provider_rejected"
  | "failed";

export type SmsErrorCode =
  | "notifications_disabled"
  | "missing_configuration"
  | "invalid_recipient"
  | "invalid_message"
  | "request_timeout"
  | "network_error"
  | "provider_http_error"
  | "invalid_provider_response"
  | "provider_rejected";

export interface SmsSendResult {
  success: boolean;
  status: SmsDeliveryStatus;
  provider: "africastalking" | "none";
  messageId?: string;
  errorCode?: SmsErrorCode;
}

export type SmsTransportReadiness =
  | { ready: true; status: "ready" }
  | {
      ready: false;
      status: "disabled" | "not_configured";
      errorCode: "notifications_disabled" | "missing_configuration";
    };

interface AfricaTalkingConfig {
  apiKey: string;
  username: string;
  senderId?: string;
  endpoint: string;
  timeoutMs: number;
}

type ConfigResult =
  | { ready: true; config: AfricaTalkingConfig }
  | { ready: false; result: SmsSendResult };

function inactiveResult(
  status: "disabled" | "not_configured",
  errorCode: "notifications_disabled" | "missing_configuration"
): SmsSendResult {
  return {
    success: false,
    status,
    provider: status === "disabled" ? "none" : "africastalking",
    errorCode,
  };
}

function boundedSecret(
  value: string | undefined,
  maximumLength: number
): string | null {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    trimmed.length > maximumLength ||
    /[\x00-\x1F\x7F]/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function configuredTimeout(): number | null {
  const rawTimeout = process.env.AFRICASTALKING_TIMEOUT_MS?.trim();
  if (!rawTimeout) return DEFAULT_TIMEOUT_MS;
  if (!/^\d+$/.test(rawTimeout)) return null;

  const timeout = Number(rawTimeout);
  if (timeout < MIN_TIMEOUT_MS || timeout > MAX_TIMEOUT_MS) return null;
  return timeout;
}

function smsConfiguration(): ConfigResult {
  if (process.env.SMS_NOTIFICATIONS_ENABLED !== "true") {
    return {
      ready: false,
      result: inactiveResult("disabled", "notifications_disabled"),
    };
  }

  const apiKey = boundedSecret(process.env.AFRICASTALKING_API_KEY, 512);
  const username = boundedSecret(process.env.AFRICASTALKING_USERNAME, 128);
  const environment = process.env.AFRICASTALKING_ENVIRONMENT?.trim();
  const senderId = process.env.AFRICASTALKING_SENDER_ID?.trim();
  const timeoutMs = configuredTimeout();

  const isSandbox = environment === "sandbox";
  const isProduction = environment === "production";
  const validSenderId =
    senderId === undefined || /^[A-Za-z0-9_-]{1,11}$/.test(senderId);

  if (
    !apiKey ||
    !username ||
    (!isSandbox && !isProduction) ||
    !validSenderId ||
    timeoutMs === null ||
    (isSandbox && username !== "sandbox") ||
    (isProduction && !senderId)
  ) {
    return {
      ready: false,
      result: inactiveResult("not_configured", "missing_configuration"),
    };
  }

  return {
    ready: true,
    config: {
      apiKey,
      username,
      senderId,
      endpoint: isSandbox
        ? AFRICAS_TALKING_SANDBOX_URL
        : AFRICAS_TALKING_PRODUCTION_URL,
      timeoutMs,
    },
  };
}

/** Return only non-sensitive transport readiness for worker feature gating. */
export function getSmsTransportReadiness(): SmsTransportReadiness {
  const configuration = smsConfiguration();
  if (configuration.ready) return { ready: true, status: "ready" };

  return {
    ready: false,
    status:
      configuration.result.status === "disabled"
        ? "disabled"
        : "not_configured",
    errorCode:
      configuration.result.errorCode === "notifications_disabled"
        ? "notifications_disabled"
        : "missing_configuration",
  };
}

function validatedMessage(message: string): string | null {
  const trimmed = message.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_MESSAGE_LENGTH ||
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProviderResponse(
  value: unknown,
  expectedRecipient: string
):
  | { kind: "accepted"; messageId: string }
  | { kind: "rejected" }
  | { kind: "invalid" } {
  if (!isRecord(value) || !isRecord(value.SMSMessageData)) {
    return { kind: "invalid" };
  }

  const recipients = value.SMSMessageData.Recipients;
  if (!Array.isArray(recipients) || recipients.length !== 1) {
    return { kind: "invalid" };
  }

  const recipient = recipients[0];
  if (!isRecord(recipient) || recipient.number !== expectedRecipient) {
    return { kind: "invalid" };
  }

  const messageId = recipient.messageId;
  if (
    recipient.statusCode === 101 &&
    recipient.status === "Success" &&
    typeof messageId === "string" &&
    /^[A-Za-z0-9_-]{1,160}$/.test(messageId)
  ) {
    return { kind: "accepted", messageId };
  }

  if (
    typeof recipient.statusCode === "number" &&
    typeof recipient.status === "string"
  ) {
    return { kind: "rejected" };
  }

  return { kind: "invalid" };
}

async function readBoundedResponseBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let byteCount = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_PROVIDER_RESPONSE_LENGTH) {
      await reader.cancel().catch(() => undefined);
      throw new Error("oversized_provider_response");
    }
    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();
  return body;
}

/**
 * Submit one transactional SMS to Africa's Talking.
 *
 * "accepted" means the provider accepted the request. Delivery to the handset
 * requires a separate delivery-report callback, which is not implemented yet.
 */
export async function sendSms(message: SmsMessage): Promise<SmsSendResult> {
  const configuration = smsConfiguration();
  if (!configuration.ready) return configuration.result;

  const recipient = normalizeKenyanPhone(message.to);
  if (!recipient) {
    return {
      success: false,
      status: "invalid_recipient",
      provider: "africastalking",
      errorCode: "invalid_recipient",
    };
  }

  const content = validatedMessage(message.message);
  if (!content) {
    return {
      success: false,
      status: "invalid_message",
      provider: "africastalking",
      errorCode: "invalid_message",
    };
  }

  const body = new URLSearchParams({
    username: configuration.config.username,
    to: recipient,
    message: content,
    bulkSMSMode: "1",
    enqueue: "0",
  });
  if (configuration.config.senderId) {
    body.set("from", configuration.config.senderId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    configuration.config.timeoutMs
  );

  let response: Response | undefined;
  try {
    response = await fetch(configuration.config.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        apiKey: configuration.config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status !== 201) {
      return {
        success: false,
        status: "failed",
        provider: "africastalking",
        errorCode: "provider_http_error",
      };
    }

    const responseLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(responseLength) &&
      responseLength > MAX_PROVIDER_RESPONSE_LENGTH
    ) {
      await response.body?.cancel().catch(() => undefined);
      return {
        success: false,
        status: "failed",
        provider: "africastalking",
        errorCode: "invalid_provider_response",
      };
    }

    const rawPayload = await readBoundedResponseBody(response);
    const providerPayload = JSON.parse(rawPayload) as unknown;
    const result = parseProviderResponse(providerPayload, recipient);
    if (result.kind === "accepted") {
      return {
        success: true,
        status: "accepted",
        provider: "africastalking",
        messageId: result.messageId,
      };
    }

    if (result.kind === "rejected") {
      return {
        success: false,
        status: "provider_rejected",
        provider: "africastalking",
        errorCode: "provider_rejected",
      };
    }

    return {
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "invalid_provider_response",
    };
  } catch {
    return {
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: controller.signal.aborted
        ? "request_timeout"
        : response
          ? "invalid_provider_response"
          : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatBookingConfirmation(
  businessName: string,
  serviceName: string,
  date: string,
  time: string
): string {
  return `Your appointment at ${businessName} for ${serviceName} on ${date} at ${time} has been confirmed. - SalonBook`;
}
