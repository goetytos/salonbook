import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import {
  getNairobiDateTime,
  normalizeKenyanPhone,
  slugify,
} from "@/lib/validation";
import type { Business, AuthResponse, DashboardStats, WorkingHours } from "@/types";

/** Register a new business owner */
export async function registerBusiness(
  name: string,
  email: string,
  password: string,
  phone: string,
  location: string
): Promise<AuthResponse> {
  const normalizedPhone = normalizeKenyanPhone(phone);
  if (!normalizedPhone) throw new Error("Invalid phone number");

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
    `INSERT INTO businesses (name, slug, email, password_hash, phone, location, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [name, slug, email, passwordHash, normalizedPhone, location]
  );

  if (!business) throw new Error("Failed to create business");

  const token = signToken({ id: business.id, email: business.email, role: "business", businessId: business.id });

  const { password_hash: _, ...safe } = business;
  return { token, role: "business", business: safe };
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

  if (business.status === "suspended") {
    throw new Error("Business account is suspended");
  }

  const token = signToken({ id: business.id, email: business.email, role: "business", businessId: business.id });

  const { password_hash: _, ...safe } = business;
  return { token, role: "business", business: safe };
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

/** Get the active business schedule exposed to public booking pages. */
export async function getPublicWorkingHours(
  id: string
): Promise<WorkingHours | null> {
  const business = await queryOne<{ working_hours: WorkingHours }>(
    "SELECT working_hours FROM businesses WHERE id = $1 AND status = 'active'",
    [id]
  );
  return business?.working_hours || null;
}

/** Get business by slug (public — only active businesses) */
export async function getBusinessBySlug(
  slug: string
): Promise<Omit<Business, "password_hash"> | null> {
  const business = await queryOne<Business>(
    "SELECT * FROM businesses WHERE slug = $1 AND status = 'active'",
    [slug]
  );
  if (!business) return null;
  const { password_hash: _, ...safe } = business;
  return safe;
}

/** Update working hours */
export async function updateWorkingHours(
  businessId: string,
  workingHours: WorkingHours
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
  const today = getNairobiDateTime().date;
  const monthStart = today.slice(0, 7) + "-01";

  const [totals] = await query<DashboardStats>(
    `SELECT
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1)::int as total_bookings,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date = $2 AND status != 'Cancelled')::int as today_bookings,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date >= $2 AND status = 'Booked')::int as upcoming_bookings,
       (SELECT COUNT(*) FROM bookings WHERE business_id = $1 AND date >= $3 AND date <= $2)::int as monthly_bookings,
       (SELECT COUNT(DISTINCT customer_id) FROM bookings WHERE business_id = $1)::int as total_customers,
       (SELECT COALESCE(SUM(b.final_price), 0) FROM bookings b
        WHERE b.business_id = $1 AND b.date >= $3 AND b.date <= $2
          AND b.status = 'Completed')::numeric as monthly_revenue`,
    [businessId, today, monthStart]
  );

  return totals;
}

/** Update business profile fields */
export async function updateBusinessProfile(
  businessId: string,
  data: {
    description?: string;
    category?: string;
    cover_image_url?: string;
    avatar_url?: string;
    buffer_minutes?: number;
    cancellation_hours?: number;
    social_links?: Record<string, string>;
    deposit_required?: boolean;
  }
): Promise<Omit<Business, "password_hash"> | null> {
  const business = await queryOne<Business>(
    `UPDATE businesses SET
      description = CASE WHEN $2::text IS NULL THEN description ELSE NULLIF($2, '') END,
      category = CASE WHEN $3::text IS NULL THEN category ELSE NULLIF($3, '') END,
      cover_image_url = CASE WHEN $4::text IS NULL THEN cover_image_url ELSE NULLIF($4, '') END,
      avatar_url = CASE WHEN $5::text IS NULL THEN avatar_url ELSE NULLIF($5, '') END,
      buffer_minutes = COALESCE($6, buffer_minutes),
      cancellation_hours = COALESCE($7, cancellation_hours),
      social_links = COALESCE($8::jsonb, social_links),
      deposit_required = COALESCE($9, deposit_required)
     WHERE id = $1
     RETURNING *`,
    [
      businessId,
      data.description ?? null,
      data.category ?? null,
      data.cover_image_url ?? null,
      data.avatar_url ?? null,
      data.buffer_minutes ?? null,
      data.cancellation_hours ?? null,
      data.social_links ? JSON.stringify(data.social_links) : null,
      data.deposit_required ?? null,
    ]
  );
  if (!business) return null;
  const { password_hash: _, ...safe } = business;
  return safe;
}

/** Get public business profile with services, staff, and review summary */
export async function getPublicBusinessProfile(slug: string) {
  const business = await queryOne<Omit<Business, "password_hash" | "email">>(
    `SELECT id, name, slug, phone, location, working_hours, created_at,
            description, cover_image_url, avatar_url, category, social_links,
            cancellation_hours, deposit_required, buffer_minutes, status
     FROM businesses
     WHERE slug = $1 AND status = 'active'`,
    [slug]
  );
  if (!business) return null;

  const services = await query(
    "SELECT * FROM services WHERE business_id = $1 AND (active IS NULL OR active = true) ORDER BY created_at DESC",
    [business.id]
  );

  const staff = await query(
    `SELECT id, business_id, name, role, specialties, avatar_url,
            working_hours, active, created_at
     FROM staff
     WHERE business_id = $1 AND active = true
     ORDER BY name`,
    [business.id]
  );

  const ratingResult = await queryOne<{ avg_rating: number; review_count: number }>(
    `SELECT COALESCE(AVG(rating), 0)::numeric as avg_rating,
            COUNT(*)::int as review_count
     FROM reviews WHERE business_id = $1`,
    [business.id]
  );

  return {
    ...business,
    services,
    staff,
    avg_rating: Number(ratingResult?.avg_rating || 0),
    review_count: ratingResult?.review_count || 0,
  };
}

/** Get customers for a business */
export async function getBusinessCustomers(businessId: string) {
  return query(
    `SELECT c.id, c.name, c.phone, c.email, c.created_at,
            COUNT(b.id)::int as booking_count,
            MAX(b.date) as last_booking
     FROM customers c
     JOIN bookings b ON c.id = b.customer_id
     WHERE b.business_id = $1
     GROUP BY c.id, c.name, c.phone, c.email, c.created_at
     ORDER BY last_booking DESC`,
    [businessId]
  );
}
