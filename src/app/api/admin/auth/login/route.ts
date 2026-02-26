import { loginAdmin } from "@/lib/services/admin.service";
import { errorResponse } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse("Email and password are required");
    }

    const result = await loginAdmin(email, password);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return errorResponse(message, 401);
  }
}
