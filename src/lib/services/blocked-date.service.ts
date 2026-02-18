import { query, queryOne } from "@/lib/db";
import type { BlockedDate } from "@/types";

/** Get blocked dates for a business */
export async function getBlockedDates(
  businessId: string,
  filters?: { startDate?: string; endDate?: string; staffId?: string }
): Promise<BlockedDate[]> {
  let sql = `
    SELECT bd.*, s.name as staff_name
    FROM blocked_dates bd
    LEFT JOIN staff s ON bd.staff_id = s.id
    WHERE bd.business_id = $1
  `;
  const params: unknown[] = [businessId];

  if (filters?.startDate) {
    params.push(filters.startDate);
    sql += ` AND bd.date >= $${params.length}`;
  }
  if (filters?.endDate) {
    params.push(filters.endDate);
    sql += ` AND bd.date <= $${params.length}`;
  }
  if (filters?.staffId) {
    params.push(filters.staffId);
    sql += ` AND bd.staff_id = $${params.length}`;
  }

  sql += " ORDER BY bd.date ASC";
  return query<BlockedDate>(sql, params);
}

/** Create a blocked date */
export async function createBlockedDate(
  businessId: string,
  data: {
    date: string;
    staff_id?: string;
    start_time?: string;
    end_time?: string;
    reason?: string;
  }
): Promise<BlockedDate> {
  const result = await queryOne<BlockedDate>(
    `INSERT INTO blocked_dates (business_id, staff_id, date, start_time, end_time, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      businessId,
      data.staff_id || null,
      data.date,
      data.start_time || null,
      data.end_time || null,
      data.reason || null,
    ]
  );
  if (!result) throw new Error("Failed to create blocked date");
  return result;
}

/** Delete a blocked date */
export async function deleteBlockedDate(
  blockedDateId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<BlockedDate>(
    "DELETE FROM blocked_dates WHERE id = $1 AND business_id = $2 RETURNING id",
    [blockedDateId, businessId]
  );
  return !!result;
}
