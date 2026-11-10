// Shared test harness. Every test gets its own in-memory database and a controllable clock.

import { openDatabase } from '../src/db/sqlite.js';
import { migrate } from '../src/db/migrate.js';
import { createContext, withActor } from '../src/domain/context.js';
import { ensureDefaultTiers } from '../src/domain/tiers.js';
import { fixedClock } from '../src/lib/clock.js';
import { newId, sha256Hex } from '../src/lib/ids.js';

export const T0 = '2026-11-09T20:00:00.000Z'; // a Monday afternoon in Los Angeles

/**
 * @returns {{ db: import('../src/db/sqlite.js').Db, clock: ReturnType<typeof fixedClock>,
 *             system: object, admin: object, adminUserId: string,
 *             as: (actor: { userId: string|null, role: string, memberId: string|null }) => object }}
 */
export function makeWorld({ at = T0 } = {}) {
  const db = openDatabase(':memory:');
  migrate(db);
  const clock = fixedClock(at);
  const system = createContext({ db, clock });
  ensureDefaultTiers(system);
  // The standing admin has signed in before, like a real one.
  const adminUserId = insertUser(db, { email: 'admin@example.test', role: 'admin', lastLoginAt: T0 });
  const admin = withActor(system, { userId: adminUserId, role: 'admin', memberId: null });
  return { db, clock, system, admin, adminUserId, as: (actor) => withActor(system, actor) };
}

export function insertMember(db, { name = 'Sample', slug, status = 'active', sortOrder = 0 } = {}) {
  const id = newId('mbr');
  db.run('INSERT INTO members (id, slug, display_name, sort_order, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    slug ?? `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}${id.slice(-6)}`,
    name,
    sortOrder,
    status,
    T0,
  ]);
  return id;
}

export function insertUser(db, { email, role = 'member', memberId = null, googleSub = null, status = 'active', lastLoginAt = null }) {
  const id = newId('usr');
  db.run('INSERT INTO users (id, email, google_sub, role, member_id, status, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id,
    email.toLowerCase(),
    googleSub,
    role,
    memberId,
    status,
    T0,
    lastLoginAt,
  ]);
  return id;
}

/** A member plus their sign-in account; returns ids and a ready-made actor. */
export function insertMemberWithUser(db, name) {
  const memberId = insertMember(db, { name });
  const userId = insertUser(db, { email: `${name.toLowerCase()}@example.test`, role: 'member', memberId });
  return { memberId, userId, actor: { userId, role: 'member', memberId } };
}

export function insertTaskType(db, { key = 'constructive_feedback', label = 'Constructive feedback', points = 25, xp = 25, requiresVideo = 0, apiCheck = 'none' } = {}) {
  const id = newId('tsk');
  db.run(
    'INSERT INTO task_types (id, key, label, points, xp, requires_video, api_check, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, key, label, points, xp, requiresVideo, apiCheck, T0, T0],
  );
  return id;
}

let subjectCounter = 0;

/**
 * Inserts a claim directly (bypassing claims.js) for tests of lower layers.
 * `state`:
 *   'pending'  – as submitted: pending and unverified
 *   'reviewed' – pending, and marked manually reviewed: ready for its award
 * (A claim only becomes approved by its ledger award being written; use awardClaim().)
 */
export function insertClaim(db, { memberId, taskTypeId, points = 25, xp = 25, state = 'pending', subjectKey, evidenceText = 'Sample evidence for tests.', at = T0 }) {
  const id = newId('clm');
  subjectCounter += 1;
  const hash = sha256Hex(`${evidenceText}#${subjectCounter}`);
  db.run(
    `INSERT INTO claims (id, member_id, task_type_id, subject_key, evidence_text, evidence_hash, points_snapshot, xp_snapshot, submitted_by_role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member', ?)`,
    [id, memberId, taskTypeId, subjectKey ?? `text:${hash}`, evidenceText, hash, points, xp, at],
  );
  if (state === 'reviewed') markReviewed(db, id, at);
  return db.get('SELECT * FROM claims WHERE id = ?', [id]);
}

/** Marks a pending claim manually reviewed with raw SQL (what an approval does first). */
export function markReviewed(db, claimId, at = T0) {
  db.run("UPDATE claims SET verification_status = 'manually_reviewed', verification_source = 'admin_review', verified_at = ? WHERE id = ?", [at, claimId]);
}

export const count = (db, table, where = '1 = 1', params = []) => db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params).n;

/** Asserts that `fn` throws an AppError with the given code (and optional status). */
export function expectAppError(assert, fn, code, status) {
  assert.throws(fn, (error) => {
    assert.equal(error.name, 'AppError', `expected AppError ${code}, got ${error.name}: ${error.message}`);
    assert.equal(error.code, code);
    if (status) assert.equal(error.status, status);
    return true;
  });
}
