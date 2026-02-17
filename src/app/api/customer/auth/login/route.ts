import { NextRequest } from "next/server";
import { loginCustomer } from "@/lib/services/customer.service";
import { sanitize, errorResponse } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) return errorResponse("Email and password are required");

    const cleanEmail = sanitize(email).toLowerCase();
    const result = await loginCustomer(cleanEmail, password);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return errorResponse(message, 401);
  }
}
