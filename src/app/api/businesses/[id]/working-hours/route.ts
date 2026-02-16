import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBusinessById, updateWorkingHours } from "@/lib/services/business.service";
import { validateTimeFormat, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/working-hours
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const business = await getBusinessById(id);
    if (!business) return errorResponse("Business not found", 404);

    return Response.json(business.working_hours);
  } catch {
    return errorResponse("Failed to fetch working hours", 500);
  }
}

// PUT /api/businesses/[id]/working-hours
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    // Validate each day's schedule
    for (const day of days) {
      const schedule = body[day];
      if (!schedule) return errorResponse(`Missing schedule for ${day}`);

      if (typeof schedule.closed !== "boolean") {
        return errorResponse(`Invalid 'closed' value for ${day}`);
      }

      if (!schedule.closed) {
        if (!validateTimeFormat(schedule.open) || !validateTimeFormat(schedule.close)) {
          return errorResponse(`Invalid time format for ${day}. Use HH:mm`);
        }
        if (schedule.open >= schedule.close) {
          return errorResponse(`Open time must be before close time for ${day}`);
        }
      }
    }

    const business = await updateWorkingHours(businessId, body);
    if (!business) return errorResponse("Business not found", 404);

    return Response.json(business.working_hours);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update working hours", 500);
  }
}
