// Raw-SQL toolkit for the schema red-team suite (test/db/schema.test.js).
//
// Nothing here goes through src/domain: the point of that suite is to prove the promises in
// the header of src/db/schema.sql hold when application code is bypassed. Rows are written
// with plain INSERT statements and every refusal is checked against the exact constraint
// or trigger that is meant to cause it.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openDatabase } from '../../src/db/sqlite.js';
import { migrate } from '../../src/db/migrate.js';
import { fixedClock } from '../../src/lib/clock.js';

export const SCHEMA_PATH = new URL('../../src/db/schema.sql', import.meta.url);

// One injected clock for the whole suite: every timestamp is derived from it.
const clock = fixedClock('2026-11-09T20:00:00.000Z');
export const T0 = clock.now().toISOString();
export const PERIOD = '2026-11';
/** The suite's "now", shifted by a number of minutes, as toISOString() writes it. */
export const at = (minutes = 0) => new Date(clock.now().getTime() + minutes * 60_000).toISOString();

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const REPLACE_STATEMENT = /\b(OR\s+REPLACE|REPLACE\s+INTO)\b/i;

/** SQL literal for a value. Only used to get REPLACE statements past the application adapter. */
const literal = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

const inline = (sql, params) => {
  let index = 0;
  return sql.replace(/\?/g, () => literal(params[index++]));
};

const opened = [];

/** Closes every connection opened since the last call (an afterEach hook in the suite). */
export function closeOpened() {
  for (const sql of opened.splice(0)) sql.close();
}

/**
 * The connection the application uses: src/db/sqlite.js openDatabase() + migrate().
 * The adapter refuses REPLACE statements in get/all/run. That is a second line of defence
 * and would hide what the SCHEMA does, so those statements are sent through exec() with
 * their parameters written inline.
 */
export function openApplication() {
  const db = openDatabase(':memory:');
  migrate(db);
  const sql = {
    db,
    foreignKeys: true,
    recursiveTriggers: true,
    lastStatement: null,
    run: (text, params = []) => {
      sql.lastStatement = text;
      if (!REPLACE_STATEMENT.test(text)) return db.run(text, params);
      db.exec(inline(text, params));
      return { changes: db.get('SELECT changes() AS n').n, lastInsertRowid: db.get('SELECT last_insert_rowid() AS id').id };
    },
    get: (text, params = []) => db.get(text, params),
    all: (text, params = []) => {
      sql.lastStatement = text;
      return db.all(text, params);
    },
    exec: (text) => {
      sql.lastStatement = text;
      db.exec(text);
    },
    close: () => db.close(),
  };
  opened.push(sql);
  return sql;
}

/**
 * A bare node:sqlite connection with schema.sql loaded and the two pragmas the schema
 * depends on set as asked. Used to show which promises survive a mis-configured connection.
 * @param {{ foreignKeys?: boolean, recursiveTriggers?: boolean }} [settings]
 */
export function openBare({ foreignKeys = true, recursiveTriggers = true } = {}) {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}; PRAGMA recursive_triggers = ${recursiveTriggers ? 'ON' : 'OFF'};`);
  raw.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  const sql = {
    raw,
    foreignKeys,
    recursiveTriggers,
    lastStatement: null,
    run: (text, params = []) => {
      sql.lastStatement = text;
      const result = raw.prepare(text).run(...params);
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    },
    get: (text, params = []) => raw.prepare(text).get(...params),
    all: (text, params = []) => {
      sql.lastStatement = text;
      return raw.prepare(text).all(...params);
    },
    exec: (text) => {
      sql.lastStatement = text;
      raw.exec(text);
    },
    close: () => raw.close(),
  };
  opened.push(sql);
  return sql;
}

/** The connection settings each append-only promise (P4, P7, P10) is attacked under. */
export const CONNECTIONS = Object.freeze({
  application: { label: 'application connection (foreign_keys ON, recursive_triggers ON)', open: openApplication },
  noRecursiveTriggers: { label: 'bare connection, recursive_triggers OFF', open: () => openBare({ recursiveTriggers: false }) },
  noForeignKeys: { label: 'bare connection, foreign_keys OFF', open: () => openBare({ foreignKeys: false }) },
  neither: { label: 'bare connection, recursive_triggers OFF and foreign_keys OFF', open: () => openBare({ foreignKeys: false, recursiveTriggers: false }) },
});

// ---------------------------------------------------------------------------
// What a refusal must look like
// ---------------------------------------------------------------------------

// SQLite extended result codes.
const ERRCODE = { check: 275, foreign_key: 787, not_null: 1299, primary_key: 1555, trigger: 1811, unique: 2067, datatype: 3091, mismatch: 20 };

const abort = (trigger, message) => Object.freeze({ kind: 'trigger', trigger, message });

/**
 * Every guard trigger in schema.sql and the exact message it raises. The messages are part
 * of the contract: src/domain translates several of them into API errors. A meta-test
 * checks this table against the live schema, so a new trigger cannot be added untested.
 */
export const ABORT = Object.freeze({
  users_google_sub_binds_once: abort('users_google_sub_binds_once', 'google_sub can only be set on an active, unbound account'),
  users_keep_one_admin_on_update: abort('users_keep_one_admin_on_update', 'at least one active, signed-in admin must remain'),
  users_keep_one_admin_on_delete: abort('users_keep_one_admin_on_delete', 'at least one active, signed-in admin must remain'),
  ledger_no_update: abort('ledger_no_update', 'ledger_entries is append-only'),
  ledger_no_delete: abort('ledger_no_delete', 'ledger_entries is append-only'),
  ledger_no_replace: abort('ledger_no_replace', 'ledger_entries is append-only (id or idempotency_key already exists)'),
  ledger_no_insert_during_erasure: abort('ledger_no_insert_during_erasure', 'an erasure is in progress (guard is set)'),
  ledger_award_requires_reviewed_claim: abort('ledger_award_requires_reviewed_claim', 'task_award requires a pending, reviewed claim of the same member'),
  ledger_reversal_must_mirror: abort('ledger_reversal_must_mirror', 'reversal must mirror one earlier non-reversal entry of the same member'),
  ledger_never_negative: abort('ledger_never_negative', 'would_go_negative'),
  ledger_no_self_credit: abort('ledger_no_self_credit', 'an account cannot credit the member it is linked to'),
  claims_start_pending: abort('claims_start_pending', 'a claim is created pending and unverified'),
  claims_no_replace: abort('claims_no_replace', 'duplicate_claim'),
  claims_no_delete: abort('claims_no_delete', 'claims are deleted only by member erasure'),
  claims_no_insert_during_erasure: abort('claims_no_insert_during_erasure', 'an erasure is in progress (guard is set)'),
  claims_snapshot_matches_task: abort('claims_snapshot_matches_task', 'claim must snapshot an active task type and satisfy its video rule'),
  claims_text_subject_is_evidence_hash: abort('claims_text_subject_is_evidence_hash', 'a text: subject is the evidence hash'),
  claims_tracked_video_url_must_use_video: abort('claims_tracked_video_url_must_use_video', 'evidence_url points at a tracked video: submit the claim against that video'),
  claims_exception_is_next: abort('claims_exception_is_next', 'an exception follows an approved claim for the same subject and is submitted by an admin with a reason'),
  claims_transitions: Object.freeze({
    illegal: abort('claims_transitions', 'illegal claim transition'),
    needsAward: abort('claims_transitions', 'a claim becomes approved only by inserting its task_award'),
    needsReversal: abort('claims_transitions', 'a claim becomes revoked only by reversing its task_award'),
    needsReviewerAndNote: abort('claims_transitions', 'a rejection needs a recorded reviewer and a note'),
  }),
  claims_no_self_approval: abort('claims_no_self_approval', 'approval needs a recorded reviewer who is not linked to the member'),
  claims_identity_is_immutable: abort('claims_identity_is_immutable', 'claim identity, evidence and value are immutable'),
  claims_decided_is_frozen: abort('claims_decided_is_frozen', 'a decided claim is frozen'),
  claims_verified_needs_attestable_task: abort('claims_verified_needs_attestable_task', 'verified requires an api-checkable task and evidence on the attesting platform'),
  erasure_guard_set: abort('erasure_guard_set', 'erasure guard: already set, or no such member'),
  erasure_guard_clear: abort('erasure_guard_clear', 'erasure guard: the member still exists; erasure is all-or-nothing'),
  erasure_guard_no_delete: abort('erasure_guard_no_delete', 'erasure guard row is permanent'),
  erasure_guard_no_insert: abort('erasure_guard_no_insert', 'erasure guard row is permanent'),
  audit_no_delete: abort('audit_no_delete', 'audit_log is append-only'),
  audit_no_replace: abort('audit_no_replace', 'audit_log is append-only'),
  audit_no_update: abort('audit_no_update', 'audit_log is append-only'),
  audit_detail_is_impersonal: abort('audit_detail_is_impersonal', 'audit detail must be small JSON without addresses or URLs'),
  audit_member_rows_need_subject: abort('audit_member_rows_need_subject', 'audit rows about a member must name subject_member_id'),
});

/** Triggers that change rows instead of refusing; a test proves each one's effect and calls witness(). */
export const EFFECT_TRIGGERS = Object.freeze(['sessions_end_on_privilege_change', 'ledger_award_approves_claim', 'ledger_reversal_revokes_claim']);

/** A CHECK constraint, identified by a distinctive piece of its expression. */
export const CHECK = (fragment) => ({ kind: 'check', fragment });
export const FOREIGN_KEY = Object.freeze({ kind: 'foreign_key', fragment: 'FOREIGN KEY constraint failed' });
/** A UNIQUE index or PRIMARY KEY, identified by "table.column". */
export const UNIQUE = (column) => ({ kind: 'unique', fragment: column });
export const NOT_NULL = (column) => ({ kind: 'not_null', fragment: column });
/** STRICT typing: "cannot store TEXT value in INTEGER column t.c". */
export const DATATYPE = (fragment) => ({ kind: 'datatype', fragment });
/** A value that is not a whole number offered as an INTEGER PRIMARY KEY (SQLite's own rowid rule, older than STRICT). */
export const ROWID_MISMATCH = Object.freeze({ kind: 'mismatch', fragment: 'datatype mismatch' });
/**
 * For statements that break two rules at once. SQLite does not promise which BEFORE trigger
 * runs first, so either refusal is correct.
 */
export const either = (...options) => ({ kind: 'either', options });
/**
 * Any refusal by the database. Only for tests of a defect that is still open, where the
 * shape of the eventual fix (a CHECK, a trigger, a message) is not known yet.
 */
export const ANY_REFUSAL = Object.freeze({ kind: 'any', fragment: 'any constraint or trigger' });

const fired = new Set();

/** Records that a test proved the effect of a trigger that does not raise. */
export function witness(trigger) {
  assert.ok(EFFECT_TRIGGERS.includes(trigger), `${trigger} is not an effect trigger`);
  fired.add(trigger);
}

/** Names of the triggers that have refused (or been witnessed) so far in this process. */
export const firedTriggers = () => new Set(fired);

function matches(error, expected) {
  if (expected.kind === 'either') return expected.options.some((option) => matches(error, option));
  if (error?.code !== 'ERR_SQLITE_ERROR') return false;
  if (expected.kind === 'any') return Object.values(ERRCODE).includes(error.errcode);
  if (expected.kind === 'trigger') return error.errcode === ERRCODE.trigger && error.message === expected.message;
  if (expected.kind === 'unique') return (error.errcode === ERRCODE.unique || error.errcode === ERRCODE.primary_key) && error.message.includes(expected.fragment);
  return error.errcode === ERRCODE[expected.kind] && error.message.includes(expected.fragment);
}

const describeExpectation = (expected) =>
  expected.kind === 'either' ? expected.options.map(describeExpectation).join(' or ') : `${expected.kind}: ${expected.message ?? expected.fragment}`;

function recordFired(error, expected) {
  if (expected.kind === 'either') expected.options.filter((option) => matches(error, option)).forEach((option) => recordFired(error, option));
  else if (expected.kind === 'trigger') fired.add(expected.trigger);
}

/** Every row of every table, for "nothing changed" comparisons. The test databases are tiny. */
export function snapshot(sql) {
  const tables = sql.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return Object.fromEntries(tables.map(({ name }) => [name, sql.all(`SELECT * FROM ${name} ORDER BY 1`).map((row) => ({ ...row }))]));
}

/**
 * Runs one forbidden statement and asserts that
 *   1. the database refused it,
 *   2. for the expected reason (the specific constraint or trigger message), and
 *   3. no row of any table changed.
 * @param {ReturnType<typeof openApplication>} sql
 * @param {() => unknown} attack
 * @param {object} expected  an ABORT entry, CHECK(...), FOREIGN_KEY, UNIQUE(...), NOT_NULL(...), DATATYPE(...) or either(...)
 * @returns {Error} the refusal
 */
export function refuses(sql, attack, expected) {
  assert.ok(expected && expected.kind, 'refuses(): say which constraint or trigger must refuse this');
  const before = snapshot(sql);
  let refusal = null;
  try {
    attack();
  } catch (error) {
    refusal = error;
  }
  const statement = `\n  statement ${String(sql.lastStatement).replace(/\s+/g, ' ').slice(0, 300)}`;
  assert.ok(refusal, `the statement was ACCEPTED; expected a refusal (${describeExpectation(expected)})${statement}`);
  assert.ok(matches(refusal, expected), `refused for the wrong reason.\n  expected ${describeExpectation(expected)}\n  got      [${refusal.errcode ?? refusal.name}] ${refusal.message}${statement}`);
  assert.deepEqual(snapshot(sql), before, 'a refused statement must leave every table exactly as it was');
  recordFired(refusal, expected);
  return refusal;
}

/**
 * One small test per forbidden statement. Each test starts from a fresh copy of the rows
 * `arrange()` builds, attempts that ONE statement, and goes through refuses().
 * @param {() => { sql: object }} arrange  builds the starting rows; whatever it returns is handed to the attack
 * @param {object} expected  the refusal every attack in the table must meet, unless the attack names its own
 * @param {Record<string, ((world: object) => unknown) | [(world: object) => unknown, object]>} attacks
 *        test name -> the forbidden statement, or [statement, its own expected refusal]
 */
export function refusedOneByOne(arrange, expected, attacks) {
  for (const [name, plan] of Object.entries(attacks)) {
    const [attack, expectedHere] = Array.isArray(plan) ? plan : [plan, expected];
    test(name, () => {
      const world = arrange();
      refuses(world.sql, () => attack(world), expectedHere);
    });
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

let serial = 0;
const next = () => String((serial += 1)).padStart(4, '0');

/**
 * INSERT of exactly the given columns (undefined values are left to the column default).
 * `verb` lets an attack use INSERT OR REPLACE / REPLACE / INSERT OR IGNORE; `tail` an ON CONFLICT clause.
 */
export function insert(sql, table, row, { verb = 'INSERT', tail = '' } = {}) {
  const columns = Object.keys(row).filter((column) => row[column] !== undefined);
  const into = verb.toUpperCase().startsWith('REPLACE') ? 'REPLACE INTO' : `${verb} INTO`;
  return sql.run(
    `${into} ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ${tail}`.trim(),
    columns.map((column) => row[column]),
  );
}

export function member(sql, id, overrides = {}) {
  insert(sql, 'members', { id, slug: id.replace(/[^a-z0-9]/g, ''), display_name: `Member ${id}`, created_at: T0, ...overrides });
  return id;
}

export function user(sql, id, overrides = {}) {
  insert(sql, 'users', { id, email: `${id.replace(/[^a-z0-9]/g, '')}@example.test`, role: 'member', created_at: T0, ...overrides });
  return id;
}

export function taskType(sql, id, overrides = {}) {
  insert(sql, 'task_types', { id, key: `task_${id.replace(/[^a-z0-9]/g, '')}`, label: `Task ${id}`, points: 25, xp: 10, created_at: T0, updated_at: T0, ...overrides });
  return id;
}

export function video(sql, id, overrides = {}) {
  const platformVideoId = overrides.platform_video_id ?? `sample${next()}x`;
  insert(sql, 'videos', {
    id,
    platform: 'youtube',
    platform_video_id: platformVideoId,
    kind: 'video',
    url: `https://www.youtube.com/watch?v=${platformVideoId}`,
    title: `Video ${id}`,
    created_at: T0,
    ...overrides,
  });
  return id;
}

export function competition(sql, id, overrides = {}) {
  insert(sql, 'competitions', { id, name: `Competition ${id}`, starts_at: at(-60), ends_at: at(60), created_at: T0, ...overrides });
  return id;
}

/**
 * The standing cast most tests start from.
 *   mbr_ada, mbr_bo            two members, each with a sign-in account (usr_ada, usr_bo)
 *   usr_root                   an admin with no member, who has signed in (the "working admin")
 *   tsk_feedback (25 / 10)     reviewed by a person
 *   tsk_creative (40 / 20)     has an automatic check (video ownership)
 *   vid_yt, vid_tt             tracked videos owned by mbr_bo, one per platform
 */
export function cast(sql) {
  member(sql, 'mbr_ada');
  member(sql, 'mbr_bo');
  user(sql, 'usr_root', { role: 'admin', last_login_at: T0 });
  user(sql, 'usr_ada', { member_id: 'mbr_ada' });
  user(sql, 'usr_bo', { member_id: 'mbr_bo' });
  taskType(sql, 'tsk_feedback', { key: 'constructive_feedback', label: 'Constructive feedback' });
  taskType(sql, 'tsk_creative', { key: 'original_video', label: 'Original creative submission', points: 40, xp: 20, api_check: 'video_ownership' });
  video(sql, 'vid_yt', { platform_video_id: 'ytSample001', owner_member_id: 'mbr_bo', added_by: 'usr_root' });
  video(sql, 'vid_tt', { platform: 'tiktok', platform_video_id: '7300000000000000001', kind: 'short', url: 'https://www.tiktok.com/@sample/video/7300000000000000001', owner_member_id: 'mbr_bo', added_by: 'usr_root' });
  return sql;
}

/** Fresh application connection with the standing cast. */
export const stage = (open = openApplication) => cast(open());

/**
 * The row a pending claim is inserted with. By default: mbr_ada, the feedback task, text
 * evidence, and the subject key the application would compute for it.
 */
export function claimRow(overrides = {}) {
  const id = overrides.id ?? `clm_${next()}`;
  const row = {
    id,
    member_id: 'mbr_ada',
    task_type_id: 'tsk_feedback',
    video_id: null,
    evidence_text: `A paragraph of constructive feedback written for ${id}.`,
    evidence_url: null,
    points_snapshot: 25,
    xp_snapshot: 10,
    submitted_by: 'usr_ada',
    submitted_by_role: 'member',
    created_at: T0,
    ...overrides,
  };
  if (row.evidence_hash === undefined) row.evidence_hash = row.evidence_text === null ? null : sha256(row.evidence_text);
  if (row.subject_key === undefined) {
    row.subject_key = row.video_id !== null ? `video:${row.video_id}` : row.evidence_url !== null ? `url:${row.evidence_url}` : `text:${row.evidence_hash}`;
  }
  return row;
}

/** Inserts a pending, unverified claim and returns its id. */
export function claim(sql, overrides = {}, options) {
  const row = claimRow(overrides);
  insert(sql, 'claims', row, options);
  return row.id;
}

/** What an approval does first: a person marks the pending claim as reviewed. */
export function markReviewed(sql, claimId, when = T0) {
  sql.run("UPDATE claims SET verification_status = 'manually_reviewed', verification_source = 'admin_review', verified_at = ? WHERE id = ?", [when, claimId]);
}

/** The ledger row a generic entry is inserted with: a +0 adjustment in the bonus bucket, written by usr_root. */
export function entryRow(overrides = {}) {
  return {
    member_id: 'mbr_ada',
    kind: 'adjustment',
    bucket: 'bonus',
    points: 0,
    xp: 0,
    idempotency_key: `req:usr_root:key-${next()}`,
    reason: 'Entered by the test suite',
    actor_user_id: 'usr_root',
    period: PERIOD,
    created_at: T0,
    ...overrides,
  };
}

/** Inserts a ledger entry and returns its id. */
export const entry = (sql, overrides = {}, options) => insert(sql, 'ledger_entries', entryRow(overrides), options).lastInsertRowid;

/** The single award row that matches a claim, value for value. */
export function awardRow(sql, claimId, overrides = {}) {
  const row = sql.get('SELECT member_id, points_snapshot, xp_snapshot FROM claims WHERE id = ?', [claimId]);
  return entryRow({
    member_id: row?.member_id ?? 'mbr_ada',
    kind: 'task_award',
    bucket: 'earned',
    points: row?.points_snapshot ?? 25,
    xp: row?.xp_snapshot ?? 10,
    claim_id: claimId,
    idempotency_key: `award:${claimId}`,
    reason: 'Approved by the test suite',
    ...overrides,
  });
}

export const award = (sql, claimId, overrides = {}, options) => insert(sql, 'ledger_entries', awardRow(sql, claimId, overrides), options).lastInsertRowid;

/** A claim that has been reviewed and awarded (so it is approved). Returns { claimId, awardId }. */
export function approvedClaim(sql, overrides = {}) {
  const claimId = claim(sql, overrides);
  markReviewed(sql, claimId);
  return { claimId, awardId: award(sql, claimId) };
}

/**
 * A claim of mbr_ada brought to the given decision the only legal way:
 *   pending    as inserted
 *   approved   reviewed, then awarded
 *   rejected   by usr_root, with a note
 *   withdrawn  by an UPDATE with a time
 *   revoked    approved, then its award reversed
 * @returns {string} the claim id
 */
export function claimIn(sql, decision, overrides = {}) {
  if (decision === 'approved') return approvedClaim(sql, overrides).claimId;
  if (decision === 'revoked') {
    const { claimId, awardId } = approvedClaim(sql, overrides);
    reversal(sql, awardId);
    return claimId;
  }
  const claimId = claim(sql, overrides);
  if (decision === 'rejected') {
    sql.run("UPDATE claims SET decision = 'rejected', decided_by = 'usr_root', decided_at = ?, decision_note = 'Too short to review.' WHERE id = ?", [T0, claimId]);
  } else if (decision === 'withdrawn') {
    sql.run("UPDATE claims SET decision = 'withdrawn', decided_at = ? WHERE id = ?", [T0, claimId]);
  } else {
    assert.equal(decision, 'pending', `claimIn(): unknown decision ${decision}`);
  }
  return claimId;
}

export const DECISIONS = Object.freeze(['pending', 'approved', 'rejected', 'withdrawn', 'revoked']);

/** The exact mirror of an existing entry. */
export function reversalRow(sql, targetId, overrides = {}) {
  const target = sql.get('SELECT member_id, bucket, points, xp, period, competition_id FROM ledger_entries WHERE id = ?', [targetId]);
  return entryRow({
    member_id: target.member_id,
    kind: 'reversal',
    bucket: target.bucket,
    points: -target.points,
    xp: -target.xp,
    reverses_entry_id: targetId,
    competition_id: target.competition_id,
    idempotency_key: `reversal:${targetId}`,
    reason: 'Reversed by the test suite',
    period: target.period,
    ...overrides,
  });
}

export const reversal = (sql, targetId, overrides = {}, options) => insert(sql, 'ledger_entries', reversalRow(sql, targetId, overrides), options).lastInsertRowid;

/** The row an audit entry is inserted with: a system row about a setting, with no subject. */
export function auditRow(overrides = {}) {
  return { at: T0, actor_user_id: 'usr_root', actor_role: 'admin', action: 'settings.update', entity_type: 'settings', ...overrides };
}

export const audit = (sql, overrides = {}, options) => insert(sql, 'audit_log', auditRow(overrides), options).lastInsertRowid;

export function sessionRow(overrides = {}) {
  return { token_hash: sha256(`session ${next()}`), user_id: 'usr_ada', auth_method: 'dev', created_at: T0, expires_at: at(60), last_seen_at: T0, ...overrides };
}

export const session = (sql, overrides = {}) => insert(sql, 'sessions', sessionRow(overrides));

// ---------------------------------------------------------------------------
// Reading back
// ---------------------------------------------------------------------------

export const count = (sql, table, where = '1 = 1', params = []) => sql.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params).n;

export const claimOf = (sql, claimId) => ({ ...sql.get('SELECT * FROM claims WHERE id = ?', [claimId]) });

/** { earned, bonus, xp } straight from SUM() over the ledger. */
export function balance(sql, memberId = 'mbr_ada') {
  const row = sql.get(
    `SELECT COALESCE(SUM(CASE WHEN bucket = 'earned' THEN points END), 0) AS earned,
            COALESCE(SUM(CASE WHEN bucket = 'bonus' THEN points END), 0) AS bonus,
            COALESCE(SUM(xp), 0) AS xp
       FROM ledger_entries WHERE member_id = ?`,
    [memberId],
  );
  return { earned: row.earned, bonus: row.bonus, xp: row.xp };
}

export const guard = (sql) => sql.get('SELECT member_id FROM erasure_guard WHERE id = 1').member_id;
export const setGuard = (sql, memberId) => sql.run('UPDATE erasure_guard SET member_id = ? WHERE id = 1', [memberId]);

/** Removes a guard trigger, to prove that the layer beneath it refuses on its own. */
export const dropTrigger = (sql, name) => sql.exec(`DROP TRIGGER ${name}`);
