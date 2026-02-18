import { query, queryOne, transaction } from "@/lib/db";
import type { Staff, WorkingHours } from "@/types";

/** Get all staff for a business */
export async function getStaff(businessId: string): Promise<Staff[]> {
  const rows = await query<Staff & { service_ids_arr: string[] | null }>(
    `SELECT s.*,
            ARRAY_AGG(ss.service_id) FILTER (WHERE ss.service_id IS NOT NULL) as service_ids_arr
     FROM staff s
     LEFT JOIN staff_services ss ON s.id = ss.staff_id
     WHERE s.business_id = $1
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [businessId]
  );
  return rows.map((r) => ({ ...r, service_ids: r.service_ids_arr || [] }));
}

/** Get a single staff member */
export async function getStaffById(
  staffId: string,
  businessId: string
): Promise<Staff | null> {
  const row = await queryOne<Staff & { service_ids_arr: string[] | null }>(
    `SELECT s.*,
            ARRAY_AGG(ss.service_id) FILTER (WHERE ss.service_id IS NOT NULL) as service_ids_arr
     FROM staff s
     LEFT JOIN staff_services ss ON s.id = ss.staff_id
     WHERE s.id = $1 AND s.business_id = $2
     GROUP BY s.id`,
    [staffId, businessId]
  );
  if (!row) return null;
  return { ...row, service_ids: row.service_ids_arr || [] };
}

/** Create a staff member with service assignments */
export async function createStaff(
  businessId: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    specialties?: string[];
    avatar_url?: string;
    service_ids?: string[];
  }
): Promise<Staff> {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO staff (business_id, name, email, phone, role, specialties, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        businessId,
        data.name,
        data.email || null,
        data.phone || null,
        data.role || "stylist",
        JSON.stringify(data.specialties || []),
        data.avatar_url || null,
      ]
    );
    const staff = result.rows[0] as Staff;

    // Assign services
    if (data.service_ids && data.service_ids.length > 0) {
      const values = data.service_ids
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");
      await client.query(
        `INSERT INTO staff_services (staff_id, service_id) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [staff.id, ...data.service_ids]
      );
      staff.service_ids = data.service_ids;
    } else {
      staff.service_ids = [];
    }

    return staff;
  });
}

/** Update a staff member */
export async function updateStaff(
  staffId: string,
  businessId: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    specialties?: string[];
    avatar_url?: string;
    service_ids?: string[];
    active?: boolean;
  }
): Promise<Staff | null> {
  return transaction(async (client) => {
    const result = await client.query(
      `UPDATE staff SET
        name = COALESCE($3, name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        role = COALESCE($6, role),
        specialties = COALESCE($7, specialties),
        avatar_url = COALESCE($8, avatar_url),
        active = COALESCE($9, active)
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [
        staffId,
        businessId,
        data.name ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.role ?? null,
        data.specialties ? JSON.stringify(data.specialties) : null,
        data.avatar_url ?? null,
        data.active ?? null,
      ]
    );
    if (result.rows.length === 0) return null;
    const staff = result.rows[0] as Staff;

    // Update service assignments
    if (data.service_ids !== undefined) {
      await client.query("DELETE FROM staff_services WHERE staff_id = $1", [staffId]);
      if (data.service_ids.length > 0) {
        const values = data.service_ids
          .map((_, i) => `($1, $${i + 2})`)
          .join(", ");
        await client.query(
          `INSERT INTO staff_services (staff_id, service_id) VALUES ${values}`,
          [staffId, ...data.service_ids]
        );
      }
      staff.service_ids = data.service_ids;
    }

    return staff;
  });
}

/** Deactivate a staff member (soft delete) */
export async function deactivateStaff(
  staffId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<Staff>(
    "UPDATE staff SET active = false WHERE id = $1 AND business_id = $2 RETURNING id",
    [staffId, businessId]
  );
  return !!result;
}

/** Update staff working hours */
export async function updateStaffWorkingHours(
  staffId: string,
  businessId: string,
  workingHours: WorkingHours
): Promise<Staff | null> {
  return queryOne<Staff>(
    `UPDATE staff SET working_hours = $3
     WHERE id = $1 AND business_id = $2
     RETURNING *`,
    [staffId, businessId, JSON.stringify(workingHours)]
  );
}

/** Get all active staff that can perform a specific service */
export async function getStaffForService(
  businessId: string,
  serviceId: string
): Promise<Staff[]> {
  return query<Staff>(
    `SELECT s.* FROM staff s
     JOIN staff_services ss ON s.id = ss.staff_id
     WHERE s.business_id = $1 AND ss.service_id = $2 AND s.active = true
     ORDER BY s.name`,
    [businessId, serviceId]
  );
}
