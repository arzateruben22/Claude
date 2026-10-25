import { test, expect, type Page } from "@playwright/test";
import { register } from "./helpers";
import { XP } from "../../src/lib/game/xp-config";

/**
 * Route smoke: every page route under src/app/(app) renders for an authenticated user, first as a
 * brand-new account (real empty states, no demo data) and then with data created through the app's
 * own UI and server actions (an application moved to Offer, an offer, a lead, a target company, a
 * lesson attempt, a practice exam, an hours entry, a résumé, a weekly report, an interview, two
 * uploads of about 5 MB each). Each visit asserts HTTP 200, the page heading, no Next error overlay
 * or "Application error" text, no browser console errors, and (iPhone project) no horizontal page
 * overflow.
 */

const MB = 1024 * 1024;

const STATIC_ROUTES: Array<[string, string | RegExp]> = [
  ["/dashboard", "Command Center"],
  ["/dashboard/goals", "Numbers game"],
  ["/applications", "Applications"],
  ["/applications/new", "New application"],
  ["/applications/import", "Import applications"],
  ["/applications/import/spreadsheet", "Import applications"],
  ["/applications/import/urls", "Import applications"],
  ["/applications/import/exports", "Import applications"],
  ["/applications/review", "Review queue"],
  ["/applications/review/captures", "Review queue"],
  ["/applications/review/duplicates", "Review queue"],
  ["/missions", "Missions"],
  ["/missions/week", "Missions"],
  ["/missions/campaign", "Missions"],
  ["/missions/achievements", "Missions"],
  ["/discovery", "Find your next job"],
  ["/discovery/companies", "Find your next job"],
  ["/discovery/search", "Find your next job"],
  ["/discovery/apprenticeships", "Find your next job"],
  ["/career-map", "Career Map"],
  ["/career-map?node=supervised-experience", "Career Map"],
  ["/academy", "Electrician Academy"],
  ["/academy/roadmap", "Certification roadmap"],
  ["/academy/workshop", "Simulated workshop"],
  ["/academy/workshop/series-basics", "Series Basics: One Path, One Current"],
  ["/academy/exam", "Practice exam"],
  ["/academy/apprenticeships", "Apprenticeship directory"],
  ["/academy/apprenticeships?region=Los%20Angeles%20County&union=union", "Apprenticeship directory"],
  ["/academy/apprenticeships/ibew-11-eti", /Electrical Training Institute/],
  ["/academy/hours", "Training hours"],
  ["/academy/certification", "Certification tracker"],
  ["/academy/certification?c=RESIDENTIAL", "Certification tracker"],
  ["/academy/lessons/electrical-basics", "Electrical Basics: Charge, Voltage, Current and Resistance"],
  ["/academy/lessons/electrical-basics?preview=1", "Electrical Basics: Charge, Voltage, Current and Resistance"],
  ["/academy/lessons/electrical-basics/quiz", "Electrical Basics: Charge, Voltage, Current and Resistance"],
  ["/skills", "Skill Tree"],
  ["/skills?skill=jobs.applications", "Skill Tree"],
  ["/coach", "Career Advisor"],
  ["/coach?ask=How%20am%20I%20doing", "Career Advisor"],
  ["/coach/resumes", "Résumés"],
  ["/analytics", "Analytics"],
  ["/analytics?range=all&status=SUBMITTED,OFFER", "Analytics"],
  ["/analytics/forecast", "Forecast"],
  ["/analytics/forecast?rho=0.5", "Forecast"],
  ["/analytics/reports", "Weekly reports"],
  ["/salary", "Salary Simulator"],
  ["/salary/compare", "Salary Simulator"],
  ["/salary/offers", "Salary Simulator"],
  ["/salary/offers/new", "Salary Simulator"],
  ["/integrations", "Integrations"],
  ["/notifications", "Notifications"],
  ["/share", "Capture a job"],
  ["/share?url=https%3A%2F%2Fwww.indeed.com%2Fviewjob%3Fjk%3Dsmoke123&title=Journeyman%20Electrician%20-%20Smoke%20Electric%20-%20Anaheim%2C%20CA%20-%20Indeed.com", "Capture a job"],
  ["/settings", "Settings"],
  ["/settings/campaign", "Settings"],
  ["/settings/eligibility", "Settings"],
  ["/settings/appearance", "Settings"],
  ["/settings/account", "Settings"],
  ["/settings/tokens", "Settings"],
  ["/settings/onboarding", "Set up your campaign"],
];

/** Browser console errors and uncaught page errors collected while a page is open. */
function watchConsole(page: Page): { errors: string[]; reset(): void } {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return {
    errors,
    reset() {
      errors.length = 0;
    },
  };
}

async function visit(page: Page, watch: { errors: string[]; reset(): void }, path: string, heading: string | RegExp) {
  watch.reset();
  const res = await page.goto(path);
  expect(res?.status(), `${path} should return 200`).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: heading, exact: typeof heading === "string" }), `${path} heading`).toBeVisible();
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  // Let client components mount (hydration errors surface as console errors).
  await page.waitForLoadState("networkidle");
  if (test.info().project.name === "iphone") {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits, `${path} must not overflow horizontally on a phone`).toBe(true);
  }
  expect(watch.errors, `${path} console errors`).toEqual([]);
}

async function completeOnboarding(page: Page) {
  await page.goto("/settings/onboarding");
  await expect(page.getByRole("heading", { name: "Step 1 · Goals" })).toBeVisible();
  await page.getByLabel("Campaign length (days)").fill("90");
  await page.getByLabel("Immediate salary target (annual)").fill("80000");
  await page.getByLabel("Long-term salary target (annual)").fill("150000");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Step 2 · Pathway" })).toBeVisible();
  await page.getByLabel("Primary trade").selectOption("ELECTRICIAN");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Step 3 · Targets" })).toBeVisible();
  await page.getByRole("button", { name: `Finish setup (+${XP.PROFILE_COMPLETED} XP)` }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
}

/** A ~5 MB RFC 5322 email: a real Indeed-style confirmation followed by a large plain-text filler part. */
function bigEml(sizeBytes: number): Buffer {
  const head = [
    'From: "Indeed" <noreply@indeed.com>',
    "To: Smoke Test <smoke.test@example.com>",
    "Subject: Application submitted: Apprentice Electrician at Acme Electric",
    "Date: Mon, 12 Jan 2026 09:14:33 -0800",
    `Message-ID: <smoke-${Date.now()}-${Math.random().toString(36).slice(2)}@indeed.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    "Your application has been sent",
    "",
    "Apprentice Electrician",
    "Acme Electric - Anaheim, CA",
    "",
    "Your application was submitted to Acme Electric on Indeed. The employer will review it and contact you if they want to move forward.",
    "",
    "Attachment (inline copy of the posting follows):",
    "",
  ].join("\r\n");
  const line = "Posting detail line: conduit bending, panel terminations, lighting controls, NEC 2023 references and site safety notes.\r\n";
  const chunks: string[] = [head];
  let size = Buffer.byteLength(head);
  while (size < sizeBytes) {
    chunks.push(line);
    size += line.length;
  }
  return Buffer.from(chunks.join(""), "utf8");
}

/** A ~5 MB file with a PDF signature (the server checks the extension and magic bytes). */
function bigPdf(sizeBytes: number): Buffer {
  const buf = Buffer.alloc(sizeBytes, 0x20);
  buf.write("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", 0, "latin1");
  buf.write("\n%%EOF\n", sizeBytes - 7, "latin1");
  return buf;
}

test.describe("route smoke", () => {
  test("every route renders a real empty state for a brand-new account", async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const watch = watchConsole(page);
    await register(page, { name: "Smoke Empty" });
    for (const [path, heading] of STATIC_ROUTES) await visit(page, watch, path, heading);
    // Unknown dynamic ids are a 404 page, never a crash.
    for (const path of ["/applications/00000000-0000-4000-8000-000000000000", "/academy/lessons/no-such-lesson", "/salary/offers/00000000-0000-4000-8000-000000000000", "/academy/apprenticeships/no-such-program", "/analytics/reports/2026-01-07"]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should be a 404`).toBe(404);
      await expect(page.getByText("Application error")).toHaveCount(0);
    }
  });

  test("every route renders with data created through the app, including two ~5 MB uploads", async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const watch = watchConsole(page);
    await register(page, { name: "Smoke Data" });
    await completeOnboarding(page);

    // ---- Application → Offer stage → offer record ---------------------------------------------
    await page.goto("/applications/new");
    await page.getByLabel("Company", { exact: true }).fill("Smoke Electric");
    await page.getByLabel("Job title", { exact: true }).fill("Apprentice Electrician");
    await page.getByLabel("Location", { exact: true }).fill("Anaheim, CA");
    await page.getByLabel("Found on", { exact: true }).selectOption("INDEED");
    await page.getByLabel("Status", { exact: true }).selectOption("SUBMITTED");
    await page.getByRole("button", { name: "Save application" }).click();
    await expect(page).toHaveURL(/\/applications\/[a-z0-9-]+\?xp=\d+$/i);
    const detailUrl = page.url().split("?")[0]!;
    const appId = detailUrl.split("/").pop()!;

    await page.getByLabel("New stage", { exact: true }).selectOption("OFFER");
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText("Marked as Offer.")).toBeVisible();
    await expect(page.getByTestId("application-status")).toHaveText("Offer");

    // Interview on the same record (dashboard + coach + reports read it).
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Schedule interview" }).click();
    const when = new Date(Date.now() + 3 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    await page.getByLabel("Date and time").fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T10:00`);
    await page.getByRole("button", { name: "Save interview" }).click();
    await expect(page.getByText("Interview scheduled", { exact: false }).first()).toBeVisible();

    await page.goto(detailUrl);
    await page.getByRole("link", { name: "Add offer details" }).click();
    await expect(page).toHaveURL(/\/salary\/offers\/new\?applicationId=/);
    await page.getByLabel("Pay period").selectOption("HOURLY");
    await page.getByLabel("Base hourly rate (USD)").fill("34");
    await page.getByLabel("Regular hours per week").fill("40");
    await page.getByRole("button", { name: "Save offer" }).click();
    await expect(page).toHaveURL(/\/salary\/offers\/[a-z0-9-]+$/i);
    const offerId = page.url().split("/").pop()!;

    // ---- Discovery: a lead and a target company -------------------------------------------------
    await page.goto("/discovery");
    await page.getByLabel("Job title", { exact: true }).fill("Maintenance Electrician");
    await page.getByLabel("Company", { exact: true }).fill("Smoke Facilities");
    await page.getByLabel("Location (optional)").fill("Irvine, CA");
    await page.getByRole("button", { name: "Save lead" }).click();
    await expect(page.getByText("Maintenance Electrician").first()).toBeVisible();

    await page.goto("/discovery/companies");
    await page.getByLabel("Company name", { exact: true }).fill("Smoke Facilities");
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByText("Smoke Facilities").first()).toBeVisible();

    // ---- Academy: lesson attempt, practice exam, hours entry, proof document (~5 MB) ------------
    await page.goto("/academy/lessons/electrical-basics");
    await page.getByRole("link", { name: "Take the quiz" }).click();
    await expect(page).toHaveURL(/\/academy\/lessons\/electrical-basics\/quiz$/);
    for (const q of await page.locator("form ol > li").all()) {
      const radio = q.locator('input[type="radio"]').first();
      if ((await radio.count()) > 0) await radio.check();
      else await q.locator('input[inputmode="decimal"]').fill("1");
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.locator('[aria-label="Quiz result"]')).toBeVisible();

    await page.goto("/academy/exam/take?size=25");
    await expect(page).toHaveURL(/seed=\d+/);
    await expect(page.getByRole("heading", { level: 1, name: /25-question practice exam/ })).toBeVisible();
    await page.locator('input[type="radio"]').evaluateAll((inputs) => {
      const seen = new Set<string>();
      for (const el of inputs as HTMLInputElement[]) {
        if (seen.has(el.name)) continue;
        seen.add(el.name);
        el.click();
      }
    });
    await page.getByRole("button", { name: "Submit exam" }).click();
    await expect(page.getByTestId("exam-results")).toBeVisible();
    await page.goto("/academy/exam");
    const reviewHref = await page.getByRole("link", { name: /25-question exam/ }).first().getAttribute("href");
    expect(reviewHref).toMatch(/^\/academy\/exam\/review\//);

    await page.goto("/academy/hours");
    await page.getByLabel("Employer", { exact: true }).fill("Smoke Electric");
    await page.getByLabel("Hours", { exact: true }).fill("4");
    await page.getByRole("button", { name: "Log hours" }).click();
    const editHours = page.getByRole("link", { name: /^Edit / }).first();
    await expect(editHours).toBeVisible();
    const hoursHref = (await editHours.getAttribute("href"))!;
    expect(hoursHref).toMatch(/^\/academy\/hours\//);

    // ~5 MB proof document through the document upload server action (10 MB limit).
    const pdfSize = 5 * MB;
    await page.locator('input[type="file"][name="file"]').first().setInputFiles({ name: "smoke-proof.pdf", mimeType: "application/pdf", buffer: bigPdf(pdfSize) });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("smoke-proof.pdf").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/could not be sent/)).toHaveCount(0);

    // ---- Email import: a ~5 MB .eml through the import server action (25 MB limit) --------------
    await page.goto("/applications/import");
    await page.locator("#email-files").setInputFiles({ name: "smoke-confirmation.eml", mimeType: "message/rfc822", buffer: bigEml(5 * MB) });
    await expect(page.getByText(/1 file, 5\.0 MB of 25 MB/)).toBeVisible();
    await page.getByRole("button", { name: "Import emails" }).click();
    await expect(page.getByRole("heading", { name: /Import result/ })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/could not be sent/)).toHaveCount(0);
    const created = page.locator("dl > div", { has: page.locator("dt", { hasText: /^New$/ }) }).locator("dd");
    await expect(created).toHaveText("1");
    await page.goto("/applications");
    await expect(page.getByRole("link", { name: "Acme Electric" })).toBeVisible();

    // ---- Coach résumé and a weekly report ---------------------------------------------------
    await page.goto("/coach/resumes");
    await page.getByLabel("Version name").fill("Smoke v1");
    await page.getByLabel("Résumé text").fill("Apprentice electrician. Residential wiring, conduit bending, panel terminations, lockout/tagout, OSHA 10.");
    await page.getByRole("button", { name: "Save résumé" }).click();
    await expect(page.getByText("Smoke v1").first()).toBeVisible();

    await page.goto("/analytics/reports");
    await page.getByRole("button", { name: "Generate this week's report" }).click();
    await expect(page).toHaveURL(/\/analytics\/reports\/\d{4}-\d{2}-\d{2}$/);
    const reportPath = new URL(page.url()).pathname;

    // ---- Every route again, now with data ---------------------------------------------------
    const dynamic: Array<[string, string | RegExp]> = [
      [detailUrl.replace(/^https?:\/\/[^/]+/, ""), "Apprentice Electrician"],
      [`/applications/${appId}/edit`, /^Edit: Apprentice Electrician/],
      [`/salary/offers/${offerId}`, "Salary Simulator"],
      [`/salary/offers/${offerId}/edit`, "Salary Simulator"],
      [`/salary/offers/new?applicationId=${appId}`, "Salary Simulator"],
      [hoursHref, "Edit entry"],
      [reviewHref!, /^25-question exam/],
      [reportPath, /^Week of /],
      ["/applications?status=OFFER&sort=followUp", "Applications"],
      ["/applications?q=Smoke", "Applications"],
    ];
    for (const [path, heading] of [...STATIC_ROUTES, ...dynamic]) await visit(page, watch, path, heading);

    // Cross-section links the integration wires up must resolve.
    await page.goto(detailUrl);
    await expect(page.getByTestId("offer-link").first()).toHaveAttribute("href", `/salary/offers/${offerId}`);
    await page.goto("/dashboard");
    await expect(page.getByTestId("today-missions-card")).toBeVisible();
    await page.goto("/analytics");
    await expect(page.getByRole("link", { name: "Weekly reports" })).toHaveAttribute("href", "/analytics/reports");
    await expect(page.getByRole("link", { name: "Forecast" })).toHaveAttribute("href", "/analytics/forecast");
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: "Notifications" }).first()).toHaveAttribute("href", "/notifications");
    await page.goto("/academy/hours");
    await expect(page.getByRole("link", { name: "Lessons" })).toHaveAttribute("href", "/academy");

    // The exports that pages link to answer with real files for this user.
    const hoursCsv = await page.request.get("/academy/hours/export");
    expect(hoursCsv.status()).toBe(200);
    expect(hoursCsv.headers()["content-type"]).toContain("text/csv");
    const reportCsv = await page.request.get(`/api/reports/${reportPath.split("/").pop()}?format=csv`);
    expect(reportCsv.status()).toBe(200);
  });
});
