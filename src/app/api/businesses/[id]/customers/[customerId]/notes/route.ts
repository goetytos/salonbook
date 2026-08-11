import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addClientNote, deleteClientNote } from "@/lib/services/client.service";
import { sanitize, errorResponse, validateUuid } from "@/lib/validation";

// POST /api/businesses/[id]/customers/[customerId]/notes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, customerId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const noteValue = (body as Record<string, unknown>).note;
    if (typeof noteValue !== "string") {
      return errorResponse("Note content is required");
    }
    const cleanNote = sanitize(noteValue);
    if (cleanNote.length < 1 || cleanNote.length > 2000) {
      return errorResponse("Note must be between 1 and 2000 characters");
    }

    const note = await addClientNote(id, customerId, cleanNote, businessId);
    return Response.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (
      error instanceof Error &&
      error.message === "Customer not found for this business"
    ) {
      return errorResponse(error.message, 404);
    }
    return errorResponse("Failed to add note", 500);
  }
}

// DELETE /api/businesses/[id]/customers/[customerId]/notes?note_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, customerId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const noteId = url.searchParams.get("note_id");
    if (!noteId || !validateUuid(noteId)) {
      return errorResponse("A valid note_id is required");
    }

    const success = await deleteClientNote(noteId, id, customerId);
    if (!success) return errorResponse("Note not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete note", 500);
  }
}
