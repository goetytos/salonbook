import { NextRequest } from "next/server";
import { validatePromotion } from "@/lib/services/promotion.service";
import { errorResponse } from "@/lib/validation";

// POST /api/promotions/validate — public
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, code, service_id } = body;

    if (!business_id || !code) {
      return errorResponse("business_id and code are required");
    }

    const promo = await validatePromotion(business_id, code, service_id);
    if (!promo) {
      return errorResponse("Invalid or expired promotion code", 404);
    }

    return Response.json({
      id: promo.id,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
    });
  } catch {
    return errorResponse("Failed to validate promotion", 500);
  }
}
