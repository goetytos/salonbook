import { NextRequest } from "next/server";
import { getAuthorizedBusinessId, requireAuth } from "@/lib/auth";
import {
  getStaffById,
  getPublicStaffById,
  updateStaff,
  deactivateStaff,
} from "@/lib/services/staff.service";
import {
  errorResponse,
  normalizeHttpsUrl,
  normalizeKenyanPhone,
  sanitize,
  validateEmail,
  validateUuid,
} from "@/lib/validation";

const STAFF_ROLES = new Set(["stylist", "barber", "manager", "receptionist"]);

// GET /api/businesses/[id]/staff/[staffId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const { id, staffId } = await params;
    if (!validateUuid(id) || !validateUuid(staffId)) {
      return errorResponse("Staff member not found", 404);
    }
    const staff =
      (await getAuthorizedBusinessId(request)) === id
        ? await getStaffById(staffId, id)
        : await getPublicStaffById(staffId, id);
    if (!staff) return errorResponse("Staff member not found", 404);
    return Response.json(staff);
  } catch {
    return errorResponse("Failed to fetch staff member", 500);
  }
}

// PUT /api/businesses/[id]/staff/[staffId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, staffId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(staffId)) return errorResponse("Invalid staff identifier");

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const input = body as Record<string, unknown>;
    if (
      input.service_ids !== undefined &&
      (!Array.isArray(input.service_ids) ||
        input.service_ids.length > 100 ||
        input.service_ids.some(
          (serviceId: unknown) =>
            typeof serviceId !== "string" || !validateUuid(serviceId)
        ))
    ) {
      return errorResponse("service_ids must contain valid service IDs");
    }
    const updates: Parameters<typeof updateStaff>[2] = {};
    if (input.name !== undefined) {
      if (
        typeof input.name !== "string" ||
        sanitize(input.name).length < 2 ||
        sanitize(input.name).length > 120
      ) {
        return errorResponse("Staff name must be between 2 and 120 characters");
      }
      updates.name = sanitize(input.name);
    }
    if (input.email !== undefined) {
      if (
        typeof input.email !== "string" ||
        input.email.length > 320 ||
        !validateEmail(sanitize(input.email))
      ) {
        return errorResponse("A valid staff email is required");
      }
      updates.email = sanitize(input.email).toLowerCase();
    }
    if (input.phone !== undefined) {
      const phone =
        typeof input.phone === "string" ? normalizeKenyanPhone(input.phone) : null;
      if (!phone) return errorResponse("A valid Kenyan staff phone number is required");
      updates.phone = phone;
    }
    if (input.role !== undefined) {
      if (typeof input.role !== "string" || !STAFF_ROLES.has(input.role)) {
        return errorResponse("Staff role is not supported");
      }
      updates.role = input.role;
    }
    if (input.specialties !== undefined) {
      if (
        !Array.isArray(input.specialties) ||
        input.specialties.length > 30 ||
        input.specialties.some(
          (specialty) =>
            typeof specialty !== "string" ||
            sanitize(specialty).length < 1 ||
            sanitize(specialty).length > 80
        )
      ) {
        return errorResponse("Specialties must be a short list of text values");
      }
      updates.specialties = input.specialties.map((specialty) =>
        sanitize(specialty as string)
      );
    }
    if (input.avatar_url !== undefined) {
      if (typeof input.avatar_url !== "string") {
        return errorResponse("Avatar must be a valid HTTPS URL");
      }
      const avatarUrl = normalizeHttpsUrl(input.avatar_url);
      if (!avatarUrl) return errorResponse("Avatar must be a valid HTTPS URL");
      updates.avatar_url = avatarUrl;
    }
    if (input.active !== undefined) {
      if (typeof input.active !== "boolean") return errorResponse("active must be boolean");
      updates.active = input.active;
    }
    if (Array.isArray(input.service_ids)) {
      updates.service_ids = input.service_ids as string[];
    }

    const staff = await updateStaff(staffId, id, updates);
    if (!staff) return errorResponse("Staff member not found", 404);

    return Response.json(staff);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    if (
      error instanceof Error &&
      error.message === "One or more services are unavailable for this business"
    ) {
      return errorResponse(error.message, 400);
    }
    return errorResponse("Failed to update staff member", 500);
  }
}

// DELETE /api/businesses/[id]/staff/[staffId] — soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id, staffId } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);
    if (!validateUuid(staffId)) return errorResponse("Invalid staff identifier");

    const success = await deactivateStaff(staffId, id);
    if (!success) return errorResponse("Staff member not found", 404);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to delete staff member", 500);
  }
}
