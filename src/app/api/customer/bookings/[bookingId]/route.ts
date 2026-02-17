import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/auth";
import { cancelCustomerBooking } from "@/lib/services/customer.service";
import { errorResponse } from "@/lib/validation";

// PATCH /api/customer/bookings/[bookingId] — cancel a booking
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const customerId = requireCustomerAuth(request);
    const { bookingId } = await params;

    const booking = await cancelCustomerBooking(bookingId, customerId);
    if (!booking) return errorResponse("Booking not found or already cancelled", 404);

    return Response.json(booking);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to cancel booking", 500);
  }
}
