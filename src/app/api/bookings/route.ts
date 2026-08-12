import { after, NextRequest } from "next/server";
import {
  BookingServiceError,
  createBooking,
} from "@/lib/services/booking.service";
import { getBusinessBySlug } from "@/lib/services/business.service";
import {
  isPastDateTimeInNairobi,
  normalizeKenyanPhone,
  sanitize,
  validateDateFormat,
  validateTimeFormat,
  validateUuid,
  errorResponse,
} from "@/lib/validation";
import {
  PUBLIC_BOOKING_RATE_LIMIT,
  RateLimitUnavailableError,
  enforceRateLimit,
  rateLimitExceededResponse,
  rateLimitUnavailableResponse,
} from "@/lib/security/rate-limit";
import { dispatchNotificationOutbox } from "@/lib/services/notification-outbox.service";
import { logServerError } from "@/lib/server/logging";
import { sameOriginJsonMutationGuard } from "@/lib/auth-session";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(
  value: unknown,
  minimumLength: number,
  maximumLength: number
): string | null {
  if (typeof value !== "string" || value.length > maximumLength) return null;

  const trimmed = value.trim();
  if (
    trimmed.length < minimumLength ||
    trimmed.length > maximumLength ||
    sanitize(trimmed) !== trimmed
  ) {
    return null;
  }

  return trimmed;
}

// POST /api/bookings — create a booking (public, no auth required)
export async function POST(request: NextRequest) {
  const rejected = sameOriginJsonMutationGuard(request);
  if (rejected) return rejected;

  try {
    const body: unknown = await request.json();
    if (!isJsonObject(body)) {
      return errorResponse("Request body must be a JSON object");
    }

    const businessSlug = boundedString(body.business_slug, 1, 255);
    const serviceId = boundedString(body.service_id, 36, 36);
    const date = boundedString(body.date, 10, 10);
    const time = boundedString(body.time, 5, 5);
    const cleanName = boundedString(body.customer_name, 2, 120);
    const rawPhone = boundedString(body.customer_phone, 10, 32);

    if (
      !businessSlug ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(businessSlug) ||
      !serviceId ||
      !validateUuid(serviceId) ||
      !date ||
      !time ||
      !cleanName ||
      !rawPhone
    ) {
      return errorResponse("Invalid or missing booking fields");
    }

    const cleanPhone = normalizeKenyanPhone(rawPhone);
    if (!cleanPhone) {
      return errorResponse("Invalid phone number. Use format: 07XXXXXXXX or +254XXXXXXXXX");
    }

    const rateLimit = await enforceRateLimit(request, PUBLIC_BOOKING_RATE_LIMIT, [
      { kind: "phone", value: cleanPhone },
    ]);
    if (!rateLimit.allowed) return rateLimitExceededResponse(rateLimit);

    if (!validateDateFormat(date)) {
      return errorResponse("Invalid date format. Use YYYY-MM-DD");
    }

    if (!validateTimeFormat(time)) {
      return errorResponse("Invalid time format. Use HH:mm");
    }

    if (isPastDateTimeInNairobi(date, time)) {
      return errorResponse("Booking time must be in the future");
    }

    let staffId: string | undefined;
    if (body.staff_id !== undefined && body.staff_id !== null) {
      staffId = boundedString(body.staff_id, 36, 36) || undefined;
      if (!staffId || !validateUuid(staffId)) {
        return errorResponse("Invalid staff identifier");
      }
    }

    let cleanNotes: string | undefined;
    if (body.notes !== undefined && body.notes !== null) {
      cleanNotes = boundedString(body.notes, 0, 1000) ?? undefined;
      if (cleanNotes === undefined) {
        return errorResponse("Notes must be 1000 characters or fewer");
      }
      if (cleanNotes.length === 0) cleanNotes = undefined;
    }

    let promotionCode: string | undefined;
    if (body.promotion_code !== undefined && body.promotion_code !== null) {
      promotionCode = boundedString(body.promotion_code, 1, 50) || undefined;
      if (!promotionCode) {
        return errorResponse("Invalid promotion code");
      }
      promotionCode = promotionCode.toUpperCase();
    }

    // Resolve business from slug
    const business = await getBusinessBySlug(businessSlug);
    if (!business) {
      return errorResponse("Business not found", 404);
    }

    const booking = await createBooking(
      business.id,
      serviceId,
      cleanName,
      cleanPhone,
      date,
      time,
      staffId,
      cleanNotes,
      promotionCode
    );

    // Opportunistically dispatch only the durable intents after the response.
    // The secured worker remains authoritative if this invocation is stopped.
    after(async () => {
      try {
        await dispatchNotificationOutbox({
          bookingId: booking.id,
          batchSize: 2,
        });
      } catch (error) {
        logServerError("api.bookings.notification_outbox", error);
      }
    });

    return Response.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return rateLimitUnavailableResponse();
    }
    if (error instanceof BookingServiceError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof SyntaxError) {
      return errorResponse("Invalid JSON body");
    }
    return errorResponse("Failed to create booking", 500);
  }
}
