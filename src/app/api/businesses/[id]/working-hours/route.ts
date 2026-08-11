import { NextRequest } from "next/server";
import { getAuthorizedBusinessId, requireAuth } from "@/lib/auth";
import {
  getBusinessById,
  getPublicWorkingHours,
  updateWorkingHours,
} from "@/lib/services/business.service";
import { validateUuid, validateWorkingHours, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/working-hours
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!validateUuid(id)) return errorResponse("Business not found", 404);
    const ownerBusiness =
      (await getAuthorizedBusinessId(request)) === id
        ? await getBusinessById(id)
        : null;
    const workingHours =
      ownerBusiness?.working_hours || (await getPublicWorkingHours(id));
    if (!workingHours) return errorResponse("Business not found", 404);

    return Response.json(workingHours);
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
    const businessId = await requireAuth(request);
    const { id } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body: unknown = await request.json();
    if (!validateWorkingHours(body)) {
      return errorResponse("Working hours must contain a valid schedule for every day");
    }

    const business = await updateWorkingHours(businessId, body);
    if (!business) return errorResponse("Business not found", 404);

    return Response.json(business.working_hours);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update working hours", 500);
  }
}
