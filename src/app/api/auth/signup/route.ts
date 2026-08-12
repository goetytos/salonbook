import { NextRequest } from "next/server";
import { registerBusiness } from "@/lib/services/business.service";
import { BusinessInvitationError } from "@/lib/services/business-invitation.service";
import {
  validateEmail,
  validatePhone,
  normalizeKenyanPhone,
  validatePassword,
  sanitize,
  errorResponse,
} from "@/lib/validation";
import {
  BUSINESS_SIGNUP_RATE_LIMIT,
  RateLimitUnavailableError,
  enforceRateLimit,
  rateLimitExceededResponse,
  rateLimitUnavailableResponse,
} from "@/lib/security/rate-limit";
import {
  authenticatedJsonResponse,
  authenticationMutationGuard,
} from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const rejected = authenticationMutationGuard(request);
  if (rejected) return rejected;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { name, email, password, phone, location, invitation_token } = body as Record<
      string,
      unknown
    >;

    // Validate required fields
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof phone !== "string" ||
      typeof location !== "string"
    ) {
      return errorResponse("All fields are required");
    }

    if (
      typeof invitation_token !== "string" ||
      invitation_token.trim().length === 0 ||
      invitation_token.length > 128
    ) {
      return errorResponse(
        "A valid business invitation is required for this pilot.",
        403
      );
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPhone = normalizeKenyanPhone(phone);
    const cleanLocation = sanitize(location);

    if (cleanName.length < 2 || cleanName.length > 120) {
      return errorResponse("Business name must be between 2 and 120 characters");
    }
    if (cleanEmail.length > 255 || !validateEmail(cleanEmail)) {
      return errorResponse("Invalid email format");
    }
    if (!validatePhone(phone) || !cleanPhone) {
      return errorResponse("Invalid phone number. Use format: 07XXXXXXXX or +254XXXXXXXXX");
    }
    if (cleanLocation.length < 2 || cleanLocation.length > 255) {
      return errorResponse("Location must be between 2 and 255 characters");
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return errorResponse(passwordError);
    }

    const rateLimit = await enforceRateLimit(request, BUSINESS_SIGNUP_RATE_LIMIT, [
      { kind: "email", value: cleanEmail },
      { kind: "phone", value: cleanPhone },
    ]);
    if (!rateLimit.allowed) return rateLimitExceededResponse(rateLimit);

    const result = await registerBusiness(
      cleanName,
      cleanEmail,
      password,
      cleanPhone,
      cleanLocation,
      invitation_token.trim()
    );

    const { token, ...safeResult } = result;
    return authenticatedJsonResponse(safeResult, "business", token, 201);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return rateLimitUnavailableResponse();
    }
    if (error instanceof BusinessInvitationError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    const duplicate =
      error instanceof Error &&
      (error.message === "Email already registered" ||
        ("code" in error && error.code === "23505"));
    return errorResponse(
      duplicate ? "Email already registered" : "Registration failed",
      duplicate ? 409 : 500
    );
  }
}
