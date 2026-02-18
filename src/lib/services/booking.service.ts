import { query, queryOne, transaction } from "@/lib/db";
import type { Booking, TimeSlot, WorkingHours } from "@/types";
import { format, parse, addMinutes, isBefore, isEqual } from "date-fns";

/** Generate available time slots for a given business, date, and service duration */
export async function getAvailableSlots(
  businessId: string,
  date: string,
  durationMinutes: number,
  staffId?: string
): Promise<TimeSlot[]> {
  // Get working hours — use staff hours if staffId provided, else business hours
  let workingHours: WorkingHours | null = null;
  let bufferMinutes = 0;

  if (staffId) {
    const staff = await queryOne<{ working_hours: WorkingHours }>(
      "SELECT working_hours FROM staff WHERE id = $1 AND business_id = $2 AND active = true",
      [staffId, businessId]
    );
    if (staff) workingHours = staff.working_hours;
  }

  if (!workingHours) {
    const business = await queryOne<{ working_hours: WorkingHours; buffer_minutes: number }>(
      "SELECT working_hours, COALESCE(buffer_minutes, 0) as buffer_minutes FROM businesses WHERE id = $1",
      [businessId]
    );
    if (!business) return [];
    workingHours = business.working_hours;
    bufferMinutes = business.buffer_minutes || 0;
  }

  // Determine the day of week
  const dayOfWeek = format(
    new Date(date + "T00:00:00"),
    "EEEE"
  ).toLowerCase() as keyof WorkingHours;
  const daySchedule = workingHours[dayOfWeek];

  if (!daySchedule || daySchedule.closed) return [];

  // Check if this date is fully blocked
  const blockedAll = await queryOne<{ id: string }>(
    `SELECT id FROM blocked_dates
     WHERE business_id = $1 AND date = $2
       AND start_time IS NULL AND end_time IS NULL
       AND ($3::uuid IS NULL OR staff_id IS NULL OR staff_id = $3::uuid)`,
    [businessId, date, staffId || null]
  );
  if (blockedAll) return [];

  // Get partial blocks for this date
  const blockedRanges = await query<{ start_time: string; end_time: string }>(
    `SELECT start_time::text, end_time::text FROM blocked_dates
     WHERE business_id = $1 AND date = $2
       AND start_time IS NOT NULL AND end_time IS NOT NULL
       AND ($3::uuid IS NULL OR staff_id IS NULL OR staff_id = $3::uuid)`,
    [businessId, date, staffId || null]
  );

  // Get existing non-cancelled bookings for this date
  let bookingQuery = `SELECT time::text, end_time::text FROM bookings
     WHERE business_id = $1 AND date = $2 AND status NOT IN ('Cancelled', 'No-Show')`;
  const bookingParams: unknown[] = [businessId, date];

  if (staffId) {
    bookingParams.push(staffId);
    bookingQuery += ` AND staff_id = $${bookingParams.length}`;
  } else {
    bookingQuery += ` AND staff_id IS NULL`;
  }

  const existingBookings = await query<{ time: string; end_time: string }>(
    bookingQuery,
    bookingParams
  );

  // Get effective buffer minutes (service buffer > business buffer)
  const serviceBuffer = await queryOne<{ buffer_minutes: number }>(
    `SELECT COALESCE(buffer_minutes, 0) as buffer_minutes FROM services
     WHERE business_id = $1 AND duration_minutes = $2 LIMIT 1`,
    [businessId, durationMinutes]
  );
  const effectiveBuffer = Math.max(serviceBuffer?.buffer_minutes || 0, bufferMinutes);

  // Generate all possible slots in 30-minute increments
  const slots: TimeSlot[] = [];
  const openTime = parse(daySchedule.open, "HH:mm", new Date());
  const closeTime = parse(daySchedule.close, "HH:mm", new Date());
  const totalDuration = durationMinutes + effectiveBuffer;

  let current = openTime;

  while (isBefore(addMinutes(current, durationMinutes), closeTime) || isEqual(addMinutes(current, durationMinutes), closeTime)) {
    const slotStart = format(current, "HH:mm");
    const slotEnd = format(addMinutes(current, totalDuration), "HH:mm");
    const actualEnd = format(addMinutes(current, durationMinutes), "HH:mm");

    // Check if this slot overlaps any existing booking (including buffer)
    const overlapsBooking = existingBookings.some((booking) => {
      const bStart = booking.time.slice(0, 5);
      const bEnd = booking.end_time.slice(0, 5);
      return slotStart < bEnd && slotEnd > bStart;
    });

    // Check if this slot overlaps a blocked range
    const overlapsBlocked = blockedRanges.some((block) => {
      const bStart = block.start_time.slice(0, 5);
      const bEnd = block.end_time.slice(0, 5);
      return slotStart < bEnd && actualEnd > bStart;
    });

    slots.push({ time: slotStart, available: !overlapsBooking && !overlapsBlocked });
    current = addMinutes(current, 30);
  }

  return slots;
}

/** Create a booking with overlap prevention using a transaction lock */
export async function createBooking(
  businessId: string,
  serviceId: string,
  customerName: string,
  customerPhone: string,
  date: string,
  time: string,
  staffId?: string,
  notes?: string,
  promotionId?: string
): Promise<Booking> {
  return transaction(async (client) => {
    // Lock bookings for this business+date to prevent race conditions
    await client.query(
      `SELECT id FROM bookings WHERE business_id = $1 AND date = $2 FOR UPDATE`,
      [businessId, date]
    );

    // Get service duration and buffer
    const serviceResult = await client.query(
      "SELECT duration_minutes, COALESCE(buffer_minutes, 0) as buffer_minutes FROM services WHERE id = $1 AND business_id = $2",
      [serviceId, businessId]
    );
    if (serviceResult.rows.length === 0) {
      throw new Error("Service not found");
    }
    const { duration_minutes: durationMinutes, buffer_minutes: serviceBuffer } = serviceResult.rows[0];

    // Get business buffer
    const bizResult = await client.query(
      "SELECT COALESCE(buffer_minutes, 0) as buffer_minutes FROM businesses WHERE id = $1",
      [businessId]
    );
    const bizBuffer = bizResult.rows[0]?.buffer_minutes || 0;
    const effectiveBuffer = Math.max(serviceBuffer, bizBuffer);

    // Calculate end time (without buffer — buffer is between appointments, not part of the booking)
    const startTime = parse(time, "HH:mm", new Date());
    const endTime = format(addMinutes(startTime, durationMinutes), "HH:mm");

    // If staff assigned, validate staff can perform this service
    if (staffId) {
      const staffService = await client.query(
        "SELECT 1 FROM staff_services WHERE staff_id = $1 AND service_id = $2",
        [staffId, serviceId]
      );
      if (staffService.rows.length === 0) {
        throw new Error("This staff member does not perform this service");
      }
    }

    // Check for overlaps within the transaction (including buffer)
    const bufferEndTime = format(addMinutes(startTime, durationMinutes + effectiveBuffer), "HH:mm");
    let overlapQuery = `SELECT id FROM bookings
       WHERE business_id = $1 AND date = $2 AND status NOT IN ('Cancelled', 'No-Show')
       AND ($3::time, $4::time) OVERLAPS (time, end_time)`;
    const overlapParams: unknown[] = [businessId, date, time, bufferEndTime];

    if (staffId) {
      overlapParams.push(staffId);
      overlapQuery += ` AND staff_id = $${overlapParams.length}`;
    } else {
      overlapQuery += ` AND staff_id IS NULL`;
    }

    const overlapResult = await client.query(overlapQuery, overlapParams);

    if (overlapResult.rows.length > 0) {
      throw new Error("This time slot is no longer available");
    }

    // Upsert customer
    const customerResult = await client.query(
      `INSERT INTO customers (name, phone)
       VALUES ($1, $2)
       ON CONFLICT (name, phone) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [customerName, customerPhone]
    );
    const customerId = customerResult.rows[0].id;

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (business_id, service_id, customer_id, staff_id, date, time, end_time, status, notes, promotion_id)
       VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, 'Booked', $8, $9)
       RETURNING *`,
      [businessId, serviceId, customerId, staffId || null, date, time, endTime, notes || null, promotionId || null]
    );

    return bookingResult.rows[0] as Booking;
  });
}

/** Get all bookings for a business with customer and service info */
export async function getBusinessBookings(
  businessId: string,
  filters?: { date?: string; status?: string }
): Promise<Booking[]> {
  let sql = `
    SELECT b.*, s.name as service_name, s.price as service_price,
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
  return queryOne<Booking>(
    `UPDATE bookings SET status = $1, no_show = $4
     WHERE id = $2 AND business_id = $3
     RETURNING *`,
    [status, bookingId, businessId, status === "No-Show"]
  );
}

/** Get weekly bookings for calendar view */
export async function getWeeklyBookings(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<Booking[]> {
  return query<Booking>(
    `SELECT b.*, s.name as service_name, s.price as service_price,
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
