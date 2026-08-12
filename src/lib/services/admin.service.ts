import { query, queryOne, transaction } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import {
  assessBusinessReadiness,
  formatReadinessBlockers,
} from "@/lib/business-readiness";
import type { Admin, PlatformStats, WorkingHours } from "@/types";

interface BusinessReadinessRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  location: string;
  description: string | null;
  category: string | null;
  working_hours: WorkingHours;
  status: string;
  created_at: string;
  booking_count: number;
  customer_count: number;
  active_service_count: number;
}

export class BusinessActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessActivationError";
  }
}

/** Create the first admin (only works when no admins exist) */
export async function seedAdmin(
  email: string,
  password: string,
  name: string
): Promise<Omit<Admin, "password_hash">> {
  const existing = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM admins"
  );
  if (existing && existing.count > 0) {
    throw new Error("Admin already exists");
  }

  const password_hash = await hashPassword(password);
  const admin = await queryOne<Admin>(
    `INSERT INTO admins (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email, password_hash, name]
  );
  if (!admin) throw new Error("Failed to create admin");

  const { password_hash: _, ...safe } = admin;
  return safe;
}

/** Authenticate an admin */
export async function loginAdmin(
  email: string,
  password: string
): Promise<{ token: string; admin: Omit<Admin, "password_hash"> }> {
  const admin = await queryOne<Admin>(
    "SELECT * FROM admins WHERE email = $1",
    [email]
  );
  if (!admin) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  const token = signToken({ id: admin.id, role: "admin" });

  const { password_hash: _, ...safe } = admin;
  return { token, admin: safe };
}

/** Get admin by ID (safe — no password) */
export async function getAdminById(
  id: string
): Promise<Omit<Admin, "password_hash"> | null> {
  const admin = await queryOne<Admin>(
    "SELECT * FROM admins WHERE id = $1",
    [id]
  );
  if (!admin) return null;
  const { password_hash: _, ...safe } = admin;
  return safe;
}

/** List businesses with optional status filter */
export async function listBusinesses(statusFilter?: string) {
  let sql = `
    SELECT b.id, b.name, b.slug, b.email, b.phone, b.location,
           b.description, b.category, b.working_hours, b.status, b.created_at,
           COUNT(DISTINCT bk.id)::int as booking_count,
           COUNT(DISTINCT bk.customer_id)::int as customer_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.active = true)::int as active_service_count
    FROM businesses b
    LEFT JOIN bookings bk ON b.id = bk.business_id
    LEFT JOIN services s ON b.id = s.business_id
  `;
  const params: unknown[] = [];

  if (statusFilter) {
    params.push(statusFilter);
    sql += ` WHERE b.status = $1`;
  }

  sql += ` GROUP BY b.id ORDER BY b.created_at DESC`;

  const businesses = await query<BusinessReadinessRow>(sql, params);
  return businesses.map((business) => ({
    ...business,
    readiness: assessBusinessReadiness(business),
  }));
}

/** Update business status */
export async function updateBusinessStatus(
  businessId: string,
  status: string
) {
  const validStatuses = ["pending", "active", "suspended"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status. Must be: pending, active, or suspended");
  }

  return transaction(async (client) => {
    const result = await client.query<Omit<BusinessReadinessRow, "active_service_count">>(
      `SELECT b.id, b.name, b.slug, b.email, b.phone, b.location,
              b.description, b.category, b.working_hours, b.status, b.created_at,
              0::int AS booking_count, 0::int AS customer_count
       FROM businesses b
       WHERE b.id = $1
       FOR UPDATE`,
      [businessId]
    );
    const existing = result.rows[0];
    if (!existing) throw new Error("Business not found");

    if (status === "active") {
      const serviceCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM services
         WHERE business_id = $1 AND active = true`,
        [businessId]
      );
      const readiness = assessBusinessReadiness({
        ...existing,
        active_service_count: serviceCount.rows[0]?.count || 0,
      });
      if (!readiness.ready) {
        throw new BusinessActivationError(
          `Complete the public listing before activation. ${formatReadinessBlockers(readiness)}`
        );
      }
    }

    const updated = await client.query<{
      id: string;
      name: string;
      slug: string;
      email: string;
      status: string;
    }>(
      `UPDATE businesses SET status = $1 WHERE id = $2
       RETURNING id, name, slug, email, status`,
      [status, businessId]
    );
    return updated.rows[0];
  });
}

/** Get platform-wide statistics */
export async function getPlatformStats(): Promise<PlatformStats> {
  const stats = await queryOne<PlatformStats>(
    `SELECT
       (SELECT COUNT(*) FROM businesses)::int as total_businesses,
       (SELECT COUNT(*) FROM businesses WHERE status = 'pending')::int as pending_businesses,
       (SELECT COUNT(*) FROM businesses WHERE status = 'active')::int as active_businesses,
       (SELECT COUNT(*) FROM businesses WHERE status = 'suspended')::int as suspended_businesses,
       (SELECT COUNT(*) FROM bookings)::int as total_bookings,
       (SELECT COALESCE(SUM(final_price), 0) FROM bookings WHERE status = 'Completed')::numeric as total_revenue`
  );
  return stats!;
}
