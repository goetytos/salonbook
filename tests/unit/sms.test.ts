import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "@/lib/modules/sms";

const SMS_ENV_KEYS = [
  "SMS_NOTIFICATIONS_ENABLED",
  "AFRICASTALKING_ENVIRONMENT",
  "AFRICASTALKING_API_KEY",
  "AFRICASTALKING_USERNAME",
  "AFRICASTALKING_SENDER_ID",
  "AFRICASTALKING_TIMEOUT_MS",
] as const;

function clearSmsEnvironment() {
  for (const key of SMS_ENV_KEYS) delete process.env[key];
}

function configureSandbox() {
  process.env.SMS_NOTIFICATIONS_ENABLED = "true";
  process.env.AFRICASTALKING_ENVIRONMENT = "sandbox";
  process.env.AFRICASTALKING_API_KEY = "sandbox-api-key";
  process.env.AFRICASTALKING_USERNAME = "sandbox";
}

function acceptedProviderResponse(phone: string = "+254712345678") {
  return new Response(
    JSON.stringify({
      SMSMessageData: {
        Message: "Sent to 1/1",
        Recipients: [
          {
            statusCode: 101,
            number: phone,
            status: "Success",
            messageId: "ATXid_test-123",
          },
        ],
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}

beforeEach(() => {
  clearSmsEnvironment();
});

afterEach(() => {
  clearSmsEnvironment();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Africa's Talking SMS transport", () => {
  it("is disabled by default and never calls the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendSms({ to: "0712345678", message: "Booking confirmed" })
    ).resolves.toEqual({
      success: false,
      status: "disabled",
      provider: "none",
      errorCode: "notifications_disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when sending is enabled without complete configuration", async () => {
    process.env.SMS_NOTIFICATIONS_ENABLED = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendSms({ to: "0712345678", message: "Booking confirmed" })
    ).resolves.toEqual({
      success: false,
      status: "not_configured",
      provider: "africastalking",
      errorCode: "missing_configuration",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an approved-looking Sender ID in production", async () => {
    process.env.SMS_NOTIFICATIONS_ENABLED = "true";
    process.env.AFRICASTALKING_ENVIRONMENT = "production";
    process.env.AFRICASTALKING_API_KEY = "production-api-key";
    process.env.AFRICASTALKING_USERNAME = "salonbook";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendSms({
      to: "+254712345678",
      message: "Booking confirmed",
    });

    expect(result.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes a Kenyan number and validates an accepted provider response", async () => {
    configureSandbox();
    const fetchMock = vi.fn().mockResolvedValue(acceptedProviderResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendSms({ to: "0712 345 678", message: " Booking confirmed " })
    ).resolves.toEqual({
      success: true,
      status: "accepted",
      provider: "africastalking",
      messageId: "ATXid_test-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.sandbox.africastalking.com/version1/messaging"
    );
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({
      Accept: "application/json",
      apiKey: "sandbox-api-key",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = init.body as URLSearchParams;
    expect(Object.fromEntries(body.entries())).toEqual({
      username: "sandbox",
      to: "+254712345678",
      message: "Booking confirmed",
      bulkSMSMode: "1",
      enqueue: "0",
    });
  });

  it("uses the fixed production endpoint and exact approved Sender ID", async () => {
    process.env.SMS_NOTIFICATIONS_ENABLED = "true";
    process.env.AFRICASTALKING_ENVIRONMENT = "production";
    process.env.AFRICASTALKING_API_KEY = "production-api-key";
    process.env.AFRICASTALKING_USERNAME = "salonbook";
    process.env.AFRICASTALKING_SENDER_ID = "SALONBOOK";
    const fetchMock = vi.fn().mockResolvedValue(acceptedProviderResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendSms({
      to: "+254712345678",
      message: "Booking confirmed",
    });

    expect(result.status).toBe("accepted");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.africastalking.com/version1/messaging");
    expect((init.body as URLSearchParams).get("from")).toBe("SALONBOOK");
  });

  it("rejects invalid recipients before any provider request", async () => {
    configureSandbox();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendSms({ to: "not-a-phone", message: "Confirmed" });

    expect(result).toMatchObject({
      success: false,
      status: "invalid_recipient",
      errorCode: "invalid_recipient",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat a structured provider rejection as sent", async () => {
    configureSandbox();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            SMSMessageData: {
              Message: "Rejected",
              Recipients: [
                {
                  statusCode: 403,
                  number: "+254712345678",
                  status: "RejectedByGateway",
                  messageId: "ATXid_rejected",
                },
              ],
            },
          }),
          { status: 201 }
        )
      )
    );

    await expect(
      sendSms({ to: "0712345678", message: "Booking confirmed" })
    ).resolves.toMatchObject({
      success: false,
      status: "provider_rejected",
      errorCode: "provider_rejected",
    });
  });

  it("fails safely on malformed responses without exposing provider content", async () => {
    configureSandbox();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"unexpected":"customer@example.test secret"}', {
          status: 201,
        })
      )
    );

    const result = await sendSms({
      to: "0712345678",
      message: "Booking confirmed",
    });

    expect(result).toEqual({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "invalid_provider_response",
    });
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("does not expose an HTTP error body", async () => {
    configureSandbox();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("account secret and +254712345678", { status: 401 })
      )
    );

    const result = await sendSms({
      to: "0712345678",
      message: "Booking confirmed",
    });

    expect(result).toEqual({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "provider_http_error",
    });
    expect(JSON.stringify(result)).not.toContain("account secret");
    expect(JSON.stringify(result)).not.toContain("+254712345678");
  });

  it("bounds provider calls with a timeout", async () => {
    configureSandbox();
    process.env.AFRICASTALKING_TIMEOUT_MS = "1000";
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("request aborted", "AbortError"))
          );
        })
      )
    );

    const pending = sendSms({ to: "0712345678", message: "Booking confirmed" });
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toEqual({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "request_timeout",
    });
  });

  it("keeps the timeout active while a successful response body stalls", async () => {
    configureSandbox();
    process.env.AFRICASTALKING_TIMEOUT_MS = "1000";
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            init.signal?.addEventListener("abort", () =>
              controller.error(new DOMException("request aborted", "AbortError"))
            );
          },
        });
        return Promise.resolve(new Response(stream, { status: 201 }));
      })
    );

    const pending = sendSms({ to: "0712345678", message: "Booking confirmed" });
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toEqual({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "request_timeout",
    });
  });

  it("stops reading a chunked response once its byte limit is exceeded", async () => {
    configureSandbox();
    let cancelled = false;
    const chunk = new Uint8Array(40 * 1024).fill(65);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(chunk);
              controller.enqueue(chunk);
            },
            cancel() {
              cancelled = true;
            },
          }),
          { status: 201 }
        )
      )
    );

    const result = await sendSms({
      to: "0712345678",
      message: "Booking confirmed",
    });

    expect(result).toEqual({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "invalid_provider_response",
    });
    expect(cancelled).toBe(true);
  });

  it("returns only a safe code when the network error contains PII", async () => {
    configureSandbox();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new Error("failed for +254712345678 with sandbox-api-key")
      )
    );

    const result = await sendSms({
      to: "0712345678",
      message: "Booking confirmed",
    });

    expect(result).toEqual({
      success: false,
      status: "failed",
      provider: "africastalking",
      errorCode: "network_error",
    });
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
