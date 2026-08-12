import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { BookingServiceErrorMock, requireAuthMock, updateBookingStatusMock } =
  vi.hoisted(() => ({
    BookingServiceErrorMock: class BookingServiceError extends Error {
      readonly status = 409 as const;
    },
    requireAuthMock: vi.fn(),
    updateBookingStatusMock: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/services/booking.service", () => ({
  BookingServiceError: BookingServiceErrorMock,
  updateBookingStatus: updateBookingStatusMock,
}));

import { PATCH } from "@/app/api/businesses/[id]/bookings/[bookingId]/route";

const BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";

function request(status: string) {
  return new NextRequest(
    `https://salonbook.test/api/businesses/${BUSINESS_ID}/bookings/${BOOKING_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
}

const routeContext = {
  params: Promise.resolve({ id: BUSINESS_ID, bookingId: BOOKING_ID }),
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue(BUSINESS_ID);
  updateBookingStatusMock.mockResolvedValue({
    id: BOOKING_ID,
    business_id: BUSINESS_ID,
    status: "Cancelled",
  });
});

describe("business booking status route", () => {
  it("delegates cancellation to the transactional status service only", async () => {
    const response = await PATCH(request("Cancelled"), routeContext);

    expect(response.status).toBe(200);
    expect(updateBookingStatusMock).toHaveBeenCalledExactlyOnceWith(
      BOOKING_ID,
      BUSINESS_ID,
      "Cancelled"
    );
  });

  it("returns a conflict for a rejected terminal-state transition", async () => {
    updateBookingStatusMock.mockRejectedValue(
      new BookingServiceErrorMock("A terminal booking status cannot be changed")
    );

    const response = await PATCH(request("Completed"), routeContext);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "A terminal booking status cannot be changed",
    });
  });
});
