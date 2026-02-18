import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updatePromotion, deletePromotion } from "@/lib/services/promotion.service";
import { errorResponse } from "@/lib/validation";

// PUT /api/businesses/[id]/promotions/[promotionId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, promotionId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const promo = await updatePromotion(promotionId, id, body);
    if (!promo) return errorResponse("Promotion not found", 404);
    return Response.json(promo);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update promotion", 500);
  }
}

// DELETE /api/businesses/[id]/promotions/[promotionId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, promotionId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const success = await deletePromotion(promotionId, id);
    if (!success) return errorResponse("Promotion not found", 404);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete promotion", 500);
  }
}
