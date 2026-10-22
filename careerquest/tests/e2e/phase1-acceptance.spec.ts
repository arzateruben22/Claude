import { test, expect, type Page } from "@playwright/test";
import { register, login, logout } from "./helpers";
import { XP } from "../../src/lib/game/xp-config";

/**
 * Phase 1 acceptance: register → onboarding → log an application → change its stage → see the
 * numbers on the dashboard and analytics → sign out/in and find the record intact.
 *
 * XP is read from the top bar (data-testid="topbar-xp"), which is visible on both desktop and
 * iPhone widths. Expected totals are computed from the XP config so a tuning change cannot
 * silently break the test's idea of "no double counting".
 */

const COMPANY = "Acme Electric";
const TITLE = "Apprentice Electrician";
const LOCATION = "Anaheim, CA";
const STATUS_NOTE = "Recruiter called about a phone screen";
const QUICK_STATUS_NAME = `Status for ${COMPANY} – ${TITLE}`;

async function topBarXp(page: Page): Promise<number> {
  const text = await page.getByTestId("topbar-xp").innerText();
  const n = Number(text.replace(/[^0-9]/g, ""));
  expect(Number.isFinite(n), `top bar XP should be numeric, got "${text}"`).toBe(true);
  return n;
}

async function expectTopBarXp(page: Page, xp: number) {
  await expect(page.getByTestId("topbar-xp")).toHaveText(new RegExp(`\\b${xp.toLocaleString("en-US")} XP\\b`));
}

test.describe("phase 1 acceptance", () => {
  test("register, onboard, track an application, see the numbers, sign back in", async ({ page }) => {
    // ---- Register and land on the dashboard --------------------------------------------------
    const { email } = await register(page, { name: "Phase One" });
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Welcome to CareerQuest, Phase/ })).toBeVisible();
    expect(await topBarXp(page)).toBe(0);

    // ---- Onboarding: three steps ----------------------------------------------------------------
    await page.goto("/settings/onboarding");
    await expect(page.getByRole("heading", { name: "Set up your campaign" })).toBeVisible();

    // Step 1 · Goals
    await expect(page.getByRole("heading", { name: "Step 1 · Goals" })).toBeVisible();
    await page.getByLabel("Campaign length (days)").fill("90");
    await page.getByLabel("Immediate salary target (annual)").fill("80000");
    await page.getByLabel("Long-term salary target (annual)").fill("150000");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2 · Pathway
    await expect(page.getByRole("heading", { name: "Step 2 · Pathway" })).toBeVisible();
    await page.getByLabel("Primary trade").selectOption("ELECTRICIAN");
    await expect(page.getByLabel("Primary trade")).toHaveValue("ELECTRICIAN");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3 · Targets (defaults are 5 per day × 5 workdays = 25 per week)
    await expect(page.getByRole("heading", { name: "Step 3 · Targets" })).toBeVisible();
    await expect(page.getByLabel("Daily application target")).toHaveValue("5");
    await expect(page.getByLabel("Weekly application target")).toHaveValue("25");
    await page.getByRole("button", { name: `Finish setup (+${XP.PROFILE_COMPLETED} XP)` }).click();

    // Finishing redirects to the dashboard with campaign info for day 1 of 90.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    // The campaign day appears in the page eyebrow and again in the campaign timeline card.
    await expect(page.getByText("Day 1 of 90 · Phase 1").first()).toBeVisible();
    let expectedXp = XP.PROFILE_COMPLETED;
    await expectTopBarXp(page, expectedXp);

    // ---- Log a submitted application -----------------------------------------------------------
    await page.goto("/applications/new");
    await expect(page.getByRole("heading", { name: "New application" })).toBeVisible();
    // Exact labels: "Company" would otherwise also match "Requires driving a company vehicle".
    await page.getByLabel("Company", { exact: true }).fill(COMPANY);
    await page.getByLabel("Job title", { exact: true }).fill(TITLE);
    await page.getByLabel("Location", { exact: true }).fill(LOCATION);
    await page.getByLabel("Found on", { exact: true }).selectOption("INDEED");
    await page.getByLabel("Status", { exact: true }).selectOption("SUBMITTED");
    await page.getByRole("button", { name: "Save application" }).click();

    // Detail page: status Submitted, XP awarded once.
    await expect(page).toHaveURL(/\/applications\/[a-z0-9-]+\?xp=25$/i);
    const detailUrl = page.url().split("?")[0]!;
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: `+${XP.APPLICATION_SUBMITTED} XP` })).toBeVisible();
    await expect(page.getByTestId("application-status")).toHaveText("Submitted");
    await expect(page.getByText(LOCATION)).toBeVisible();
    expectedXp += XP.APPLICATION_SUBMITTED;
    await expectTopBarXp(page, expectedXp);

    // ---- Move it to Screening with a note ------------------------------------------------------
    await page.getByLabel("New stage", { exact: true }).selectOption("SCREENING");
    await page.getByLabel("Note (optional)", { exact: true }).fill(STATUS_NOTE);
    await page.getByRole("button", { name: "Update status" }).click();

    await expect(page.getByText("Marked as Screening.")).toBeVisible();
    await expect(page.getByTestId("application-status")).toHaveText("Screening");
    await expect(page.getByText("Currently Screening.")).toBeVisible();
    const timeline = page.getByRole("list", { name: "Activity timeline" });
    const change = timeline.getByRole("listitem").filter({ hasText: "Submitted → Screening" });
    await expect(change).toBeVisible();
    await expect(change).toContainText(STATUS_NOTE);
    await expect(change).toContainText("Verified");
    await expect(timeline.getByRole("listitem").filter({ hasText: "Created as Submitted" })).toBeVisible();

    // A stage change is not a second submission: XP must not move.
    await expectTopBarXp(page, expectedXp);
    await page.reload();
    await expectTopBarXp(page, expectedXp);
    await expect(page.getByTestId("application-status")).toHaveText("Screening");

    // ---- The list shows the row ----------------------------------------------------------------
    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
    const row = page.getByRole("link", { name: COMPANY });
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("href", new RegExp(detailUrl.replace(/^https?:\/\/[^/]+/, "") + "$"));
    // The list renders a desktop table and mobile cards; only one is visible per viewport.
    await expect(page.getByText(TITLE).locator("visible=true")).toBeVisible();
    await expect(page.getByRole("combobox", { name: QUICK_STATUS_NAME })).toHaveValue("SCREENING");

    // ---- Dashboard numbers --------------------------------------------------------------------
    await page.goto("/dashboard");
    await expect(page.getByText("Day 1 of 90 · Phase 1").first()).toBeVisible();
    const tiles = page.getByRole("list", { name: "Today's numbers" });
    await expect(tiles.getByRole("listitem").filter({ hasText: "Today" }).first()).toContainText(/1\s*\/\s*5/);
    await expect(tiles.getByRole("listitem").filter({ hasText: "Total submitted" })).toContainText("1");
    await expect(page.getByTestId("funnel-stage-submitted").getByTestId("funnel-stage-count")).toHaveText("1");
    await expect(page.getByTestId("funnel-stage-responses").getByTestId("funnel-stage-count")).toHaveText("1");
    await expect(page.getByTestId("funnel-stage-screenings").getByTestId("funnel-stage-count")).toHaveText("1");
    await expect(page.getByTestId("funnel-stage-interviews").getByTestId("funnel-stage-count")).toHaveText("0");
    await expectTopBarXp(page, expectedXp);

    // ---- Analytics: applied = 1, honest low-sample warning -----------------------------------
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByTestId("tile-applied")).toContainText("Applied · Observed");
    await expect(page.getByTestId("tile-applied").locator("p").nth(1)).toHaveText("1");
    const responseTile = page.getByTestId("tile-response-rate");
    await expect(responseTile).toContainText("n = 1");
    await expect(responseTile).toContainText("Low sample");
    await expect(responseTile).toContainText("not enough data for a reliable rate");

    // ---- Sign out, sign in, and the record is still there -------------------------------------
    await logout(page);
    await login(page, email);
    await expectTopBarXp(page, expectedXp);
    await page.goto("/applications");
    await expect(page.getByRole("link", { name: COMPANY })).toBeVisible();
    await expect(page.getByRole("combobox", { name: QUICK_STATUS_NAME })).toHaveValue("SCREENING");
    await page.goto(detailUrl);
    await expect(page.getByTestId("application-status")).toHaveText("Screening");
  });

  test("every shell route renders: Phase 1 pages, API exports, honest placeholders", async ({ page }) => {
    await register(page, { name: "Route Walker" });

    // A saved (not submitted) application so the detail and edit routes have a real id.
    await page.goto("/applications/new");
    await page.getByLabel("Company", { exact: true }).fill("Route Co");
    await page.getByLabel("Job title", { exact: true }).fill("Journeyman Electrician");
    await page.getByRole("button", { name: "Save application" }).click();
    // Exclude /applications/new so the assertion waits for the redirect to the created record.
    await expect(page).toHaveURL(/\/applications\/(?!new$)[a-z0-9-]+$/i);
    const appId = page.url().split("/").pop()!;

    const phase1: Array<[string, RegExp | string]> = [
      ["/dashboard", "Command Center"],
      ["/dashboard/goals", "Numbers game"],
      ["/applications", "Applications"],
      ["/applications/new", "New application"],
      [`/applications/${appId}`, "Journeyman Electrician"],
      [`/applications/${appId}/edit`, /^Edit: Journeyman Electrician/],
      ["/analytics", "Analytics"],
      ["/settings", "Settings"],
      ["/settings/campaign", "Settings"],
      ["/settings/eligibility", "Settings"],
      ["/settings/appearance", "Settings"],
      ["/settings/account", "Settings"],
      ["/settings/tokens", "Settings"],
      ["/settings/onboarding", "Set up your campaign"],
    ];
    for (const [route, heading] of phase1) {
      const res = await page.goto(route);
      expect(res?.status(), `${route} should return 200`).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading, exact: typeof heading === "string" })).toBeVisible();
      await expect(page.getByText("Application error")).toHaveCount(0);
    }

    // Later-phase modules stay honest placeholders: no demo data, clearly marked as not built yet.
    for (const route of ["/missions", "/discovery", "/career-map", "/academy", "/skills", "/coach", "/salary", "/integrations"]) {
      const res = await page.goto(route);
      expect(res?.status(), `${route} should return 200`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Module under construction" })).toBeVisible();
      await expect(page.getByText("no demo data is shown")).toBeVisible();
    }

    // API exports share the browser session cookie.
    const csv = await page.request.get("/api/export/applications");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(csv.headers()["content-disposition"]).toMatch(/attachment; filename="careerquest-applications-\d{4}-\d{2}-\d{2}\.csv"/);
    const csvBody = await csv.text();
    expect(csvBody.split("\n")[0]).toContain("company");
    expect(csvBody).toContain("Route Co");

    const json = await page.request.get("/api/account/export");
    expect(json.status()).toBe(200);
    expect(json.headers()["content-type"]).toContain("application/json");
    const exported = (await json.json()) as { applications?: Array<{ companyName?: string }> };
    expect(JSON.stringify(exported)).toContain("Route Co");
    expect(JSON.stringify(exported)).not.toContain("passwordHash");

    // Signed out, both APIs refuse with 401 JSON rather than redirecting to HTML.
    await logout(page);
    for (const route of ["/api/export/applications", "/api/account/export"]) {
      const res = await page.request.get(route);
      expect(res.status(), `${route} signed out`).toBe(401);
      expect(res.headers()["content-type"]).toContain("application/json");
    }
  });
});
