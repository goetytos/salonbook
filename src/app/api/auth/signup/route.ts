import { NextRequest } from "next/server";
import { registerBusiness } from "@/lib/services/business.service";
import {
  validateEmail,
  validatePhone,
  normalizeKenyanPhone,
  validatePassword,
  sanitize,
  errorResponse,
} from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Request body must be a JSON object");
    }
    const { name, email, password, phone, location } = body as Record<
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

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPhone = normalizeKenyanPhone(phone);
    const cleanLocation = sanitize(location);

    if (cleanName.length < 2 || cleanName.length > 120) {
      return errorResponse("Business name must be between 2 and 120 characters");
    }
    if (cleanEmail.length > 320 || !validateEmail(cleanEmail)) {
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

    const result = await registerBusiness(
      cleanName,
      cleanEmail,
      password,
      cleanPhone,
      cleanLocation
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
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
