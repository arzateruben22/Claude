// Row-level security: what a browser holding the public anon key, or a
// signed-in client's token, can read or write directly through the API.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, asUser, asAnon, rejects } from "../pg/harness.mjs";
import { seedStaff, seedClient } from "../pg/seed.mjs";

// one probe, in its own savepoint, so a refusal doesn't abort the checks after it
async function probe(tx, sql, params) {
  await tx.query("savepoint probe");
  try {
    const r = await tx.query(sql, params);
    await tx.query("release savepoint probe");
    return { rows: r.rows, n: r.affectedRows ?? 0 };
  } catch (e) {
    await tx.query("rollback to savepoint probe");
    return { denied: String(e.message) };
  }
}

let db, staff, A, B;
before(async () => {
  db = await freshDb();
  staff = await seedStaff(db);
  A = await seedClient(db, "ana@example.test", "Ana", staff);
  B = await seedClient(db, "bea@example.test", "Bea", staff);
});
after(async () => { await db?.close(); });

test("every table in public has row-level security on", async () => {
  const { rows } = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`);
  assert.deepEqual(rows.map((r) => r.relname), []);
});

// Tables a client may read their own rows of, directly.
const OWN_READABLE = {
  skin_profiles: "id", consents: "email", routine_entries: "profile_id", routine_checkins: "profile_id",
  recovery_checkins: "profile_id", progress_reports: "profile_id", data_requests: "email",
};
// Clinical tables no browser reads directly: the functions curate them.
const FUNCTIONS_ONLY = ["imaging_sessions", "captures", "derived_images", "quality_checks", "analysis_jobs", "analyses",
  "measurements", "measurement_validation", "change_detections", "treatment_records", "imaging_devices", "imaging_sites",
  "client_assignments", "skin_settings", "audit_log", "rate_limits"];

test("a client reads only their own rows, and nothing of another client's", async () => {
  await asUser(db, { sub: A.uid, email: A.email }, async (tx) => {
    for (const [table, key] of Object.entries(OWN_READABLE)) {
      const { rows } = await tx.query(`select ${key} as k from ${table}`);
      assert.ok(rows.length > 0, `${table}: Ana should see her own rows`);
      for (const r of rows) assert.ok(r.k === A.pid || r.k === A.email, `${table}: Ana saw a row that isn't hers`);
    }
  });
});

test("an email in a different case still matches the client's own rows", async () => {
  await asUser(db, { sub: "00000000-0000-0000-0000-000000000001", email: "ANA@EXAMPLE.TEST" }, async (tx) => {
    const { rows } = await tx.query("select id from skin_profiles");
    assert.deepEqual(rows.map((r) => r.id), [A.pid]);
  });
});

test("draft reports stay hidden until approved", async () => {
  await asUser(db, { sub: A.uid, email: A.email }, async (tx) => {
    const { rows } = await tx.query("select title from progress_reports");
    assert.deepEqual(rows.map((r) => r.title), ["Approved report"]);
  });
});

test("clinical tables are unreadable from the browser, even for the client the rows belong to", async () => {
  await asUser(db, { sub: A.uid, email: A.email }, async (tx) => {
    for (const t of FUNCTIONS_ONLY) {
      const res = await probe(tx, `select count(*)::int n from ${t}`);
      assert.ok(res.denied ? /permission denied/.test(res.denied) : res.rows[0].n === 0, `${t}: a client could read ${res.rows?.[0]?.n} rows (${res.denied ?? ""})`);
    }
  });
});

test("the anon key reads nothing of Skin Intelligence but the published consent texts", async () => {
  await asAnon(db, async (tx) => {
    for (const t of [...Object.keys(OWN_READABLE), ...FUNCTIONS_ONLY]) {
      const res = await probe(tx, `select count(*)::int n from ${t}`);
      assert.ok(res.denied ? /permission denied/.test(res.denied) : res.rows[0].n === 0, `${t}: anon could read ${res.rows?.[0]?.n} rows (${res.denied ?? ""})`);
    }
    const texts = await tx.query("select kind from consent_texts order by kind");
    assert.equal(texts.rows.length, 4);
  });
});

test("no browser can write Skin Intelligence rows directly", async () => {
  await asUser(db, { sub: A.uid, email: A.email }, async (tx) => {
    for (const sql of [
      `insert into skin_profiles (email) values ('ana@example.test')`,
      `update skin_profiles set goals = 'x'`,
      `insert into consents (email, kind, version, granted, source) values ('ana@example.test', 'marketing', '1-draft', true, 'client')`,
      `insert into routine_entries (profile_id, slot, product_name, source) values ('${A.pid}', 'pm', 'x', 'client')`,
      `update progress_reports set status = 'approved'`,
      `delete from routine_checkins`,
    ]) {
      const res = await probe(tx, sql);
      assert.ok(res.denied ? /permission denied|row-level security/.test(res.denied) : res.n === 0, `a client managed: ${sql} (${res.denied ?? ""})`);
    }
  });
});

test("0001 narrows clients to read-only: a client cannot edit their referral fields", async () => {
  await asUser(db, { sub: A.uid, email: A.email }, async (tx) => {
    const mine = await tx.query("select id from clients");
    assert.deepEqual(mine.rows.map((r) => r.id), [A.uid]);
    const res = await tx.query("update clients set referral_credited = true where id = $1", [A.uid]);
    assert.equal(res.affectedRows ?? 0, 0);
  });
});

test("0010: reward balances, flash openings and the old notifications queue are closed to the anon key", async () => {
  await asAnon(db, async (tx) => {
    assert.match(await rejects(tx.query("select * from reward_balances")), /permission denied/);
  });
  await asAnon(db, async (tx) => {
    assert.equal((await tx.query("select count(*)::int n from flash_slots")).rows[0].n, 0);
    const ins = await tx.query("insert into flash_slots (date, start_min) values ('2026-12-01', 600)").catch((e) => String(e.message));
    assert.match(String(ins), /row-level security/);
  });
});

test("the website's public reads still work (shelf, site settings)", async () => {
  await db.query("insert into products (id, name, price_cents) values ('fr-gentle-gel-cleanser', 'Gentle Gel Cleanser', 3200)");
  await asAnon(db, async (tx) => {
    assert.equal((await tx.query("select count(*)::int n from shelf")).rows[0].n, 1);
    await tx.query("select * from site_settings");
  });
});

test("a staff member reads their own staff row and no one else's", async () => {
  await asUser(db, { sub: staff, email: "evelyn@lumevina.test" }, async (tx) => {
    assert.equal((await tx.query("select count(*)::int n from staff")).rows[0].n, 1);
  });
  await asUser(db, { sub: A.uid, email: A.email }, async (tx) => {
    assert.equal((await tx.query("select count(*)::int n from staff")).rows[0].n, 0);
  });
});
