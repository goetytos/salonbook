import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updatePromotion, deletePromotion } from "@/lib/services/promotion.service";
import {
  errorResponse,
  sanitize,
  validateDateFormat,
  validateUuid,
} from "@/lib/validation";

// PUT /api/businesses/[id]/promotions/[promotionId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, promotionId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(promotionId)) {
      return errorResponse("Invalid promotion identifier");
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const input = body as Record<string, unknown>;
    const updates: Parameters<typeof updatePromotion>[2] = {};

    if (input.code !== undefined) {
      if (typeof input.code !== "string") return errorResponse("Invalid code");
      const code = sanitize(input.code).toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(code)) {
        return errorResponse("Code may contain letters, numbers, underscores, and hyphens");
      }
      updates.code = code;
    }
    if (input.discount_type !== undefined) {
      if (input.discount_type !== "percentage" && input.discount_type !== "fixed") {
        return errorResponse("Discount type must be percentage or fixed");
      }
      updates.discount_type = input.discount_type;
    }
    if (input.discount_value !== undefined) {
      if (
        typeof input.discount_value !== "number" ||
        !Number.isFinite(input.discount_value) ||
        input.discount_value <= 0 ||
        input.discount_value > 99_999_999.99 ||
        ((updates.discount_type === "percentage" || input.discount_type === "percentage") &&
          input.discount_value > 100)
      ) {
        return errorResponse("Discount value is outside the allowed range");
      }
      updates.discount_value = input.discount_value;
    }
    for (const field of ["valid_from", "valid_to"] as const) {
      const value = input[field];
      if (value !== undefined) {
        if (typeof value !== "string" || !validateDateFormat(value)) {
          return errorResponse("Promotion date is invalid");
        }
        updates[field] = value;
      }
    }
    if (
      updates.valid_from !== undefined &&
      updates.valid_to !== undefined &&
      updates.valid_from > updates.valid_to
    ) {
      return errorResponse("Promotion date range is invalid");
    }
    if (input.max_uses !== undefined) {
      if (
        !Number.isInteger(input.max_uses) ||
        (input.max_uses as number) < 1 ||
        (input.max_uses as number) > 1_000_000
      ) {
        return errorResponse("max_uses must be a positive whole number");
      }
      updates.max_uses = input.max_uses as number;
    }
    if (input.active !== undefined) {
      if (typeof input.active !== "boolean") return errorResponse("active must be boolean");
      updates.active = input.active;
    }
    if (input.applicable_services !== undefined) {
      if (
        !Array.isArray(input.applicable_services) ||
        input.applicable_services.length > 100 ||
        input.applicable_services.some(
          (serviceId) => typeof serviceId !== "string" || !validateUuid(serviceId)
        )
      ) {
        return errorResponse("applicable_services must contain valid service IDs");
      }
      updates.applicable_services = input.applicable_services as string[];
    }

    const promo = await updatePromotion(promotionId, id, updates);
    if (!promo) return errorResponse("Promotion not found", 404);
    return Response.json(promo);
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
    return errorResponse("Failed to update promotion", 500);
  }
}

// DELETE /api/businesses/[id]/promotions/[promotionId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, promotionId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(promotionId)) {
      return errorResponse("Invalid promotion identifier");
    }

    const success = await deletePromotion(promotionId, id);
    if (!success) return errorResponse("Promotion not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete promotion", 500);
  }
}
