import { describe, expect, it } from "vitest";
import {
  getNairobiDateTime,
  normalizeHttpsUrl,
  normalizeKenyanPhone,
  validateDateFormat,
  validateWorkingHours,
} from "@/lib/validation";

const openDay = { open: "09:00", close: "18:00", closed: false };

describe("input and Nairobi-time validation", () => {
  it("accepts real leap dates and rejects calendar rollover dates", () => {
    expect(validateDateFormat("2028-02-29")).toBe(true);
    expect(validateDateFormat("2027-02-29")).toBe(false);
    expect(validateDateFormat("2026-04-31")).toBe(false);
  });

  it.each([
    ["0712 345 678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["+254712345678", "+254712345678"],
  ])("normalizes Kenyan phone %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it("uses the Nairobi calendar at the UTC date boundary", () => {
    expect(getNairobiDateTime(new Date("2026-08-10T22:30:00.000Z"))).toEqual({
      date: "2026-08-11",
      time: "01:30",
    });
  });

  it("requires a complete, ordered seven-day schedule", () => {
    const schedule = {
      monday: openDay,
      tuesday: openDay,
      wednesday: openDay,
      thursday: openDay,
      friday: openDay,
      saturday: openDay,
      sunday: { open: "00:00", close: "00:00", closed: true },
    };
    expect(validateWorkingHours(schedule)).toBe(true);
    expect(
      validateWorkingHours({
        ...schedule,
        monday: { open: "18:00", close: "09:00", closed: false },
      })
    ).toBe(false);
  });

  it("allows only credential-free HTTPS URLs", () => {
    expect(normalizeHttpsUrl("https://images.example.com/salon.jpg")).toBe(
      "https://images.example.com/salon.jpg"
    );
    expect(normalizeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpsUrl("http://images.example.com/salon.jpg")).toBeNull();
    expect(normalizeHttpsUrl("https://user:pass@example.com/image.jpg")).toBe(
      "https://example.com/image.jpg"
    );
  });
});
