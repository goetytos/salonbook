import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import { slugify } from "@/lib/validation";
import type { Business, AuthResponse, DashboardStats } from "@/types";

/** Register a new business owner */
export async function registerBusiness(
  name: string,
  email: string,
  password: string,
  phone: string,
  location: string
): Promise<AuthResponse> {
  // Check if email already exists
  const existing = await queryOne<Business>(
    "SELECT id FROM businesses WHERE email = $1",
    [email]
  );
  if (existing) throw new Error("Email already registered");

  // Generate unique slug
  let slug = slugify(name);
  const slugExists = await queryOne<Business>(
    "SELECT id FROM businesses WHERE slug = $1",
    [slug]
  );
  if (slugExists) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const passwordHash = await hashPassword(password);

  const business = await queryOne<Business>(
    `INSERT INTO businesses (name, slug, email, password_hash, phone, location)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, slug, email, passwordHash, phone, location]
  );

  if (!business) throw new Error("Failed to create business");

  const token = signToken({ businessId: business.id, email: business.email });

  const { password_hash: _, ...safe } = business;
  return { token, business: safe };
}

/** Authenticate a business owner */
export async function loginBusiness(
  email: string,
  password: string
): Promise<AuthResponse> {
  const business = await queryOne<Business>(
    "SELECT * FROM businesses WHERE email = $1",
    [email]
  );
  if (!business) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, business.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  const token = signToken({ businessId: business.id, email: business.email });

  const { password_hash: _, ...safe } = business;
  return { token, business: safe };
}

/** Get business by ID (safe — no password) */
export async function getBusinessById(
  id: string
): Promise<Omit<Business, "password_hash"> | null> {
  const business = await queryOne<Business>(
    "SELECT * FROM businesses WHERE id = $1",
    [id]
  );
  if (!business) return null;
  const { password_hash: _, ...safe } = business;
  return safe;
}

/** Get business by slug (public) */
export async function getBusinessBySlug(
  slug: string
): Promise<Omit<Business, "password_hash"> | null> {
  const business = await queryOne<Business>(
    "SELECT * FROM businesses WHERE slug = $1",
    [slug]
  );
  if (!business) return null;
  const { password_hash: _, ...safe } = business;
  return safe;
}

/** Update working hours */
export async function updateWorkingHours(
  businessId: string,
  workingHours: Record<string, unknown>
): Promise<Omit<Business, "password_hash"> | null> {
  const business = await queryOne<Business>(
    "UPDATE businesses SET working_hours = $1 WHERE id = $2 RETURNING *",
    [JSON.stringify(workingHours), businessId]
  );
  if (!business) return null;
  const { password_hash: _, ...safe } = business;
  return safe;
}

/** Get dashboard statistics */
export async function getDashboardStats(
  businessId: string
): Promise<DashboardStats> {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [totals] = await query<DashboardStats>(
    `SELECT
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1)::int as total_bookings,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date = $2 AND status != 'Cancelled')::int as today_bookings,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date >= $2 AND status = 'Booked')::int as upcoming_bookings,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date >= $3 AND date <= $2)::int as monthly_bookings,
       (SELECT COUNT(DISTINCT customer_id) FROM bookings WHERE business_id = $1)::int as total_customers,
       (SELECT COALESCE(SUM(s.price), 0) FROM bookings b JOIN services s ON b.service_id = s.id
        WHERE b.business_id = $1 AND b.date >= $3 AND b.status != 'Cancelled')::numeric as monthly_revenue`,
    [businessId, today, monthStart]
  );

  return totals;
}

/** Get customers for a business */
export async function getBusinessCustomers(businessId: string) {
  return query(
    `SELECT DISTINCT c.*, COUNT(b.id)::int as booking_count,
            MAX(b.date) as last_booking
     FROM customers c
     JOIN bookings b ON c.id = b.customer_id
     WHERE b.business_id = $1
     GROUP BY c.id
     ORDER BY last_booking DESC`,
    [businessId]
  );
}
