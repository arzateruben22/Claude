// A real Postgres (PGlite) with Supabase's auth/storage stubs, Lumevina's
// schema.sql, and the migrations in server/migrations applied in order.
//
//   const db = await freshDb();                 // schema + every migration
//   const db = await freshDb({ migrations: 0 }); // schema.sql only
//   await asUser(db, { sub, email }, (tx) => tx.query("select ..."));
//   await asAnon(db, (tx) => ...);
//
// asUser/asAnon run inside a transaction as the `authenticated` / `anon`
// role with the JWT claims PostgREST would set, so row-level security
// applies exactly as it does for the website's direct reads.

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..", "..");
export const MIGRATIONS = join(ROOT, "server", "migrations");

export const migrationFiles = () =>
  readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();

export const downFile = (name) => join(MIGRATIONS, "down", name);

export async function freshDb({ migrations = Infinity } = {}) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  await db.exec(readFileSync(join(ROOT, "server", "schema.sql"), "utf8"));
  const files = migrationFiles().slice(0, migrations);
  for (const f of files) await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  return db;
}

export async function applyDown(db, name) {
  await db.exec(readFileSync(downFile(name), "utf8"));
}
export async function applyUp(db, name) {
  await db.exec(readFileSync(join(MIGRATIONS, name), "utf8"));
}

async function asRole(db, role, claims, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? {})]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}
export const asUser = (db, { sub, email, aal = "aal1" }, fn) =>
  asRole(db, "authenticated", { sub, email, role: "authenticated", aal }, fn);
export const asAnon = (db, fn) => asRole(db, "anon", { role: "anon" }, fn);

/** A signed-up person: an auth.users row (the clients trigger does the rest once 0001 is in). */
export async function signUp(db, email, name = "") {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email.toLowerCase(), JSON.stringify(name ? { name } : {})]);
  return rows[0].id;
}

/** Expect a query to throw; returns the error message. */
export async function rejects(promise) {
  try { await promise; } catch (e) { return String(e.message || e); }
  throw new Error("expected the query to fail, and it succeeded");
}

/** The shape of the public schema, for comparing before/after a down migration. */
export async function schemaShape(db) {
  const tables = await db.query(`select table_name, column_name, data_type, column_default, is_nullable
    from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`);
  const policies = await db.query(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`);
  const triggers = await db.query(`select event_object_table, trigger_name, action_statement from information_schema.triggers
    where trigger_schema in ('public', 'auth') order by 1, 2`);
  const functions = await db.query(`select p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1, 2`);
  const rls = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1`);
  const views = await db.query(`select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v' order by 1`);
  const grants = await db.query(`select table_name, grantee, privilege_type from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 1, 2, 3`);
  const buckets = await db.query(`select id, public from storage.buckets order by id`);
  return JSON.stringify({ t: tables.rows, p: policies.rows, tr: triggers.rows, f: functions.rows, r: rls.rows, v: views.rows, g: grants.rows, b: buckets.rows });
}
