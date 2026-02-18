import { NextRequest } from "next/server";
import { getBusinessReviews, getBusinessRating } from "@/lib/services/review.service";
import { errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/reviews — public
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const { reviews, total } = await getBusinessReviews(id, limit, offset);
    const rating = await getBusinessRating(id);

    return Response.json({ reviews, total, ...rating });
  } catch {
    return errorResponse("Failed to fetch reviews", 500);
  }
}
