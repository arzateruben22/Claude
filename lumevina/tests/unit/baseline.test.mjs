// A baseline for Lumevina's existing server logic, which had no tests: the
// studio key check, the hours rules, skin plan and profile cleaning, the
// chat-photo validator, the unsubscribe token, and the generated catalog.
// These pin today's behaviour so Skin Intelligence work (and anyone else's)
// can't change it unnoticed.
import { test } from "node:test";
import assert from "node:assert/strict";

const env = new Map();
globalThis.Deno = { env: { get: (k) => env.get(k) } };

const { studioOk } = await import("../../server/functions/_shared/studio.ts");
const { cleanHours, fitsHours, hoursFor, isExtraMonday, DEFAULT_WEEK, CLEAN } = await import("../../server/functions/_shared/hours.ts");
const { cleanPlan, planText } = await import("../../server/functions/_shared/plans.ts");
const { cleanProfile, isEmpty, profileText } = await import("../../server/functions/_shared/profiles.ts");
const { readPhotos } = await import("../../server/functions/_shared/photos.ts");
const { emailToken, norm, EMAIL } = await import("../../server/functions/_shared/contacts.ts");
const { CATALOG } = await import("../../server/functions/_shared/catalog.ts");
const { SHELF } = await import("../../server/functions/_shared/knowledge.ts");

const req = (key) => new Request("https://x.test", { headers: key == null ? {} : { "x-studio-key": key } });

test("studio key: right key in, wrong or missing key out, and a short configured key never works", () => {
  env.set("STUDIO_KEY", "a long phrase only evelyn knows");
  assert.equal(studioOk(req("a long phrase only evelyn knows")), true);
  assert.equal(studioOk(req("a long phrase only evelyn knowz")), false);
  assert.equal(studioOk(req(null)), false);
  assert.equal(studioOk(req("")), false);
  env.set("STUDIO_KEY", "short");
  assert.equal(studioOk(req("short")), false);
});

test("hours: the default week is Tue–Sat, Sunday and Monday closed, with the cleaning gap", () => {
  const h = cleanHours({});
  assert.equal(DEFAULT_WEEK[0], null); assert.equal(DEFAULT_WEEK[1], null);
  assert.equal(CLEAN, 30);
  assert.equal(hoursFor(h, "2026-10-25"), null, "a Sunday");
  assert.ok(hoursFor(h, "2026-10-27"), "a Tuesday");
  assert.equal(isExtraMonday(h, "2026-10-26"), false);
  const tue = hoursFor(h, "2026-10-27");
  assert.equal(fitsHours(h, "2026-10-27", tue.open, 60), true);
  assert.equal(fitsHours(h, "2026-10-27", tue.close - 30, 60), false, "can't run past closing");
});

test("skin plans: bounded fields, shelf products kept by id, unknown ids become named steps", () => {
  const shelfItem = SHELF[0];
  const p = cleanPlan({ skinType: "Oily", concerns: ["x".repeat(100)], morning: [{ id: shelfItem.id, how: "pea-sized" }, { id: "not-a-product", name: "Drugstore SPF" }],
    log: [{ at: "2026-10-01", text: "Visit one" }, { at: "bad", text: "no date" }], goal: "g".repeat(1000) });
  assert.equal(p.skinType, "Oily");
  assert.equal(p.concerns[0].length, 60);
  assert.equal(p.goal.length, 400);
  assert.deepEqual(p.morning.map((s) => s.id), [shelfItem.id, ""]);
  assert.equal(p.morning[1].name, "Drugstore SPF");
  assert.match(p.log[1].at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(cleanPlan({ skinType: "Purple" }).skinType, "");
  assert.match(planText(p), /Evelyn's plan for them/);
});

test("client skin profiles: bounded, and an empty one is recognised", () => {
  const p = cleanProfile({ skinType: "Dry", concerns: ["Redness"], night: "n".repeat(2000) });
  assert.equal(p.night.length, 600);
  assert.equal(isEmpty(cleanProfile({})), true);
  assert.equal(isEmpty(p), false);
  assert.match(profileText(p), /in their own words/);
});

test("chat photos: JPEGs only, at most three, at most 2.5 MB each", () => {
  const jpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
  const png = "data:image/jpeg;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
  assert.equal(readPhotos([jpeg, jpeg, jpeg, jpeg]).length, 3);
  assert.equal(readPhotos([png]).length, 0, "PNG bytes labelled as JPEG are dropped");
  assert.equal(readPhotos(["not base64 at all!"]).length, 0);
  assert.equal(readPhotos(null).length, 0);
});

test("unsubscribe tokens: stable per email, different across emails, and keyed on PREFS_SECRET first", async () => {
  env.set("STUDIO_KEY", "a long phrase only evelyn knows"); env.delete("PREFS_SECRET");
  const a = await emailToken("ana@example.test");
  assert.equal(a, await emailToken("ana@example.test"));
  assert.notEqual(a, await emailToken("bea@example.test"));
  env.set("PREFS_SECRET", "separate secret");
  assert.notEqual(a, await emailToken("ana@example.test"));
  assert.equal(norm("  Ana@Example.TEST "), "ana@example.test");
  assert.ok(EMAIL.test("ana@example.test") && !EMAIL.test("ana@"));
});

test("the generated service catalog has the ProCell treatments the treatment record refers to", () => {
  for (const id of ["procell-microchanneling", "procell-package"]) assert.ok(CATALOG[id], id);
  for (const [id, s] of Object.entries(CATALOG)) {
    assert.ok(s.price_cents >= 0 && s.dur_min >= 0, id);   // add-ons (after hours) take no time of their own
    assert.equal(s.dur_min % 30, 0, `${id}: bookings sit on the 30-minute grid`);
  }
});
