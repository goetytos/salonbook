import { NextRequest } from "next/server";
import { getAvailableSlots } from "@/lib/services/booking.service";
import {
  getNairobiDateTime,
  validateDateFormat,
  validateUuid,
  errorResponse,
} from "@/lib/validation";

// GET /api/businesses/[id]/slots?date=YYYY-MM-DD&service_id=...&duration=30&staff_id=...
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const duration = url.searchParams.get("duration");
    const staffId = url.searchParams.get("staff_id") || undefined;
    const serviceId = url.searchParams.get("service_id") || undefined;

    if (!validateUuid(id)) {
      return errorResponse("Invalid business identifier");
    }

    if (!date || !validateDateFormat(date)) {
      return errorResponse("Valid date parameter required (YYYY-MM-DD)");
    }

    if (staffId && !validateUuid(staffId)) {
      return errorResponse("Invalid staff identifier");
    }
    if (serviceId && !validateUuid(serviceId)) {
      return errorResponse("Invalid service identifier");
    }

    const rawDuration = duration || "30";
    const durationMinutes = Number(rawDuration);
    if (
      !/^\d{1,3}$/.test(rawDuration) ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 480
    ) {
      return errorResponse("Invalid duration");
    }

    // Prevent booking in the past
    const today = getNairobiDateTime().date;
    if (date < today) {
      return errorResponse("Cannot book in the past");
    }

    const slots = await getAvailableSlots(
      id,
      date,
      durationMinutes,
      staffId,
      serviceId
    );
    return Response.json(slots);
  } catch {
    return errorResponse("Failed to fetch available slots", 500);
  }
}
