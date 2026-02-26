import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { updateBusinessStatus } from "@/lib/services/admin.service";
import { errorResponse } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdminAuth(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!status) {
      return errorResponse("Status is required");
    }

    const business = await updateBusinessStatus(id, status);
    return Response.json(business);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return errorResponse(message, 400);
  }
}
