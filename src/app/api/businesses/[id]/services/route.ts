import { NextRequest } from "next/server";
import { getAuthorizedBusinessId, requireAuth } from "@/lib/auth";
import {
  getServices,
  getPublicServices,
  createService,
} from "@/lib/services/service.service";
import { sanitize, errorResponse, validateUuid } from "@/lib/validation";

// GET /api/businesses/[id]/services — list services (public for booking, auth for management)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!validateUuid(id)) return errorResponse("Business not found", 404);
    const services =
      (await getAuthorizedBusinessId(request)) === id
        ? await getServices(id)
        : await getPublicServices(id);
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
    const businessId = await requireAuth(request);
    const { id } = await params;

    // Verify ownership
    if (businessId !== id) {
      return errorResponse("Forbidden", 403);
    }

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

    const service = await createService(
      businessId,
      cleanName,
      price,
      duration_minutes
    );

    return Response.json(service, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    return errorResponse("Failed to create service", 500);
  }
}
