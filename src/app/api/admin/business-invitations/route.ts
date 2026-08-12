import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { authenticationMutationGuard } from "@/lib/auth-session";
import {
  BusinessInvitationError,
  DEFAULT_BUSINESS_INVITATION_HOURS,
  createBusinessInvitation,
} from "@/lib/services/business-invitation.service";
import { errorResponse, sanitize, validateEmail } from "@/lib/validation";

function configuredSiteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        url.protocol === "https:" ||
        (url.protocol === "http:" &&
          (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
      ) {
        return url.origin;
      }
    } catch {
      // Fall through to the already same-origin request URL.
    }
  }
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  // This endpoint always requires a deliberate same-origin JSON request, even
  // during the temporary legacy-bearer compatibility window.
  const rejected = authenticationMutationGuard(request);
  if (rejected) return rejected;

  try {
    const adminId = await requireAdminAuth(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }

    const { email, expires_in_hours } = body as Record<string, unknown>;
    if (typeof email !== "string") {
      return errorResponse("Invitation email is required");
    }
    const cleanEmail = sanitize(email).toLowerCase();
    if (cleanEmail.length > 255 || !validateEmail(cleanEmail)) {
      return errorResponse("Enter a valid invitation email address");
    }
    if (
      expires_in_hours !== undefined &&
      (typeof expires_in_hours !== "number" ||
        !Number.isInteger(expires_in_hours))
    ) {
      return errorResponse("Invitation expiry must be a whole number of hours");
    }

    const created = await createBusinessInvitation(
      adminId,
      cleanEmail,
      expires_in_hours ?? DEFAULT_BUSINESS_INVITATION_HOURS
    );
    const signupUrl = new URL("/auth/signup", configuredSiteOrigin(request));
    // Keep the bearer capability in the URL fragment. Fragments are available
    // to the signup page but are not sent in HTTP requests or Referer headers.
    signupUrl.hash = new URLSearchParams({
      invite: created.token,
      email: created.invitation.email,
    }).toString();

    return Response.json(
      {
        invitation: created.invitation,
        signup_link: signupUrl.toString(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    if (error instanceof BusinessInvitationError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Invitation could not be created", 500);
  }
}
