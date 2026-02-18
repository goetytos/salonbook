import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPromotions, createPromotion } from "@/lib/services/promotion.service";
import { sanitize, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/promotions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const promotions = await getPromotions(id);
    return Response.json(promotions);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch promotions", 500);
  }
}

// POST /api/businesses/[id]/promotions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    if (!body.code || !body.discount_type || !body.discount_value || !body.valid_from || !body.valid_to) {
      return errorResponse("Code, discount type, value, and date range are required");
    }

    const promo = await createPromotion(id, {
      code: sanitize(body.code),
      discount_type: body.discount_type,
      discount_value: body.discount_value,
      valid_from: body.valid_from,
      valid_to: body.valid_to,
      max_uses: body.max_uses,
      applicable_services: body.applicable_services,
    });
    return Response.json(promo, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to create promotion";
    return errorResponse(message, message.includes("duplicate") ? 409 : 500);
  }
}
