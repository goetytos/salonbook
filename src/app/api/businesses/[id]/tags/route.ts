import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTags, createTag, deleteTag } from "@/lib/services/client.service";
import { sanitize, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const tags = await getTags(id);
    return Response.json(tags);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch tags", 500);
  }
}

// POST /api/businesses/[id]/tags
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    if (!body.name || sanitize(body.name).length < 1) {
      return errorResponse("Tag name is required");
    }

    const tag = await createTag(id, sanitize(body.name), body.color || "#6B7280");
    return Response.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to create tag", 500);
  }
}

// DELETE /api/businesses/[id]/tags?tag_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const tagId = url.searchParams.get("tag_id");
    if (!tagId) return errorResponse("tag_id is required");

    const success = await deleteTag(tagId, id);
    if (!success) return errorResponse("Tag not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete tag", 500);
  }
}
