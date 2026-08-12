import { expect, test } from "@playwright/test";
import {
  installMockApi,
  TEST_IDS,
  testBusiness,
  testService,
  testStaff,
} from "./mock-api";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((fulfil) => {
    resolve = fulfil;
  });
  return { promise, resolve };
}

test("books with a stylist after the delayed staff response resolves", async ({
  page,
}) => {
  const staffGate = deferred<void>();
  const api = await installMockApi(page, { staffGate: staffGate.promise });

  await page.goto(`/book/${testBusiness.slug}`);
  await page
    .getByRole("button", { name: new RegExp(testService.name, "i") })
    .click();

  await expect(
    page.getByRole("heading", { name: "Choose a stylist" })
  ).toBeVisible();
  await expect(page.getByText("Loading available stylists")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pick a date and time" })
  ).toHaveCount(0);

  staffGate.resolve();
  await page.getByRole("button", { name: new RegExp(testStaff.name, "i") }).click();

  await expect(
    page.getByRole("heading", { name: "Pick a date and time" })
  ).toBeVisible();
  await page.locator('input[type="date"]').fill("2099-08-12");
  await page.getByRole("button", { name: "10:00" }).click();
  await page.getByRole("button", { name: "Continue to details" }).click();

  await page.getByPlaceholder("e.g. Akinyi Wambui").fill("Njeri Kamau");
  await page.getByPlaceholder("07XXXXXXXX").fill("0712345678");
  await page
    .getByPlaceholder("Style preferences or arrival details")
    .fill("Low-tension finish");
  await page.getByPlaceholder("Enter code").fill("amani10");
  await page.getByRole("button", { name: "Apply code" }).click();
  await expect(page.getByText("10% off applied.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm appointment" }).click();

  await expect(
    page.getByRole("heading", { name: "Your time is reserved." })
  ).toBeVisible();
  await expect(
    page.getByText(`Reference ${TEST_IDS.booking.slice(-8).toUpperCase()}`)
  ).toBeVisible();
  await expect(page.getByText("Online rescheduling is not available yet.")).toBeVisible();
  expect(api.staffRequests).toBe(1);
  expect(api.bookingSubmissions).toEqual([
    {
      business_slug: testBusiness.slug,
      service_id: TEST_IDS.service,
      date: "2099-08-12",
      time: "10:00",
      customer_name: "Njeri Kamau",
      customer_phone: "0712345678",
      staff_id: TEST_IDS.staff,
      notes: "Low-tension finish",
      promotion_code: "AMANI10",
    },
  ]);
  expect(api.unexpectedRequests).toEqual([]);
});
