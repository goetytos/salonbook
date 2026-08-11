import { NextRequest } from "next/server";
import { getAuthorizedBusinessId, requireAuth } from "@/lib/auth";
import { getStaff, getPublicStaff, createStaff } from "@/lib/services/staff.service";
import {
  sanitize,
  errorResponse,
  normalizeHttpsUrl,
  normalizeKenyanPhone,
  validateEmail,
  validateUuid,
} from "@/lib/validation";

const STAFF_ROLES = new Set(["stylist", "barber", "manager", "receptionist"]);

// GET /api/businesses/[id]/staff — list staff (public for booking flow)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!validateUuid(id)) return errorResponse("Business not found", 404);
    const staff =
      (await getAuthorizedBusinessId(request)) === id
        ? await getStaff(id)
        : await getPublicStaff(id);
    return Response.json(staff);
  } catch {
    return errorResponse("Failed to fetch staff", 500);
  }
}

// POST /api/businesses/[id]/staff — create staff member (auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(id)) return errorResponse("Invalid business identifier");

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { name, email, phone, role, specialties, avatar_url, service_ids } =
      body as Record<string, unknown>;

    if (typeof name !== "string" || sanitize(name).length < 2 || sanitize(name).length > 120) {
      return errorResponse("Staff name is required (min 2 characters)");
    }
    if (
      email !== undefined &&
      (typeof email !== "string" || email.length > 320 || !validateEmail(sanitize(email)))
    ) {
      return errorResponse("A valid staff email is required");
    }
    const normalizedPhone =
      phone === undefined
        ? undefined
        : typeof phone === "string"
          ? normalizeKenyanPhone(phone)
          : null;
    if (phone !== undefined && !normalizedPhone) {
      return errorResponse("A valid Kenyan staff phone number is required");
    }
    if (role !== undefined && (typeof role !== "string" || !STAFF_ROLES.has(role))) {
      return errorResponse("Staff role is not supported");
    }
    if (
      specialties !== undefined &&
      (!Array.isArray(specialties) ||
        specialties.length > 30 ||
        specialties.some(
          (specialty) =>
            typeof specialty !== "string" ||
            sanitize(specialty).length < 1 ||
            sanitize(specialty).length > 80
        ))
    ) {
      return errorResponse("Specialties must be a short list of text values");
    }
    const avatarUrl =
      avatar_url === undefined
        ? undefined
        : typeof avatar_url === "string" && avatar_url.trim() === ""
          ? undefined
          : typeof avatar_url === "string"
            ? normalizeHttpsUrl(avatar_url)
            : null;
    if (avatar_url !== undefined && avatar_url !== "" && !avatarUrl) {
      return errorResponse("Avatar must be a valid HTTPS URL");
    }
    if (
      service_ids !== undefined &&
      (!Array.isArray(service_ids) ||
        service_ids.length > 100 ||
        service_ids.some(
          (serviceId: unknown) =>
            typeof serviceId !== "string" || !validateUuid(serviceId)
        ))
    ) {
      return errorResponse("service_ids must contain valid service IDs");
    }

    const staff = await createStaff(id, {
      name: sanitize(name),
      email: typeof email === "string" ? sanitize(email).toLowerCase() : undefined,
      phone: normalizedPhone || undefined,
      role: typeof role === "string" ? role : undefined,
      specialties: Array.isArray(specialties)
        ? specialties.map((specialty) => sanitize(specialty as string))
        : undefined,
      avatar_url: avatarUrl || undefined,
      service_ids: service_ids as string[] | undefined,
    });

    return Response.json(staff, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    if (
      error instanceof Error &&
      error.message === "One or more services are unavailable for this business"
    ) {
      return errorResponse(error.message, 400);
    }
    return errorResponse("Failed to create staff member", 500);
  }
}
