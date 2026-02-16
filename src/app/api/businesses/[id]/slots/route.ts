import { NextRequest } from "next/server";
import { getAvailableSlots } from "@/lib/services/booking.service";
import { validateDateFormat, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/slots?date=YYYY-MM-DD&duration=30
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const duration = url.searchParams.get("duration");

    if (!date || !validateDateFormat(date)) {
      return errorResponse("Valid date parameter required (YYYY-MM-DD)");
    }

    const durationMinutes = parseInt(duration || "30", 10);
    if (isNaN(durationMinutes) || durationMinutes < 1) {
      return errorResponse("Invalid duration");
    }

    // Prevent booking in the past
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return errorResponse("Cannot book in the past");
    }

    const slots = await getAvailableSlots(id, date, durationMinutes);
    return Response.json(slots);
  } catch {
    return errorResponse("Failed to fetch available slots", 500);
  }
}
