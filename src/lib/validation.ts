/** Centralized input validation helpers */

import type { WorkingHours } from "@/types";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Normalize a public asset/link URL and reject executable or insecure schemes. */
export function normalizeHttpsUrl(value: string, maxLength: number = 500): string | null {
  const trimmed = sanitize(value);
  if (!trimmed || trimmed.length > maxLength) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Normalize supported Kenyan mobile formats to E.164 (+254XXXXXXXXX). */
export function normalizeKenyanPhone(phone: string): string | null {
  const compact = phone.replace(/[\s()-]/g, "");

  if (/^0[17]\d{8}$/.test(compact)) {
    return `+254${compact.slice(1)}`;
  }

  if (/^254[17]\d{8}$/.test(compact)) {
    return `+${compact}`;
  }

  if (/^\+254[17]\d{8}$/.test(compact)) {
    return compact;
  }

  return null;
}

export function validatePhone(phone: string): boolean {
  return normalizeKenyanPhone(phone) !== null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password must be 128 characters or fewer";
  return null;
}

export function validateTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function validateWorkingHours(value: unknown): value is WorkingHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;

  return WEEKDAYS.every((day) => {
    const schedule = candidate[day];
    if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
      return false;
    }
    const fields = schedule as Record<string, unknown>;
    if (typeof fields.closed !== "boolean") return false;
    if (
      typeof fields.open !== "string" ||
      typeof fields.close !== "string" ||
      !validateTimeFormat(fields.open) ||
      !validateTimeFormat(fields.close)
    ) {
      return false;
    }
    return fields.closed || fields.open < fields.close;
  });
}

export function validateDateFormat(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export function validateUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

const NAIROBI_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Return a stable, lexicographically sortable wall-clock value for Nairobi. */
export function getNairobiDateTime(now: Date = new Date()): {
  date: string;
  time: string;
} {
  const parts = Object.fromEntries(
    NAIROBI_DATE_TIME_FORMATTER.formatToParts(now).map(({ type, value }) => [
      type,
      value,
    ])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Treat the current minute as unavailable because it has already started. */
export function isPastDateTimeInNairobi(
  date: string,
  time: string,
  now: Date = new Date()
): boolean {
  if (!validateDateFormat(date) || !validateTimeFormat(time)) return true;

  const current = getNairobiDateTime(now);
  return date < current.date || (date === current.date && time <= current.time);
}

/** Sanitize a string by trimming and removing control characters */
export function sanitize(value: string): string {
  return value.trim().replace(/[\x00-\x1F\x7F]/g, "");
}

/** Create a URL-safe slug from a business name */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Standard JSON error response */
export function errorResponse(message: string, status: number = 400) {
  return Response.json({ error: message }, { status });
}
