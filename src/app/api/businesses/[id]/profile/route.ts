import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateBusinessProfile } from "@/lib/services/business.service";
import { errorResponse, normalizeHttpsUrl, sanitize } from "@/lib/validation";

const CATEGORIES = new Set([
  "hair-salon",
  "barbershop",
  "nail-salon",
  "spa",
  "beauty-salon",
  "braids",
  "makeup",
  "other",
]);

const SOCIAL_LINK_KEYS = new Set(["instagram", "facebook", "tiktok", "website"]);

// PUT /api/businesses/[id]/profile — update business profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await requireAuth(request);
    const { id } = await params;
    if (businessId !== id) return errorResponse("Forbidden", 403);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const input = body as Record<string, unknown>;
    const updates: Parameters<typeof updateBusinessProfile>[1] = {};

    if (input.description !== undefined) {
      if (typeof input.description !== "string") {
        return errorResponse("Description must be text");
      }
      const description = sanitize(input.description);
      if (description.length > 2000) {
        return errorResponse("Description must be 2000 characters or fewer");
      }
      updates.description = description;
    }
    if (input.category !== undefined) {
      if (typeof input.category !== "string") {
        return errorResponse("Category must be text");
      }
      const category = sanitize(input.category);
      if (category && !CATEGORIES.has(category)) {
        return errorResponse("Category is not supported");
      }
      updates.category = category;
    }
    for (const [inputKey, updateKey] of [
      ["cover_image_url", "cover_image_url"],
      ["avatar_url", "avatar_url"],
    ] as const) {
      const value = input[inputKey];
      if (value !== undefined) {
        if (typeof value !== "string") {
          return errorResponse(`${inputKey} must be a URL`);
        }
        const cleanValue = sanitize(value);
        if (cleanValue) {
          const normalized = normalizeHttpsUrl(cleanValue);
          if (!normalized) return errorResponse(`${inputKey} must be a valid HTTPS URL`);
          updates[updateKey] = normalized;
        } else {
          updates[updateKey] = "";
        }
      }
    }
    if (input.buffer_minutes !== undefined) {
      if (
        !Number.isInteger(input.buffer_minutes) ||
        (input.buffer_minutes as number) < 0 ||
        (input.buffer_minutes as number) > 240
      ) {
        return errorResponse("Buffer must be between 0 and 240 minutes");
      }
      updates.buffer_minutes = input.buffer_minutes as number;
    }
    if (input.cancellation_hours !== undefined) {
      if (
        !Number.isInteger(input.cancellation_hours) ||
        (input.cancellation_hours as number) < 0 ||
        (input.cancellation_hours as number) > 720
      ) {
        return errorResponse("Cancellation window must be between 0 and 720 hours");
      }
      updates.cancellation_hours = input.cancellation_hours as number;
    }
    if (input.deposit_required !== undefined) {
      if (typeof input.deposit_required !== "boolean") {
        return errorResponse("deposit_required must be boolean");
      }
      updates.deposit_required = input.deposit_required;
    }
    if (input.social_links !== undefined) {
      if (
        !input.social_links ||
        typeof input.social_links !== "object" ||
        Array.isArray(input.social_links)
      ) {
        return errorResponse("social_links must be an object");
      }
      const socialLinks: Record<string, string> = {};
      for (const [key, rawValue] of Object.entries(
        input.social_links as Record<string, unknown>
      )) {
        if (!SOCIAL_LINK_KEYS.has(key) || typeof rawValue !== "string") {
          return errorResponse("social_links contains an unsupported value");
        }
        const normalized = normalizeHttpsUrl(rawValue);
        if (!normalized) return errorResponse("Social links must use valid HTTPS URLs");
        socialLinks[key] = normalized;
      }
      updates.social_links = socialLinks;
    }

    const business = await updateBusinessProfile(id, updates);
    if (!business) return errorResponse("Business not found", 404);

    return Response.json(business);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    return errorResponse("Failed to update profile", 500);
  }
}
