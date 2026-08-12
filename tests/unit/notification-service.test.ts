import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryOneMock, sendSmsMock } = vi.hoisted(() => ({
  queryOneMock: vi.fn(),
  sendSmsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ queryOne: queryOneMock }));
vi.mock("@/lib/modules/sms", () => ({ sendSms: sendSmsMock }));

import {
  sendBookingCancellation,
  sendBookingConfirmation,
  sendBookingOwnerAlert,
} from "@/lib/services/notification.service";

beforeEach(() => {
  queryOneMock.mockReset();
  sendSmsMock.mockReset();
  queryOneMock.mockResolvedValue({ id: "notification-id" });
});

describe("booking notification audit logging", () => {
  it("records a disabled transport truthfully without storing message PII", async () => {
    sendSmsMock.mockResolvedValue({
      success: false,
      status: "disabled",
      provider: "none",
      errorCode: "notifications_disabled",
    });

    await sendBookingConfirmation(
      "booking-id",
      "business-id",
      "0712 345 678",
      "Amina",
      "Braids",
      "2026-08-14",
      "10:30"
    );

    expect(sendSmsMock).toHaveBeenCalledWith({
      to: "0712 345 678",
      message: "Hi Amina, your booking for Braids on 2026-08-14 at 10:30 is confirmed!",
    });
    const params = queryOneMock.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("booking_confirmation");
    expect(params[1]).toBe("+254712345678");
    expect(params[3]).toBe("disabled");
    expect(JSON.parse(params[6] as string)).toEqual({ provider: "none" });
    expect(params[7]).toBe("notifications_disabled");

    const payload = params[6] as string;
    expect(payload).not.toContain("Amina");
    expect(payload).not.toContain("Braids");
    expect(payload).not.toContain("0712");
    expect(payload).not.toContain("confirmed");
  });

  it("records provider acceptance without claiming delivery", async () => {
    sendSmsMock.mockResolvedValue({
      success: true,
      status: "accepted",
      provider: "africastalking",
      messageId: "ATXid_test-123",
    });

    await sendBookingCancellation(
      "booking-id",
      "business-id",
      "+254712345678",
      "Amina",
      "Braids",
      "2026-08-14",
      "10:30"
    );

    const params = queryOneMock.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("booking_cancellation");
    expect(params[3]).toBe("accepted");
    expect(JSON.parse(params[6] as string)).toEqual({
      provider: "africastalking",
      provider_message_id: "ATXid_test-123",
    });
    expect(params[7]).toBeNull();
  });

  it("does not persist a malformed phone value as the audit recipient", async () => {
    sendSmsMock.mockResolvedValue({
      success: false,
      status: "invalid_recipient",
      provider: "africastalking",
      errorCode: "invalid_recipient",
    });

    await sendBookingConfirmation(
      "booking-id",
      "business-id",
      "malformed private value",
      "Amina",
      "Braids",
      "2026-08-14",
      "10:30"
    );

    const params = queryOneMock.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe("invalid-recipient");
    expect(params[3]).toBe("invalid_recipient");
    expect(params[7]).toBe("invalid_recipient");
  });

  it("submits and audits a new-booking owner alert through the same safe path", async () => {
    sendSmsMock.mockResolvedValue({
      success: false,
      status: "disabled",
      provider: "none",
      errorCode: "notifications_disabled",
    });

    await sendBookingOwnerAlert(
      "booking-id",
      "business-id",
      "0712 345 678",
      "Amina",
      "Braids",
      "2026-08-14",
      "10:30"
    );

    expect(sendSmsMock).toHaveBeenCalledWith({
      to: "0712 345 678",
      message: "New SalonBook booking: Amina, Braids, 2026-08-14 at 10:30.",
    });
    const params = queryOneMock.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("booking_owner_alert");
    expect(params[1]).toBe("+254712345678");
    expect(params[3]).toBe("disabled");
    expect(JSON.parse(params[6] as string)).toEqual({ provider: "none" });
    expect(params[7]).toBe("notifications_disabled");
    expect(params[6] as string).not.toContain("Amina");
    expect(params[6] as string).not.toContain("Braids");
  });
});
