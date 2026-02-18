import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateBookingStatus } from "@/lib/services/booking.service";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

// PATCH /api/businesses/[id]/bookings/[bookingId] — update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, bookingId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const { status } = body;

    if (!["Booked", "Cancelled", "Completed", "No-Show"].includes(status)) {
      return errorResponse("Invalid status. Must be Booked, Cancelled, Completed, or No-Show");
    }

    const booking = await updateBookingStatus(bookingId, businessId, status);
    if (!booking) return errorResponse("Booking not found", 404);

    // Fire cancellation notification (non-blocking)
    if (status === "Cancelled") {
      query<{ name: string; phone: string; service_name: string }>(
        `SELECT c.name, c.phone, s.name as service_name
         FROM bookings b JOIN customers c ON b.customer_id = c.id JOIN services s ON b.service_id = s.id
         WHERE b.id = $1`,
        [bookingId]
      )
        .then(([info]) => {
          if (!info) return;
          return import("@/lib/services/notification.service").then(
            ({ sendBookingCancellation }) =>
              sendBookingCancellation(
                bookingId,
                businessId,
                info.phone,
                info.name,
                info.service_name,
                String(booking.date),
                String(booking.time)
              )
          );
        })
        .catch(() => {});
    }

    return Response.json(booking);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update booking", 500);
  }
}
