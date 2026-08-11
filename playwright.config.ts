import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT || 3107);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "output/playwright/report" }]]
    : "list",
  outputDir: "output/playwright/test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.CI
          ? "npm run start"
          : "npm run dev -- --hostname 127.0.0.1",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: String(port),
          JWT_SECRET:
            process.env.JWT_SECRET ||
            "salonbook-e2e-only-signing-secret-never-use-in-production",
        },
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
