import { loginAdmin } from "@/lib/services/admin.service";
import { errorResponse, sanitize, validateEmail } from "@/lib/validation";
import {
  ADMIN_LOGIN_RATE_LIMIT,
  RateLimitUnavailableError,
  enforceRateLimit,
  rateLimitExceededResponse,
  rateLimitUnavailableResponse,
} from "@/lib/security/rate-limit";
import {
  authenticatedJsonResponse,
  authenticationMutationGuard,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  const rejected = authenticationMutationGuard(request);
  if (rejected) return rejected;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { email, password } = body as Record<string, unknown>;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 320 ||
      password.length > 128
    ) {
      return errorResponse("Email and password are required");
    }
    const cleanEmail = sanitize(email).toLowerCase();
    if (!validateEmail(cleanEmail)) return errorResponse("Invalid email format");

    const rateLimit = await enforceRateLimit(request, ADMIN_LOGIN_RATE_LIMIT, [
      { kind: "email", value: cleanEmail },
    ]);
    if (!rateLimit.allowed) return rateLimitExceededResponse(rateLimit);

    const result = await loginAdmin(cleanEmail, password);
    const { token, ...safeResult } = result;
    return authenticatedJsonResponse(safeResult, "admin", token);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return rateLimitUnavailableResponse();
    }
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    return errorResponse("Invalid email or password", 401);
  }
}
