import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPromotions, createPromotion } from "@/lib/services/promotion.service";
import {
  sanitize,
  validateDateFormat,
  validateUuid,
  errorResponse,
} from "@/lib/validation";

// GET /api/businesses/[id]/promotions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await requireAuth(request);
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
    const businessId = await requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const data = body as Record<string, unknown>;
    if (
      typeof data.code !== "string" ||
      typeof data.discount_type !== "string" ||
      typeof data.discount_value !== "number" ||
      typeof data.valid_from !== "string" ||
      typeof data.valid_to !== "string"
    ) {
      return errorResponse("Code, discount type, value, and date range are required");
    }
    const code = sanitize(data.code).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(code)) {
      return errorResponse("Code may contain letters, numbers, underscores, and hyphens");
    }
    if (data.discount_type !== "percentage" && data.discount_type !== "fixed") {
      return errorResponse("Discount type must be percentage or fixed");
    }
    if (
      !Number.isFinite(data.discount_value) ||
      data.discount_value <= 0 ||
      data.discount_value > 99_999_999.99 ||
      (data.discount_type === "percentage" && data.discount_value > 100)
    ) {
      return errorResponse("Discount value is outside the allowed range");
    }
    if (
      !validateDateFormat(data.valid_from) ||
      !validateDateFormat(data.valid_to) ||
      data.valid_from > data.valid_to
    ) {
      return errorResponse("Promotion date range is invalid");
    }
    if (
      data.max_uses !== undefined &&
      (!Number.isInteger(data.max_uses) ||
        (data.max_uses as number) < 1 ||
        (data.max_uses as number) > 1_000_000)
    ) {
      return errorResponse("max_uses must be a positive whole number");
    }
    const applicableServices = data.applicable_services;
    if (
      applicableServices !== undefined &&
      (!Array.isArray(applicableServices) ||
        applicableServices.length > 100 ||
        applicableServices.some(
          (serviceId) => typeof serviceId !== "string" || !validateUuid(serviceId)
        ))
    ) {
      return errorResponse("applicable_services must contain valid service IDs");
    }

    const promo = await createPromotion(id, {
      code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      valid_from: data.valid_from,
      valid_to: data.valid_to,
      max_uses: data.max_uses as number | undefined,
      applicable_services: applicableServices as string[] | undefined,
    });
    return Response.json(promo, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    const databaseCode =
      error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (databaseCode === "23505") {
      return errorResponse("A promotion with this code already exists", 409);
    }
    if (
      error instanceof Error &&
      error.message === "One or more services are unavailable for this business"
    ) {
      return errorResponse(error.message, 400);
    }
    return errorResponse("Failed to create promotion", 500);
  }
}
