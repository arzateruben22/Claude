// functions/intake (the pre-visit form on the server) and the consent check
// the chat uses before photos may reach the AI assistant.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, signUp } from "../pg/harness.mjs";
import { makeClient, issueToken, post } from "./adapter.mjs";
import { handle } from "../../server/functions/intake/handler.ts";
import { hasConsent } from "../../server/functions/_shared/consents.ts";

let pg, deps, tokens, T = {};
const form = (over = {}) => ({ name: "Ana Diaz", email: "ana@example.test", signature: "ana diaz", answers: { allergies: "Fragrance", conditions: ["None"], photo_consent: "I do not accept", terms: true }, ...over });
const send = async (token, body) => { const r = await handle(post("https://fn.test/intake", token, body), deps); return { status: r.status, body: await r.json() }; };

before(async () => {
  pg = await freshDb();
  tokens = new Map();
  deps = { db: makeClient(pg, { tokens }).client, env: (k) => ({ SUPABASE_ANON_KEY: "anon-key" })[k], now: () => new Date("2026-10-22T17:00:00Z") };
  const ana = await signUp(pg, "ana@example.test", "Ana Diaz");
  T.ana = issueToken(tokens, { sub: ana, email: "ana@example.test" });
});
after(async () => { await pg?.close(); });

test("a first form saves without sign-in, bounded and with its signature checked", async () => {
  assert.equal((await send("anon-key", form({ signature: "Someone Else" }))).status, 400);
  const r = await send("anon-key", form({ answers: { allergies: "x".repeat(5000), "bad key!": "dropped", conditions: ["a", "b"] } }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const row = (await pg.query("select name, answers, client_id from intake_forms where email = 'ana@example.test'")).rows[0];
  assert.equal(row.answers.allergies.length, 2000);
  assert.equal(row.answers["bad key!"], undefined);
  assert.equal(row.client_id, null);
});

test("no one can overwrite an existing form by typing that email", async () => {
  const r = await send("anon-key", form({ answers: { allergies: "None" } }));
  assert.equal(r.status, 409);
  assert.equal(r.body.reason, "sign_in_to_update");
  assert.equal((await pg.query("select answers from intake_forms where email = 'ana@example.test'")).rows[0].answers.allergies.length, 2000);
});

test("signed in, they update their own form; the email comes from the token, not the body", async () => {
  const r = await send(T.ana, form({ email: "someone.else@example.test", answers: { allergies: "None now" } }));
  assert.equal(r.status, 200);
  assert.equal(r.body.updated, true);
  assert.equal((await pg.query("select count(*)::int n from intake_forms where email = 'someone.else@example.test'")).rows[0].n, 0);
  const row = (await pg.query("select answers, client_id from intake_forms where email = 'ana@example.test'")).rows[0];
  assert.equal(row.answers.allergies, "None now");
  assert.ok(row.client_id);
});

test("a bad token is refused rather than treated as a guest", async () => {
  assert.equal((await send("not-a-token", form())).status, 401);
});

test("chat photos reach the assistant only with an ai_processing yes in force", async () => {
  const db = deps.db;
  assert.equal(await hasConsent(db, "ana@example.test", "ai_processing"), false);
  await pg.query("insert into consents (email, kind, version, granted, signature, source) values ('ana@example.test', 'ai_processing', '1-draft', true, 'Ana Diaz', 'client')");
  assert.equal(await hasConsent(db, "ANA@example.test", "ai_processing"), true);
  await pg.query("update consents set withdrawn_at = now() where email = 'ana@example.test' and kind = 'ai_processing'");
  assert.equal(await hasConsent(db, "ana@example.test", "ai_processing"), false);
});

test("before the consents migration exists, the answer is no", async () => {
  const bare = await freshDb({ migrations: 0 });
  assert.equal(await hasConsent(makeClient(bare).client, "ana@example.test", "ai_processing"), false);
  await bare.close();
});
