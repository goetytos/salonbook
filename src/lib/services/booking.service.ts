import { query, queryOne, transaction } from "@/lib/db";
import { reservePromotionUsage } from "@/lib/services/promotion.service";
import {
  enqueueBookingCancellationIntent,
  enqueueBookingNotificationIntents,
} from "@/lib/services/notification-outbox.service";
import {
  getNairobiDateTime,
  isPastDateTimeInNairobi,
  normalizeKenyanPhone,
  sanitize,
  validateDateFormat,
  validateTimeFormat,
  validateUuid,
} from "@/lib/validation";
import type { Booking, TimeSlot, WorkingHours } from "@/types";

type BookingErrorStatus = 400 | 404 | 409;

export class BookingServiceError extends Error {
  readonly status: BookingErrorStatus;

  constructor(message: string, status: BookingErrorStatus) {
    super(message);
    this.name = "BookingServiceError";
    this.status = status;
  }
}

const DAY_KEYS: (keyof WorkingHours)[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function timeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const time = value.slice(0, 5);
  if (!validateTimeFormat(time)) return null;

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
    return null;
  }

  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
}

function getScheduleWindow(
  workingHours: WorkingHours,
  date: string
): { open: number; close: number } | null {
  const dayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
  const schedule = workingHours?.[DAY_KEYS[dayIndex]];
  if (!schedule || schedule.closed) return null;

  const open = timeToMinutes(schedule.open);
  const close = timeToMinutes(schedule.close);
  if (open === null || close === null || open >= close) return null;
  return { open, close };
}

function getCombinedScheduleWindow(
  businessHours: WorkingHours,
  date: string,
  staffHours?: WorkingHours
): { open: number; close: number } | null {
  const businessWindow = getScheduleWindow(businessHours, date);
  if (!businessWindow) return null;
  if (!staffHours) return businessWindow;

  const staffWindow = getScheduleWindow(staffHours, date);
  if (!staffWindow) return null;

  const open = Math.max(businessWindow.open, staffWindow.open);
  const close = Math.min(businessWindow.close, staffWindow.close);
  return open < close ? { open, close } : null;
}

function normalizeBuffer(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }

  const buffer = Number(value);
  return Number.isInteger(buffer) && buffer >= 0 && buffer <= 24 * 60
    ? buffer
    : null;
}

function moneyToCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;

  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

function centsToMoney(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function calculateDiscountCents(
  priceCents: number,
  discountType: unknown,
  discountValue: unknown
): number | null {
  const valueCents = moneyToCents(discountValue);
  if (valueCents === null || valueCents <= 0) return null;

  if (discountType === "fixed") {
    return Math.min(valueCents, priceCents);
  }
  if (discountType === "percentage") {
    const calculated = Math.round((priceCents * valueCents) / 10_000);
    return Math.min(calculated, priceCents);
  }

  return null;
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart;
}

/** Generate available time slots for a given business, date, and service duration */
export async function getAvailableSlots(
  businessId: string,
  date: string,
  durationMinutes: number,
  staffId?: string,
  serviceId?: string
): Promise<TimeSlot[]> {
  if (
    !validateUuid(businessId) ||
    !validateDateFormat(date) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 480 ||
    (staffId !== undefined && !validateUuid(staffId)) ||
    (serviceId !== undefined && !validateUuid(serviceId))
  ) {
    return [];
  }

  businessId = businessId.toLowerCase();
  if (staffId) staffId = staffId.toLowerCase();
  if (serviceId) serviceId = serviceId.toLowerCase();

  const currentNairobi = getNairobiDateTime();
  if (date < currentNairobi.date) return [];

  const business = await queryOne<{
    working_hours: WorkingHours;
    buffer_minutes: number;
  }>(
    `SELECT working_hours, COALESCE(buffer_minutes, 0)::int AS buffer_minutes
     FROM businesses
     WHERE id = $1 AND status = 'active'`,
    [businessId]
  );
  if (!business) return [];

  const businessBuffer = normalizeBuffer(business.buffer_minutes);
  if (businessBuffer === null) return [];

  let staffHours: WorkingHours | undefined;
  if (staffId) {
    const staff = await queryOne<{ working_hours: WorkingHours }>(
      `SELECT working_hours
       FROM staff
       WHERE id = $1 AND business_id = $2 AND active = true`,
      [staffId, businessId]
    );
    if (!staff) return [];
    staffHours = staff.working_hours;
  }

  let effectiveDuration = durationMinutes;
  let serviceBuffer: number | null;

  if (serviceId) {
    const service = await queryOne<{
      duration_minutes: number;
      buffer_minutes: number;
    }>(
      `SELECT duration_minutes, COALESCE(buffer_minutes, 0)::int AS buffer_minutes
       FROM services
       WHERE id = $1 AND business_id = $2 AND active = true`,
      [serviceId, businessId]
    );
    if (!service) return [];

    effectiveDuration = Number(service.duration_minutes);
    serviceBuffer = normalizeBuffer(service.buffer_minutes);

    if (staffId) {
      const assignment = await queryOne<{ assigned: boolean }>(
        `SELECT true AS assigned
         FROM staff_services
         WHERE staff_id = $1 AND service_id = $2`,
        [staffId, serviceId]
      );
      if (!assignment) return [];
    }
  } else {
    const params: unknown[] = [businessId, durationMinutes];
    let serviceSql = `SELECT MAX(COALESCE(s.buffer_minutes, 0))::int AS buffer_minutes
      FROM services s`;

    if (staffId) {
      params.push(staffId);
      serviceSql += `
        JOIN staff_services ss ON ss.service_id = s.id AND ss.staff_id = $3`;
    }

    serviceSql += `
      WHERE s.business_id = $1 AND s.duration_minutes = $2 AND s.active = true`;
    const service = await queryOne<{ buffer_minutes: number | null }>(
      serviceSql,
      params
    );
    serviceBuffer = normalizeBuffer(service?.buffer_minutes);
  }

  if (
    !Number.isInteger(effectiveDuration) ||
    effectiveDuration < 1 ||
    effectiveDuration > 480 ||
    serviceBuffer === null
  ) {
    return [];
  }

  const schedule = getCombinedScheduleWindow(
    business.working_hours,
    date,
    staffHours
  );
  if (!schedule) return [];

  const blockedRanges = await query<{
    start_time: string | null;
    end_time: string | null;
  }>(
    `SELECT start_time::text, end_time::text
     FROM blocked_dates
     WHERE business_id = $1 AND date = $2
       AND (staff_id IS NULL OR ($3::uuid IS NOT NULL AND staff_id = $3::uuid))`,
    [businessId, date, staffId || null]
  );
  if (
    blockedRanges.some(({ start_time: start, end_time: end }) => {
      const startMinutes = timeToMinutes(start);
      const endMinutes = timeToMinutes(end);
      return (
        startMinutes === null ||
        endMinutes === null ||
        startMinutes >= endMinutes
      );
    })
  ) {
    return [];
  }

  let bookingSql = `SELECT b.time::text, b.end_time::text,
      GREATEST(COALESCE(s.buffer_minutes, 0), $3::int)::int AS buffer_minutes
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    WHERE b.business_id = $1 AND b.date = $2
      AND b.status NOT IN ('Cancelled', 'No-Show')`;
  const bookingParams: unknown[] = [businessId, date, businessBuffer];

  if (staffId) {
    bookingParams.push(staffId);
    bookingSql += ` AND b.staff_id = $4`;
  } else {
    bookingSql += ` AND b.staff_id IS NULL`;
  }

  const existingBookings = await query<{
    time: string;
    end_time: string;
    buffer_minutes: number;
  }>(bookingSql, bookingParams);
  const effectiveBuffer = Math.max(serviceBuffer, businessBuffer);

  const slots: TimeSlot[] = [];
  for (
    let slotStartMinutes = schedule.open;
    slotStartMinutes + effectiveDuration <= schedule.close;
    slotStartMinutes += 30
  ) {
    const slotTime = minutesToTime(slotStartMinutes);
    if (!slotTime) continue;

    const appointmentEnd = slotStartMinutes + effectiveDuration;
    const bufferedEnd = appointmentEnd + effectiveBuffer;
    const overlapsBooking = existingBookings.some((booking) => {
      const bookingStart = timeToMinutes(booking.time);
      const bookingEnd = timeToMinutes(booking.end_time);
      const bookingBuffer = normalizeBuffer(booking.buffer_minutes);
      return (
        bookingStart === null ||
        bookingEnd === null ||
        bookingBuffer === null ||
        rangesOverlap(
          slotStartMinutes,
          bufferedEnd,
          bookingStart,
          bookingEnd + bookingBuffer
        )
      );
    });
    const overlapsBlocked = blockedRanges.some((block) => {
      const blockStart = timeToMinutes(block.start_time);
      const blockEnd = timeToMinutes(block.end_time);
      return (
        blockStart === null ||
        blockEnd === null ||
        rangesOverlap(slotStartMinutes, appointmentEnd, blockStart, blockEnd)
      );
    });

    slots.push({
      time: slotTime,
      available:
        !isPastDateTimeInNairobi(date, slotTime) &&
        !overlapsBooking &&
        !overlapsBlocked,
    });
  }

  return slots;
}

/** Create a booking with all availability checks and writes in one transaction. */
export async function createBooking(
  businessId: string,
  serviceId: string,
  customerName: string,
  customerPhone: string,
  date: string,
  time: string,
  staffId?: string,
  notes?: string,
  promotionCode?: string
): Promise<Booking> {
  const cleanName = sanitize(customerName);
  const cleanPhone = normalizeKenyanPhone(customerPhone);
  const cleanNotes = notes === undefined ? undefined : sanitize(notes);
  const cleanPromotionCode =
    promotionCode === undefined ? undefined : sanitize(promotionCode).toUpperCase();

  if (!validateUuid(businessId) || !validateUuid(serviceId)) {
    throw new BookingServiceError("Invalid booking identifier", 400);
  }
  if (staffId !== undefined && !validateUuid(staffId)) {
    throw new BookingServiceError("Invalid staff identifier", 400);
  }
  if (!validateDateFormat(date) || !validateTimeFormat(time)) {
    throw new BookingServiceError("Invalid booking date or time", 400);
  }
  if (isPastDateTimeInNairobi(date, time)) {
    throw new BookingServiceError("Booking time must be in the future", 400);
  }
  if (cleanName.length < 2 || cleanName.length > 120 || !cleanPhone) {
    throw new BookingServiceError("Invalid customer details", 400);
  }
  if (cleanNotes !== undefined && cleanNotes.length > 1000) {
    throw new BookingServiceError("Notes must be 1000 characters or fewer", 400);
  }
  if (
    cleanPromotionCode !== undefined &&
    (cleanPromotionCode.length < 1 || cleanPromotionCode.length > 50)
  ) {
    throw new BookingServiceError("Invalid promotion code", 400);
  }

  businessId = businessId.toLowerCase();
  serviceId = serviceId.toLowerCase();
  if (staffId) staffId = staffId.toLowerCase();

  try {
    return await transaction(async (client) => {
      const lockResource = `salonbook:booking:${businessId}:${
        staffId || "unassigned"
      }:${date}`;
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [lockResource]
      );

      const clock = await client.query<{ date: string; time: string }>(
        `SELECT
           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS date,
           to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi', 'HH24:MI') AS time`
      );
      const current = clock.rows[0];
      if (
        !current ||
        date < current.date ||
        (date === current.date && time <= current.time)
      ) {
        throw new BookingServiceError("Booking time must be in the future", 400);
      }

      const businessResult = await client.query<{
        working_hours: WorkingHours;
        buffer_minutes: number;
      }>(
        `SELECT working_hours, COALESCE(buffer_minutes, 0)::int AS buffer_minutes
         FROM businesses
         WHERE id = $1 AND status = 'active'
         FOR SHARE`,
        [businessId]
      );
      const business = businessResult.rows[0];
      if (!business) {
        throw new BookingServiceError("Business is not available", 404);
      }

      const serviceResult = await client.query<{
        name: string;
        price: string | number;
        duration_minutes: number;
        buffer_minutes: number;
      }>(
        `SELECT name, price, duration_minutes,
                COALESCE(buffer_minutes, 0)::int AS buffer_minutes
         FROM services
         WHERE id = $1 AND business_id = $2 AND active = true
         FOR SHARE`,
        [serviceId, businessId]
      );
      const service = serviceResult.rows[0];
      if (!service) {
        throw new BookingServiceError("Service is not available", 404);
      }

      const durationMinutes = Number(service.duration_minutes);
      const servicePriceCents = moneyToCents(service.price);
      const serviceBuffer = normalizeBuffer(service.buffer_minutes);
      const businessBuffer = normalizeBuffer(business.buffer_minutes);
      if (
        typeof service.name !== "string" ||
        service.name.length < 1 ||
        service.name.length > 255 ||
        servicePriceCents === null ||
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 1 ||
        durationMinutes > 480 ||
        serviceBuffer === null ||
        businessBuffer === null
      ) {
        throw new BookingServiceError("Booking configuration is invalid", 409);
      }

      let staffHours: WorkingHours | undefined;
      if (staffId) {
        const staffResult = await client.query<{ working_hours: WorkingHours }>(
          `SELECT s.working_hours
           FROM staff s
           JOIN staff_services ss
             ON ss.staff_id = s.id AND ss.service_id = $3
           WHERE s.id = $1 AND s.business_id = $2 AND s.active = true
           FOR SHARE OF s`,
          [staffId, businessId, serviceId]
        );
        const staff = staffResult.rows[0];
        if (!staff) {
          throw new BookingServiceError(
            "Staff member is not available for this service",
            404
          );
        }
        staffHours = staff.working_hours;
      }

      const schedule = getCombinedScheduleWindow(
        business.working_hours,
        date,
        staffHours
      );
      const startMinutes = timeToMinutes(time);
      const endMinutes =
        startMinutes === null ? null : startMinutes + durationMinutes;
      const endTime = endMinutes === null ? null : minutesToTime(endMinutes);
      if (
        !schedule ||
        startMinutes === null ||
        endMinutes === null ||
        !endTime ||
        startMinutes < schedule.open ||
        endMinutes > schedule.close
      ) {
        throw new BookingServiceError(
          "Selected time is outside working hours",
          409
        );
      }

      const blockedResult = await client.query<{
        start_time: string | null;
        end_time: string | null;
      }>(
        `SELECT start_time::text, end_time::text
         FROM blocked_dates
         WHERE business_id = $1 AND date = $2
           AND (staff_id IS NULL OR ($3::uuid IS NOT NULL AND staff_id = $3::uuid))
         FOR SHARE`,
        [businessId, date, staffId || null]
      );
      const isBlocked = blockedResult.rows.some((block) => {
        const blockStart = timeToMinutes(block.start_time);
        const blockEnd = timeToMinutes(block.end_time);
        return (
          blockStart === null ||
          blockEnd === null ||
          blockStart >= blockEnd ||
          rangesOverlap(startMinutes, endMinutes, blockStart, blockEnd)
        );
      });
      if (isBlocked) {
        throw new BookingServiceError("Selected time is blocked", 409);
      }

      const effectiveBuffer = Math.max(serviceBuffer, businessBuffer);
      const bufferedEndMinutes = endMinutes + effectiveBuffer;
      let overlapSql = `SELECT b.id
        FROM bookings b
        JOIN services existing_service ON existing_service.id = b.service_id
        WHERE b.business_id = $1 AND b.date = $2
          AND b.status NOT IN ('Cancelled', 'No-Show')
          AND $3::int < (
            EXTRACT(EPOCH FROM b.end_time) / 60
            + GREATEST(COALESCE(existing_service.buffer_minutes, 0), $5::int)
          )
          AND $4::int > EXTRACT(EPOCH FROM b.time) / 60`;
      const overlapParams: unknown[] = [
        businessId,
        date,
        startMinutes,
        bufferedEndMinutes,
        businessBuffer,
      ];

      if (staffId) {
        overlapParams.push(staffId);
        overlapSql += ` AND b.staff_id = $6`;
      } else {
        overlapSql += ` AND b.staff_id IS NULL`;
      }
      overlapSql += " LIMIT 1";

      const overlapResult = await client.query(overlapSql, overlapParams);
      if (overlapResult.rows.length > 0) {
        throw new BookingServiceError(
          "This time slot is no longer available",
          409
        );
      }

      let promotionId: string | null = null;
      let discountCents = 0;
      if (cleanPromotionCode) {
        const promotion = await reservePromotionUsage(
          client,
          businessId,
          cleanPromotionCode,
          serviceId,
          date
        );
        if (promotion.status !== "reserved") {
          if (promotion.status === "limit_reached") {
            throw new BookingServiceError(
              "Promotion usage limit has been reached",
              409
            );
          }
          throw new BookingServiceError("Invalid or expired promotion code", 400);
        }
        promotionId = promotion.promotion.id;
        const calculatedDiscount = calculateDiscountCents(
          servicePriceCents,
          promotion.promotion.discount_type,
          promotion.promotion.discount_value
        );
        if (calculatedDiscount === null) {
          throw new BookingServiceError(
            "Promotion configuration is invalid",
            409
          );
        }
        discountCents = calculatedDiscount;
      }
      const finalPriceCents = servicePriceCents - discountCents;

      const customerResult = await client.query<{ id: string }>(
        `INSERT INTO customers (name, phone)
         VALUES ($1, $2)
         ON CONFLICT (name, phone)
           WHERE email IS NULL AND password_hash IS NULL
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [cleanName, cleanPhone]
      );
      const customerId = customerResult.rows[0]?.id;
      if (!customerId) {
        throw new Error("Customer upsert did not return an identifier");
      }

      const bookingResult = await client.query<Booking>(
        `INSERT INTO bookings
           (business_id, service_id, customer_id, staff_id, date, time, end_time,
            status, notes, promotion_id, service_name_snapshot,
            service_price_snapshot, discount_amount, final_price)
         VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, 'Booked', $8, $9,
                 $10, $11::numeric, $12::numeric, $13::numeric)
         RETURNING *`,
        [
          businessId,
          serviceId,
          customerId,
          staffId || null,
          date,
          time,
          endTime,
          cleanNotes || null,
          promotionId,
          service.name,
          centsToMoney(servicePriceCents),
          centsToMoney(discountCents),
          centsToMoney(finalPriceCents),
        ]
      );
      const booking = bookingResult.rows[0];
      if (!booking) throw new Error("Booking insert returned no row");

      // A booking is not committed unless both PII-minimized notification
      // intents are durable in the same transaction.
      await enqueueBookingNotificationIntents(client, booking.id);
      return booking;
    });
  } catch (error) {
    if (error instanceof BookingServiceError) throw error;

    const databaseError = error as { code?: unknown; message?: unknown };
    if (
      databaseError.code === "23P01" ||
      databaseError.code === "23505" ||
      (databaseError.code === "P0001" &&
        typeof databaseError.message === "string" &&
        databaseError.message.toLowerCase().includes("overlap"))
    ) {
      throw new BookingServiceError(
        "This time slot is no longer available",
        409
      );
    }
    if (databaseError.code === "23503") {
      throw new BookingServiceError(
        "Booking details changed; please refresh and try again",
        409
      );
    }
    if (databaseError.code === "23514") {
      throw new BookingServiceError("Booking configuration is invalid", 409);
    }

    throw error;
  }
}

/** Get all bookings for a business with customer and service info */
export async function getBusinessBookings(
  businessId: string,
  filters?: { date?: string; status?: string }
): Promise<Booking[]> {
  let sql = `
    SELECT b.*,
           COALESCE(b.service_name_snapshot, s.name) as service_name,
           COALESCE(b.service_price_snapshot, s.price) as service_price,
           s.duration_minutes as service_duration,
           c.name as customer_name, c.phone as customer_phone,
           st.name as staff_name
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN staff st ON b.staff_id = st.id
    WHERE b.business_id = $1
  `;
  const params: unknown[] = [businessId];

  if (filters?.date) {
    params.push(filters.date);
    sql += ` AND b.date = $${params.length}`;
  }

  if (filters?.status) {
    params.push(filters.status);
    sql += ` AND b.status = $${params.length}`;
  }

  sql += " ORDER BY b.date DESC, b.time ASC";

  return query<Booking>(sql, params);
}

/** Update booking status */
export async function updateBookingStatus(
  bookingId: string,
  businessId: string,
  status: string
): Promise<Booking | null> {
  return transaction(async (client) => {
    const currentResult = await client.query<Booking>(
      `SELECT * FROM bookings
       WHERE id = $1 AND business_id = $2
       FOR UPDATE`,
      [bookingId, businessId]
    );
    const current = currentResult.rows[0] ?? null;
    if (!current) return null;

    // Repeated writes of the current status are idempotent. Once a booking is
    // terminal it cannot be reopened or changed to a different terminal state.
    if (current.status === status) return current;
    if (current.status !== "Booked" || status === "Booked") {
      throw new BookingServiceError(
        "A terminal booking status cannot be changed",
        409
      );
    }

    const bookingResult = await client.query<Booking>(
      `UPDATE bookings SET status = $1, no_show = $4
       WHERE id = $2 AND business_id = $3 AND status = 'Booked'
       RETURNING *`,
      [status, bookingId, businessId, status === "No-Show"]
    );
    const booking = bookingResult.rows[0];
    if (!booking) {
      throw new BookingServiceError(
        "Booking status changed; refresh and try again",
        409
      );
    }

    await client.query(
      `UPDATE notification_outbox
       SET status = 'dead',
           lease_token = NULL,
           lease_expires_at = NULL,
           last_error_code = 'booking_not_booked',
           provider_message_id = NULL,
           accepted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1
         AND type IN ('booking_confirmation', 'booking_owner_alert')
         AND status IN ('pending', 'processing')`,
      [bookingId]
    );

    if (status === "Cancelled") {
      await enqueueBookingCancellationIntent(client, bookingId);
    }

    return booking;
  });
}

/** Get weekly bookings for calendar view */
export async function getWeeklyBookings(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<Booking[]> {
  return query<Booking>(
    `SELECT b.*,
            COALESCE(b.service_name_snapshot, s.name) as service_name,
            COALESCE(b.service_price_snapshot, s.price) as service_price,
            s.duration_minutes as service_duration,
            c.name as customer_name, c.phone as customer_phone,
            st.name as staff_name
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN customers c ON b.customer_id = c.id
     LEFT JOIN staff st ON b.staff_id = st.id
     WHERE b.business_id = $1 AND b.date >= $2 AND b.date <= $3
       AND b.status NOT IN ('Cancelled', 'No-Show')
     ORDER BY b.date ASC, b.time ASC`,
    [businessId, startDate, endDate]
  );
}
