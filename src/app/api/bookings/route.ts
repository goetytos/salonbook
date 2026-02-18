import { NextRequest } from "next/server";
import { createBooking } from "@/lib/services/booking.service";
import { getBusinessBySlug } from "@/lib/services/business.service";
import {
  sanitize,
  validatePhone,
  validateDateFormat,
  validateTimeFormat,
  errorResponse,
} from "@/lib/validation";

// POST /api/bookings — create a booking (public, no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_slug,
      service_id,
      date,
      time,
      customer_name,
      customer_phone,
      staff_id,
      notes,
      promotion_code,
    } = body;

    // Validate all required fields
    if (!business_slug || !service_id || !date || !time || !customer_name || !customer_phone) {
      return errorResponse("All fields are required");
    }

    const cleanName = sanitize(customer_name);
    const cleanPhone = sanitize(customer_phone);

    if (!cleanName || cleanName.length < 2) {
      return errorResponse("Name must be at least 2 characters");
    }

    if (!validatePhone(cleanPhone)) {
      return errorResponse("Invalid phone number. Use format: 07XXXXXXXX or +254XXXXXXXXX");
    }

    if (!validateDateFormat(date)) {
      return errorResponse("Invalid date format. Use YYYY-MM-DD");
    }

    if (!validateTimeFormat(time)) {
      return errorResponse("Invalid time format. Use HH:mm");
    }

    // Prevent booking in the past
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return errorResponse("Cannot book in the past");
    }

    // Resolve business from slug
    const business = await getBusinessBySlug(business_slug);
    if (!business) {
      return errorResponse("Business not found", 404);
    }

    // Validate and apply promotion if provided
    let promotionId: string | undefined;
    if (promotion_code) {
      const { validatePromotion, incrementUsage } = await import(
        "@/lib/services/promotion.service"
      );
      const promo = await validatePromotion(business.id, promotion_code, service_id);
      if (!promo) {
        return errorResponse("Invalid or expired promotion code");
      }
      promotionId = promo.id;
      await incrementUsage(promo.id);
    }

    const booking = await createBooking(
      business.id,
      service_id,
      cleanName,
      cleanPhone,
      date,
      time,
      staff_id || undefined,
      notes ? sanitize(notes) : undefined,
      promotionId
    );

    // Fire confirmation notification (non-blocking)
    import("@/lib/services/notification.service")
      .then(({ sendBookingConfirmation }) =>
        sendBookingConfirmation(
          booking.id,
          business.id,
          cleanPhone,
          cleanName,
          booking.service_name || "your service",
          date,
          time
        )
      )
      .catch(() => {});

    return Response.json(booking, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create booking";
    const status = message.includes("no longer available") ? 409 : 500;
    return errorResponse(message, status);
  }
}
