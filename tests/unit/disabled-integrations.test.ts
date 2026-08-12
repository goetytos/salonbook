import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initiateSTKPush,
  verifyTransaction,
} from "@/lib/modules/mpesa";
import {
  sendBookingConfirmation as sendWhatsAppBookingConfirmation,
  sendWhatsAppMessage,
} from "@/lib/modules/whatsapp";
import {
  cancelSubscription,
  createSubscription,
  handleWebhook,
} from "@/lib/modules/stripe";

afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoConsoleOutput(
  logSpy: ReturnType<typeof vi.spyOn>,
  errorSpy: ReturnType<typeof vi.spyOn>,
  warnSpy: ReturnType<typeof vi.spyOn>
) {
  expect(logSpy).not.toHaveBeenCalled();
  expect(errorSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
}

function spyOnConsole() {
  return {
    logSpy: vi.spyOn(console, "log").mockImplementation(() => undefined),
    errorSpy: vi.spyOn(console, "error").mockImplementation(() => undefined),
    warnSpy: vi.spyOn(console, "warn").mockImplementation(() => undefined),
  };
}

describe("disabled external integrations", () => {
  it("never initiates or simulates an M-Pesa transaction", async () => {
    const spies = spyOnConsole();

    const initiated = await initiateSTKPush({
      phoneNumber: "+254712345678",
      amount: 1_500,
      accountReference: "private-account-reference",
      transactionDesc: "private transaction description",
    });
    const verified = await verifyTransaction("private-checkout-request-id");

    expect(initiated).toEqual({
      success: false,
      status: "disabled",
      errorCode: "integration_not_configured",
    });
    expect(initiated.checkoutRequestId).toBeUndefined();
    expect(verified).toEqual({
      success: false,
      paid: false,
      status: "disabled",
      errorCode: "integration_not_configured",
    });
    expect(JSON.stringify([initiated, verified])).not.toContain("private");
    expectNoConsoleOutput(spies.logSpy, spies.errorSpy, spies.warnSpy);
  });

  it("never sends or simulates a WhatsApp template", async () => {
    const spies = spyOnConsole();

    const direct = await sendWhatsAppMessage({
      to: "+254712345678",
      templateName: "private_template",
      templateParams: ["private customer"],
    });
    const booking = await sendWhatsAppBookingConfirmation(
      "+254712345678",
      "Private Salon",
      "Private Service",
      "2026-08-14",
      "10:30"
    );

    expect(direct).toEqual({
      success: false,
      status: "disabled",
      errorCode: "integration_not_configured",
    });
    expect(booking).toEqual(direct);
    expect(JSON.stringify([direct, booking])).not.toContain("private");
    expectNoConsoleOutput(spies.logSpy, spies.errorSpy, spies.warnSpy);
  });

  it("never creates, cancels, or processes a simulated Stripe resource", async () => {
    const spies = spyOnConsole();

    const created = await createSubscription({
      email: "private@example.test",
      priceId: "price_private",
      paymentMethodId: "pm_private",
    });
    const cancelled = await cancelSubscription("sub_private");
    const webhook = await handleWebhook("private payload", "private signature");

    const expected = {
      success: false,
      status: "disabled",
      errorCode: "integration_not_configured",
    };
    expect(created).toEqual(expected);
    expect(created.subscriptionId).toBeUndefined();
    expect(created.clientSecret).toBeUndefined();
    expect(cancelled).toEqual(expected);
    expect(webhook).toEqual(expected);
    expect(JSON.stringify([created, cancelled, webhook])).not.toContain("private");
    expectNoConsoleOutput(spies.logSpy, spies.errorSpy, spies.warnSpy);
  });
});
