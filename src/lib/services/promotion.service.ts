import { query, queryOne, transaction } from "@/lib/db";
import { sanitize, validateDateFormat, validateUuid } from "@/lib/validation";
import type { Promotion } from "@/types";
import type { PoolClient } from "pg";

export type PromotionReservationResult =
  | { status: "reserved"; promotion: Promotion }
  | { status: "invalid" }
  | { status: "limit_reached" };

function normalizePromotionCode(code: string): string | null {
  const normalized = sanitize(code).toUpperCase();
  return normalized.length > 0 && normalized.length <= 50 ? normalized : null;
}

async function validateApplicableServices(
  client: PoolClient,
  businessId: string,
  serviceIds: string[]
): Promise<string[]> {
  const uniqueServiceIds = [...new Set(serviceIds)];
  if (uniqueServiceIds.length === 0) return [];

  const services = await client.query<{ id: string }>(
    `SELECT id
     FROM services
     WHERE business_id = $1 AND active = true AND id = ANY($2::uuid[])`,
    [businessId, uniqueServiceIds]
  );
  if (services.rows.length !== uniqueServiceIds.length) {
    throw new Error("One or more services are unavailable for this business");
  }
  return uniqueServiceIds;
}

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
  return transaction(async (client) => {
    const applicableServices = await validateApplicableServices(
      client,
      businessId,
      data.applicable_services || []
    );
    const result = await client.query<Promotion>(
      `INSERT INTO promotions
         (business_id, code, discount_type, discount_value, valid_from,
          valid_to, max_uses, applicable_services)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid[])
       RETURNING *`,
      [
        businessId,
        data.code.toUpperCase(),
        data.discount_type,
        data.discount_value,
        data.valid_from,
        data.valid_to,
        data.max_uses ?? null,
        applicableServices,
      ]
    );
    const promotion = result.rows[0];
    if (!promotion) throw new Error("Failed to create promotion");
    return promotion;
  });
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
  return transaction(async (client) => {
    const applicableServices =
      data.applicable_services === undefined
        ? null
        : await validateApplicableServices(
            client,
            businessId,
            data.applicable_services
          );
    const result = await client.query<Promotion>(
      `UPDATE promotions SET
        code = COALESCE($3, code),
        discount_type = COALESCE($4, discount_type),
        discount_value = COALESCE($5, discount_value),
        valid_from = COALESCE($6, valid_from),
        valid_to = COALESCE($7, valid_to),
        max_uses = COALESCE($8, max_uses),
        active = COALESCE($9, active),
        applicable_services = COALESCE($10::uuid[], applicable_services)
       WHERE id = $1 AND business_id = $2
         AND COALESCE($6::date, valid_from) <= COALESCE($7::date, valid_to)
         AND (
           COALESCE($4, discount_type) <> 'percentage'
           OR COALESCE($5, discount_value) <= 100
         )
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
        applicableServices,
      ]
    );
    return result.rows[0] || null;
  });
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
  bookingDate: string,
  serviceId?: string
): Promise<Promotion | null> {
  const normalizedCode = normalizePromotionCode(code);
  if (
    !validateUuid(businessId) ||
    !normalizedCode ||
    !validateDateFormat(bookingDate) ||
    (serviceId !== undefined && !validateUuid(serviceId))
  ) {
    return null;
  }

  businessId = businessId.toLowerCase();
  if (serviceId) serviceId = serviceId.toLowerCase();

  const promo = await queryOne<Promotion>(
    `SELECT promotion.*
     FROM promotions promotion
     JOIN businesses business
       ON business.id = promotion.business_id
      AND business.status = 'active'
     WHERE promotion.business_id = $1 AND promotion.code = $2
       AND promotion.active = true
       AND promotion.valid_from <= $3::date
       AND promotion.valid_to >= $3::date
       AND (promotion.max_uses IS NULL OR promotion.current_uses < promotion.max_uses)`,
    [businessId, normalizedCode, bookingDate]
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

/**
 * Atomically validate and reserve one use inside the caller's transaction.
 * A later booking failure rolls this increment back with the transaction.
 */
export async function reservePromotionUsage(
  client: PoolClient,
  businessId: string,
  code: string,
  serviceId: string,
  bookingDate: string
): Promise<PromotionReservationResult> {
  const normalizedCode = normalizePromotionCode(code);
  if (
    !validateUuid(businessId) ||
    !validateUuid(serviceId) ||
    !validateDateFormat(bookingDate) ||
    !normalizedCode
  ) {
    return { status: "invalid" };
  }

  businessId = businessId.toLowerCase();
  serviceId = serviceId.toLowerCase();

  const reservation = await client.query<Promotion>(
    `UPDATE promotions
     SET current_uses = current_uses + 1
     WHERE business_id = $1
       AND code = $2
       AND active = true
       AND valid_from <= $4::date
       AND valid_to >= $4::date
       AND (max_uses IS NULL OR current_uses < max_uses)
       AND (
         cardinality(COALESCE(applicable_services, ARRAY[]::uuid[])) = 0
         OR $3::uuid = ANY(applicable_services)
       )
     RETURNING *`,
    [businessId, normalizedCode, serviceId, bookingDate]
  );

  if (reservation.rows[0]) {
    return { status: "reserved", promotion: reservation.rows[0] };
  }

  const existing = await client.query<Pick<Promotion, "max_uses" | "current_uses">>(
    `SELECT max_uses, current_uses
     FROM promotions
     WHERE business_id = $1 AND code = $2
     FOR SHARE`,
    [businessId, normalizedCode]
  );
  const promotion = existing.rows[0];

  if (
    promotion &&
    promotion.max_uses !== null &&
    promotion.max_uses !== undefined &&
    promotion.current_uses >= promotion.max_uses
  ) {
    return { status: "limit_reached" };
  }

  return { status: "invalid" };
}

/** Increment promotion usage atomically */
export async function incrementUsage(promotionId: string): Promise<void> {
  if (!validateUuid(promotionId)) return;

  await queryOne(
    `UPDATE promotions SET current_uses = current_uses + 1
     WHERE id = $1 AND (max_uses IS NULL OR current_uses < max_uses)`,
    [promotionId]
  );
}
