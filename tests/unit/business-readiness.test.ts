import { describe, expect, it } from "vitest";
import {
  assessBusinessReadiness,
  formatReadinessBlockers,
} from "@/lib/business-readiness";
import type { WorkingHours } from "@/types";

const validHours: WorkingHours = {
  monday: { open: "09:00", close: "17:00", closed: false },
  tuesday: { open: "09:00", close: "17:00", closed: false },
  wednesday: { open: "09:00", close: "17:00", closed: false },
  thursday: { open: "09:00", close: "17:00", closed: false },
  friday: { open: "09:00", close: "17:00", closed: false },
  saturday: { open: "09:00", close: "14:00", closed: false },
  sunday: { open: "00:00", close: "00:00", closed: true },
};

describe("business listing readiness", () => {
  it("accepts the minimum complete public listing", () => {
    const readiness = assessBusinessReadiness({
      name: "Amani Studio",
      phone: "+254712345678",
      location: "Westlands, Nairobi",
      category: "hair-salon",
      description: "A calm appointment-led hair studio in Westlands.",
      working_hours: validHours,
      active_service_count: 1,
    });

    expect(readiness).toMatchObject({ ready: true, completed: 5, total: 5 });
    expect(formatReadinessBlockers(readiness)).toBe("");
  });

  it("explains every incomplete activation gate", () => {
    const closedHours = Object.fromEntries(
      Object.keys(validHours).map((day) => [
        day,
        { open: "00:00", close: "00:00", closed: true },
      ])
    ) as unknown as WorkingHours;
    const readiness = assessBusinessReadiness({
      name: "A",
      phone: "",
      location: "",
      category: "",
      description: "Too short",
      working_hours: closedHours,
      active_service_count: 0,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.completed).toBe(0);
    expect(readiness.checks.map((check) => check.key)).toEqual([
      "contact",
      "category",
      "description",
      "hours",
      "services",
    ]);
    expect(formatReadinessBlockers(readiness)).toContain("active service");
  });
});
