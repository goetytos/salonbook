import { query, queryOne } from "@/lib/db";
import type { ClientNote, ClientTag } from "@/types";

/** Get detailed client info with booking history, tags, notes */
export async function getClientDetail(businessId: string, customerId: string) {
  const customer = await queryOne<{
    id: string;
    name: string;
    phone: string;
    email: string;
    created_at: string;
  }>(
    `SELECT c.id, c.name, c.phone, c.email, c.created_at
     FROM customers c
     JOIN bookings b ON c.id = b.customer_id
     WHERE b.business_id = $1 AND c.id = $2
     GROUP BY c.id`,
    [businessId, customerId]
  );

  if (!customer) return null;

  const bookings = await query(
    `SELECT b.*, s.name as service_name, s.price as service_price,
            s.duration_minutes as service_duration, st.name as staff_name
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     LEFT JOIN staff st ON b.staff_id = st.id
     WHERE b.business_id = $1 AND b.customer_id = $2
     ORDER BY b.date DESC, b.time ASC`,
    [businessId, customerId]
  );

  const notes = await query<ClientNote>(
    `SELECT * FROM client_notes
     WHERE business_id = $1 AND customer_id = $2
     ORDER BY created_at DESC`,
    [businessId, customerId]
  );

  const tags = await query<ClientTag>(
    `SELECT ct.* FROM client_tags ct
     JOIN customer_tags cust_t ON ct.id = cust_t.tag_id
     WHERE ct.business_id = $1 AND cust_t.customer_id = $2`,
    [businessId, customerId]
  );

  const statsResult = await queryOne<{ total_spent: number; total_visits: number }>(
    `SELECT COALESCE(SUM(s.price), 0)::numeric as total_spent,
            COUNT(*)::int as total_visits
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     WHERE b.business_id = $1 AND b.customer_id = $2 AND b.status = 'Completed'`,
    [businessId, customerId]
  );

  return {
    ...customer,
    bookings,
    notes,
    tags,
    total_spent: Number(statsResult?.total_spent || 0),
    total_visits: statsResult?.total_visits || 0,
  };
}

/** Add a note to a client */
export async function addClientNote(
  businessId: string,
  customerId: string,
  note: string,
  createdBy?: string
): Promise<ClientNote> {
  const result = await queryOne<ClientNote>(
    `INSERT INTO client_notes (business_id, customer_id, note, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [businessId, customerId, note, createdBy || null]
  );
  if (!result) throw new Error("Failed to add note");
  return result;
}

/** Delete a client note */
export async function deleteClientNote(
  noteId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<ClientNote>(
    "DELETE FROM client_notes WHERE id = $1 AND business_id = $2 RETURNING id",
    [noteId, businessId]
  );
  return !!result;
}

/** Create a tag for a business */
export async function createTag(
  businessId: string,
  name: string,
  color: string = "#6B7280"
): Promise<ClientTag> {
  const result = await queryOne<ClientTag>(
    `INSERT INTO client_tags (business_id, name, color)
     VALUES ($1, $2, $3)
     ON CONFLICT (business_id, name) DO UPDATE SET color = EXCLUDED.color
     RETURNING *`,
    [businessId, name, color]
  );
  if (!result) throw new Error("Failed to create tag");
  return result;
}

/** Get all tags for a business */
export async function getTags(businessId: string): Promise<ClientTag[]> {
  return query<ClientTag>(
    "SELECT * FROM client_tags WHERE business_id = $1 ORDER BY name",
    [businessId]
  );
}

/** Delete a tag */
export async function deleteTag(
  tagId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<ClientTag>(
    "DELETE FROM client_tags WHERE id = $1 AND business_id = $2 RETURNING id",
    [tagId, businessId]
  );
  return !!result;
}

/** Tag a customer */
export async function tagCustomer(
  customerId: string,
  tagId: string
): Promise<void> {
  await queryOne(
    `INSERT INTO customer_tags (customer_id, tag_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [customerId, tagId]
  );
}

/** Remove a tag from a customer */
export async function untagCustomer(
  customerId: string,
  tagId: string
): Promise<void> {
  await queryOne(
    "DELETE FROM customer_tags WHERE customer_id = $1 AND tag_id = $2",
    [customerId, tagId]
  );
}
