import { query, queryOne } from "@/lib/db";
import type { Promotion } from "@/types";

/** Get all promotions for a business */
export async function getPromotions(businessId: string): Promise<Promotion[]> {
  return query<Promotion>(
    "SELECT * FROM promotions WHERE business_id = $1 ORDER BY created_at DESC",
    [businessId]
  );
}

/** Create a promotion */
export async function createPromotion(
  businessId: string,
  data: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    valid_from: string;
    valid_to: string;
    max_uses?: number;
    applicable_services?: string[];
  }
): Promise<Promotion> {
  const result = await queryOne<Promotion>(
    `INSERT INTO promotions (business_id, code, discount_type, discount_value, valid_from, valid_to, max_uses, applicable_services)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      businessId,
      data.code.toUpperCase(),
      data.discount_type,
      data.discount_value,
      data.valid_from,
      data.valid_to,
      data.max_uses || null,
      data.applicable_services && data.applicable_services.length > 0
        ? `{${data.applicable_services.join(",")}}`
        : "{}",
    ]
  );
  if (!result) throw new Error("Failed to create promotion");
  return result;
}

/** Update a promotion */
export async function updatePromotion(
  promotionId: string,
  businessId: string,
  data: Partial<{
    code: string;
    discount_type: string;
    discount_value: number;
    valid_from: string;
    valid_to: string;
    max_uses: number;
    applicable_services: string[];
    active: boolean;
  }>
): Promise<Promotion | null> {
  return queryOne<Promotion>(
    `UPDATE promotions SET
      code = COALESCE($3, code),
      discount_type = COALESCE($4, discount_type),
      discount_value = COALESCE($5, discount_value),
      valid_from = COALESCE($6, valid_from),
      valid_to = COALESCE($7, valid_to),
      max_uses = COALESCE($8, max_uses),
      active = COALESCE($9, active)
     WHERE id = $1 AND business_id = $2
     RETURNING *`,
    [
      promotionId,
      businessId,
      data.code?.toUpperCase() ?? null,
      data.discount_type ?? null,
      data.discount_value ?? null,
      data.valid_from ?? null,
      data.valid_to ?? null,
      data.max_uses ?? null,
      data.active ?? null,
    ]
  );
}

/** Delete a promotion */
export async function deletePromotion(
  promotionId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<Promotion>(
    "DELETE FROM promotions WHERE id = $1 AND business_id = $2 RETURNING id",
    [promotionId, businessId]
  );
  return !!result;
}

/** Validate a promotion code (public) */
export async function validatePromotion(
  businessId: string,
  code: string,
  serviceId?: string
): Promise<Promotion | null> {
  const today = new Date().toISOString().split("T")[0];

  const promo = await queryOne<Promotion>(
    `SELECT * FROM promotions
     WHERE business_id = $1 AND code = $2
       AND active = true
       AND valid_from <= $3 AND valid_to >= $3
       AND (max_uses IS NULL OR current_uses < max_uses)`,
    [businessId, code.toUpperCase(), today]
  );

  if (!promo) return null;

  // Check if service is applicable
  if (
    serviceId &&
    promo.applicable_services &&
    promo.applicable_services.length > 0 &&
    !promo.applicable_services.includes(serviceId)
  ) {
    return null;
  }

  return promo;
}

/** Increment promotion usage atomically */
export async function incrementUsage(promotionId: string): Promise<void> {
  await queryOne(
    `UPDATE promotions SET current_uses = current_uses + 1
     WHERE id = $1 AND (max_uses IS NULL OR current_uses < max_uses)`,
    [promotionId]
  );
}
