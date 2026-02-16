import { NextRequest } from "next/server";
import { registerBusiness } from "@/lib/services/business.service";
import {
  validateEmail,
  validatePhone,
  validatePassword,
  sanitize,
  errorResponse,
} from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, location } = body;

    // Validate required fields
    if (!name || !email || !password || !phone || !location) {
      return errorResponse("All fields are required");
    }

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPhone = sanitize(phone);
    const cleanLocation = sanitize(location);

    if (!validateEmail(cleanEmail)) {
      return errorResponse("Invalid email format");
    }
    if (!validatePhone(cleanPhone)) {
      return errorResponse("Invalid phone number. Use format: 07XXXXXXXX or +254XXXXXXXXX");
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
    const message = error instanceof Error ? error.message : "Registration failed";
    const status = message === "Email already registered" ? 409 : 500;
    return errorResponse(message, status);
  }
}
