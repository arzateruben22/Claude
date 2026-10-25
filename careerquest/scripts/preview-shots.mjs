// Captures screenshots of the running production build for a preview gallery.
// Usage: node scripts/preview-shots.mjs <baseUrl> <outDir>
// Registers a fresh user, creates a little real data through the UI, then screenshots each route
// on desktop (1440×900) and iPhone (390×844). Nothing is faked: what you see is the app's own output.
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [base = "http://localhost:3100", out = "preview"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const email = `preview+${Date.now()}@careerquest.test`;
const password = "PreviewPassw0rd!";

const ROUTES = [
  ["dashboard", "/dashboard", "Command Center"],
  ["goals", "/dashboard/goals", "Numbers game"],
  ["missions", "/missions", "Today's missions"],
  ["campaign", "/missions/campaign", "Operation Get Hired"],
  ["achievements", "/missions/achievements", "Achievements"],
  ["applications", "/applications", "Application tracker"],
  ["application", "__APP__", "Application detail"],
  ["review", "/applications/review", "Review queue"],
  ["import", "/applications/import", "Import"],
  ["discovery", "/discovery", "Job discovery"],
  ["career-map", "/career-map", "Career map"],
  ["academy", "/academy", "Electrical Academy"],
  ["lesson", "/academy/lessons/ohms-law", "Lesson: Ohm's law"],
  ["workshop", "/academy/workshop", "Simulated workshop"],
  ["roadmap", "/academy/roadmap", "Certification roadmap"],
  ["apprenticeships", "/academy/apprenticeships", "Apprenticeship directory"],
  ["hours", "/academy/hours", "Training hours"],
  ["skills", "/skills", "Skill tree"],
  ["coach", "/coach", "Career coach"],
  ["analytics", "/analytics", "Analytics"],
  ["forecast", "/analytics/forecast", "Forecast"],
  ["salary", "/salary", "Salary simulator"],
  ["compare", "/salary/compare", "Compare paths"],
  ["integrations", "/integrations", "Integrations"],
  ["notifications", "/notifications", "Notifications"],
  ["settings", "/settings", "Settings"],
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);

await page.goto(`${base}/register`);
await page.getByLabel("Name").fill("Preview User");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/\/dashboard/);

// Onboarding (best effort: the wizard may change; skip gracefully)
try {
  await page.goto(`${base}/settings/onboarding`);
  for (let i = 0; i < 4; i++) {
    const next = page.getByRole("button", { name: /next|finish|continue|complete/i }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(400);
    if (page.url().includes("/dashboard")) break;
  }
} catch {}

// Create two applications through the real form
let appUrl = null;
const apps = [
  { company: "Acme Electric", title: "Apprentice Electrician", status: "SUBMITTED", location: "Anaheim, CA" },
  { company: "Harbor Line Elevator Co.", title: "Elevator Mechanic Helper", status: "SCREENING", location: "Long Beach, CA" },
];
for (const a of apps) {
  await page.goto(`${base}/applications/new`);
  await page.getByLabel(/company/i).first().fill(a.company);
  await page.getByLabel(/job title|position/i).first().fill(a.title);
  const loc = page.getByLabel(/location/i).first();
  if (await loc.isVisible().catch(() => false)) await loc.fill(a.location);
  const status = page.getByLabel(/^status/i).first();
  if (await status.isVisible().catch(() => false)) await status.selectOption(a.status).catch(() => {});
  await page.getByRole("button", { name: /save|create|add application/i }).first().click();
  await page.waitForURL(/\/applications\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => {});
  if (!appUrl && /\/applications\/[0-9a-f-]{36}/.test(page.url())) appUrl = new URL(page.url()).pathname.replace(/\?.*$/, "");
}

const shots = [];
async function shoot(p, name, label, route) {
  const url = route === "__APP__" ? appUrl : route;
  if (!url) return;
  const res = await p.goto(`${base}${url}`, { waitUntil: "networkidle" }).catch(() => null);
  await p.waitForTimeout(600);
  const file = path.join(out, `${name}.jpg`);
  await p.screenshot({ path: file, type: "jpeg", quality: 72, fullPage: false });
  shots.push({ name, label, url, status: res ? res.status() : 0, file });
}
for (const [name, route, label] of ROUTES) await shoot(page, `desktop-${name}`, label, route);

const mctx = await browser.newContext({ ...devices["iPhone 14"], deviceScaleFactor: 2 });
await mctx.addCookies(await ctx.cookies());
const mpage = await mctx.newPage();
mpage.setDefaultTimeout(30000);
for (const [name, route, label] of ROUTES) await shoot(mpage, `iphone-${name}`, label, route);

writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ base, email, shots }, null, 2));
await browser.close();
console.log(`captured ${shots.length} screenshots to ${out}`);
