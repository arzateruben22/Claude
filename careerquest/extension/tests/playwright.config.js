// @ts-check
/**
 * Playwright config for the CareerQuest Job Tracker extension tests.
 * Run from the repo root:  npx playwright test -c extension/tests/playwright.config.js
 *
 * The browser is NOT launched by Playwright's default fixtures: extensions need a
 * persistent context, which tests/fixtures.js creates (see that file for the
 * headless/extension-loading details and the host mapping used for job-board URLs).
 */
const { defineConfig } = require("@playwright/test");
const path = require("node:path");

module.exports = defineConfig({
  testDir: path.join(__dirname, "specs"),
  outputDir: path.join(__dirname, ".tmp", "test-results"),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
  },
});
