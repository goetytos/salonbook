import { query, queryOne, transaction } from "@/lib/db";
import type { Booking, TimeSlot, WorkingHours } from "@/types";
import { format, parse, addMinutes, isBefore, isEqual } from "date-fns";

/** Generate available time slots for a given business, date, and service duration */
export async function getAvailableSlots(
  businessId: string,
  date: string,
  durationMinutes: number
): Promise<TimeSlot[]> {
  // Get working hours for this business
  const business = await queryOne<{ working_hours: WorkingHours }>(
    "SELECT working_hours FROM businesses WHERE id = $1",
    [businessId]
  );
  if (!business) return [];

  // Determine the day of week
  const dayOfWeek = format(
    new Date(date + "T00:00:00"),
    "EEEE"
  ).toLowerCase() as keyof WorkingHours;
  const daySchedule = business.working_hours[dayOfWeek];

  if (!daySchedule || daySchedule.closed) return [];

  // Get existing non-cancelled bookings for this date
  const existingBookings = await query<{ time: string; end_time: string }>(
    `SELECT time::text, end_time::text FROM bookings
     WHERE business_id = $1 AND date = $2 AND status != 'Cancelled'`,
    [businessId, date]
  );

  // Generate all possible slots in 30-minute increments
  const slots: TimeSlot[] = [];
  const openTime = parse(daySchedule.open, "HH:mm", new Date());
  const closeTime = parse(daySchedule.close, "HH:mm", new Date());

  let current = openTime;

  while (isBefore(addMinutes(current, durationMinutes), closeTime) || isEqual(addMinutes(current, durationMinutes), closeTime)) {
    const slotStart = format(current, "HH:mm");
    const slotEnd = format(addMinutes(current, durationMinutes), "HH:mm");

    // Check if this slot overlaps any existing booking
    const overlaps = existingBookings.some((booking) => {
      const bStart = booking.time.slice(0, 5); // "HH:mm"
      const bEnd = booking.end_time.slice(0, 5);
      return slotStart < bEnd && slotEnd > bStart;
    });

    slots.push({ time: slotStart, available: !overlaps });
    current = addMinutes(current, 30); // 30-minute increments
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
  time: string
): Promise<Booking> {
  return transaction(async (client) => {
    // Lock bookings for this business+date to prevent race conditions
    await client.query(
      `SELECT id FROM bookings WHERE business_id = $1 AND date = $2 FOR UPDATE`,
      [businessId, date]
    );

    // Get service duration
    const serviceResult = await client.query(
      "SELECT duration_minutes FROM services WHERE id = $1 AND business_id = $2",
      [serviceId, businessId]
    );
    if (serviceResult.rows.length === 0) {
      throw new Error("Service not found");
    }
    const durationMinutes = serviceResult.rows[0].duration_minutes;

    // Calculate end time
    const startTime = parse(time, "HH:mm", new Date());
    const endTime = format(addMinutes(startTime, durationMinutes), "HH:mm");

    // Check for overlaps within the transaction
    const overlapResult = await client.query(
      `SELECT id FROM bookings
       WHERE business_id = $1 AND date = $2 AND status != 'Cancelled'
       AND ($3::time, $4::time) OVERLAPS (time, end_time)`,
      [businessId, date, time, endTime]
    );

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
      `INSERT INTO bookings (business_id, service_id, customer_id, date, time, end_time, status)
       VALUES ($1, $2, $3, $4, $5::time, $6::time, 'Booked')
       RETURNING *`,
      [businessId, serviceId, customerId, date, time, endTime]
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
           c.name as customer_name, c.phone as customer_phone
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN customers c ON b.customer_id = c.id
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
    `UPDATE bookings SET status = $1
     WHERE id = $2 AND business_id = $3
     RETURNING *`,
    [status, bookingId, businessId]
  );
}
