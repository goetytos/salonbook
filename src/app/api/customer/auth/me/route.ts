import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/auth";
import { getCustomerById } from "@/lib/services/customer.service";
import { errorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const customerId = requireCustomerAuth(request);
    const customer = await getCustomerById(customerId);
    if (!customer) return errorResponse("Customer not found", 404);

    return Response.json({ customer });
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch profile", 500);
  }
}
