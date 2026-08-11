import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { tagCustomer, untagCustomer } from "@/lib/services/client.service";
import { errorResponse, validateUuid } from "@/lib/validation";

// POST /api/businesses/[id]/customers/[customerId]/tags
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, customerId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    if (!body.tag_id || !validateUuid(body.tag_id)) {
      return errorResponse("A valid tag_id is required");
    }

    const tagged = await tagCustomer(id, customerId, body.tag_id);
    if (!tagged) return errorResponse("Customer or tag not found", 404);
    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to tag customer", 500);
  }
}

// DELETE /api/businesses/[id]/customers/[customerId]/tags?tag_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, customerId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const tagId = url.searchParams.get("tag_id");
    if (!tagId || !validateUuid(tagId)) {
      return errorResponse("A valid tag_id is required");
    }

    const removed = await untagCustomer(id, customerId, tagId);
    if (!removed) return errorResponse("Customer tag not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to remove tag", 500);
  }
}
