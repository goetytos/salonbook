import { NextRequest } from "next/server";
import { loginBusiness } from "@/lib/services/business.service";
import { sanitize, errorResponse } from "@/lib/validation";

export async function POST(request: NextRequest) {
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
    const result = await loginBusiness(cleanEmail, password);

    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    const message = error instanceof Error ? error.message : "Login failed";
    return errorResponse(
      message === "Business account is suspended"
        ? message
        : "Invalid email or password",
      message === "Business account is suspended" ? 403 : 401
    );
  }
}
