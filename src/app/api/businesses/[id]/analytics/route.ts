import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAnalytics } from "@/lib/services/analytics.service";
import { errorResponse } from "@/lib/validation";

// GET /api/businesses/[id]/analytics?period=7d|30d|90d
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const url = new URL(request.url);
    const period = (url.searchParams.get("period") || "30d") as "7d" | "30d" | "90d";
    if (!["7d", "30d", "90d"].includes(period)) {
      return errorResponse("period must be 7d, 30d, or 90d");
    }

    const analytics = await getAnalytics(id, period);
    return Response.json(analytics);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch analytics", 500);
  }
}
