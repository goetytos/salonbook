import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateStaffWorkingHours } from "@/lib/services/staff.service";
import { errorResponse, validateUuid, validateWorkingHours } from "@/lib/validation";

// PUT /api/businesses/[id]/staff/[staffId]/working-hours
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, staffId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(staffId)) return errorResponse("Invalid staff identifier");

    const workingHours: unknown = await request.json();
    if (!validateWorkingHours(workingHours)) {
      return errorResponse("Working hours must contain a valid schedule for every day");
    }
    const staff = await updateStaffWorkingHours(staffId, id, workingHours);
    if (!staff) return errorResponse("Staff member not found", 404);

    return Response.json(staff);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update working hours", 500);
  }
}
