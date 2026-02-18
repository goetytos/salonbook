import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientDetail } from "@/lib/services/client.service";
import { errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/customers/[customerId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id, customerId } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const client = await getClientDetail(id, customerId);
    if (!client) return errorResponse("Customer not found", 404);

    return Response.json(client);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch customer", 500);
  }
}
