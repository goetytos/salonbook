import { NextRequest } from "next/server";
import { getBusinessBySlug } from "@/lib/services/business.service";
import { getServices } from "@/lib/services/service.service";
import { errorResponse } from "@/lib/validation";

// GET /api/bookings/business?slug=kings-barbershop — public route for booking page
export async function GET(request: NextRequest) {
  try {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug) return errorResponse("Slug parameter required");

    const business = await getBusinessBySlug(slug);
    if (!business) return errorResponse("Business not found", 404);

    const services = await getServices(business.id);

    return Response.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        phone: business.phone,
        location: business.location,
      },
      services,
    });
  } catch {
    return errorResponse("Failed to load business", 500);
  }
}
