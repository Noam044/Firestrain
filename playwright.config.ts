import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (run `npm run build` first).
 * Browser: the system Chrome by default (no download); set PLAYWRIGHT_CHANNEL=chromium
 * after `npx playwright install chromium` to use Playwright's own build instead.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";
const port = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // On CI a test that fails once is run again: the 3D map and the live routes can be slow on shared runners.
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: channel === "chromium" ? undefined : channel } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: channel === "chromium" ? undefined : channel },
      testMatch: /carte|liste|feu-url/,
    },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
