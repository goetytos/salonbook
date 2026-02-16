import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBusinessCustomers } from "@/lib/services/business.service";
import { errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/customers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;

    if (businessId !== id) return errorResponse("Forbidden", 403);

    const customers = await getBusinessCustomers(businessId);
    return Response.json(customers);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch customers", 500);
  }
}
