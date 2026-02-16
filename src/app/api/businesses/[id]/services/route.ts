import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getServices, createService } from "@/lib/services/service.service";
import { sanitize, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/services — list services (public for booking, auth for management)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const services = await getServices(id);
    return Response.json(services);
  } catch {
    return errorResponse("Failed to fetch services", 500);
  }
}

// POST /api/businesses/[id]/services — create a service (auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;

    // Verify ownership
    if (businessId !== id) {
      return errorResponse("Forbidden", 403);
    }

    const body = await request.json();
    const { name, price, duration_minutes } = body;

    if (!name || price == null || !duration_minutes) {
      return errorResponse("Name, price, and duration are required");
    }

    if (typeof price !== "number" || price < 0) {
      return errorResponse("Price must be a non-negative number");
    }

    if (typeof duration_minutes !== "number" || duration_minutes < 1 || duration_minutes > 480) {
      return errorResponse("Duration must be between 1 and 480 minutes");
    }

    const service = await createService(
      businessId,
      sanitize(name),
      price,
      duration_minutes
    );

    return Response.json(service, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to create service", 500);
  }
}
