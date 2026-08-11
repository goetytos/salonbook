import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { updateBusinessStatus } from "@/lib/services/admin.service";
import { errorResponse, validateUuid } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const { id } = await params;
    if (!validateUuid(id)) return errorResponse("Invalid business identifier");
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { status } = body as Record<string, unknown>;

    if (typeof status !== "string") {
      return errorResponse("Status is required");
    }

    const business = await updateBusinessStatus(id, status);
    return Response.json(business);
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    const message = error instanceof Error ? error.message : "Update failed";
    return errorResponse(
      message.startsWith("Invalid status") || message === "Business not found"
        ? message
        : "Update failed",
      message === "Business not found" ? 404 : 400
    );
  }
}
