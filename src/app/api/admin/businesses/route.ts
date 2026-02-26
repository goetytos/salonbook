import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { listBusinesses } from "@/lib/services/admin.service";
import { errorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    requireAdminAuth(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const businesses = await listBusinesses(status);
    return Response.json(businesses);
  } catch {
    return errorResponse("Failed to list businesses", 500);
  }
}
