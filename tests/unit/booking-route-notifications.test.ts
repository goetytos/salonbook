import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  afterMock,
  createBookingMock,
  dispatchNotificationOutboxMock,
  getBusinessBySlugMock,
  enforceRateLimitMock,
  logServerErrorMock,
} = vi.hoisted(() => ({
  afterMock: vi.fn(),
  createBookingMock: vi.fn(),
  dispatchNotificationOutboxMock: vi.fn(),
  getBusinessBySlugMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  logServerErrorMock: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: afterMock };
});

vi.mock("@/lib/services/booking.service", () => ({
  BookingServiceError: class BookingServiceError extends Error {},
  createBooking: createBookingMock,
}));
vi.mock("@/lib/services/business.service", () => ({
  getBusinessBySlug: getBusinessBySlugMock,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  PUBLIC_BOOKING_RATE_LIMIT: {},
  RateLimitUnavailableError: class RateLimitUnavailableError extends Error {},
  enforceRateLimit: enforceRateLimitMock,
  rateLimitExceededResponse: vi.fn(),
  rateLimitUnavailableResponse: vi.fn(),
}));
vi.mock("@/lib/services/notification-outbox.service", () => ({
  dispatchNotificationOutbox: dispatchNotificationOutboxMock,
}));
vi.mock("@/lib/server/logging", () => ({ logServerError: logServerErrorMock }));

import { POST } from "@/app/api/bookings/route";

const requestBody = {
  business_slug: "pilot-studio",
  service_id: "11111111-1111-4111-8111-111111111111",
  date: "2099-08-12",
  time: "10:00",
  customer_name: "Amina Test",
  customer_phone: "0712345678",
};

function bookingRequest() {
  return new NextRequest("https://salonbook.test/api/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://salonbook.test",
    },
    body: JSON.stringify(requestBody),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceRateLimitMock.mockResolvedValue({ allowed: true });
  getBusinessBySlugMock.mockResolvedValue({
    id: "22222222-2222-4222-8222-222222222222",
    phone: "+254700000001",
  });
  createBookingMock.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    service_name_snapshot: "Knotless braids",
  });
  dispatchNotificationOutboxMock.mockResolvedValue({
    status: "processed",
    claimed: 2,
    accepted: 2,
    retried: 0,
    dead: 0,
    lease_lost: 0,
  });
});

describe("public booking notification scheduling", () => {
  it.each([
    ["cross-site JSON", "application/json", "https://attacker.example", 403],
    ["simple text", "text/plain", "https://attacker.example", 415],
  ])(
    "rejects %s before quota or booking mutation",
    async (_label, contentType, origin, status) => {
      const response = await POST(
        new NextRequest("https://salonbook.test/api/bookings", {
          method: "POST",
          headers: { "Content-Type": contentType, Origin: origin },
          body: JSON.stringify(requestBody),
        })
      );

      expect(response.status).toBe(status);
      expect(enforceRateLimitMock).not.toHaveBeenCalled();
      expect(getBusinessBySlugMock).not.toHaveBeenCalled();
      expect(createBookingMock).not.toHaveBeenCalled();
      expect(afterMock).not.toHaveBeenCalled();
    }
  );

  it("returns the booking first and opportunistically dispatches its durable intents", async () => {
    let scheduled: (() => Promise<void>) | undefined;
    afterMock.mockImplementation((task: () => Promise<void>) => {
      scheduled = task;
    });

    const response = await POST(bookingRequest());

    expect(response.status).toBe(201);
    expect(afterMock).toHaveBeenCalledOnce();
    expect(dispatchNotificationOutboxMock).not.toHaveBeenCalled();

    await scheduled?.();

    expect(dispatchNotificationOutboxMock).toHaveBeenCalledExactlyOnceWith({
      bookingId: "33333333-3333-4333-8333-333333333333",
      batchSize: 2,
    });
  });

  it("contains opportunistic dispatch failures and logs only a fixed scope", async () => {
    let scheduled: (() => Promise<void>) | undefined;
    afterMock.mockImplementation((task: () => Promise<void>) => {
      scheduled = task;
    });
    const privateFailure = Object.assign(
      new Error("phone=+254712345678 customer=Amina"),
      { code: "ETIMEDOUT" }
    );
    dispatchNotificationOutboxMock.mockRejectedValue(privateFailure);

    const response = await POST(bookingRequest());
    await scheduled?.();

    expect(response.status).toBe(201);
    expect(logServerErrorMock).toHaveBeenCalledExactlyOnceWith(
      "api.bookings.notification_outbox",
      privateFailure
    );
  });
});
