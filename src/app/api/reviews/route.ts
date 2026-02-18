import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/auth";
import { createReview } from "@/lib/services/review.service";
import { errorResponse } from "@/lib/validation";

// POST /api/reviews — create a review (customer auth required)
export async function POST(request: NextRequest) {
  try {
    const customerId = requireCustomerAuth(request);
    const body = await request.json();
    const { booking_id, rating, comment, staff_id } = body;

    if (!booking_id) return errorResponse("booking_id is required");
    if (!rating || rating < 1 || rating > 5) {
      return errorResponse("Rating must be between 1 and 5");
    }

    const review = await createReview(
      "", // business_id is derived from booking
      customerId,
      booking_id,
      rating,
      comment,
      staff_id
    );

    return Response.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to create review";
    return errorResponse(message, 400);
  }
}
