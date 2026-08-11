import { query, queryOne } from "@/lib/db";
import type { Service } from "@/types";

/** Get all services for a business */
export async function getServices(businessId: string): Promise<Service[]> {
  return query<Service>(
    `SELECT * FROM services
     WHERE business_id = $1 AND (active IS NULL OR active = true)
     ORDER BY created_at DESC`,
    [businessId]
  );
}

/** List active services only when the owning business is publicly active. */
export async function getPublicServices(businessId: string): Promise<Service[]> {
  return query<Service>(
    `SELECT service.*
     FROM services service
     JOIN businesses business ON business.id = service.business_id
     WHERE service.business_id = $1
       AND service.active = true
       AND business.status = 'active'
     ORDER BY service.created_at DESC`,
    [businessId]
  );
}

/** Get a single service */
export async function getServiceById(
  serviceId: string,
  businessId: string
): Promise<Service | null> {
  return queryOne<Service>(
    "SELECT * FROM services WHERE id = $1 AND business_id = $2",
    [serviceId, businessId]
  );
}

/** Create a new service */
export async function createService(
  businessId: string,
  name: string,
  price: number,
  durationMinutes: number
): Promise<Service> {
  const service = await queryOne<Service>(
    `INSERT INTO services (business_id, name, price, duration_minutes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [businessId, name, price, durationMinutes]
  );
  if (!service) throw new Error("Failed to create service");
  return service;
}

/** Update a service */
export async function updateService(
  serviceId: string,
  businessId: string,
  name: string,
  price: number,
  durationMinutes: number
): Promise<Service | null> {
  return queryOne<Service>(
    `UPDATE services SET name = $1, price = $2, duration_minutes = $3
     WHERE id = $4 AND business_id = $5
     RETURNING *`,
    [name, price, durationMinutes, serviceId, businessId]
  );
}

/** Deactivate a service while preserving historical bookings */
export async function deleteService(
  serviceId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<Service>(
    `UPDATE services SET active = false
     WHERE id = $1 AND business_id = $2
     RETURNING id`,
    [serviceId, businessId]
  );
  return !!result;
}
