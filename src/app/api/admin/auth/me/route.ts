import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getAdminById } from "@/lib/services/admin.service";
import { errorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const adminId = await requireAdminAuth(request);
    const admin = await getAdminById(adminId);
    if (!admin) return errorResponse("Administrator not found", 404);
    return Response.json({ admin });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch administrator", 500);
  }
}
