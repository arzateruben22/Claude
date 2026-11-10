// Integrity self-check: asserts everything the schema cannot express on its own, and
// that the schema's own guards are still in place.
//
// Run at boot (the server refuses to serve on any violation), after every erasure, in
// the test suite, and behind GET /api/admin/integrity.
//
// Violations carry ids and counts only — never names, addresses or evidence.

import { openDatabase } from '../db/sqlite.js';
import { migrate } from '../db/migrate.js';

const normaliseSql = (sql) => String(sql ?? '').replace(/\s+/g, ' ').trim();

let expectedObjectsCache = null;

/** The tables, indexes and triggers a correctly migrated database must contain. */
function expectedObjects() {
  if (!expectedObjectsCache) {
    const reference = openDatabase(':memory:');
    migrate(reference);
    expectedObjectsCache = schemaObjects(reference);
    reference.close();
  }
  return expectedObjectsCache;
}

function schemaObjects(db) {
  const rows = db.all("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name");
  return new Map(rows.map((row) => [`${row.type}:${row.name}`, normaliseSql(row.sql)]));
}

const sample = (rows, column) => rows.slice(0, 5).map((row) => row[column]);

/**
 * @param {import('../db/sqlite.js').Db} db
 * @returns {{ ok: boolean, checked_at_version: number, violations: { check: string, count: number, sample?: unknown[], note?: string }[] }}
 */
export function checkIntegrity(db) {
  const violations = [];
  const report = (check, rows, column, note) => {
    if (rows.length > 0) violations.push({ check, count: rows.length, ...(column ? { sample: sample(rows, column) } : {}), ...(note ? { note } : {}) });
  };
  const flag = (check, note) => violations.push({ check, count: 1, note });

  // 1. Connection settings the schema depends on, and SQLite's own consistency checks.
  if (db.pragma('foreign_keys') !== 1) flag('pragma_foreign_keys', 'PRAGMA foreign_keys is off');
  if (db.pragma('recursive_triggers') !== 1) flag('pragma_recursive_triggers', 'PRAGMA recursive_triggers is off');
  report('foreign_key_check', db.all('PRAGMA foreign_key_check'), 'table');
  const quick = db.all('PRAGMA quick_check');
  if (quick.length !== 1 || Object.values(quick[0])[0] !== 'ok') flag('quick_check', 'SQLite reports file corruption');

  // 2. Every table, index and trigger of the schema is present and unmodified.
  const expected = expectedObjects();
  const actual = schemaObjects(db);
  for (const [name, sql] of expected) {
    if (!actual.has(name)) flag('schema_object_missing', name);
    else if (actual.get(name) !== sql) flag('schema_object_changed', name);
  }
  for (const name of actual.keys()) {
    if (!expected.has(name)) flag('schema_object_unexpected', name);
  }
  const schemaIntact = violations.every((item) => !item.check.startsWith('schema_object'));
  if (!schemaIntact) return { ok: false, checked_at_version: Number(db.pragma('user_version')), violations };

  // 3. No erasure is half-done.
  const guard = db.all('SELECT id, member_id FROM erasure_guard');
  if (guard.length !== 1 || guard[0].member_id !== null) flag('erasure_guard_not_clear', 'the erasure guard is set or missing');

  // 4. Claims and awards agree (P1, P3, P5).
  report(
    'approved_claim_without_live_award',
    db.all(
      `SELECT c.id FROM claims c WHERE c.decision = 'approved'
         AND (SELECT COUNT(*) FROM ledger_entries e WHERE e.claim_id = c.id AND e.kind = 'task_award'
                AND NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.reverses_entry_id = e.id)) <> 1`,
    ),
    'id',
  );
  report(
    'revoked_claim_without_reversed_award',
    db.all(
      `SELECT c.id FROM claims c WHERE c.decision = 'revoked'
         AND NOT EXISTS (SELECT 1 FROM ledger_entries e JOIN ledger_entries r ON r.reverses_entry_id = e.id
                          WHERE e.claim_id = c.id AND e.kind = 'task_award')`,
    ),
    'id',
  );
  report(
    'award_on_undecided_claim',
    db.all(
      `SELECT e.id FROM ledger_entries e JOIN claims c ON c.id = e.claim_id
        WHERE e.kind = 'task_award' AND c.decision NOT IN ('approved', 'revoked')`,
    ),
    'id',
  );
  report(
    'award_differs_from_claim',
    db.all(
      `SELECT e.id FROM ledger_entries e JOIN claims c ON c.id = e.claim_id
        WHERE e.kind = 'task_award' AND (e.member_id <> c.member_id OR e.points <> c.points_snapshot OR e.xp <> c.xp_snapshot)`,
    ),
    'id',
  );
  report('approved_claim_not_reviewed', db.all("SELECT id FROM claims WHERE decision IN ('approved', 'revoked') AND verification_status = 'unverified'"), 'id');
  report(
    'verified_claim_on_unattestable_task',
    db.all("SELECT c.id FROM claims c JOIN task_types t ON t.id = c.task_type_id WHERE c.verification_status = 'verified' AND t.api_check = 'none'"),
    'id',
  );

  // 5. Reversals mirror their targets (P5).
  report(
    'reversal_does_not_mirror',
    db.all(
      `SELECT r.id FROM ledger_entries r LEFT JOIN ledger_entries t ON t.id = r.reverses_entry_id
        WHERE r.kind = 'reversal'
          AND (t.id IS NULL OR t.kind = 'reversal' OR t.id >= r.id OR t.member_id <> r.member_id OR t.bucket <> r.bucket
               OR t.points <> -r.points OR t.xp <> -r.xp OR t.period <> r.period)`,
    ),
    'id',
  );

  // 6. Nothing is below zero (P11).
  report(
    'negative_balance',
    db.all(
      `SELECT member_id FROM ledger_entries GROUP BY member_id
       HAVING SUM(CASE WHEN bucket = 'earned' THEN points ELSE 0 END) < 0
           OR SUM(CASE WHEN bucket = 'bonus' THEN points ELSE 0 END) < 0
           OR SUM(xp) < 0`,
    ),
    'member_id',
  );

  // 7. One credit per subject (P2).
  report('video_claim_with_wrong_subject', db.all("SELECT id FROM claims WHERE video_id IS NOT NULL AND subject_key <> 'video:' || video_id"), 'id');
  report(
    'duplicate_live_claims',
    db.all(
      `SELECT MIN(id) AS id FROM claims WHERE decision IN ('pending', 'approved')
        GROUP BY member_id, task_type_id, subject_key, exception_seq HAVING COUNT(*) > 1`,
    ),
    'id',
  );
  report(
    'exception_without_credited_predecessor',
    db.all(
      `SELECT c.id FROM claims c WHERE c.exception_seq > 0
         AND NOT EXISTS (SELECT 1 FROM claims p WHERE p.member_id = c.member_id AND p.task_type_id = c.task_type_id
                           AND p.subject_key = c.subject_key AND p.exception_seq = c.exception_seq - 1
                           AND p.decision IN ('approved', 'revoked'))`,
    ),
    'id',
  );

  // 8. Every ledger entry has its audit row, about the right member.
  report(
    'ledger_entry_without_audit_row',
    db.all(
      `SELECT e.id FROM ledger_entries e
        WHERE NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.entity_type = 'ledger_entry' AND a.entity_id = CAST(e.id AS TEXT)
                            AND a.subject_member_id = e.member_id)`,
    ),
    'id',
  );

  // 9. Ledger ids are never reused.
  const sequence = db.get("SELECT seq FROM sqlite_sequence WHERE name = 'ledger_entries'");
  const maxId = db.get('SELECT COALESCE(MAX(id), 0) AS id FROM ledger_entries').id;
  if (maxId > (sequence?.seq ?? 0)) flag('ledger_id_sequence_behind', 'ledger ids could be reused');

  // 10. Exactly five tiers, climbing.
  const tiers = db.all('SELECT level, min_xp FROM tiers ORDER BY level');
  const ladderOk = tiers.length === 5 && tiers.every((tier, index) => tier.level === index + 1 && (index === 0 ? tier.min_xp === 0 : tier.min_xp > tiers[index - 1].min_xp));
  if (!ladderOk) flag('tiers_not_five_ascending', `found ${tiers.length} tier rows`);

  // 11. There is an account that can administer, once anyone has signed in at all.
  const signedIn = db.get('SELECT COUNT(*) AS n FROM users WHERE last_login_at IS NOT NULL').n;
  const workingAdmins = db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND last_login_at IS NOT NULL").n;
  if (signedIn > 0 && workingAdmins === 0) flag('no_working_admin', 'people have signed in but no active admin has');

  return { ok: violations.length === 0, checked_at_version: Number(db.pragma('user_version')), violations };
}

/** Throws when the database fails the self-check. Used at boot. */
export function assertIntegrity(db) {
  const result = checkIntegrity(db);
  if (!result.ok) {
    const summary = result.violations.map((item) => `${item.check}(${item.count})`).join(', ');
    const error = new Error(`database integrity check failed: ${summary}`);
    error.violations = result.violations;
    throw error;
  }
  return result;
}
