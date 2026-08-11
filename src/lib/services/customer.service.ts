import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import { normalizeKenyanPhone } from "@/lib/validation";
import type { Customer, AuthResponse, Booking } from "@/types";

export class CustomerRegistrationError extends Error {
  readonly code = "EMAIL_ALREADY_REGISTERED";

  constructor() {
    super("Email already registered");
    this.name = "CustomerRegistrationError";
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

  const token = signToken({ id: customer.id, email: customer.email!, role: "customer" });

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

  const token = signToken({ id: customer.id, email: customer.email!, role: "customer" });

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
  return queryOne<Booking>(
    `UPDATE bookings SET status = 'Cancelled'
     WHERE id = $1 AND customer_id = $2 AND status = 'Booked'
     RETURNING *`,
    [bookingId, customerId]
  );
}
