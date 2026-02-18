import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStaff, createStaff } from "@/lib/services/staff.service";
import { sanitize, errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/staff — list staff (public for booking flow)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await getStaff(id);
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
    const businessId = requireAuth(request);
    const { id } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body = await request.json();
    const { name, email, phone, role, specialties, avatar_url, service_ids } = body;

    if (!name || sanitize(name).length < 2) {
      return errorResponse("Staff name is required (min 2 characters)");
    }

    const staff = await createStaff(id, {
      name: sanitize(name),
      email: email ? sanitize(email) : undefined,
      phone: phone ? sanitize(phone) : undefined,
      role,
      specialties,
      avatar_url,
      service_ids,
    });

    return Response.json(staff, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to create staff member", 500);
  }
}
