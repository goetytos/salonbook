import { seedAdmin } from "@/lib/services/admin.service";
import { errorResponse } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return errorResponse("Email, password, and name are required");
    }

    if (password.length < 8) {
      return errorResponse("Password must be at least 8 characters");
    }

    const admin = await seedAdmin(email, password, name);
    return Response.json({ admin, message: "Admin created successfully" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed";
    return errorResponse(message, 400);
  }
}
