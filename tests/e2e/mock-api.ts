import type { Page } from "@playwright/test";

export const TEST_IDS = {
  business: "11111111-1111-4111-8111-111111111111",
  service: "22222222-2222-4222-8222-222222222222",
  staff: "33333333-3333-4333-8333-333333333333",
  customer: "44444444-4444-4444-8444-444444444444",
  booking: "55555555-5555-4555-8555-555555555555",
  promotion: "66666666-6666-4666-8666-666666666666",
} as const;

const workingHours = {
  monday: { open: "08:00", close: "18:00", closed: false },
  tuesday: { open: "08:00", close: "18:00", closed: false },
  wednesday: { open: "08:00", close: "18:00", closed: false },
  thursday: { open: "08:00", close: "18:00", closed: false },
  friday: { open: "08:00", close: "18:00", closed: false },
  saturday: { open: "09:00", close: "16:00", closed: false },
  sunday: { open: "09:00", close: "16:00", closed: true },
};

export const testBusiness = {
  id: TEST_IDS.business,
  name: "Amani Studio",
  slug: "amani-studio",
  email: "owner@amani.test",
  phone: "+254700000001",
  location: "Westlands, Nairobi",
  working_hours: workingHours,
  created_at: "2099-01-01T00:00:00.000Z",
  description: "Braids, natural hair care and calm appointments.",
  category: "braids",
  cancellation_hours: 24,
  deposit_required: false,
  buffer_minutes: 10,
  status: "active",
};

export const testService = {
  id: TEST_IDS.service,
  business_id: TEST_IDS.business,
  name: "Signature Braids",
  price: 2500,
  duration_minutes: 90,
  created_at: "2099-01-01T00:00:00.000Z",
  description: "Neat, lightweight braids with a tailored finish.",
  buffer_minutes: 10,
  active: true,
};

export const testStaff = {
  id: TEST_IDS.staff,
  business_id: TEST_IDS.business,
  name: "Amina Otieno",
  email: "amina@amani.test",
  phone: "+254700000002",
  role: "senior stylist",
  specialties: ["Braids", "Natural hair"],
  working_hours: workingHours,
  active: true,
  created_at: "2099-01-01T00:00:00.000Z",
  service_ids: [TEST_IDS.service],
};

const initialBooking = {
  id: TEST_IDS.booking,
  business_id: TEST_IDS.business,
  service_id: TEST_IDS.service,
  customer_id: TEST_IDS.customer,
  date: "2099-08-12",
  time: "10:00:00",
  end_time: "11:30:00",
  status: "Booked",
  created_at: "2099-08-01T09:00:00.000Z",
  staff_id: TEST_IDS.staff,
  service_name: testService.name,
  service_price: testService.price,
  customer_name: "Njeri Kamau",
  customer_phone: "+254712345678",
  staff_name: testStaff.name,
};

type RecordedRequest = {
  authorization: string | null;
  body?: Record<string, unknown>;
  method: string;
  path: string;
  search: string;
};

export type MockApiState = {
  bookingSubmissions: Record<string, unknown>[];
  bookings: Array<typeof initialBooking>;
  requests: RecordedRequest[];
  staffRequests: number;
  statusUpdates: Array<{ bookingId: string; status: string }>;
  unexpectedRequests: RecordedRequest[];
};

type MockApiOptions = {
  staffGate?: Promise<void>;
};

function jsonBody(rawBody: string | null): Record<string, unknown> {
  if (!rawBody) return {};
  const parsed: unknown = JSON.parse(rawBody);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/**
 * Installs a single catch-all API boundary. Every API response used by E2E is
 * synthetic, and an unrecognised endpoint returns 501 instead of reaching the DB.
 */
export async function installMockApi(
  page: Page,
  options: MockApiOptions = {}
): Promise<MockApiState> {
  const state: MockApiState = {
    bookingSubmissions: [],
    bookings: [{ ...initialBooking }],
    requests: [],
    staffRequests: 0,
    statusUpdates: [],
    unexpectedRequests: [],
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const recorded: RecordedRequest = {
      authorization: request.headers()["authorization"] || null,
      method,
      path: url.pathname,
      search: url.search,
    };

    if (request.postData()) recorded.body = jsonBody(request.postData());
    state.requests.push(recorded);

    if (method === "GET" && url.pathname === "/api/discover") {
      const query = (url.searchParams.get("q") || "").toLowerCase();
      const category = url.searchParams.get("category") || "";
      const matchesQuery =
        !query ||
        testBusiness.name.toLowerCase().includes(query) ||
        testBusiness.location.toLowerCase().includes(query);
      const matchesCategory = !category || testBusiness.category === category;

      await route.fulfill({
        json:
          matchesQuery && matchesCategory
            ? [
                {
                  id: testBusiness.id,
                  name: testBusiness.name,
                  slug: testBusiness.slug,
                  location: testBusiness.location,
                  category: testBusiness.category,
                  description: testBusiness.description,
                  avg_rating: 4.8,
                  review_count: 24,
                },
              ]
            : [],
      });
      return;
    }

    if (method === "GET" && url.pathname === "/api/bookings/business") {
      await route.fulfill({
        json: {
          business: {
            id: testBusiness.id,
            name: testBusiness.name,
            slug: testBusiness.slug,
            phone: testBusiness.phone,
            location: testBusiness.location,
          },
          services: [testService],
        },
      });
      return;
    }

    if (
      method === "GET" &&
      url.pathname === `/api/businesses/${TEST_IDS.business}/staff`
    ) {
      state.staffRequests += 1;
      if (options.staffGate) await options.staffGate;
      await route.fulfill({ json: [testStaff] });
      return;
    }

    if (
      method === "GET" &&
      url.pathname === `/api/businesses/${TEST_IDS.business}/slots`
    ) {
      await route.fulfill({
        json: [
          { time: "09:00", available: false },
          { time: "10:00", available: true },
          { time: "14:30", available: true },
        ],
      });
      return;
    }

    if (method === "POST" && url.pathname === "/api/promotions/validate") {
      const body = recorded.body || {};
      const valid =
        body.business_id === TEST_IDS.business &&
        body.service_id === TEST_IDS.service &&
        body.booking_date === "2099-08-12" &&
        body.code === "AMANI10";
      await route.fulfill({
        status: valid ? 200 : 400,
        json: valid
          ? {
              id: TEST_IDS.promotion,
              discount_type: "percentage",
              discount_value: 10,
            }
          : { error: "Invalid or expired promotion code" },
      });
      return;
    }

    if (method === "POST" && url.pathname === "/api/bookings") {
      const body = recorded.body || {};
      state.bookingSubmissions.push(body);
      await route.fulfill({
        status: 201,
        json: {
          ...initialBooking,
          ...body,
          service_name_snapshot: testService.name,
          service_price_snapshot: testService.price,
          discount_amount: body.promotion_code ? 250 : 0,
          final_price: body.promotion_code ? 2250 : 2500,
        },
      });
      return;
    }

    if (method === "GET" && url.pathname === "/api/auth/me") {
      await route.fulfill({
        json: {
          business: testBusiness,
          stats: {
            total_bookings: 18,
            today_bookings: 1,
            upcoming_bookings: 6,
            monthly_bookings: 12,
            total_customers: 9,
            monthly_revenue: 28500,
          },
        },
      });
      return;
    }

    if (
      method === "GET" &&
      url.pathname === `/api/businesses/${TEST_IDS.business}/analytics`
    ) {
      await route.fulfill({
        json: {
          period: "7d",
          revenue: [],
          bookings: [
            { date: "2099-08-10", count: 2 },
            { date: "2099-08-11", count: 3 },
          ],
          popular_services: [{ name: testService.name, count: 8 }],
          peak_hours: [{ hour: 10, count: 4 }],
          total_revenue: 12500,
          total_bookings: 5,
          avg_rating: 4.8,
          new_customers: 2,
        },
      });
      return;
    }

    if (
      method === "GET" &&
      url.pathname === `/api/businesses/${TEST_IDS.business}/calendar`
    ) {
      const start = url.searchParams.get("start") || initialBooking.date;
      await route.fulfill({
        json: state.bookings.map((booking) => ({ ...booking, date: start })),
      });
      return;
    }

    if (
      method === "GET" &&
      url.pathname === `/api/businesses/${TEST_IDS.business}/bookings`
    ) {
      const status = url.searchParams.get("status");
      const date = url.searchParams.get("date");
      const bookings = state.bookings.filter(
        (booking) =>
          (!status || booking.status === status) && (!date || booking.date === date)
      );
      await route.fulfill({ json: bookings });
      return;
    }

    const bookingMatch = url.pathname.match(
      new RegExp(
        `^/api/businesses/${TEST_IDS.business}/bookings/([0-9a-f-]+)$`
      )
    );
    if (method === "PATCH" && bookingMatch) {
      const body = recorded.body || {};
      const status = typeof body.status === "string" ? body.status : "";
      const bookingId = bookingMatch[1];
      state.statusUpdates.push({ bookingId, status });
      state.bookings = state.bookings.map((booking) =>
        booking.id === bookingId ? { ...booking, status } : booking
      );
      await route.fulfill({
        json: state.bookings.find((booking) => booking.id === bookingId),
      });
      return;
    }

    state.unexpectedRequests.push(recorded);
    await route.fulfill({
      status: 501,
      json: { error: `Unexpected E2E API request: ${method} ${url.pathname}` },
    });
  });

  return state;
}

export async function authenticateBusiness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("salonbook_token", "e2e-business-token");
  });
}
