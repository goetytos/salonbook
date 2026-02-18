import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getBlockedDates,
  createBlockedDate,
  deleteBlockedDate,
} from "@/lib/services/blocked-date.service";
import { sanitize, validateDateFormat, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/blocked-dates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const blockedDates = await getBlockedDates(id, {
      startDate: url.searchParams.get("start") || undefined,
      endDate: url.searchParams.get("end") || undefined,
      staffId: url.searchParams.get("staff_id") || undefined,
    });
    return Response.json(blockedDates);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch blocked dates", 500);
  }
}

// POST /api/businesses/[id]/blocked-dates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    if (!body.date || !validateDateFormat(body.date)) {
      return errorResponse("Valid date is required (YYYY-MM-DD)");
    }

    const blocked = await createBlockedDate(id, {
      date: body.date,
      staff_id: body.staff_id,
      start_time: body.start_time,
      end_time: body.end_time,
      reason: body.reason ? sanitize(body.reason) : undefined,
    });
    return Response.json(blocked, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to create blocked date", 500);
  }
}

// DELETE /api/businesses/[id]/blocked-dates?blocked_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const blockedId = url.searchParams.get("blocked_id");
    if (!blockedId) return errorResponse("blocked_id is required");

    const success = await deleteBlockedDate(blockedId, id);
    if (!success) return errorResponse("Blocked date not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete blocked date", 500);
  }
}
