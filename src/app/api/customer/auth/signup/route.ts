import { NextRequest } from "next/server";
import {
  CustomerRegistrationError,
  registerCustomer,
} from "@/lib/services/customer.service";
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
    const { name, email, password, phone } = body as Record<string, unknown>;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof phone !== "string"
    ) {
      return errorResponse("All fields are required");
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPhone = normalizeKenyanPhone(phone);

    if (cleanName.length < 2 || cleanName.length > 120) {
      return errorResponse("Name must be between 2 and 120 characters");
    }
    if (cleanEmail.length > 320 || !validateEmail(cleanEmail)) {
      return errorResponse("Invalid email format");
    }
    if (!validatePhone(phone) || !cleanPhone) {
      return errorResponse("Invalid phone number. Use format: 07XXXXXXXX or +254XXXXXXXXX");
    }
    const passwordError = validatePassword(password);
    if (passwordError) return errorResponse(passwordError);

    const result = await registerCustomer(cleanName, cleanEmail, password, cleanPhone);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    if (error instanceof CustomerRegistrationError) {
      return errorResponse("Email already registered", 409);
    }
    return errorResponse("Registration failed", 500);
  }
}
