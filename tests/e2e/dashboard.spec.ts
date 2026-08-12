import { expect, test } from "@playwright/test";
import {
  authenticateBusiness,
  installMockApi,
  TEST_IDS,
} from "./mock-api";

test("business owner completes a booking and can keyboard-switch schedule views", async ({
  page,
}) => {
  await authenticateBusiness(page);
  const api = await installMockApi(page);

  await page.goto("/dashboard/bookings");
  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  const bookingsTable = page.getByRole("table", { name: "Business bookings" });
  await expect(bookingsTable.getByText("Njeri Kamau")).toBeVisible();

  await page.getByRole("button", { name: "Complete" }).click();
  await expect(bookingsTable.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete" })).toHaveCount(0);
  expect(api.statusUpdates).toEqual([
    { bookingId: TEST_IDS.booking, status: "Completed" },
  ]);

  const listTab = page.getByRole("tab", { name: "Appointment list" });
  await listTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Weekly calendar" })
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Show previous week" })).toBeVisible();

  const protectedRequests = api.requests.filter((request) =>
    request.path.startsWith(`/api/businesses/${TEST_IDS.business}/`)
  );
  expect(protectedRequests.length).toBeGreaterThan(0);
  expect(protectedRequests.every((request) => request.authorization === null)).toBe(
    true
  );
  const browserStorage = await page.evaluate(() => ({
    business: window.localStorage.getItem("salonbook_token"),
    customer: window.localStorage.getItem("salonbook_customer_token"),
    admin: window.localStorage.getItem("salonbook_admin_token"),
  }));
  expect(browserStorage).toEqual({ business: null, customer: null, admin: null });
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "salonbook_business_session"
  );
  expect(sessionCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
  });
  expect(api.unexpectedRequests).toEqual([]);
});
