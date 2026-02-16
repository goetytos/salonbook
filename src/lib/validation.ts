/** Centralized input validation helpers */

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  // Kenya phone: +254... or 07... or 01...
  return /^(\+254|0)[17]\d{8}$/.test(phone.replace(/\s/g, ""));
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function validateTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function validateDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/** Sanitize a string by trimming and removing control characters */
export function sanitize(value: string): string {
  // eslint-disable-next-line no-control-regex
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
