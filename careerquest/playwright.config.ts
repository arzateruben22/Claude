import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// E2E_PORT lets parallel worktrees run their own server; APP_URL follows the port.
const PORT = Number(process.env.E2E_PORT ?? 3100);

// Use a pre-installed Chromium when available (CI images / sandboxes) instead of downloading one.
const preinstalled = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const launchOptions = existsSync(preinstalled) ? { executablePath: preinstalled } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "iphone", use: { ...devices["iPhone 14"], browserName: "chromium", launchOptions } },
  ],
  webServer: {
    command: `APP_URL=http://localhost:${PORT} npx dotenv -e ${process.env.E2E_ENV_FILE ?? ".env.test"} -- next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
