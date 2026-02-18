import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getWeeklyBookings } from "@/lib/services/booking.service";
import { validateDateFormat, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end || !validateDateFormat(start) || !validateDateFormat(end)) {
      return errorResponse("Valid start and end dates required (YYYY-MM-DD)");
    }

    const bookings = await getWeeklyBookings(id, start, end);
    return Response.json(bookings);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch calendar data", 500);
  }
}
