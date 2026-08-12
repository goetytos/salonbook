import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  loginBusinessMock,
  registerBusinessMock,
  getBusinessBySlugMock,
  loginCustomerMock,
  registerCustomerMock,
  loginAdminMock,
  createBookingMock,
  queryOneMock,
} = vi.hoisted(() => ({
  loginBusinessMock: vi.fn(),
  registerBusinessMock: vi.fn(),
  getBusinessBySlugMock: vi.fn(),
  loginCustomerMock: vi.fn(),
  registerCustomerMock: vi.fn(),
  loginAdminMock: vi.fn(),
  createBookingMock: vi.fn(),
  queryOneMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ queryOne: queryOneMock }));
vi.mock("@/lib/services/business.service", () => ({
  loginBusiness: loginBusinessMock,
  registerBusiness: registerBusinessMock,
  getBusinessBySlug: getBusinessBySlugMock,
}));
vi.mock("@/lib/services/customer.service", () => ({
  CustomerRegistrationError: class CustomerRegistrationError extends Error {},
  loginCustomer: loginCustomerMock,
  registerCustomer: registerCustomerMock,
}));
vi.mock("@/lib/services/admin.service", () => ({ loginAdmin: loginAdminMock }));
vi.mock("@/lib/services/booking.service", () => ({
  BookingServiceError: class BookingServiceError extends Error {},
  createBooking: createBookingMock,
}));

import { POST as businessLogin } from "@/app/api/auth/login/route";
import { POST as businessSignup } from "@/app/api/auth/signup/route";
import { POST as businessLogout } from "@/app/api/auth/logout/route";
import { POST as customerLogin } from "@/app/api/customer/auth/login/route";
import { POST as customerSignup } from "@/app/api/customer/auth/signup/route";
import { POST as customerLogout } from "@/app/api/customer/auth/logout/route";
import { POST as adminLogin } from "@/app/api/admin/auth/login/route";
import { POST as adminLogout } from "@/app/api/admin/auth/logout/route";
import { POST as createPublicBooking } from "@/app/api/bookings/route";

const STRONG_RATE_LIMIT_SECRET =
  "salonbook-route-rate-limit-secret-that-is-longer-than-thirty-two-bytes";

function jsonRequest(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`https://salonbook.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://salonbook.test",
    },
    body: JSON.stringify(body),
  });
}

function crossSiteJsonRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`https://salonbook.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: JSON.stringify(body),
  });
}

const AUTH_ROUTE_CASES: Array<
  [string, (request: NextRequest) => Promise<Response>, string, Record<string, unknown>]
> = [
  [
    "business login",
    businessLogin,
    "/api/auth/login",
    { email: "owner@example.test", password: "valid-password" },
  ],
  [
    "business signup",
    businessSignup,
    "/api/auth/signup",
    {
      name: "Pilot Salon",
      email: "owner@example.test",
      password: "valid-password",
      phone: "0712345678",
      location: "Nairobi",
      invitation_token: "i".repeat(43),
    },
  ],
  [
    "customer login",
    customerLogin,
    "/api/customer/auth/login",
    { email: "customer@example.test", password: "valid-password" },
  ],
  [
    "customer signup",
    customerSignup,
    "/api/customer/auth/signup",
    {
      name: "Pilot Customer",
      email: "customer@example.test",
      password: "valid-password",
      phone: "0712345678",
    },
  ],
  [
    "admin login",
    adminLogin,
    "/api/admin/auth/login",
    { email: "admin@example.test", password: "valid-password" },
  ],
];

const PROTECTED_ROUTE_CASES: Array<[string, () => Promise<Response>]> = [
  [
    "business login",
    () =>
      businessLogin(
        jsonRequest("/api/auth/login", {
          email: "owner@example.test",
          password: "valid-password",
        })
      ),
  ],
  [
    "business signup",
    () =>
      businessSignup(
        jsonRequest("/api/auth/signup", {
          name: "Pilot Salon",
          email: "owner@example.test",
          password: "valid-password",
          phone: "0712345678",
          location: "Nairobi",
          invitation_token: "i".repeat(43),
        })
      ),
  ],
  [
    "customer login",
    () =>
      customerLogin(
        jsonRequest("/api/customer/auth/login", {
          email: "customer@example.test",
          password: "valid-password",
        })
      ),
  ],
  [
    "customer signup",
    () =>
      customerSignup(
        jsonRequest("/api/customer/auth/signup", {
          name: "Pilot Customer",
          email: "customer@example.test",
          password: "valid-password",
          phone: "0712345678",
        })
      ),
  ],
  [
    "admin login",
    () =>
      adminLogin(
        jsonRequest("/api/admin/auth/login", {
          email: "admin@example.test",
          password: "valid-password",
        })
      ),
  ],
  [
    "public booking",
    () =>
      createPublicBooking(
        jsonRequest("/api/bookings", {
          business_slug: "pilot-salon",
          service_id: "11111111-1111-4111-8111-111111111111",
          date: "2099-08-11",
          time: "10:00",
          customer_name: "Pilot Customer",
          customer_phone: "0712345678",
        })
      ),
  ],
];

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_HMAC_SECRET", STRONG_RATE_LIMIT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  queryOneMock.mockResolvedValue({
    exceeded: true,
    max_count: 10_001,
    retry_after_seconds: 60,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("rate-limited mutation routes", () => {
  it("keeps public business signup closed when no invitation is supplied", async () => {
    queryOneMock.mockResolvedValue({ max_count: 1, retry_after_seconds: 60 });

    const response = await businessSignup(
      jsonRequest("/api/auth/signup", {
        name: "Pilot Salon",
        email: "owner@example.test",
        password: "valid-password",
        phone: "0712345678",
        location: "Nairobi",
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "A valid business invitation is required for this pilot.",
    });
    expect(queryOneMock).not.toHaveBeenCalled();
    expect(registerBusinessMock).not.toHaveBeenCalled();
  });

  it.each(AUTH_ROUTE_CASES)(
    "rejects cross-site %s before rate limiting or authentication",
    async (_name, run, path, body) => {
      const response = await run(crossSiteJsonRequest(path, body));

      expect(response.status).toBe(403);
      expect(queryOneMock).not.toHaveBeenCalled();
      expect(loginBusinessMock).not.toHaveBeenCalled();
      expect(registerBusinessMock).not.toHaveBeenCalled();
      expect(loginCustomerMock).not.toHaveBeenCalled();
      expect(registerCustomerMock).not.toHaveBeenCalled();
      expect(loginAdminMock).not.toHaveBeenCalled();
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  );

  it("rejects cross-site simple text/plain login requests", async () => {
    const response = await businessLogin(
      new NextRequest("https://salonbook.test/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify({
          email: "attacker@example.test",
          password: "attacker-password",
        }),
      })
    );

    expect(response.status).toBe(415);
    expect(queryOneMock).not.toHaveBeenCalled();
    expect(loginBusinessMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["business", businessLogout, "/api/auth/logout"],
    ["customer", customerLogout, "/api/customer/auth/logout"],
    ["admin", adminLogout, "/api/admin/auth/logout"],
  ] as const)("rejects cross-site %s logout without clearing its cookie", async (_role, run, path) => {
    const response = await run(crossSiteJsonRequest(path, {}));

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(PROTECTED_ROUTE_CASES)(
    "returns 429 before %s reaches its mutation service",
    async (_name, run) => {
      const response = await run();
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(loginBusinessMock).not.toHaveBeenCalled();
      expect(registerBusinessMock).not.toHaveBeenCalled();
      expect(loginCustomerMock).not.toHaveBeenCalled();
      expect(registerCustomerMock).not.toHaveBeenCalled();
      expect(loginAdminMock).not.toHaveBeenCalled();
      expect(getBusinessBySlugMock).not.toHaveBeenCalled();
      expect(createBookingMock).not.toHaveBeenCalled();
    }
  );

  it.each(PROTECTED_ROUTE_CASES)(
    "returns 503 before %s mutates when the limiter database fails",
    async (_name, run) => {
      queryOneMock.mockRejectedValue(new Error("database unavailable"));

      const response = await run();

      expect(response.status).toBe(503);
      expect(loginBusinessMock).not.toHaveBeenCalled();
      expect(registerBusinessMock).not.toHaveBeenCalled();
      expect(loginCustomerMock).not.toHaveBeenCalled();
      expect(registerCustomerMock).not.toHaveBeenCalled();
      expect(loginAdminMock).not.toHaveBeenCalled();
      expect(getBusinessBySlugMock).not.toHaveBeenCalled();
      expect(createBookingMock).not.toHaveBeenCalled();
    }
  );

  it("keeps a successful business JWT out of the JSON response and in an HttpOnly cookie", async () => {
    queryOneMock.mockResolvedValue({
      exceeded: false,
      max_count: 1,
      retry_after_seconds: 60,
    });
    loginBusinessMock.mockResolvedValue({
      token: "signed-business-session",
      role: "business",
      business: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Pilot Salon",
      },
    });

    const response = await businessLogin(
      jsonRequest("/api/auth/login", {
        email: "owner@example.test",
        password: "valid-password",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      role: "business",
      business: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Pilot Salon",
      },
    });
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain(
      "salonbook_business_session=signed-business-session"
    );
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});
