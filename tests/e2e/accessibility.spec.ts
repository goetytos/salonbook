import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  authenticateBusiness,
  installMockApi,
  testBusiness,
  testService,
  testStaff,
} from "./mock-api";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoWcagViolations(page: Page, pageName: string) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));

  expect(summary, `${pageName} accessibility violations`).toEqual([]);
}

test("landing page meets automated WCAG A/AA checks", async ({ page }) => {
  const api = await installMockApi(page);

  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "default-src 'self'"
  );
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoWcagViolations(page, "landing page");
  expect(api.unexpectedRequests).toEqual([]);
});

test("Explore meets automated WCAG A/AA checks", async ({ page }) => {
  const api = await installMockApi(page);

  await page.goto("/explore?q=Westlands");
  await expect(page.getByText("1 result for “Westlands”")).toBeVisible();
  await expectNoWcagViolations(page, "Explore page");
  expect(api.unexpectedRequests).toEqual([]);
});

test("booking entry meets automated WCAG A/AA checks", async ({ page }) => {
  const api = await installMockApi(page);

  await page.goto(`/book/${testBusiness.slug}`);
  await expect(
    page.getByRole("heading", { name: "Select a service" })
  ).toBeVisible();
  await expectNoWcagViolations(page, "booking page");
  expect(api.unexpectedRequests).toEqual([]);
});

test("booking details form meets automated WCAG A/AA checks", async ({ page }) => {
  const api = await installMockApi(page);

  await page.goto(`/book/${testBusiness.slug}`);
  await page
    .getByRole("button", { name: new RegExp(testService.name, "i") })
    .click();
  await page
    .getByRole("button", { name: new RegExp(testStaff.name, "i") })
    .click();
  await page.locator('input[type="date"]').fill("2099-08-12");
  await page.getByRole("button", { name: "10:00" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Your details" })
  ).toBeVisible();

  await expectNoWcagViolations(page, "booking details form");
  expect(api.unexpectedRequests).toEqual([]);
});

test("business bookings meets automated WCAG A/AA checks", async ({ page }) => {
  await authenticateBusiness(page);
  const api = await installMockApi(page);

  await page.goto("/dashboard/bookings");
  await expect(
    page.getByRole("table", { name: "Business bookings" }).getByText("Njeri Kamau")
  ).toBeVisible();
  await expectNoWcagViolations(page, "business bookings page");

  expect(api.unexpectedRequests).toEqual([]);
});
