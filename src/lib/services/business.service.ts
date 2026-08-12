import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import {
  normalizeBusinessInvitationEmail,
  redeemBusinessInvitation,
} from "@/lib/services/business-invitation.service";
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
  location: string,
  invitationToken: string
): Promise<AuthResponse> {
  const normalizedPhone = normalizeKenyanPhone(phone);
  if (!normalizedPhone) throw new Error("Invalid phone number");
  const normalizedEmail = normalizeBusinessInvitationEmail(email);
  const passwordHash = await hashPassword(password);

  const redeemed = await redeemBusinessInvitation(
    invitationToken,
    normalizedEmail,
    async (client) => {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM public.businesses WHERE lower(btrim(email)) = $1",
        [normalizedEmail]
      );
      if (existing.rows[0]) throw new Error("Email already registered");

      const slugBase = slugify(name) || "studio";
      const slugExists = await client.query<{ id: string }>(
        "SELECT id FROM public.businesses WHERE slug = $1",
        [slugBase]
      );
      const slug = slugExists.rows[0]
        ? `${slugBase}-${randomBytes(4).toString("hex")}`
        : slugBase;

      const inserted = await client.query<Business>(
        `INSERT INTO public.businesses
           (name, slug, email, password_hash, phone, location, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [name, slug, normalizedEmail, passwordHash, normalizedPhone, location]
      );
      const business = inserted.rows[0];
      if (!business) throw new Error("Failed to create business");

      // Create the cookie credential before commit. A signing/configuration
      // failure therefore rolls back both the account and invitation use.
      const token = signToken({
        id: business.id,
        role: "business",
        businessId: business.id,
      });
      const { password_hash: _, ...safe } = business;
      return {
        businessId: business.id,
        response: { token, role: "business" as const, business: safe },
      };
    }
  );

  return redeemed.response;
}

/** Authenticate a business owner */
export async function loginBusiness(
  email: string,
  password: string
): Promise<AuthResponse> {
  const business = await queryOne<Business>(
    "SELECT * FROM businesses WHERE lower(btrim(email)) = $1",
    [normalizeBusinessInvitationEmail(email)]
  );
  if (!business) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, business.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  if (business.status === "suspended") {
    throw new Error("Business account is suspended");
  }

  const token = signToken({ id: business.id, role: "business", businessId: business.id });

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
    name?: string;
    phone?: string;
    location?: string;
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
      name = COALESCE($2, name),
      phone = COALESCE($3, phone),
      location = COALESCE($4, location),
      description = CASE WHEN $5::text IS NULL THEN description ELSE NULLIF($5, '') END,
      category = CASE WHEN $6::text IS NULL THEN category ELSE NULLIF($6, '') END,
      cover_image_url = CASE WHEN $7::text IS NULL THEN cover_image_url ELSE NULLIF($7, '') END,
      avatar_url = CASE WHEN $8::text IS NULL THEN avatar_url ELSE NULLIF($8, '') END,
      buffer_minutes = COALESCE($9, buffer_minutes),
      cancellation_hours = COALESCE($10, cancellation_hours),
      social_links = COALESCE($11::jsonb, social_links),
      deposit_required = COALESCE($12, deposit_required)
     WHERE id = $1
     RETURNING *`,
    [
      businessId,
      data.name ?? null,
      data.phone ?? null,
      data.location ?? null,
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

/** Get an active public profile, or a private owner preview when authorized. */
export async function getPublicBusinessProfile(
  slug: string,
  previewBusinessId?: string
) {
  const business = await queryOne<Omit<Business, "password_hash" | "email">>(
    `SELECT id, name, slug, phone, location, working_hours, created_at,
            description, cover_image_url, avatar_url, category, social_links,
            cancellation_hours, deposit_required, buffer_minutes, status
     FROM businesses
     WHERE slug = $1
       AND (status = 'active' OR id = $2::uuid)`,
    [slug, previewBusinessId || null]
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
