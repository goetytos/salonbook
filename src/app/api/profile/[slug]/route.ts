import { NextRequest } from "next/server";
import { getPublicBusinessProfile } from "@/lib/services/business.service";
import { errorResponse } from "@/lib/validation";

// GET /api/profile/[slug] — public business profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const profile = await getPublicBusinessProfile(slug);
    if (!profile) return errorResponse("Business not found", 404);
    return Response.json(profile);
  } catch {
    return errorResponse("Failed to fetch business profile", 500);
  }
}
