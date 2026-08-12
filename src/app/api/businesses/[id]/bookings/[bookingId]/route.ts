import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  BookingServiceError,
  updateBookingStatus,
} from "@/lib/services/booking.service";
import { errorResponse, validateUuid } from "@/lib/validation";

// PATCH /api/businesses/[id]/bookings/[bookingId] — update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, bookingId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(bookingId)) return errorResponse("Invalid booking identifier");

    const body = await request.json();
    const { status } = body;

    if (!["Booked", "Cancelled", "Completed", "No-Show"].includes(status)) {
      return errorResponse("Invalid status. Must be Booked, Cancelled, Completed, or No-Show");
    }

    const booking = await updateBookingStatus(bookingId, businessId, status);
    if (!booking) return errorResponse("Booking not found", 404);

    return Response.json(booking);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof BookingServiceError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Failed to update booking", 500);
  }
}
