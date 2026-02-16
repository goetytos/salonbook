import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateService, deleteService } from "@/lib/services/service.service";
import { sanitize, errorResponse } from "@/lib/validation";

// PUT /api/businesses/[id]/services/[serviceId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, serviceId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const { name, price, duration_minutes } = body;

    if (!name || price == null || !duration_minutes) {
      return errorResponse("Name, price, and duration are required");
    }

    const service = await updateService(
      serviceId,
      businessId,
      sanitize(name),
      price,
      duration_minutes
    );

    if (!service) return errorResponse("Service not found", 404);
    return Response.json(service);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to update service", 500);
  }
}

// DELETE /api/businesses/[id]/services/[serviceId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, serviceId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const deleted = await deleteService(serviceId, businessId);
    if (!deleted) return errorResponse("Service not found", 404);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete service", 500);
  }
}
