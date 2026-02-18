import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateBusinessProfile } from "@/lib/services/business.service";
import { errorResponse } from "@/lib/validation";

// PUT /api/businesses/[id]/profile — update business profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const business = await updateBusinessProfile(id, body);
    if (!business) return errorResponse("Business not found", 404);

    return Response.json(business);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update profile", 500);
  }
}
