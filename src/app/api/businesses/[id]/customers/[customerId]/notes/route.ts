import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addClientNote, deleteClientNote } from "@/lib/services/client.service";
import { sanitize, errorResponse } from "@/lib/validation";

// POST /api/businesses/[id]/customers/[customerId]/notes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, customerId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    if (!body.note || sanitize(body.note).length < 1) {
      return errorResponse("Note content is required");
    }

    const note = await addClientNote(id, customerId, sanitize(body.note), businessId);
    return Response.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to add note", 500);
  }
}

// DELETE /api/businesses/[id]/customers/[customerId]/notes?note_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const noteId = url.searchParams.get("note_id");
    if (!noteId) return errorResponse("note_id is required");

    const success = await deleteClientNote(noteId, id);
    if (!success) return errorResponse("Note not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete note", 500);
  }
}
