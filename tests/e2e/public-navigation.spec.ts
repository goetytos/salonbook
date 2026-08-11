import { expect, test } from "@playwright/test";
import { installMockApi, testBusiness } from "./mock-api";

test("landing search carries its query into Explore and renders fixture results", async ({
  page,
}) => {
  const api = await installMockApi(page);

  await page.goto("/");
  const search = page.getByRole("searchbox", {
    name: "Search by salon name or location",
  });
  await search.focus();
  await page.keyboard.type("Westlands");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/explore\?q=Westlands$/);
  await expect(
    page.getByRole("heading", { name: "Find your next salon." })
  ).toBeVisible();
  await expect(page.getByText("1 result for “Westlands”")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: testBusiness.name })
  ).toBeVisible();
  expect(
    api.requests.some(
      (request) =>
        request.path === "/api/discover" && request.search === "?q=Westlands"
    )
  ).toBe(true);
  expect(api.unexpectedRequests).toEqual([]);
});

test.describe("mobile keyboard navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, dismisses and follows the public menu without a pointer", async ({
    page,
  }) => {
    const api = await installMockApi(page);
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await menuButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Close navigation" })
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#mobile-navigation")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-navigation")).toHaveCount(0);
    await expect(menuButton).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const exploreLink = page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Find a salon" });
    await expect(exploreLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/explore$/);
    await expect(
      page.getByRole("heading", { name: "Find your next salon." })
    ).toBeVisible();
    expect(api.unexpectedRequests).toEqual([]);
  });
});
