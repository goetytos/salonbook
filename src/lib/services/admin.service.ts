import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import type { Admin, PlatformStats } from "@/types";

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

  const token = signToken({ id: admin.id, email: admin.email, role: "admin" });

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
           b.category, b.status, b.created_at,
           COUNT(DISTINCT bk.id)::int as booking_count,
           COUNT(DISTINCT bk.customer_id)::int as customer_count
    FROM businesses b
    LEFT JOIN bookings bk ON b.id = bk.business_id
  `;
  const params: unknown[] = [];

  if (statusFilter) {
    params.push(statusFilter);
    sql += ` WHERE b.status = $1`;
  }

  sql += ` GROUP BY b.id ORDER BY b.created_at DESC`;

  return query(sql, params);
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

  const business = await queryOne(
    `UPDATE businesses SET status = $1 WHERE id = $2
     RETURNING id, name, slug, email, status`,
    [status, businessId]
  );
  if (!business) throw new Error("Business not found");
  return business;
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
       (SELECT COALESCE(SUM(s.price), 0) FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.status != 'Cancelled')::numeric as total_revenue`
  );
  return stats!;
}
