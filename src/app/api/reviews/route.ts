import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/auth";
import { createReview } from "@/lib/services/review.service";
import { errorResponse, sanitize, validateUuid } from "@/lib/validation";

// POST /api/reviews — create a review (customer auth required)
export async function POST(request: NextRequest) {
  try {
    const customerId = requireCustomerAuth(request);
    const body = await request.json();
    const { booking_id, rating, comment } = body;

    if (!booking_id || !validateUuid(booking_id)) {
      return errorResponse("A valid booking_id is required");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return errorResponse("Rating must be a whole number between 1 and 5");
    }
    if (comment !== undefined && typeof comment !== "string") {
      return errorResponse("Comment must be text");
    }

    const review = await createReview(
      customerId,
      booking_id,
      rating,
      comment ? sanitize(comment).slice(0, 2000) : undefined
    );

    return Response.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to create review";
    return errorResponse(message, 400);
  }
}
