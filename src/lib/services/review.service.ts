import { query, queryOne } from "@/lib/db";
import type { Review } from "@/types";

/** Create a review (one per booking, booking must be completed) */
export async function createReview(
  businessId: string,
  customerId: string,
  bookingId: string,
  rating: number,
  comment?: string,
  staffId?: string
): Promise<Review> {
  // Verify booking belongs to customer and is completed
  const booking = await queryOne<{ id: string; business_id: string; staff_id: string }>(
    `SELECT id, business_id, staff_id FROM bookings
     WHERE id = $1 AND customer_id = $2 AND status = 'Completed'`,
    [bookingId, customerId]
  );
  if (!booking) {
    throw new Error("Booking not found or not completed");
  }

  // Check if review already exists for this booking
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM reviews WHERE booking_id = $1",
    [bookingId]
  );
  if (existing) {
    throw new Error("Review already submitted for this booking");
  }

  const review = await queryOne<Review>(
    `INSERT INTO reviews (business_id, customer_id, booking_id, staff_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      booking.business_id,
      customerId,
      bookingId,
      staffId || booking.staff_id || null,
      rating,
      comment || null,
    ]
  );
  if (!review) throw new Error("Failed to create review");
  return review;
}

/** Get paginated reviews for a business */
export async function getBusinessReviews(
  businessId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ reviews: Review[]; total: number }> {
  const reviews = await query<Review>(
    `SELECT r.*, c.name as customer_name, st.name as staff_name,
            s.name as service_name
     FROM reviews r
     JOIN customers c ON r.customer_id = c.id
     LEFT JOIN staff st ON r.staff_id = st.id
     LEFT JOIN bookings b ON r.booking_id = b.id
     LEFT JOIN services s ON b.service_id = s.id
     WHERE r.business_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [businessId, limit, offset]
  );

  const countResult = await queryOne<{ total: number }>(
    "SELECT COUNT(*)::int as total FROM reviews WHERE business_id = $1",
    [businessId]
  );

  return { reviews, total: countResult?.total || 0 };
}

/** Get average rating for a business */
export async function getBusinessRating(
  businessId: string
): Promise<{ avg_rating: number; review_count: number }> {
  const result = await queryOne<{ avg_rating: number; review_count: number }>(
    `SELECT COALESCE(AVG(rating), 0)::numeric as avg_rating,
            COUNT(*)::int as review_count
     FROM reviews WHERE business_id = $1`,
    [businessId]
  );
  return {
    avg_rating: Number(result?.avg_rating || 0),
    review_count: result?.review_count || 0,
  };
}
