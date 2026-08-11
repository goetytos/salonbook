import { NextRequest } from "next/server";
import { getBusinessReviews, getBusinessRating } from "@/lib/services/review.service";
import { errorResponse, validateUuid } from "@/lib/validation";

// GET /api/businesses/[id]/reviews — public
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!validateUuid(id)) return errorResponse("Business not found", 404);
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit") || "20";
    const rawOffset = url.searchParams.get("offset") || "0";
    if (!/^\d{1,3}$/.test(rawLimit) || !/^\d{1,7}$/.test(rawOffset)) {
      return errorResponse("Invalid pagination parameters");
    }
    const limit = Number(rawLimit);
    const offset = Number(rawOffset);
    if (limit < 1 || limit > 100 || offset > 1_000_000) {
      return errorResponse("Invalid pagination parameters");
    }

    const { reviews, total } = await getBusinessReviews(id, limit, offset);
    const rating = await getBusinessRating(id);

    return Response.json({ reviews, total, ...rating });
  } catch {
    return errorResponse("Failed to fetch reviews", 500);
  }
}
