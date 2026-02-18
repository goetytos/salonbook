import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStaffById, updateStaff, deactivateStaff } from "@/lib/services/staff.service";
import { errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/staff/[staffId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const { id, staffId } = await params;
    const staff = await getStaffById(staffId, id);
    if (!staff) return errorResponse("Staff member not found", 404);
    return Response.json(staff);
  } catch {
    return errorResponse("Failed to fetch staff member", 500);
  }
}

// PUT /api/businesses/[id]/staff/[staffId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, staffId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const staff = await updateStaff(staffId, id, body);
    if (!staff) return errorResponse("Staff member not found", 404);

    return Response.json(staff);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update staff member", 500);
  }
}

// DELETE /api/businesses/[id]/staff/[staffId] — soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, staffId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const success = await deactivateStaff(staffId, id);
    if (!success) return errorResponse("Staff member not found", 404);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete staff member", 500);
  }
}
