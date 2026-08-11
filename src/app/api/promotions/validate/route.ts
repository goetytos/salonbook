import { NextRequest } from "next/server";
import { validatePromotion } from "@/lib/services/promotion.service";
import {
  errorResponse,
  sanitize,
  validateDateFormat,
  validateUuid,
} from "@/lib/validation";

// POST /api/promotions/validate — public
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { business_id, code, booking_date, service_id } = body as Record<
      string,
      unknown
    >;

    if (
      typeof business_id !== "string" ||
      !validateUuid(business_id) ||
      typeof code !== "string" ||
      code.length < 1 ||
      code.length > 50 ||
      typeof booking_date !== "string" ||
      !validateDateFormat(booking_date) ||
      (service_id !== undefined &&
        (typeof service_id !== "string" || !validateUuid(service_id)))
    ) {
      return errorResponse(
        "business_id, code, and a valid booking_date are required"
      );
    }

    const promo = await validatePromotion(
      business_id,
      sanitize(code),
      booking_date,
      service_id
    );
    if (!promo) {
      return errorResponse("Invalid or expired promotion code", 404);
    }

    return Response.json({
      id: promo.id,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    return errorResponse("Failed to validate promotion", 500);
  }
}
