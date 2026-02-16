import { query, queryOne } from "@/lib/db";
import type { Service } from "@/types";

/** Get all services for a business */
export async function getServices(businessId: string): Promise<Service[]> {
  return query<Service>(
    "SELECT * FROM services WHERE business_id = $1 ORDER BY created_at DESC",
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

/** Delete a service */
export async function deleteService(
  serviceId: string,
  businessId: string
): Promise<boolean> {
  const result = await queryOne<Service>(
    "DELETE FROM services WHERE id = $1 AND business_id = $2 RETURNING id",
    [serviceId, businessId]
  );
  return !!result;
}
