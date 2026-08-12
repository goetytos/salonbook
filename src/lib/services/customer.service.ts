import { query, queryOne, transaction } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import { normalizeKenyanPhone } from "@/lib/validation";
import { enqueueBookingCancellationIntent } from "@/lib/services/notification-outbox.service";
import type { Customer, AuthResponse, Booking } from "@/types";

export class CustomerRegistrationError extends Error {
  readonly code = "EMAIL_ALREADY_REGISTERED";

  constructor() {
    super("Email already registered");
    this.name = "CustomerRegistrationError";
  }
}

export class CustomerBookingActionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CustomerBookingActionError";
    this.status = status;
  }
}

function isEmailUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return (
    databaseError.code === "23505" &&
    databaseError.constraint === "customers_email_key"
  );
}

/** Register a new customer account */
export async function registerCustomer(
  name: string,
  email: string,
  password: string,
  phone: string
): Promise<AuthResponse> {
  const normalizedPhone = normalizeKenyanPhone(phone);
  if (!normalizedPhone) throw new Error("Invalid phone number");

  // Check if email already taken
  const existing = await queryOne<Customer>(
    "SELECT id FROM customers WHERE email = $1",
    [email]
  );
  if (existing) throw new CustomerRegistrationError();

  const passwordHash = await hashPassword(password);

  let customer: Customer | null;
  try {
    // Always create a distinct credentialed identity. Matching guest name/phone
    // data is intentionally not claimed; verified OTP linking is future work.
    customer = await queryOne<Customer>(
      `INSERT INTO customers (name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, passwordHash, normalizedPhone]
    );
  } catch (error) {
    // The pre-check improves the common response, while the unique constraint
    // remains the authoritative race-safe boundary.
    if (isEmailUniqueViolation(error)) throw new CustomerRegistrationError();
    throw error;
  }

  if (!customer) throw new Error("Failed to create account");

  const token = signToken({ id: customer.id, role: "customer" });

  const { password_hash: _, ...safe } = customer;
  return { token, role: "customer", customer: safe };
}

/** Authenticate a customer */
export async function loginCustomer(
  email: string,
  password: string
): Promise<AuthResponse> {
  const customer = await queryOne<Customer>(
    "SELECT * FROM customers WHERE email = $1",
    [email]
  );
  if (!customer || !customer.password_hash) {
    throw new Error("Invalid email or password");
  }

  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  const token = signToken({ id: customer.id, role: "customer" });

  const { password_hash: _, ...safe } = customer;
  return { token, role: "customer", customer: safe };
}

/** Get customer by ID (safe — no password) */
export async function getCustomerById(
  id: string
): Promise<Omit<Customer, "password_hash"> | null> {
  const customer = await queryOne<Customer>(
    "SELECT * FROM customers WHERE id = $1",
    [id]
  );
  if (!customer) return null;
  const { password_hash: _, ...safe } = customer;
  return safe;
}

/** Get all bookings for a customer */
export async function getCustomerBookings(customerId: string): Promise<Booking[]> {
  return query<Booking>(
    `SELECT b.*,
            COALESCE(b.service_name_snapshot, s.name) as service_name,
            COALESCE(b.service_price_snapshot, s.price) as service_price,
            s.duration_minutes as service_duration,
            biz.name as business_name, biz.location as business_location
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN businesses biz ON b.business_id = biz.id
     WHERE b.customer_id = $1
     ORDER BY b.date DESC, b.time ASC`,
    [customerId]
  );
}

/** Cancel a booking (customer can only cancel their own) */
export async function cancelCustomerBooking(
  bookingId: string,
  customerId: string
): Promise<Booking | null> {
  return transaction(async (client) => {
    const candidate = await client.query<Booking & { can_cancel: boolean; cancellation_hours: number }>(
      `SELECT b.*,
              COALESCE(biz.cancellation_hours, 24)::int AS cancellation_hours,
              (
                b.date + b.time
                >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')
                   + COALESCE(biz.cancellation_hours, 24) * INTERVAL '1 hour'
              ) AS can_cancel
       FROM bookings b
       JOIN businesses biz ON biz.id = b.business_id
       WHERE b.id = $1 AND b.customer_id = $2
       FOR UPDATE OF b`,
      [bookingId, customerId]
    );
    const booking = candidate.rows[0];
    if (!booking || booking.status !== "Booked") return null;
    if (!booking.can_cancel) {
      throw new CustomerBookingActionError(
        `Online cancellation closes ${booking.cancellation_hours} hour${booking.cancellation_hours === 1 ? "" : "s"} before the appointment. Contact the studio directly for help.`,
        409
      );
    }

    const updated = await client.query<Booking>(
      `UPDATE bookings SET status = 'Cancelled'
       WHERE id = $1 AND customer_id = $2 AND status = 'Booked'
       RETURNING *`,
      [bookingId, customerId]
    );
    const cancelledBooking = updated.rows[0] || null;
    if (!cancelledBooking) return null;

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
    await enqueueBookingCancellationIntent(client, bookingId);

    return cancelledBooking;
  });
}
