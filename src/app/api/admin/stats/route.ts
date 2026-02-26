import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getPlatformStats } from "@/lib/services/admin.service";
import { errorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    requireAdminAuth(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const stats = await getPlatformStats();
    return Response.json(stats);
  } catch {
    return errorResponse("Failed to get stats", 500);
  }
}
