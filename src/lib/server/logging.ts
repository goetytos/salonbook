const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

function safeToken(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_TOKEN.test(value) ? value : undefined;
}

/** Return operational error identifiers without leaking messages, queries, or PII. */
export function safeErrorMetadata(error: unknown): { name: string; code?: string } {
  const object =
    error !== null && typeof error === "object"
      ? (error as { name?: unknown; code?: unknown })
      : null;
  const name = safeToken(object?.name) ?? (error instanceof Error ? "Error" : "UnknownError");
  const code = safeToken(object?.code);

  return code ? { name, code } : { name };
}

/** Log only redacted server-side error metadata. Scope must be a constant identifier. */
export function logServerError(scope: string, error: unknown): void {
  console.error(`[server:${scope}]`, safeErrorMetadata(error));
}
