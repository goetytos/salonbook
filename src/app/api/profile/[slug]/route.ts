import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPublicBusinessProfile } from "@/lib/services/business.service";
import { errorResponse } from "@/lib/validation";

// GET /api/profile/[slug] — public business profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (
      slug.length > 255 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      return errorResponse("Business not found", 404);
    }
    let previewBusinessId: string | undefined;
    if (request.nextUrl.searchParams.get("preview") === "1") {
      previewBusinessId = await requireAuth(request);
    }

    const profile = await getPublicBusinessProfile(slug, previewBusinessId);
    if (!profile) return errorResponse("Business not found", 404);
    return Response.json({
      ...profile,
      preview_mode: Boolean(previewBusinessId && profile.status !== "active"),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch business profile", 500);
  }
}
