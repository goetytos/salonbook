import { loginAdmin } from "@/lib/services/admin.service";
import { errorResponse, sanitize, validateEmail } from "@/lib/validation";

export async function POST(request: Request) {
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

    const result = await loginAdmin(cleanEmail, password);
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON body");
    return errorResponse("Invalid email or password", 401);
  }
}
