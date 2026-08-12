import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE_NAMES,
  authenticatedJsonResponse,
  authenticationMutationGuard,
  clearedSessionResponse,
} from "@/lib/auth-session";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authentication session responses", () => {
  it("requires a same-origin application/json authentication request", () => {
    expect(
      authenticationMutationGuard(
        new Request("https://salonbook.test/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Origin: "https://salonbook.test",
          },
        })
      )
    ).toBeNull();
  });

  it.each([
    [{ "Content-Type": "text/plain", Origin: "https://salonbook.test" }, 415],
    [{ "Content-Type": "application/json" }, 403],
    [
      {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      403,
    ],
  ])("rejects unsafe authentication request headers %#", (headers, status) => {
    const response = authenticationMutationGuard(
      new Request("https://salonbook.test/api/auth/login", {
        method: "POST",
        headers,
      })
    );

    expect(response?.status).toBe(status);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets a production-only browser-inaccessible role cookie without echoing the token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = authenticatedJsonResponse(
      { business: { id: "business-1" } },
      "business",
      "signed.jwt.value"
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      business: { id: "business-1" },
    });
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain(
      `${SESSION_COOKIE_NAMES.business}=signed.jwt.value`
    );
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/Max-Age=604800/i);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not mark a local-development cookie Secure", () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = authenticatedJsonResponse({}, "customer", "token");
    const cookie = response.headers.get("set-cookie") || "";

    expect(cookie).toContain(`${SESSION_COOKIE_NAMES.customer}=token`);
    expect(cookie).not.toMatch(/; Secure/i);
  });

  it("clears only the selected role cookie", async () => {
    const response = clearedSessionResponse("admin");
    const cookie = response.headers.get("set-cookie") || "";

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(cookie).toContain(`${SESSION_COOKIE_NAMES.admin}=`);
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).not.toContain(SESSION_COOKIE_NAMES.business);
    expect(cookie).not.toContain(SESSION_COOKIE_NAMES.customer);
  });
});
