import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateService, deleteService } from "@/lib/services/service.service";
import { sanitize, errorResponse, validateUuid } from "@/lib/validation";

// PUT /api/businesses/[id]/services/[serviceId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, serviceId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(serviceId)) return errorResponse("Invalid service identifier");

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { name, price, duration_minutes } = body as Record<string, unknown>;

    if (typeof name !== "string" || price == null || duration_minutes == null) {
      return errorResponse("Name, price, and duration are required");
    }
    const cleanName = sanitize(name);
    if (cleanName.length < 2 || cleanName.length > 120) {
      return errorResponse("Service name must be between 2 and 120 characters");
    }
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99_999_999.99
    ) {
      return errorResponse("Price must be a non-negative number");
    }
    if (
      typeof duration_minutes !== "number" ||
      !Number.isInteger(duration_minutes) ||
      duration_minutes < 1 ||
      duration_minutes > 480
    ) {
      return errorResponse("Duration must be between 1 and 480 minutes");
    }

    const service = await updateService(
      serviceId,
      businessId,
      cleanName,
      price,
      duration_minutes
    );

    if (!service) return errorResponse("Service not found", 404);
    return Response.json(service);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    return errorResponse("Failed to update service", 500);
  }
}

// DELETE /api/businesses/[id]/services/[serviceId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, serviceId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(serviceId)) return errorResponse("Invalid service identifier");

    const deleted = await deleteService(serviceId, businessId);
    if (!deleted) return errorResponse("Service not found", 404);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete service", 500);
  }
}
