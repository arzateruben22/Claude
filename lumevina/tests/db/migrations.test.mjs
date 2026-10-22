// Migrations: each applies on top of schema.sql, each has a down twin, and
// going down restores the schema exactly as it was before that migration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { freshDb, migrationFiles, downFile, applyUp, applyDown, schemaShape, signUp, rejects } from "../pg/harness.mjs";

test("every migration has a down twin", () => {
  const files = migrationFiles();
  assert.ok(files.length >= 11, `expected the Skin Intelligence migrations, found ${files.length}`);
  for (const f of files) assert.ok(existsSync(downFile(f)), `missing down/${f}`);
});

test("up, then down in reverse, restores each earlier schema exactly; then up again", async () => {
  const files = migrationFiles();
  const db = await freshDb({ migrations: 0 });
  const shapes = [await schemaShape(db)];
  for (const f of files) { await applyUp(db, f); shapes.push(await schemaShape(db)); }
  for (let i = files.length - 1; i >= 0; i--) {
    await applyDown(db, files[i]);
    assert.equal(await schemaShape(db), shapes[i], `down/${files[i]} did not restore the schema before it`);
  }
  for (const f of files) await applyUp(db, f);
  assert.equal(await schemaShape(db), shapes[files.length], "re-applying every migration gave a different schema");
  await db.close();
});

test("0001: a signed-in website booking no longer fails the clients foreign key", async () => {
  const before = await freshDb({ migrations: 0 });
  const uid0 = await signUp(before, "maya@example.com", "Maya");
  const booking = `insert into bookings (client_id, guest_email, date, start_min, dur_min, services, total_cents, deposit_cents)
                   values ($1, 'maya@example.com', '2026-11-03', 600, 60, '["lumevina-custom-facial"]', 12000, 6000)`;
  const msg = await rejects(before.query(booking, [uid0]));
  assert.match(msg, /foreign key/i, "schema.sql alone: the booking should fail the clients FK (the bug 0001 fixes)");
  await before.close();

  const db = await freshDb({ migrations: 1 });
  const uid = await signUp(db, "Maya@Example.com", "Maya");
  const { rows } = await db.query("select email, name, ref_code from clients where id = $1", [uid]);
  assert.equal(rows[0].email, "maya@example.com");
  assert.equal(rows[0].name, "Maya");
  assert.match(rows[0].ref_code, /^[0-9A-F]{8}$/);
  await db.query(booking, [uid]);
  await db.query("update auth.users set email = 'maya.new@example.com' where id = $1", [uid]);
  assert.equal((await db.query("select email from clients where id = $1", [uid])).rows[0].email, "maya.new@example.com");
  await db.close();
});

test("0001 backfills clients for people who signed up before it", async () => {
  const db = await freshDb({ migrations: 0 });
  const uid = await signUp(db, "early@example.com");
  await applyUp(db, migrationFiles()[0]);
  assert.equal((await db.query("select count(*)::int n from clients where id = $1", [uid])).rows[0].n, 1);
  await db.close();
});
