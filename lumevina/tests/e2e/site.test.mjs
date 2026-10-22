// The existing site still works with Skin Intelligence merged in, and the new
// pages work in demo mode, at phone (390) and desktop (1280) widths.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { serve, browser } from "./serve.mjs";

let srv, br;
before(async () => { srv = await serve(); br = await browser(); });
after(async () => { await br?.close(); srv?.close(); });

async function open(path, width) {
  const page = await br.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(srv.url + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return { page, errors, overflow };
}

for (const width of [390, 1280]) {
  test(`home page loads cleanly at ${width}px; the skin record entry stays hidden outside the v4 preview`, async () => {
    const { page, errors } = await open("/index.html", width);
    assert.deepEqual(errors, []);
    assert.equal(await page.locator(".acct-skin").isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("has-skin")), false);
    await page.close();
  });

  test(`in the v4 preview My Lumevina links to My Skin (${width}px)`, async () => {
    const { page, errors } = await open("/index.html?preview=v4", width);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("has-skin")), true);
    assert.equal(await page.locator('.acct-skin a[href="my-skin.html"]').count(), 1);
    await page.goto(srv.url + "/index.html?preview=off");
    await page.close();
  });

  test(`dashboard still loads cleanly and links to Skin Intelligence (${width}px)`, async () => {
    const { page, errors } = await open("/dashboard.html", width);
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('a[href="studio-skin.html"]').count(), 1);
    await page.close();
  });

  for (const tab of ["home", "evolution", "profile", "routine", "appointments", "orders", "reports", "privacy"]) {
    test(`My Skin ${tab} (demo) at ${width}px: no errors, no sideways scroll`, async () => {
      const { page, errors, overflow } = await open(`/my-skin.html#${tab}`, width);
      assert.deepEqual(errors, []);
      assert.equal(overflow, 0);
      assert.doesNotMatch(await page.locator("main").innerText(), /Something went wrong/);
      await page.close();
    });
  }

  const PID = "00000000-0000-4000-8000-00000000d001";
  for (const route of ["needs", "clients", ...["overview", "imaging", "evolution", "measurements", "treatments", "routine", "reports", "consents"].map((t) => `client/${PID}/${t}`), ...["analytics", "staff", "devices", "validation", "privacy", "audit", "settings"].map((t) => `admin/${t}`)]) {
    test(`studio ${route} (demo) at ${width}px: no errors, no sideways scroll`, async () => {
      const { page, errors, overflow } = await open(`/studio-skin.html#${route}`, width);
      assert.deepEqual(errors, []);
      assert.equal(overflow, 0);
      assert.doesNotMatch(await page.locator("main").innerText(), /Something went wrong/);
      await page.close();
    });
  }
}

test("the client sees changes Evelyn confirmed and shared, worded without causes", async () => {
  const { page } = await open("/my-skin.html#evolution", 1280);
  const text = await page.locator("[data-changes]").innerText();
  assert.match(text, /than at the earlier visit/);
  assert.doesNotMatch(text, /because|routine/i);
  await page.close();
});

test("the comparison viewer's slider moves and zoom works", async () => {
  const { page } = await open("/my-skin.html#evolution", 1280);
  const stage = page.locator(".sk-cmp-stage");
  await page.locator(".sk-cmp-range").fill("20");
  assert.equal(await stage.evaluate((el) => el.style.getPropertyValue("--split")), "20%");
  await page.locator('[data-z="1"]').click();
  assert.match(await page.locator(".sk-cmp-zv").innerText(), /1\.5×/);
  await page.locator('[data-mode="side"]').click();
  assert.equal(await page.locator(".sk-cmp").getAttribute("data-mode"), "side");
  await page.locator('[data-mode="diff"]').click();
  assert.equal(await page.locator(".sk-cmp-legend").isVisible(), true);
  await page.close();
});

test("a report drafted in the studio, approved, reaches My Skin and prints", async () => {
  const { page } = await open("/studio-skin.html#client/00000000-0000-4000-8000-00000000d001/reports", 1280);
  await page.locator('[name="images"]').first().check();
  await page.locator('[name="summary"]').fill("Your skin is 40% smoother!");
  assert.match(await page.locator("[data-wording]").innerText(), /percentage/);
  await page.locator('[name="summary"]').fill("Your ProCell series is complete. The redness on your cheeks has eased across the visits.");
  await page.locator("button", { hasText: "Prepare draft" }).click();
  await page.waitForTimeout(400);
  await page.locator("[data-approve]").first().click();
  await page.waitForTimeout(400);
  await page.goto(srv.url + "/my-skin.html#reports", { waitUntil: "networkidle" });
  const link = page.locator('a[href^="report.html?id="]').first();
  await link.click();
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator("main").innerText(), /Your ProCell series is complete/);
  await page.close();
});
