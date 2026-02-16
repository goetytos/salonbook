import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBusinessById, getDashboardStats } from "@/lib/services/business.service";
import { errorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const businessId = requireAuth(request);
    const business = await getBusinessById(businessId);

    if (!business) {
      return errorResponse("Business not found", 404);
    }

    const stats = await getDashboardStats(businessId);

    return Response.json({ business, stats });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch profile", 500);
  }
}
