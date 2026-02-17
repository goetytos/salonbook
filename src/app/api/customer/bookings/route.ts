import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/auth";
import { getCustomerBookings } from "@/lib/services/customer.service";
import { errorResponse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const customerId = requireCustomerAuth(request);
    const bookings = await getCustomerBookings(customerId);
    return Response.json(bookings);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Failed to fetch bookings", 500);
  }
}
