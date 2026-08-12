import { validateWorkingHours } from "@/lib/validation";
import type { WorkingHours } from "@/types";

export type BusinessReadinessKey =
  | "contact"
  | "category"
  | "description"
  | "hours"
  | "services";

export interface BusinessReadinessCheck {
  key: BusinessReadinessKey;
  label: string;
  complete: boolean;
  action: string;
}

export interface BusinessReadinessInput {
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  category?: string | null;
  description?: string | null;
  working_hours?: WorkingHours | null;
  active_service_count?: number | null;
}

export interface BusinessReadiness {
  ready: boolean;
  completed: number;
  total: number;
  checks: BusinessReadinessCheck[];
}

/**
 * The minimum truthful public-listing boundary. Images, staff and social links
 * improve a listing, but are intentionally optional for solo and early-stage
 * businesses.
 */
export function assessBusinessReadiness(
  business: BusinessReadinessInput
): BusinessReadiness {
  const checks: BusinessReadinessCheck[] = [
    {
      key: "contact",
      label: "Business contact and location",
      complete: Boolean(
        business.name?.trim() &&
          business.phone?.trim() &&
          business.location?.trim()
      ),
      action: "Add a business name, Kenyan phone number and customer-facing location.",
    },
    {
      key: "category",
      label: "Business category",
      complete: Boolean(business.category?.trim()),
      action: "Choose the category customers should use to find you.",
    },
    {
      key: "description",
      label: "Public description",
      complete: (business.description?.trim().length ?? 0) >= 20,
      action: "Write at least 20 characters explaining what customers can expect.",
    },
    {
      key: "hours",
      label: "Bookable working hours",
      complete:
        validateWorkingHours(business.working_hours) &&
        Object.values(business.working_hours).some((day) => !day.closed),
      action: "Save valid opening hours with at least one open day.",
    },
    {
      key: "services",
      label: "Active service",
      complete: Number(business.active_service_count || 0) > 0,
      action: "Publish at least one active service with a price and duration.",
    },
  ];

  const completed = checks.filter((check) => check.complete).length;
  return {
    ready: completed === checks.length,
    completed,
    total: checks.length,
    checks,
  };
}

export function formatReadinessBlockers(readiness: BusinessReadiness): string {
  return readiness.checks
    .filter((check) => !check.complete)
    .map((check) => check.action)
    .join(" ");
}
