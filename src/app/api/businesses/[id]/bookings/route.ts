import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBusinessBookings } from "@/lib/services/booking.service";
import { errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/bookings — list bookings (auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || undefined;
    const status = url.searchParams.get("status") || undefined;

    const bookings = await getBusinessBookings(businessId, { date, status });
    return Response.json(bookings);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch bookings", 500);
  }
}
