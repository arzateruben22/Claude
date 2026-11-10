// Red-team suite for src/db/schema.sql.
//
// The schema's header makes twelve promises (P1-P12) and says each is enforced by the
// database itself, not only by application code. This file takes that literally: it never
// calls src/domain to change data. Every test writes rows with raw SQL, attempts ONE
// forbidden thing, and requires
//   * a refusal,
//   * by the specific constraint or trigger that is meant to stop it, and
//   * no change to any row of any table (refuses() compares a full snapshot).
// Next to each group of attacks is the legal version of the same action, so a schema that
// simply refused everything would fail too.
//
// The append-only promises (P4, P7, P10) are attacked under four connection settings,
// because they must hold even on a connection that forgot its pragmas.
//
// A test marked { todo: 'defect: ...' } is an attack that currently SUCCEEDS (or a legal
// action that is wrongly refused). It asserts what the promise calls for, so it turns
// green by itself once the schema is fixed. See the hand-over report for the exact SQL.

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Db, constraintKind, isTriggerAbort } from '../../src/db/sqlite.js';
import { checkIntegrity } from '../../src/domain/integrity.js';
import { findEngagementWord, findMoneyTerm } from '../../src/domain/policy.js';
import { fixedClock } from '../../src/lib/clock.js';
import {
  ABORT,
  ANY_REFUSAL,
  CHECK,
  CONNECTIONS,
  DATATYPE,
  DECISIONS,
  EFFECT_TRIGGERS,
  FOREIGN_KEY,
  NOT_NULL,
  PERIOD,
  T0,
  UNIQUE,
  approvedClaim,
  at,
  audit,
  auditRow,
  award,
  awardRow,
  balance,
  cast,
  claim,
  claimIn,
  claimOf,
  claimRow,
  closeOpened,
  competition,
  count,
  dropTrigger,
  either,
  entry,
  entryRow,
  firedTriggers,
  guard,
  insert,
  markReviewed,
  member,
  openApplication,
  openBare,
  refuses,
  reversal,
  reversalRow,
  session,
  sessionRow,
  setGuard,
  sha256,
  snapshot,
  stage,
  taskType,
  user,
  video,
  witness,
} from './schema.helpers.js';

afterEach(closeOpened);

const DEFECT = (line) => ({ todo: `defect: ${line}` });

/** Runs a step of a longer attack; a refusal anywhere along the chain is the wanted outcome. */
const attempt = (step) => {
  try {
    step();
    return true;
  } catch {
    return false;
  }
};

const workingAdmins = (sql) => count(sql, 'users', "role = 'admin' AND status = 'active' AND last_login_at IS NOT NULL");

// ---------------------------------------------------------------------------
// The schema under test
// ---------------------------------------------------------------------------

describe('The schema under test', () => {
  test('the application connection runs with both pragmas the promises rely on', () => {
    const sql = openApplication();
    assert.equal(sql.db.pragma('foreign_keys'), 1);
    assert.equal(sql.db.pragma('recursive_triggers'), 1);
    assert.ok(Number(sql.db.pragma('user_version')) >= 1);
  });

  test('a bare connection loaded from schema.sql has exactly the objects migrate() creates', () => {
    const objects = (sql) => sql.all("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").map((row) => ({ ...row }));
    assert.deepEqual(objects(openBare()), objects(openApplication()));
    assert.equal(openBare({ recursiveTriggers: false }).get('PRAGMA recursive_triggers').recursive_triggers, 0);
    assert.equal(openBare({ foreignKeys: false }).get('PRAGMA foreign_keys').foreign_keys, 0);
  });

  test('every table is STRICT', () => {
    const tables = openApplication().all("SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'");
    assert.equal(tables.length, 12);
    assert.deepEqual(tables.filter((table) => table.strict !== 1), []);
  });

  test('every trigger has its message pinned in this suite, and nothing pinned has gone', () => {
    const triggers = openApplication().all("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name");
    const raised = (text) => [...text.matchAll(/RAISE\s*\(\s*ABORT\s*,\s*'((?:[^']|'')*)'\s*\)/g)].map((match) => match[1].replaceAll("''", "'")).sort();
    const pinned = (item) => (item.kind === 'trigger' ? [item.message] : Object.values(item).map((one) => one.message)).sort();
    for (const { name, sql: text } of triggers) {
      const messages = raised(text);
      if (messages.length === 0) {
        assert.ok(EFFECT_TRIGGERS.includes(name), `trigger ${name} raises nothing and is not listed as an effect trigger`);
      } else {
        assert.ok(ABORT[name], `trigger ${name} is not covered: add it to ABORT in schema.helpers.js and attack it`);
        assert.deepEqual(pinned(ABORT[name]), messages, `messages of ${name}`);
      }
    }
    assert.deepEqual([...Object.keys(ABORT), ...EFFECT_TRIGGERS].sort(), triggers.map((trigger) => trigger.name));
  });

  test('the fragments src/domain turns into API errors are still what the triggers say', () => {
    const translated = {
      ledger_never_negative: 'would_go_negative',
      ledger_no_self_credit: 'cannot credit the member it is linked to',
      ledger_no_insert_during_erasure: 'an erasure is in progress',
      claims_no_insert_during_erasure: 'an erasure is in progress',
      ledger_no_replace: 'append-only',
      claims_no_replace: 'duplicate_claim',
      claims_no_self_approval: 'reviewer who is not linked to the member',
      users_keep_one_admin_on_update: 'at least one active',
      users_keep_one_admin_on_delete: 'at least one active',
    };
    for (const [trigger, fragment] of Object.entries(translated)) assert.ok(ABORT[trigger].message.includes(fragment), trigger);
  });

  test('the adapter classifies each kind of refusal the way src/domain expects', () => {
    const sql = stage();
    const kindOf = (attack) => {
      try {
        attack();
      } catch (error) {
        return constraintKind(error);
      }
      return 'accepted';
    };
    assert.equal(kindOf(() => entry(sql, { points: -5 })), 'trigger');
    assert.equal(kindOf(() => entry(sql, { points: 5, period: '2026-13' })), 'check');
    assert.equal(kindOf(() => entry(sql, { points: 5, member_id: 'mbr_nobody' })), 'foreign_key');
    assert.equal(kindOf(() => user(sql, 'usr_twin', { email: 'usrroot@example.test', role: 'admin' })), 'unique');
    assert.equal(kindOf(() => member(sql, 'mbr_ada', { slug: 'another' })), 'unique');
    assert.equal(kindOf(() => member(sql, 'mbr_cy', { display_name: null })), 'not_null');
    assert.equal(kindOf(() => entry(sql, { points: 'ten' })), 'datatype');
    const negative = refuses(sql, () => entry(sql, { points: -5 }), ABORT.ledger_never_negative);
    assert.ok(isTriggerAbort(negative, 'would_go_negative'));
  });
});

// ---------------------------------------------------------------------------
// P1
// ---------------------------------------------------------------------------

describe('P1  An approved claim has exactly one ledger award, and a claim becomes approved ONLY by that award being written', () => {
  const { illegal, needsAward, needsReversal, needsReviewerAndNote } = ABORT.claims_transitions;

  test('legal: writing the award is what approves the claim, and it records who and when', () => {
    const sql = stage();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    assert.equal(claimOf(sql, claimId).decision, 'pending', 'a review mark alone approves nothing');

    award(sql, claimId, { created_at: at(5) });
    const approved = claimOf(sql, claimId);
    assert.equal(approved.decision, 'approved');
    assert.equal(approved.decided_at, at(5));
    assert.equal(approved.decided_by, 'usr_root');
    assert.equal(count(sql, 'ledger_entries', "claim_id = ? AND kind = 'task_award'", [claimId]), 1);
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 });
    witness('ledger_award_approves_claim');
  });

  test('approving by UPDATE alone is refused, whether or not the claim was reviewed', () => {
    const sql = stage();
    const reviewed = claim(sql);
    markReviewed(sql, reviewed);
    const unreviewed = claim(sql);
    for (const claimId of [reviewed, unreviewed]) {
      refuses(sql, () => sql.run("UPDATE claims SET decision = 'approved', decided_at = ?, decided_by = 'usr_root' WHERE id = ?", [T0, claimId]), needsAward);
    }
    assert.equal(count(sql, 'ledger_entries'), 0);
  });

  test('beneath the trigger, a CHECK refuses an approved claim that nobody reviewed', () => {
    const sql = stage();
    const claimId = claim(sql);
    dropTrigger(sql, 'claims_transitions');
    refuses(sql, () => sql.run("UPDATE claims SET decision = 'approved', decided_at = ?, decided_by = 'usr_root' WHERE id = ?", [T0, claimId]), CHECK("decision <> 'approved' OR verification_status IN"));
  });

  test('a second award for the same claim is refused', () => {
    const sql = stage();
    const { claimId } = approvedClaim(sql);
    const secondAward = either(ABORT.ledger_no_replace, ABORT.ledger_award_requires_reviewed_claim);
    refuses(sql, () => award(sql, claimId), secondAward);
    refuses(sql, () => award(sql, claimId, { created_at: at(9), reason: 'Approved again' }), secondAward);
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 });
  });

  test('beneath the triggers, a unique index allows one award per claim', () => {
    const sql = cast(openBare());
    const { claimId } = approvedClaim(sql);
    dropTrigger(sql, 'ledger_no_replace');
    dropTrigger(sql, 'ledger_award_requires_reviewed_claim');
    refuses(sql, () => award(sql, claimId), UNIQUE('ledger_entries.'));
    // CHECKs off, so the second award can carry another key and reach the index this test is about.
    sql.exec('PRAGMA ignore_check_constraints = ON');
    refuses(sql, () => award(sql, claimId, { idempotency_key: 'award:under-another-key' }), UNIQUE('ledger_entries.claim_id'));
  });

  const moveTo = (sql, claimId, decision) =>
    decision === 'pending'
      ? sql.run("UPDATE claims SET decision = 'pending', decided_at = NULL, decided_by = NULL, decision_note = NULL WHERE id = ?", [claimId])
      : sql.run("UPDATE claims SET decision = ?, decided_at = ?, decided_by = 'usr_root', decision_note = 'A note the member can read.' WHERE id = ?", [decision, at(30), claimId]);

  // Of the twenty possible moves, an UPDATE on its own may make exactly two.
  for (const from of DECISIONS) {
    for (const to of DECISIONS.filter((decision) => decision !== from)) {
      if (from === 'pending' && (to === 'rejected' || to === 'withdrawn')) {
        test(`legal: ${from} -> ${to} by UPDATE`, () => {
          const sql = stage();
          const claimId = claimIn(sql, from);
          moveTo(sql, claimId, to);
          assert.equal(claimOf(sql, claimId).decision, to);
          assert.equal(count(sql, 'ledger_entries'), 0);
        });
      } else {
        const expected = from === 'pending' && to === 'approved' ? needsAward : from === 'approved' && to === 'revoked' ? needsReversal : illegal;
        test(`${from} -> ${to} by UPDATE alone is refused`, () => {
          const sql = stage();
          const claimId = claimIn(sql, from);
          refuses(sql, () => moveTo(sql, claimId, to), expected);
        });
      }
    }
  }

  test('a rejection needs a recorded reviewer and a real note', () => {
    const sql = stage();
    const claimId = claim(sql);
    const reject = (decidedBy, note) => () => sql.run("UPDATE claims SET decision = 'rejected', decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?", [T0, decidedBy, note, claimId]);
    refuses(sql, reject(null, 'Too short to review.'), needsReviewerAndNote);
    refuses(sql, reject('usr_root', null), needsReviewerAndNote);
    refuses(sql, reject('usr_root', '    '), needsReviewerAndNote);
    refuses(sql, reject('usr_root', ' no '), needsReviewerAndNote);
    refuses(sql, reject('usr_nobody', 'Too short to review.'), FOREIGN_KEY);
    refuses(sql, reject('usr_root', 'x'.repeat(501)), CHECK('length(decision_note) <= 500'));
    reject('usr_root', 'Too short to review.')();
    assert.equal(claimOf(sql, claimId).decision, 'rejected');
  });

  test('a pending claim carries no decision details, and a decided one always has a time', () => {
    const sql = stage();
    const claimId = claim(sql);
    const pendingIsBlank = CHECK("decision <> 'pending' OR (decided_at IS NULL AND decided_by IS NULL AND decision_note IS NULL)");
    refuses(sql, () => sql.run('UPDATE claims SET decided_at = ? WHERE id = ?', [T0, claimId]), pendingIsBlank);
    refuses(sql, () => sql.run("UPDATE claims SET decided_by = 'usr_root' WHERE id = ?", [claimId]), pendingIsBlank);
    refuses(sql, () => sql.run("UPDATE claims SET decision_note = 'Looks fine to me.' WHERE id = ?", [claimId]), pendingIsBlank);
    refuses(sql, () => sql.run("UPDATE claims SET decision = 'withdrawn' WHERE id = ?", [claimId]), CHECK("decision = 'pending' OR decided_at IS NOT NULL"));
    refuses(sql, () => sql.run("UPDATE claims SET decision = 'archived', decided_at = ? WHERE id = ?", [T0, claimId]), illegal);
    refuses(sql, () => sql.run('UPDATE claims SET decision = NULL WHERE id = ?', [claimId]), NOT_NULL('claims.decision'));
  });

  // A NULL written with UPDATE OR REPLACE is replaced by the column default ('pending') AFTER the
  // BEFORE UPDATE triggers ran, and those triggers compare the decision with <>, which is not true for NULL.
  const unDecide = (sql, claimId) => sql.run('UPDATE OR REPLACE claims SET decision = NULL, decided_at = NULL, decided_by = NULL, decision_note = NULL WHERE id = ?', [claimId]);

  for (const from of ['approved', 'rejected', 'withdrawn', 'revoked']) {
    test(`UPDATE OR REPLACE with a NULL decision cannot turn a ${from} claim back into a pending one`, DEFECT('claims.decision = NULL under UPDATE OR REPLACE falls back to the default and un-decides a claim'), () => {
      const sql = stage();
      const claimId = claimIn(sql, from);
      refuses(sql, () => unDecide(sql, claimId), ANY_REFUSAL);
    });
  }

  test('an approved claim cannot be un-decided, withdrawn and submitted again for a second credit', DEFECT('un-deciding an approved claim leaves its award in place and frees the subject: one contribution, two awards'), () => {
    const sql = stage();
    const text = 'The intro runs long; cut the first ten seconds and the hook lands.';
    const { claimId } = approvedClaim(sql, { evidence_text: text });
    attempt(() => unDecide(sql, claimId));
    attempt(() => sql.run("UPDATE claims SET decision = 'withdrawn', decided_at = ? WHERE id = ?", [at(1), claimId]));
    attempt(() => {
      const again = claim(sql, { evidence_text: text });
      markReviewed(sql, again);
      award(sql, again);
    });
    assert.equal(claimOf(sql, claimId).decision, 'approved');
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 }, 'the same text was credited twice');
  });

  test('a revoked claim cannot be un-decided and approved again by UPDATE alone', DEFECT('after un-deciding, a claim whose award was reversed can be approved by UPDATE with no live award'), () => {
    const sql = stage();
    const claimId = claimIn(sql, 'revoked');
    attempt(() => unDecide(sql, claimId));
    attempt(() => sql.run("UPDATE claims SET decision = 'approved', decided_at = ?, decided_by = 'usr_root' WHERE id = ?", [at(1), claimId]));
    assert.equal(claimOf(sql, claimId).decision, 'revoked');
  });
});

// ---------------------------------------------------------------------------
// P2
// ---------------------------------------------------------------------------

describe('P2  A duplicate submission can never be credited twice', () => {
  const TEXT = 'Move the captions up: they cover the product in the second half.';
  const subjectPrefix = CHECK("subject_key GLOB 'video:?*' OR subject_key GLOB 'url:?*' OR subject_key GLOB 'text:?*'");
  const subjectIsVideo = CHECK("CASE WHEN video_id IS NULL THEN subject_key NOT GLOB 'video:*' ELSE subject_key = 'video:' || video_id END");

  test('a second live claim for the same member, task and subject is refused while the first is pending', () => {
    const sql = stage();
    claim(sql, { evidence_text: TEXT });
    refuses(sql, () => claim(sql, { evidence_text: TEXT }), ABORT.claims_no_replace);
    refuses(sql, () => claim(sql, { evidence_text: TEXT, created_at: at(90), submitted_by: 'usr_root', submitted_by_role: 'admin' }), ABORT.claims_no_replace);
    claim(sql, { video_id: 'vid_yt' });
    refuses(sql, () => claim(sql, { video_id: 'vid_yt' }), ABORT.claims_no_replace);
  });

  test('a second claim for a subject that was already credited is refused', () => {
    const sql = stage();
    approvedClaim(sql, { evidence_text: TEXT });
    refuses(sql, () => claim(sql, { evidence_text: TEXT }), ABORT.claims_no_replace);
    assert.equal(count(sql, 'claims'), 1);
  });

  for (const decision of ['rejected', 'withdrawn', 'revoked']) {
    test(`legal: a ${decision} claim frees the subject, so the member can try again`, () => {
      const sql = stage();
      claimIn(sql, decision, { evidence_text: TEXT });
      const again = claim(sql, { evidence_text: TEXT });
      assert.equal(claimOf(sql, again).decision, 'pending');
      refuses(sql, () => claim(sql, { evidence_text: TEXT }), ABORT.claims_no_replace);
    });
  }

  test('legal: the same subject may be claimed by another member, or for another task', () => {
    const sql = stage();
    claim(sql, { evidence_text: TEXT });
    claim(sql, { evidence_text: TEXT, member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    claim(sql, { evidence_text: TEXT, task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20, evidence_url: 'https://example.test/my-edit', subject_key: `text:${sha256(TEXT)}` });
    assert.equal(count(sql, 'claims'), 3);
  });

  test('beneath the trigger, the unique index refuses the duplicate on its own', () => {
    const sql = stage();
    claim(sql, { evidence_text: TEXT });
    dropTrigger(sql, 'claims_no_replace');
    refuses(sql, () => claim(sql, { evidence_text: TEXT }), UNIQUE('claims.member_id, claims.task_type_id, claims.subject_key, claims.exception_seq'));
    const existing = sql.get('SELECT id FROM claims').id;
    refuses(sql, () => claim(sql, { id: existing, evidence_text: 'Different text, same id.' }), UNIQUE('claims.id'));
  });

  test('the subject of a claim about a tracked video IS that video', () => {
    const sql = stage();
    refuses(sql, () => claim(sql, { video_id: 'vid_yt', subject_key: 'url:https://youtu.be/ytSample001' }), subjectIsVideo);
    refuses(sql, () => claim(sql, { video_id: 'vid_yt', evidence_text: TEXT, subject_key: `text:${sha256(TEXT)}` }), subjectIsVideo);
    refuses(sql, () => claim(sql, { video_id: 'vid_yt', subject_key: 'video:vid_tt' }), subjectIsVideo);
    refuses(sql, () => claim(sql, { video_id: 'vid_yt', subject_key: 'video:VID_YT' }), subjectIsVideo);
    refuses(sql, () => claim(sql, { video_id: null, subject_key: 'video:vid_yt' }), subjectIsVideo);
    const claimId = claim(sql, { video_id: 'vid_yt' });
    assert.equal(claimOf(sql, claimId).subject_key, 'video:vid_yt');
  });

  test('a subject key is one of video: / url: / text: followed by something', () => {
    const sql = stage();
    for (const subjectKey of ['misc:thing', 'url:', 'URL:https://example.test/a', '', 'video']) {
      refuses(sql, () => claim(sql, { subject_key: subjectKey }), subjectPrefix);
    }
    refuses(sql, () => claim(sql, { subject_key: 'video:' }), either(subjectPrefix, subjectIsVideo));
    refuses(sql, () => claim(sql, { subject_key: null }), NOT_NULL('claims.subject_key'));
  });

  test('a text: subject is exactly the evidence hash', () => {
    const sql = stage();
    const notTheHash = ABORT.claims_text_subject_is_evidence_hash;
    refuses(sql, () => claim(sql, { evidence_text: TEXT, subject_key: `text:${sha256('some other text')}` }), notTheHash);
    refuses(sql, () => claim(sql, { evidence_text: TEXT, subject_key: `text:${sha256(TEXT).toUpperCase()}` }), notTheHash);
    refuses(sql, () => claim(sql, { evidence_text: TEXT, evidence_hash: null, subject_key: `text:${sha256(TEXT)}` }), notTheHash);
    refuses(sql, () => claim(sql, { evidence_text: TEXT, subject_key: 'text:' }), notTheHash);
    const claimId = claim(sql, { evidence_text: TEXT });
    assert.equal(claimOf(sql, claimId).subject_key, `text:${sha256(TEXT)}`);
  });

  test('a link to a tracked video must be submitted against that video', () => {
    const sql = stage();
    const useTheVideo = ABORT.claims_tracked_video_url_must_use_video;
    for (const link of ['https://www.youtube.com/watch?v=ytSample001', 'https://youtu.be/ytSample001?t=42', 'https://m.youtube.com/watch?feature=share&v=ytSample001', 'https://www.tiktok.com/@sample/video/7300000000000000001']) {
      refuses(sql, () => claim(sql, { evidence_url: link }), useTheVideo);
    }
    // Legal: the same link next to the video it points at, a link to something untracked, and no link at all.
    const against = claim(sql, { video_id: 'vid_yt', evidence_url: 'https://www.youtube.com/watch?v=ytSample001' });
    assert.equal(claimOf(sql, against).subject_key, 'video:vid_yt');
    claim(sql, { evidence_url: 'https://example.test/portfolio/edit-7' });
    claim(sql, { evidence_url: null });
    assert.equal(count(sql, 'claims'), 3);
  });

  test('a claim has evidence of some kind, and it is not blank or oversized', () => {
    const sql = stage();
    refuses(sql, () => claim(sql, { evidence_text: null, evidence_url: null, video_id: null, subject_key: 'url:nothing-at-all' }), CHECK('evidence_text IS NOT NULL OR evidence_url IS NOT NULL OR video_id IS NOT NULL'));
    const textRule = CHECK('length(evidence_text) <= 4000 AND length(trim(evidence_text)) > 0');
    refuses(sql, () => claim(sql, { evidence_text: '   ' }), textRule);
    refuses(sql, () => claim(sql, { evidence_text: '' }), textRule);
    refuses(sql, () => claim(sql, { evidence_text: 'x'.repeat(4001) }), textRule);
    refuses(sql, () => claim(sql, { evidence_url: `https://example.test/${'x'.repeat(480)}` }), CHECK('length(evidence_url) <= 500'));
    claim(sql, { evidence_text: 'x'.repeat(4000) });
    claim(sql, { evidence_text: null, video_id: 'vid_yt' });
  });

  describe('exceptions: a logged second credit for something already credited', () => {
    const exception = (overrides = {}) =>
      claimRow({ evidence_text: TEXT, exception_seq: 1, exception_reason: 'Counted again by agreement with the group.', submitted_by: 'usr_root', submitted_by_role: 'admin', ...overrides });
    const notNext = ABORT.claims_exception_is_next;
    const pairRule = CHECK('(exception_seq = 0) = (exception_reason IS NULL)');

    test('legal: an admin grants the next number after an approved claim, with a reason; then the one after that', () => {
      const sql = stage();
      approvedClaim(sql, { evidence_text: TEXT });
      const first = exception();
      insert(sql, 'claims', first);
      refuses(sql, () => insert(sql, 'claims', exception()), ABORT.claims_no_replace);
      refuses(sql, () => insert(sql, 'claims', exception({ exception_seq: 2 })), notNext);
      markReviewed(sql, first.id);
      award(sql, first.id);
      insert(sql, 'claims', exception({ exception_seq: 2 }));
      assert.deepEqual(balance(sql), { earned: 50, bonus: 0, xp: 20 });
      assert.equal(count(sql, 'claims'), 3);
    });

    test('an exception with nothing credited before it is refused', () => {
      const sql = stage();
      refuses(sql, () => insert(sql, 'claims', exception()), notNext);
    });

    for (const decision of ['pending', 'rejected', 'withdrawn', 'revoked']) {
      test(`an exception after a ${decision} claim is refused`, () => {
        const sql = stage();
        claimIn(sql, decision, { evidence_text: TEXT });
        refuses(sql, () => insert(sql, 'claims', exception()), notNext);
      });
    }

    test('an exception is entered by an admin account, with a real reason', () => {
      const sql = stage();
      approvedClaim(sql, { evidence_text: TEXT });
      refuses(sql, () => insert(sql, 'claims', exception({ submitted_by: 'usr_ada', submitted_by_role: 'member' })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ submitted_by: 'usr_ada' })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ submitted_by: null })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ submitted_by: 'usr_nobody' })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ exception_reason: '     ' })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ exception_reason: ' ok ' })), notNext);
      assert.equal(count(sql, 'claims'), 1);
    });

    test('an exception belongs to the same member, task and subject as the claim it follows, and skips no number', () => {
      const sql = stage();
      approvedClaim(sql, { evidence_text: TEXT });
      refuses(sql, () => insert(sql, 'claims', exception({ member_id: 'mbr_bo' })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20 })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ evidence_text: 'Some other text entirely.' })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ exception_seq: 2 })), notNext);
      refuses(sql, () => insert(sql, 'claims', exception({ exception_seq: 7 })), notNext);
    });

    test('the number and the reason go together, and the number is never negative', () => {
      const sql = stage();
      approvedClaim(sql, { evidence_text: TEXT });
      refuses(sql, () => insert(sql, 'claims', exception({ exception_reason: null })), pairRule);
      refuses(sql, () => claim(sql, { exception_seq: 0, exception_reason: 'A reason with no exception.' }), pairRule);
      refuses(sql, () => insert(sql, 'claims', exception({ exception_seq: -1 })), CHECK('exception_seq >= 0'));
    });
  });

  test('a text-only claim cannot dodge the text rule by calling its subject url:', DEFECT('a url: subject is tied to nothing, so one text can be live (and credited) under any number of invented url: subjects'), () => {
    const sql = stage();
    claim(sql, { evidence_text: TEXT });
    refuses(sql, () => claim(sql, { evidence_text: TEXT, subject_key: 'url:invented-one' }), ANY_REFUSAL);
    refuses(sql, () => claim(sql, { evidence_text: TEXT, subject_key: 'url:invented-two' }), ANY_REFUSAL);
  });

  test('a claim with a link is measured on the link, not on its text', DEFECT('a claim that carries evidence_url may use a text: subject, so one link can be live under any number of different texts'), () => {
    const sql = stage();
    const link = 'https://example.test/portfolio/edit-7';
    claim(sql, { evidence_url: link });
    refuses(sql, () => claim(sql, { evidence_url: link, evidence_text: 'First wording.', subject_key: `text:${sha256('First wording.')}` }), ANY_REFUSAL);
  });

  test('a tracked video cannot be claimed again through a percent-encoded spelling of its link', DEFECT('claims_tracked_video_url_must_use_video compares raw text, so v=ytSample00%31 slips past it'), () => {
    const sql = stage();
    claim(sql, { video_id: 'vid_yt' });
    refuses(sql, () => claim(sql, { evidence_url: 'https://www.youtube.com/watch?v=ytSample00%31' }), ANY_REFUSAL);
  });

  test('a link credited before its video was tracked cannot be credited again against the tracked video', DEFECT('(recorded as PE-01) a video put on the tracked list after its link was credited can be credited a second time'), () => {
    const sql = stage();
    approvedClaim(sql, { evidence_url: 'https://www.youtube.com/watch?v=trackedLater' });
    attempt(() => video(sql, 'vid_later', { platform_video_id: 'trackedLater' }));
    attempt(() => approvedClaim(sql, { video_id: 'vid_later' }));
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 }, 'one video, one task, one member: one award');
  });
});

// ---------------------------------------------------------------------------
// P3
// ---------------------------------------------------------------------------

describe('P3  No task award exists without a reviewed or API-attested claim, and the "earned" bucket can only grow through such an award', () => {
  const needsReviewedClaim = ABORT.ledger_award_requires_reviewed_claim;
  const untrackedLink = 'https://www.youtube.com/watch?v=untracked01';
  const creative = (overrides = {}) => ({ task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20, evidence_text: null, evidence_url: untrackedLink, subject_key: 'url:youtube/untracked01', ...overrides });

  test('an award for a claim nobody reviewed is refused', () => {
    const sql = stage();
    const claimId = claim(sql);
    refuses(sql, () => award(sql, claimId), needsReviewedClaim);
    assert.equal(claimOf(sql, claimId).decision, 'pending');
  });

  test('legal: a manually reviewed claim and a platform-attested claim can both be awarded', () => {
    const sql = stage();
    const reviewed = claim(sql);
    markReviewed(sql, reviewed);
    award(sql, reviewed);
    const attested = claim(sql, creative({ member_id: 'mbr_bo', submitted_by: 'usr_bo' }));
    sql.run("UPDATE claims SET verification_status = 'verified', verification_source = 'youtube_api', verified_at = ? WHERE id = ?", [T0, attested]);
    award(sql, attested);
    assert.deepEqual(balance(sql, 'mbr_ada'), { earned: 25, bonus: 0, xp: 10 });
    assert.deepEqual(balance(sql, 'mbr_bo'), { earned: 40, bonus: 0, xp: 20 });
    assert.equal(count(sql, 'claims', "decision = 'approved'"), 2);
  });

  test('an award must match its claim: same member, same points, same XP', () => {
    const sql = stage();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    for (const forged of [{ member_id: 'mbr_bo' }, { points: 26 }, { points: 1000 }, { points: 24 }, { xp: 11 }, { xp: 0 }, { points: 10, xp: 25 }]) {
      refuses(sql, () => award(sql, claimId, forged), needsReviewedClaim);
    }
    award(sql, claimId);
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 });
  });

  for (const decision of ['rejected', 'withdrawn']) {
    test(`an award for a ${decision} claim is refused, even one that had been reviewed`, () => {
      const sql = stage();
      const claimId = claim(sql);
      markReviewed(sql, claimId);
      if (decision === 'rejected') sql.run("UPDATE claims SET decision = 'rejected', decided_by = 'usr_root', decided_at = ?, decision_note = 'Not this time.' WHERE id = ?", [T0, claimId]);
      else sql.run("UPDATE claims SET decision = 'withdrawn', decided_at = ? WHERE id = ?", [T0, claimId]);
      refuses(sql, () => award(sql, claimId), needsReviewedClaim);
    });
  }

  for (const decision of ['approved', 'revoked']) {
    test(`an award for a claim that is already ${decision} is refused`, () => {
      const sql = stage();
      const claimId = claimIn(sql, decision);
      refuses(sql, () => award(sql, claimId, { created_at: at(60) }), either(ABORT.ledger_no_replace, needsReviewedClaim));
    });
  }

  test('an award needs a claim that exists, and only an award may name a claim', () => {
    const sql = stage();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    refuses(sql, () => award(sql, 'clm_missing'), needsReviewedClaim);
    refuses(sql, () => entry(sql, { kind: 'task_award', bucket: 'earned', points: 25, xp: 10, idempotency_key: 'award:nothing' }), needsReviewedClaim);
    const awardNamesClaim = CHECK("(kind = 'task_award') = (claim_id IS NOT NULL)");
    refuses(sql, () => entry(sql, { kind: 'bonus', points: 25, xp: 10, claim_id: claimId }), awardNamesClaim);
    refuses(sql, () => entry(sql, { kind: 'adjustment', points: 25, xp: 10, claim_id: claimId }), awardNamesClaim);
  });

  test('an award is non-negative and always lands in "earned"', () => {
    const sql = stage();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    refuses(sql, () => award(sql, claimId, { bucket: 'bonus' }), CHECK("kind <> 'task_award' OR (points >= 0 AND xp >= 0 AND bucket = 'earned')"));
  });

  test('an adjustment may add to "bonus" only; points and XP put into "earned" by hand are refused', () => {
    const sql = stage();
    approvedClaim(sql);
    const earnedOnlyByAward = CHECK("kind <> 'adjustment' OR bucket = 'bonus' OR (points <= 0 AND xp <= 0)");
    refuses(sql, () => entry(sql, { bucket: 'earned', points: 5 }), earnedOnlyByAward);
    refuses(sql, () => entry(sql, { bucket: 'earned', xp: 5 }), earnedOnlyByAward);
    refuses(sql, () => entry(sql, { bucket: 'earned', points: 5, xp: -5 }), earnedOnlyByAward);
    refuses(sql, () => entry(sql, { bucket: 'earned', points: -5, xp: 5 }), earnedOnlyByAward);
    refuses(sql, () => entry(sql, { bucket: 'earned', points: 100000, xp: 100000 }), earnedOnlyByAward);
    // Legal: taking away from "earned", and adding to "bonus".
    entry(sql, { bucket: 'earned', points: -10, xp: -1 });
    entry(sql, { bucket: 'bonus', points: 7, xp: 3 });
    assert.deepEqual(balance(sql), { earned: 15, bonus: 7, xp: 12 });
  });

  test('a bonus is non-negative and always lands in "bonus"', () => {
    const sql = stage();
    entry(sql, { points: 50, xp: 50 });
    const bonusShape = CHECK("kind <> 'bonus' OR (points >= 0 AND xp >= 0 AND bucket = 'bonus')");
    refuses(sql, () => entry(sql, { kind: 'bonus', bucket: 'earned', points: 5 }), bonusShape);
    refuses(sql, () => entry(sql, { kind: 'bonus', points: -5 }), bonusShape);
    refuses(sql, () => entry(sql, { kind: 'bonus', points: 5, xp: -5 }), bonusShape);
    entry(sql, { kind: 'bonus', points: 5 });
    assert.deepEqual(balance(sql), { earned: 0, bonus: 55, xp: 50 });
  });

  test('undoing a deduction can only give back what an award put there', () => {
    const sql = stage();
    approvedClaim(sql);
    const deduction = entry(sql, { bucket: 'earned', points: -10 });
    assert.equal(balance(sql).earned, 15);
    reversal(sql, deduction);
    assert.equal(balance(sql).earned, 25, '"earned" is back to exactly the award');
    refuses(sql, () => reversal(sql, deduction), ABORT.ledger_no_replace);
    assert.equal(sql.get("SELECT COALESCE(SUM(points), 0) AS points FROM ledger_entries WHERE bucket = 'earned' AND kind = 'task_award'").points, 25);
  });

  test('a new claim snapshots its task exactly, and the task must be open', () => {
    const sql = stage();
    const mismatch = ABORT.claims_snapshot_matches_task;
    refuses(sql, () => claim(sql, { points_snapshot: 26 }), mismatch);
    refuses(sql, () => claim(sql, { points_snapshot: 1000, xp_snapshot: 1000 }), mismatch);
    refuses(sql, () => claim(sql, { xp_snapshot: 0 }), mismatch);
    refuses(sql, () => claim(sql, { task_type_id: 'tsk_creative' }), mismatch);
    refuses(sql, () => claim(sql, { task_type_id: 'tsk_missing' }), mismatch);
    sql.run("UPDATE task_types SET active = 0 WHERE id = 'tsk_feedback'");
    refuses(sql, () => claim(sql), mismatch);
    sql.run("UPDATE task_types SET active = 1, points = 30 WHERE id = 'tsk_feedback'");
    refuses(sql, () => claim(sql), mismatch);
    const claimId = claim(sql, { points_snapshot: 30 });
    assert.equal(claimOf(sql, claimId).points_snapshot, 30);
  });

  test('a task about a video only accepts claims that name one', () => {
    const sql = stage();
    taskType(sql, 'tsk_about_video', { requires_video: 1 });
    refuses(sql, () => claim(sql, { task_type_id: 'tsk_about_video' }), ABORT.claims_snapshot_matches_task);
    refuses(sql, () => claim(sql, { task_type_id: 'tsk_about_video', evidence_url: 'https://example.test/not-a-tracked-video' }), ABORT.claims_snapshot_matches_task);
    claim(sql, { task_type_id: 'tsk_about_video', video_id: 'vid_yt' });
  });

  test('beneath the trigger, a claim worth nothing cannot exist', () => {
    const sql = stage();
    dropTrigger(sql, 'claims_snapshot_matches_task');
    refuses(sql, () => claim(sql, { points_snapshot: 0, xp_snapshot: 0 }), CHECK('points_snapshot > 0 OR xp_snapshot > 0'));
    refuses(sql, () => claim(sql, { points_snapshot: 1001 }), CHECK('points_snapshot BETWEEN 0 AND 1000'));
    refuses(sql, () => claim(sql, { xp_snapshot: -1 }), CHECK('xp_snapshot BETWEEN 0 AND 1000'));
  });

  test('a claim cannot be inserted already decided or already verified', () => {
    const sql = stage();
    const reviewedFields = { verification_status: 'manually_reviewed', verification_source: 'admin_review', verified_at: T0 };
    const decidedFields = { decided_at: T0, decided_by: 'usr_root', decision_note: 'Inserted as decided.' };
    refuses(sql, () => claim(sql, { decision: 'approved', ...reviewedFields, ...decidedFields }), ABORT.claims_start_pending);
    refuses(sql, () => claim(sql, { decision: 'rejected', ...decidedFields }), ABORT.claims_start_pending);
    refuses(sql, () => claim(sql, { decision: 'withdrawn', decided_at: T0 }), ABORT.claims_start_pending);
    refuses(sql, () => claim(sql, { decision: 'revoked', ...reviewedFields, ...decidedFields }), ABORT.claims_start_pending);
    refuses(sql, () => claim(sql, reviewedFields), ABORT.claims_start_pending);
    refuses(sql, () => claim(sql, creative({ verification_status: 'verified', verification_source: 'mock_adapter', verified_at: T0 })), ABORT.claims_start_pending);
    const claimId = claim(sql, { decision: 'pending', verification_status: 'unverified', verification_source: 'none' });
    assert.equal(claimOf(sql, claimId).decision, 'pending');
  });

  test('an award is never dated before the claim it rewards was submitted', DEFECT('ledger_award_requires_reviewed_claim does not compare dates, so an award (and its cap month) can be backdated to before its claim existed'), () => {
    const sql = stage();
    const claimId = claim(sql, { created_at: T0 });
    markReviewed(sql, claimId);
    refuses(sql, () => award(sql, claimId, { created_at: '2019-01-15T00:00:00.000Z', period: '2019-01' }), ANY_REFUSAL);
  });
});

// ---------------------------------------------------------------------------
// P4
// ---------------------------------------------------------------------------

describe('P4  The ledger is append-only; corrections are new entries', () => {
  const REWRITES = {
    id: 999,
    member_id: 'mbr_bo',
    kind: 'bonus',
    bucket: 'earned',
    points: 500,
    xp: 500,
    claim_id: 'clm_other',
    reverses_entry_id: 1,
    competition_id: 'cmp_other',
    idempotency_key: 'req:usr_root:rewritten',
    reason: 'Rewritten after the fact',
    actor_user_id: 'usr_bo',
    period: '2026-10',
    created_at: at(1),
  };

  for (const connection of Object.values(CONNECTIONS)) {
    describe(connection.label, () => {
      /** mbr_ada with a +50 credit and a -20 deduction in "bonus". */
      const ledger = () => {
        const sql = cast(connection.open());
        const credit = entry(sql, { points: 50, xp: 5, reason: 'Credit' });
        const deduction = entry(sql, { points: -20, reason: 'Deduction' });
        return { sql, credit, deduction };
      };
      const replacement = (deductionKey) => entryRow({ points: 500, idempotency_key: deductionKey, reason: 'Rewritten after the fact' });
      const keyOf = (sql, id) => sql.get('SELECT idempotency_key FROM ledger_entries WHERE id = ?', [id]).idempotency_key;

      for (const [column, value] of Object.entries(REWRITES)) {
        test(`UPDATE of ${column} is refused`, () => {
          const { sql, deduction } = ledger();
          refuses(sql, () => sql.run(`UPDATE ledger_entries SET ${column} = ? WHERE id = ?`, [value, deduction]), ABORT.ledger_no_update);
        });
      }

      test('even an UPDATE that changes nothing, or one aimed at every row, is refused', () => {
        const { sql, deduction } = ledger();
        refuses(sql, () => sql.run('UPDATE ledger_entries SET points = points WHERE id = ?', [deduction]), ABORT.ledger_no_update);
        refuses(sql, () => sql.run('UPDATE ledger_entries SET points = 0, xp = 1'), ABORT.ledger_no_update);
        refuses(sql, () => sql.run("UPDATE OR IGNORE ledger_entries SET reason = 'Quietly changed' WHERE id = ?", [deduction]), ABORT.ledger_no_update);
        refuses(sql, () => sql.run("UPDATE OR REPLACE ledger_entries SET idempotency_key = 'req:usr_root:moved' WHERE id = ?", [deduction]), ABORT.ledger_no_update);
      });

      test('DELETE of one entry, of a member\'s entries and of every entry is refused', () => {
        const { sql, deduction } = ledger();
        refuses(sql, () => sql.run('DELETE FROM ledger_entries WHERE id = ?', [deduction]), ABORT.ledger_no_delete);
        refuses(sql, () => sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada'"), ABORT.ledger_no_delete);
        refuses(sql, () => sql.run('DELETE FROM ledger_entries'), ABORT.ledger_no_delete);
        refuses(sql, () => sql.all('DELETE FROM ledger_entries WHERE id = ? RETURNING id', [deduction]), ABORT.ledger_no_delete);
      });

      test('INSERT OR REPLACE and REPLACE INTO cannot overwrite an entry by key or by id', () => {
        const { sql, deduction } = ledger();
        const key = keyOf(sql, deduction);
        refuses(sql, () => insert(sql, 'ledger_entries', replacement(key), { verb: 'INSERT OR REPLACE' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', replacement(key), { verb: 'REPLACE' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', { ...replacement('req:usr_root:fresh-key'), id: deduction, member_id: 'mbr_bo' }, { verb: 'INSERT OR REPLACE' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', { ...replacement('req:usr_root:fresh-key'), id: deduction }, { verb: 'REPLACE' }), ABORT.ledger_no_replace);
      });

      test('an UPSERT cannot rewrite an entry, and a duplicate is refused rather than silently ignored', () => {
        const { sql, deduction } = ledger();
        const key = keyOf(sql, deduction);
        refuses(sql, () => insert(sql, 'ledger_entries', replacement(key), { tail: 'ON CONFLICT (idempotency_key) DO UPDATE SET points = 500' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', { ...replacement('req:usr_root:fresh-key'), id: deduction }, { tail: 'ON CONFLICT (id) DO UPDATE SET points = excluded.points' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', replacement(key), { tail: 'ON CONFLICT DO NOTHING' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', replacement(key), { verb: 'INSERT OR IGNORE' }), ABORT.ledger_no_replace);
        refuses(sql, () => insert(sql, 'ledger_entries', replacement(key)), ABORT.ledger_no_replace);
      });

      test('legal: a correction is a new entry, and the balance is the sum of all of them', () => {
        const { sql, deduction } = ledger();
        assert.deepEqual(balance(sql), { earned: 0, bonus: 30, xp: 5 });
        entry(sql, { points: -5, reason: 'Second deduction' });
        reversal(sql, deduction);
        assert.deepEqual(balance(sql), { earned: 0, bonus: 45, xp: 5 });
        assert.equal(count(sql, 'ledger_entries'), 4);
      });
    });
  }

  test('ledger_no_replace is what holds this promise when recursive_triggers is OFF', () => {
    // Without it, REPLACE deletes the old row without firing ledger_no_delete. Proving the
    // trigger is necessary guards against someone "simplifying" it away.
    const without = cast(openBare({ recursiveTriggers: false }));
    const deduction = entry(without, { points: 50 });
    dropTrigger(without, 'ledger_no_replace');
    insert(without, 'ledger_entries', { ...entryRow({ points: 500 }), id: deduction }, { verb: 'INSERT OR REPLACE' });
    assert.equal(without.get('SELECT points FROM ledger_entries WHERE id = ?', [deduction]).points, 500, 'the row was rewritten in place');

    // With recursive_triggers ON the delete trigger fires for the replaced row, so the two layers overlap.
    const layered = cast(openBare());
    const kept = entry(layered, { points: 50 });
    dropTrigger(layered, 'ledger_no_replace');
    refuses(layered, () => insert(layered, 'ledger_entries', { ...entryRow({ points: 500 }), id: kept }, { verb: 'INSERT OR REPLACE' }), ABORT.ledger_no_delete);
  });

  test('ids are handed out in order and never go back', () => {
    const sql = stage();
    const first = entry(sql, { points: 5 });
    const second = entry(sql, { points: 5 });
    assert.equal(second, first + 1);
    refuses(sql, () => entry(sql, { id: first, points: 9 }), ABORT.ledger_no_replace);
    assert.equal(sql.get("SELECT seq FROM sqlite_sequence WHERE name = 'ledger_entries'").seq, second);
  });

  test('an entry written with id -1 does not lock the ledger for everyone afterwards', DEFECT('in a BEFORE INSERT trigger an auto-assigned id reads as -1, so one row with id -1 makes ledger_no_replace refuse every later insert'), () => {
    const sql = stage();
    attempt(() => entry(sql, { id: -1, points: 5 }));
    assert.doesNotThrow(() => entry(sql, { points: 5 }));
  });

  test('an entry written with the largest possible id does not exhaust the id space', DEFECT('explicit ids are accepted, and AUTOINCREMENT can never follow 9223372036854775807: every later insert fails with "database or disk is full"'), () => {
    const sql = stage();
    attempt(() => entry(sql, { id: 9223372036854775807n, points: 5 }));
    assert.doesNotThrow(() => entry(sql, { points: 5 }));
  });
});

// ---------------------------------------------------------------------------
// P5
// ---------------------------------------------------------------------------

describe("P5  A correction can be undone exactly once, mirrors its target, and counts in its target's month. Undoing an award revokes the claim", () => {
  const mustMirror = ABORT.ledger_reversal_must_mirror;

  /** Both members hold plenty, so a refusal here is never the never-negative rule. */
  const funded = () => {
    const sql = stage();
    entry(sql, { points: 500, xp: 500, reason: 'Float' });
    entry(sql, { member_id: 'mbr_bo', points: 500, xp: 500, reason: 'Float' });
    const credit = entry(sql, { points: 50, xp: 5, reason: 'Credit' });
    const deduction = entry(sql, { points: -20, xp: -2, reason: 'Deduction' });
    return { sql, credit, deduction };
  };

  test('legal: the exact mirror of an entry undoes it', () => {
    const { sql, credit, deduction } = funded();
    const before = balance(sql);
    const undoCredit = reversal(sql, credit, { created_at: at(10) });
    const undoDeduction = reversal(sql, deduction, { created_at: T0 });
    assert.deepEqual(balance(sql), { earned: 0, bonus: before.bonus - 50 + 20, xp: before.xp - 5 + 2 });
    const row = sql.get('SELECT kind, points, xp, bucket, period, reverses_entry_id, idempotency_key FROM ledger_entries WHERE id = ?', [undoCredit]);
    assert.deepEqual({ ...row }, { kind: 'reversal', points: -50, xp: -5, bucket: 'bonus', period: PERIOD, reverses_entry_id: credit, idempotency_key: `reversal:${credit}` });
    assert.ok(undoDeduction > undoCredit);
  });

  test('an entry can be undone once: a second reversal is refused', () => {
    const { sql, deduction } = funded();
    reversal(sql, deduction);
    refuses(sql, () => reversal(sql, deduction), ABORT.ledger_no_replace);
    refuses(sql, () => reversal(sql, deduction, { created_at: at(60), reason: 'Undone again', actor_user_id: 'usr_bo' }), ABORT.ledger_no_replace);
  });

  test('beneath the trigger, a unique index allows one reversal per entry', () => {
    const sql = cast(openBare());
    entry(sql, { points: 500 });
    const deduction = entry(sql, { points: -20 });
    reversal(sql, deduction);
    dropTrigger(sql, 'ledger_no_replace');
    refuses(sql, () => reversal(sql, deduction), UNIQUE('ledger_entries.'));
    sql.exec('PRAGMA ignore_check_constraints = ON');
    refuses(sql, () => reversal(sql, deduction, { idempotency_key: 'reversal:under-another-key' }), UNIQUE('ledger_entries.reverses_entry_id'));
  });

  test('a reversal cannot itself be reversed', () => {
    const { sql, deduction } = funded();
    const undo = reversal(sql, deduction);
    refuses(sql, () => reversal(sql, undo), mustMirror);
  });

  test('a reversal that is not the exact mirror is refused', () => {
    const { sql, credit, deduction } = funded();
    for (const forged of [{ points: -49 }, { points: -51 }, { points: 0 }, { xp: -4 }, { xp: 0 }, { points: 50, xp: 5 }, { points: -5, xp: -50 }]) {
      refuses(sql, () => reversal(sql, credit, forged), mustMirror);
    }
    refuses(sql, () => reversal(sql, credit, { member_id: 'mbr_bo' }), mustMirror);
    refuses(sql, () => reversal(sql, deduction, { bucket: 'earned' }), mustMirror);
    refuses(sql, () => reversal(sql, deduction, { points: 19 }), mustMirror);
  });

  test('a reversal needs a target that exists, and only a reversal may name one', () => {
    const { sql, credit } = funded();
    refuses(sql, () => entry(sql, { kind: 'reversal', points: 5, reverses_entry_id: 9999, idempotency_key: 'reversal:9999' }), mustMirror);
    refuses(sql, () => entry(sql, { kind: 'reversal', points: 5, idempotency_key: 'reversal:1' }), mustMirror);
    const reversalNamesTarget = CHECK("(kind = 'reversal') = (reverses_entry_id IS NOT NULL)");
    refuses(sql, () => entry(sql, { kind: 'adjustment', points: 5, reverses_entry_id: credit }), reversalNamesTarget);
    refuses(sql, () => entry(sql, { kind: 'bonus', points: 5, reverses_entry_id: credit }), reversalNamesTarget);
  });

  test('a reversal is never dated before its target', () => {
    const { sql, credit, deduction } = funded();
    refuses(sql, () => reversal(sql, credit, { created_at: at(-1) }), mustMirror);
    refuses(sql, () => reversal(sql, deduction, { created_at: '2026-11-01T00:00:00.000Z' }), mustMirror);
    reversal(sql, credit, { created_at: T0 });
    assert.equal(count(sql, 'ledger_entries', "kind = 'reversal'"), 1);
  });

  test("a reversal counts in its target's month, whenever it is written", () => {
    const sql = stage();
    entry(sql, { points: 500, reason: 'Float' });
    const october = entry(sql, { points: 50, period: '2026-10', created_at: '2026-10-20T10:00:00.000Z' });
    refuses(sql, () => reversal(sql, october, { period: PERIOD }), mustMirror);
    refuses(sql, () => reversal(sql, october, { period: '2031-07' }), mustMirror);
    const undo = reversal(sql, october);
    assert.deepEqual({ ...sql.get('SELECT period, created_at FROM ledger_entries WHERE id = ?', [undo]) }, { period: '2026-10', created_at: T0 });
  });

  test('a reversal carries the competition of its target, or none when the target has none', () => {
    const { sql, credit } = funded();
    competition(sql, 'cmp_one');
    competition(sql, 'cmp_two');
    const prize = entry(sql, { kind: 'bonus', points: 30, competition_id: 'cmp_one' });
    refuses(sql, () => reversal(sql, credit, { competition_id: 'cmp_one' }), mustMirror);
    refuses(sql, () => reversal(sql, prize, { competition_id: null }), mustMirror);
    refuses(sql, () => reversal(sql, prize, { competition_id: 'cmp_two' }), mustMirror);
    const undoPrize = reversal(sql, prize);
    reversal(sql, credit);
    assert.equal(sql.get('SELECT competition_id FROM ledger_entries WHERE id = ?', [undoPrize]).competition_id, 'cmp_one');
  });

  test('legal: undoing an award revokes its claim and records who, when and why', () => {
    const sql = stage();
    user(sql, 'usr_second', { role: 'admin' });
    const { claimId, awardId } = approvedClaim(sql);
    const before = claimOf(sql, claimId);
    reversal(sql, awardId, { created_at: at(45), actor_user_id: 'usr_second', reason: 'Copied from another submission' });
    const after = claimOf(sql, claimId);
    assert.equal(after.decision, 'revoked');
    assert.equal(after.decided_at, at(45));
    assert.equal(after.decided_by, 'usr_second');
    assert.equal(after.decision_note, 'Copied from another submission');
    assert.equal(after.verification_status, before.verification_status);
    assert.equal(after.verified_at, before.verified_at);
    assert.deepEqual(balance(sql), { earned: 0, bonus: 0, xp: 0 });
    witness('ledger_reversal_revokes_claim');
  });

  test('undoing something that is not an award touches no claim', () => {
    const { sql, credit } = funded();
    const { claimId } = approvedClaim(sql);
    const before = claimOf(sql, claimId);
    reversal(sql, credit);
    assert.deepEqual(claimOf(sql, claimId), before);
  });

  test('a revoked claim cannot be awarded again, and its award cannot be reversed again', () => {
    const sql = stage();
    const { claimId, awardId } = approvedClaim(sql);
    reversal(sql, awardId);
    refuses(sql, () => award(sql, claimId), either(ABORT.ledger_no_replace, ABORT.ledger_award_requires_reviewed_claim));
    refuses(sql, () => reversal(sql, awardId), either(ABORT.ledger_no_replace, ABORT.ledger_never_negative));
    assert.equal(claimOf(sql, claimId).decision, 'revoked');
  });
});

// ---------------------------------------------------------------------------
// P6
// ---------------------------------------------------------------------------

describe('P6  Engagement (likes, comments, views, follows) has NO path to points', () => {
  const POINT_TABLES = ['ledger_entries', 'claims', 'task_types', 'competitions', 'tiers', 'settings'];
  const columnsOf = (sql, table) => sql.all(`SELECT name FROM pragma_table_info('${table}')`).map((column) => column.name);
  const tablesOf = (sql) => sql.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((table) => table.name);

  test('platform statistics live in three columns of one table, and nothing references them', () => {
    const sql = openApplication();
    const statistics = tablesOf(sql).flatMap((table) => columnsOf(sql, table).filter((column) => column.startsWith('stats')).map((column) => `${table}.${column}`));
    assert.deepEqual(statistics, ['videos.stats_json', 'videos.stats_source', 'videos.stats_fetched_at']);
    const everything = sql.all("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
    assert.deepEqual(everything.filter((object) => object.type === 'view'), [], 'no view derives anything');
    assert.deepEqual(everything.filter((object) => object.type === 'trigger' && object.tbl_name === 'videos'), [], 'no trigger fires on videos');
    assert.deepEqual(everything.filter((object) => object.tbl_name !== 'videos' && /stats/i.test(object.sql ?? '')).map((object) => object.name), []);
  });

  test('a ledger entry can point at a member, a claim, another entry or a competition, and at nothing else', () => {
    const sql = openApplication();
    const parents = (table) => [...new Set(sql.all(`SELECT "table" AS parent FROM pragma_foreign_key_list('${table}')`).map((row) => row.parent))].sort();
    assert.deepEqual(parents('ledger_entries'), ['claims', 'competitions', 'ledger_entries', 'members']);
    assert.deepEqual(parents('claims'), ['members', 'task_types', 'users', 'videos']);
    assert.deepEqual(parents('task_types'), []);
  });

  test('no column of a table that carries points is named after an engagement action', () => {
    const sql = openApplication();
    const names = POINT_TABLES.flatMap((table) => [table, ...columnsOf(sql, table).map((column) => `${table}.${column}`)]);
    assert.ok(names.length > 50);
    assert.deepEqual(names.filter((name) => findEngagementWord(name.replace(/[._]/g, ' ')) !== null), []);
  });

  test('nothing anywhere in the schema is named in terms of payment', () => {
    const sql = openApplication();
    const names = [
      ...tablesOf(sql).flatMap((table) => [table, ...columnsOf(sql, table)]),
      ...sql.all("SELECT name FROM sqlite_master WHERE type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%'").map((object) => object.name),
    ];
    assert.deepEqual(names.filter((name) => findMoneyTerm(name.replace(/_/g, ' ')) !== null), []);
  });

  test('the only kinds of entry are the four contribution kinds, and the only automatic check is video ownership', () => {
    const sql = stage();
    refuses(sql, () => entry(sql, { kind: 'engagement', points: 5 }), CHECK("kind IN ('task_award', 'bonus', 'adjustment', 'reversal')"));
    refuses(sql, () => entry(sql, { bucket: 'engagement', points: 5 }), CHECK("bucket IN ('earned', 'bonus')"));
    refuses(sql, () => taskType(sql, 'tsk_counted', { api_check: 'engagement_count' }), CHECK("api_check IN ('none', 'video_ownership')"));
    refuses(sql, () => sql.run("UPDATE task_types SET api_check = 'engagement_count' WHERE id = 'tsk_feedback'"), CHECK("api_check IN ('none', 'video_ownership')"));
  });

  test('changing a video\'s statistics changes nobody\'s points', () => {
    const sql = stage();
    approvedClaim(sql, { video_id: 'vid_yt' });
    const ledgerBefore = snapshot(sql).ledger_entries;
    sql.run("UPDATE videos SET stats_json = ?, stats_source = 'mock_adapter', stats_fetched_at = ? WHERE id = 'vid_yt'", [JSON.stringify({ views: 9_000_000, likes: 800_000, comments: 70_000 }), T0]);
    sql.run("UPDATE videos SET stats_json = NULL, stats_source = NULL, stats_fetched_at = NULL WHERE id = 'vid_yt'");
    assert.deepEqual(snapshot(sql).ledger_entries, ledgerBefore);
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 });
  });
});

// ---------------------------------------------------------------------------
// P7
// ---------------------------------------------------------------------------

describe('P7  Erasing a member removes their rows for real, is all-or-nothing, and is the ONLY way ledger rows or claims are ever deleted', () => {
  /** mbr_ada: an approved claim, a deduction and its reversal, a pending claim. mbr_bo: an approved claim and a pending one. */
  const populated = (open) => {
    const sql = cast(open());
    const ada = approvedClaim(sql);
    const adaDeduction = entry(sql, { bucket: 'earned', points: -5 });
    reversal(sql, adaDeduction);
    const adaPending = claim(sql, { video_id: 'vid_yt' });
    const bo = approvedClaim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    const boPending = claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    audit(sql, { action: 'ledger.adjust', entity_type: 'ledger_entry', entity_id: String(adaDeduction), subject_member_id: 'mbr_ada', detail: '{"points":-5}' });
    session(sql, { user_id: 'usr_ada' });
    return { sql, ada, adaDeduction, adaPending, bo, boPending };
  };

  const eraseByHand = (sql, memberId) => {
    sql.exec('BEGIN IMMEDIATE');
    setGuard(sql, memberId);
    sql.run('DELETE FROM ledger_entries WHERE member_id = ?', [memberId]);
    sql.run('DELETE FROM claims WHERE member_id = ?', [memberId]);
    sql.run('UPDATE audit_log SET detail = NULL WHERE subject_member_id = ? AND detail IS NOT NULL', [memberId]);
    sql.run('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE member_id = ?)', [memberId]);
    sql.run('DELETE FROM users WHERE member_id = ?', [memberId]);
    sql.run('DELETE FROM members WHERE id = ?', [memberId]);
    setGuard(sql, null);
    sql.exec('COMMIT');
  };

  for (const connection of Object.values(CONNECTIONS)) {
    describe(connection.label, () => {
      test('with no erasure in progress, no claim can be deleted', () => {
        const { sql, ada, adaPending } = populated(connection.open);
        refuses(sql, () => sql.run('DELETE FROM claims WHERE id = ?', [adaPending]), ABORT.claims_no_delete);
        refuses(sql, () => sql.run('DELETE FROM claims WHERE id = ?', [ada.claimId]), ABORT.claims_no_delete);
        refuses(sql, () => sql.run("DELETE FROM claims WHERE decision = 'pending'"), ABORT.claims_no_delete);
        refuses(sql, () => sql.run('DELETE FROM claims'), ABORT.claims_no_delete);
      });

      test('the guard set for one member unlocks nobody else\'s ledger rows or claims', () => {
        const { sql, bo, boPending } = populated(connection.open);
        setGuard(sql, 'mbr_ada');
        refuses(sql, () => sql.run('DELETE FROM ledger_entries WHERE id = ?', [bo.awardId]), ABORT.ledger_no_delete);
        refuses(sql, () => sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_bo'"), ABORT.ledger_no_delete);
        refuses(sql, () => sql.run('DELETE FROM ledger_entries'), ABORT.ledger_no_delete);
        refuses(sql, () => sql.run('DELETE FROM claims WHERE id = ?', [boPending]), ABORT.claims_no_delete);
        refuses(sql, () => sql.run('DELETE FROM claims'), either(ABORT.claims_no_delete, FOREIGN_KEY));
        refuses(sql, () => sql.run('UPDATE ledger_entries SET points = 0 WHERE member_id = ?', ['mbr_ada']), ABORT.ledger_no_update);
      });

      test('the guard can only name an existing member, and only one at a time', () => {
        const { sql } = populated(connection.open);
        refuses(sql, () => setGuard(sql, 'mbr_nobody'), ABORT.erasure_guard_set);
        refuses(sql, () => setGuard(sql, ''), ABORT.erasure_guard_set);
        setGuard(sql, 'mbr_ada');
        refuses(sql, () => setGuard(sql, 'mbr_bo'), ABORT.erasure_guard_set);
        refuses(sql, () => setGuard(sql, 'mbr_ada'), ABORT.erasure_guard_set);
        assert.equal(guard(sql), 'mbr_ada');
      });

      test('the guard cannot be cleared while the member still exists', () => {
        const { sql, adaDeduction } = populated(connection.open);
        setGuard(sql, 'mbr_ada');
        refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
        sql.run('DELETE FROM ledger_entries WHERE reverses_entry_id = ?', [adaDeduction]);
        sql.run('DELETE FROM ledger_entries WHERE id = ?', [adaDeduction]);
        refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
        assert.equal(guard(sql), 'mbr_ada');
      });

      test('the guard row is permanent and there is exactly one', () => {
        const { sql } = populated(connection.open);
        refuses(sql, () => sql.run('INSERT INTO erasure_guard (id, member_id) VALUES (2, NULL)'), ABORT.erasure_guard_no_insert);
        refuses(sql, () => sql.run("INSERT INTO erasure_guard (id, member_id) VALUES (1, 'mbr_ada')"), ABORT.erasure_guard_no_insert);
        refuses(sql, () => sql.run("INSERT OR REPLACE INTO erasure_guard (id, member_id) VALUES (1, 'mbr_ada')"), ABORT.erasure_guard_no_insert);
        refuses(sql, () => sql.run("REPLACE INTO erasure_guard (id, member_id) VALUES (1, 'mbr_ada')"), ABORT.erasure_guard_no_insert);
        refuses(sql, () => sql.run('INSERT OR IGNORE INTO erasure_guard (id, member_id) VALUES (1, NULL)'), ABORT.erasure_guard_no_insert);
        refuses(sql, () => sql.run('DELETE FROM erasure_guard'), ABORT.erasure_guard_no_delete);
        refuses(sql, () => sql.run('DELETE FROM erasure_guard WHERE id = 1'), ABORT.erasure_guard_no_delete);
        refuses(sql, () => sql.run('UPDATE erasure_guard SET id = 2'), CHECK('id = 1'));
        assert.deepEqual(sql.all('SELECT id, member_id FROM erasure_guard').map((row) => ({ ...row })), [{ id: 1, member_id: null }]);
      });

      test('while an erasure is in progress nothing is written to the ledger or to claims, for anyone', () => {
        const { sql, boPending } = populated(connection.open);
        markReviewed(sql, boPending);
        setGuard(sql, 'mbr_ada');
        refuses(sql, () => entry(sql, { points: 5 }), ABORT.ledger_no_insert_during_erasure);
        refuses(sql, () => entry(sql, { member_id: 'mbr_bo', points: 5 }), ABORT.ledger_no_insert_during_erasure);
        refuses(sql, () => award(sql, boPending), either(ABORT.ledger_no_insert_during_erasure));
        refuses(sql, () => claim(sql), ABORT.claims_no_insert_during_erasure);
        refuses(sql, () => claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo', video_id: 'vid_tt' }), ABORT.claims_no_insert_during_erasure);
      });

      test('legal: an erasure deletes the member\'s rows for real and leaves everyone else exactly as they were', () => {
        const { sql, bo } = populated(connection.open);
        const others = () => ({
          ledger: sql.all("SELECT * FROM ledger_entries WHERE member_id <> 'mbr_ada' ORDER BY id").map((row) => ({ ...row })),
          claims: sql.all("SELECT * FROM claims WHERE member_id <> 'mbr_ada' ORDER BY id").map((row) => ({ ...row })),
        });
        const before = others();
        eraseByHand(sql, 'mbr_ada');

        assert.equal(count(sql, 'ledger_entries', "member_id = 'mbr_ada'"), 0);
        assert.equal(count(sql, 'claims', "member_id = 'mbr_ada'"), 0);
        assert.equal(count(sql, 'members', "id = 'mbr_ada'"), 0);
        assert.equal(count(sql, 'users', "id = 'usr_ada'"), 0);
        assert.equal(count(sql, 'sessions'), 0);
        assert.equal(count(sql, 'audit_log', "subject_member_id = 'mbr_ada' AND detail IS NOT NULL"), 0);
        assert.equal(guard(sql), null);
        assert.deepEqual(others(), before);

        // The tables are locked again the moment the guard is clear.
        refuses(sql, () => sql.run('DELETE FROM ledger_entries WHERE id = ?', [bo.awardId]), ABORT.ledger_no_delete);
        refuses(sql, () => sql.run('DELETE FROM claims WHERE id = ?', [bo.claimId]), ABORT.claims_no_delete);
        refuses(sql, () => setGuard(sql, 'mbr_ada'), ABORT.erasure_guard_set);
      });

      test('all-or-nothing: a partial erasure cannot clear the guard, and rolling back restores every row', () => {
        const { sql, adaPending } = populated(connection.open);
        const before = snapshot(sql);
        sql.exec('BEGIN IMMEDIATE');
        setGuard(sql, 'mbr_ada');
        sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada' AND points < 0");
        sql.run('DELETE FROM claims WHERE id = ?', [adaPending]);
        refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
        sql.exec('ROLLBACK');
        assert.deepEqual(snapshot(sql), before);
      });

      test('a guard that was left set cannot go unnoticed: every later ledger and claim insert fails', () => {
        const { sql } = populated(connection.open);
        setGuard(sql, 'mbr_ada');
        sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada' AND kind = 'reversal'");
        refuses(sql, () => entry(sql, { member_id: 'mbr_bo', points: 5 }), ABORT.ledger_no_insert_during_erasure);
        refuses(sql, () => claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo', video_id: 'vid_tt' }), ABORT.claims_no_insert_during_erasure);
        refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
      });

      test('INSERT OR REPLACE, REPLACE INTO and UPSERT cannot delete or rewrite a claim', () => {
        const { sql, ada, boPending } = populated(connection.open);
        const overId = claimRow({ id: ada.claimId, member_id: 'mbr_bo', submitted_by: 'usr_bo', evidence_text: 'Swapped in over an approved claim.' });
        const overSubject = claimRow({ member_id: 'mbr_bo', submitted_by: 'usr_bo', evidence_text: claimOf(sql, boPending).evidence_text });
        for (const verb of ['INSERT OR REPLACE', 'REPLACE', 'INSERT OR IGNORE', 'INSERT']) {
          refuses(sql, () => insert(sql, 'claims', overId, { verb }), ABORT.claims_no_replace);
          refuses(sql, () => insert(sql, 'claims', { ...overSubject }, { verb }), ABORT.claims_no_replace);
        }
        refuses(sql, () => insert(sql, 'claims', overId, { tail: "ON CONFLICT (id) DO UPDATE SET evidence_text = 'rewritten'" }), ABORT.claims_no_replace);
        refuses(sql, () => insert(sql, 'claims', overId, { tail: 'ON CONFLICT DO NOTHING' }), ABORT.claims_no_replace);
      });
    });
  }

  test('with foreign keys on, the member row cannot go while a ledger row, a claim or an account still points at it', () => {
    const { sql } = populated(openApplication);
    setGuard(sql, 'mbr_ada');
    refuses(sql, () => sql.run("DELETE FROM members WHERE id = 'mbr_ada'"), FOREIGN_KEY);
    sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada'");
    refuses(sql, () => sql.run("DELETE FROM members WHERE id = 'mbr_ada'"), FOREIGN_KEY);
    sql.run("DELETE FROM claims WHERE member_id = 'mbr_ada'");
    refuses(sql, () => sql.run("DELETE FROM members WHERE id = 'mbr_ada'"), FOREIGN_KEY);
    refuses(sql, () => sql.run("UPDATE members SET id = 'mbr_renamed' WHERE id = 'mbr_ada'"), FOREIGN_KEY);
    sql.run("DELETE FROM users WHERE member_id = 'mbr_ada'");
    sql.run("DELETE FROM members WHERE id = 'mbr_ada'");
    setGuard(sql, null);
    assert.equal(guard(sql), null);
  });

  test('"gone" means deleted: renaming the member row does not let the guard clear', DEFECT('members.id can be changed, so after the ledger rows and claims are deleted the guard clears while the member row lives on under another id'), () => {
    const sql = stage();
    entry(sql, { points: 50 });
    setGuard(sql, 'mbr_ada');
    sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada'");
    sql.run("DELETE FROM users WHERE member_id = 'mbr_ada'");
    attempt(() => sql.run("UPDATE members SET id = 'mbr_parked' WHERE id = 'mbr_ada'"));
    refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
  });

  test('with recursive_triggers OFF, un-deciding a claim cannot delete another member-visible claim through REPLACE', DEFECT('UPDATE OR REPLACE ... SET decision = NULL re-enters the live index; with recursive_triggers OFF the conflicting pending claim is deleted without claims_no_delete firing'), () => {
    const sql = cast(openBare({ recursiveTriggers: false }));
    const text = 'One piece of feedback, submitted twice over time.';
    const rejected = claimIn(sql, 'rejected', { evidence_text: text });
    const resubmitted = claim(sql, { evidence_text: text });
    attempt(() => sql.run('UPDATE OR REPLACE claims SET decision = NULL, decided_at = NULL, decided_by = NULL, decision_note = NULL WHERE id = ?', [rejected]));
    assert.equal(count(sql, 'claims', 'id = ?', [resubmitted]), 1, 'the resubmitted claim was deleted outside an erasure');
  });
});

// ---------------------------------------------------------------------------
// P8
// ---------------------------------------------------------------------------

describe('P8  Nobody credits themselves: an account linked to a member can neither approve that member\'s claims nor write them a positive entry', () => {
  /** usr_ada becomes an admin who is also the member mbr_ada; mbr_ada already holds 50 / 50. */
  const selfLinkedAdmin = () => {
    const sql = stage();
    sql.run("UPDATE users SET role = 'admin', last_login_at = ? WHERE id = 'usr_ada'", [T0]);
    entry(sql, { points: 50, xp: 50, reason: 'Float' });
    return sql;
  };
  const self = { actor_user_id: 'usr_ada' };

  test('a linked account cannot write its member a bonus, a positive adjustment or XP', () => {
    const sql = selfLinkedAdmin();
    refuses(sql, () => entry(sql, { ...self, kind: 'bonus', points: 5 }), ABORT.ledger_no_self_credit);
    refuses(sql, () => entry(sql, { ...self, kind: 'bonus', xp: 5 }), ABORT.ledger_no_self_credit);
    refuses(sql, () => entry(sql, { ...self, points: 5 }), ABORT.ledger_no_self_credit);
    refuses(sql, () => entry(sql, { ...self, xp: 1 }), ABORT.ledger_no_self_credit);
    refuses(sql, () => entry(sql, { ...self, points: -5, xp: 5 }), ABORT.ledger_no_self_credit);
    refuses(sql, () => entry(sql, { ...self, points: 5, xp: -5 }), ABORT.ledger_no_self_credit);
    refuses(sql, () => entry(sql, { ...self, points: 100000, xp: 100000 }), ABORT.ledger_no_self_credit);
  });

  test('a linked account cannot award its own member\'s claim', () => {
    const sql = selfLinkedAdmin();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    refuses(sql, () => award(sql, claimId, self), ABORT.ledger_no_self_credit);
    refuses(sql, () => award(sql, claimId, self, { verb: 'INSERT OR IGNORE' }), ABORT.ledger_no_self_credit);
    assert.equal(claimOf(sql, claimId).decision, 'pending');
  });

  test('a linked account cannot undo a deduction on its own member: that is a credit too', () => {
    const sql = selfLinkedAdmin();
    const deduction = entry(sql, { points: -20, xp: -2 });
    refuses(sql, () => reversal(sql, deduction, self), ABORT.ledger_no_self_credit);
    const earnedDeduction = (() => {
      approvedClaim(sql);
      return entry(sql, { bucket: 'earned', points: -5 });
    })();
    refuses(sql, () => reversal(sql, earnedDeduction, self), ABORT.ledger_no_self_credit);
    reversal(sql, deduction);
    assert.equal(count(sql, 'ledger_entries', "kind = 'reversal'"), 1);
  });

  test('legal: a linked account may take away from its own member, credit other members, and be credited by someone else', () => {
    const sql = selfLinkedAdmin();
    const credit = entry(sql, { points: 10, xp: 1 });
    entry(sql, { ...self, points: -5, xp: -5 });
    reversal(sql, credit, self);
    entry(sql, { ...self, member_id: 'mbr_bo', kind: 'bonus', points: 5 });
    const bosClaim = claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    markReviewed(sql, bosClaim);
    award(sql, bosClaim, self);
    assert.equal(claimOf(sql, bosClaim).decided_by, 'usr_ada');
    const adasClaim = claim(sql);
    markReviewed(sql, adasClaim);
    award(sql, adasClaim, { actor_user_id: 'usr_bo' });
    assert.equal(claimOf(sql, adasClaim).decision, 'approved');
    assert.deepEqual(balance(sql), { earned: 25, bonus: 45, xp: 55 });
  });

  test('the rule follows the link as it is when the entry is written', () => {
    const sql = selfLinkedAdmin();
    member(sql, 'mbr_cy');
    sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_ada'");
    entry(sql, { ...self, points: 5 });
    refuses(sql, () => entry(sql, { ...self, member_id: 'mbr_cy', points: 5 }), ABORT.ledger_no_self_credit);
    sql.run("UPDATE users SET member_id = NULL WHERE id = 'usr_ada'");
    entry(sql, { ...self, member_id: 'mbr_cy', points: 5 });
  });

  test('beneath ledger_no_self_credit, the approval itself refuses a reviewer linked to the member', () => {
    const sql = selfLinkedAdmin();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    dropTrigger(sql, 'ledger_no_self_credit');
    refuses(sql, () => award(sql, claimId, self), ABORT.claims_no_self_approval);
    assert.equal(count(sql, 'ledger_entries', "kind = 'task_award'"), 0, 'the award row went with the refused approval');
  });

  test('an approval always has a recorded reviewer', () => {
    // With the trigger that normally performs the approval removed, the UPDATE can be attempted by hand.
    const sql = selfLinkedAdmin();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    dropTrigger(sql, 'ledger_award_approves_claim');
    award(sql, claimId);
    const approveAs = (decidedBy) => () => sql.run("UPDATE claims SET decision = 'approved', decided_at = ?, decided_by = ? WHERE id = ?", [T0, decidedBy, claimId]);
    refuses(sql, approveAs(null), ABORT.claims_no_self_approval);
    refuses(sql, approveAs('usr_ada'), ABORT.claims_no_self_approval);
    refuses(sql, approveAs('usr_nobody'), FOREIGN_KEY);
    approveAs('usr_bo')();
    assert.equal(claimOf(sql, claimId).decision, 'approved');
  });
});

// ---------------------------------------------------------------------------
// P9
// ---------------------------------------------------------------------------

describe('P9  There is always an admin who can sign in', () => {
  const lastAdminUpdate = ABORT.users_keep_one_admin_on_update;
  const lastAdminDelete = ABORT.users_keep_one_admin_on_delete;

  test('the last active, signed-in admin cannot be demoted, disabled, deleted or made to look never-signed-in', () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    assert.equal(workingAdmins(sql), 1);
    refuses(sql, () => sql.run("UPDATE users SET role = 'member', member_id = 'mbr_cy' WHERE id = 'usr_root'"), lastAdminUpdate);
    refuses(sql, () => sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_root'"), lastAdminUpdate);
    refuses(sql, () => sql.run("UPDATE users SET last_login_at = NULL WHERE id = 'usr_root'"), lastAdminUpdate);
    refuses(sql, () => sql.run("UPDATE users SET role = 'member', status = 'disabled', member_id = 'mbr_cy', last_login_at = NULL WHERE id = 'usr_root'"), lastAdminUpdate);
    refuses(sql, () => sql.run("DELETE FROM users WHERE id = 'usr_root'"), lastAdminDelete);
    refuses(sql, () => sql.run("DELETE FROM users WHERE role = 'admin'"), lastAdminDelete);
  });

  test('an admin who has never signed in, or who is disabled, does not count as the other admin', () => {
    const sql = stage();
    user(sql, 'usr_typo', { role: 'admin' });
    user(sql, 'usr_former', { role: 'admin', status: 'disabled', last_login_at: T0 });
    refuses(sql, () => sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_root'"), lastAdminUpdate);
    refuses(sql, () => sql.run("DELETE FROM users WHERE id = 'usr_root'"), lastAdminDelete);
    // Those two rows are not protected themselves: removing them leaves the working admin in place.
    sql.run("DELETE FROM users WHERE id = 'usr_typo'");
    sql.run("UPDATE users SET role = 'member', member_id = NULL, status = 'disabled' WHERE id = 'usr_former' AND 0");
    sql.run("DELETE FROM users WHERE id = 'usr_former'");
    assert.equal(workingAdmins(sql), 1);
  });

  test('legal: with two working admins either may go, and then the survivor is protected', () => {
    for (const leave of ["UPDATE users SET status = 'disabled' WHERE id = 'usr_second'", "DELETE FROM users WHERE id = 'usr_second'", "UPDATE users SET last_login_at = NULL WHERE id = 'usr_second'"]) {
      const sql = stage();
      user(sql, 'usr_second', { role: 'admin', last_login_at: T0 });
      sql.run(leave);
      assert.equal(workingAdmins(sql), 1);
      refuses(sql, () => sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_root'"), lastAdminUpdate);
      refuses(sql, () => sql.run("DELETE FROM users WHERE id = 'usr_root'"), lastAdminDelete);
    }
  });

  test('one statement cannot take out every admin at once', () => {
    const sql = stage();
    user(sql, 'usr_second', { role: 'admin', last_login_at: T0 });
    refuses(sql, () => sql.run("UPDATE users SET status = 'disabled' WHERE role = 'admin'"), lastAdminUpdate);
    refuses(sql, () => sql.run('UPDATE users SET last_login_at = NULL'), lastAdminUpdate);
    refuses(sql, () => sql.run("DELETE FROM users WHERE role = 'admin'"), lastAdminDelete);
    assert.equal(workingAdmins(sql), 2);
  });

  test('legal: everything else about the last admin may change', () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    sql.run("UPDATE users SET last_login_at = ? WHERE id = 'usr_root'", [at(5)]);
    sql.run("UPDATE users SET email = 'renamed@example.test' WHERE id = 'usr_root'");
    sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_root'");
    sql.run("UPDATE users SET role = 'admin', status = 'active' WHERE id = 'usr_root'");
    assert.equal(workingAdmins(sql), 1);
  });

  test('REPLACE cannot swap the last admin for a lesser row', () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    const lesser = { id: 'usr_root', email: 'usrroot@example.test', role: 'member', member_id: 'mbr_cy', created_at: T0 };
    refuses(sql, () => insert(sql, 'users', lesser, { verb: 'INSERT OR REPLACE' }), lastAdminDelete);
    refuses(sql, () => insert(sql, 'users', { ...lesser, id: 'usr_other' }, { verb: 'REPLACE' }), lastAdminDelete);
    refuses(sql, () => sql.run("UPDATE OR REPLACE users SET email = 'usrroot@example.test' WHERE id = 'usr_bo'"), lastAdminDelete);
    assert.equal(workingAdmins(sql), 1);
  });

  test('an account that is not an admin is attached to a member, and roles and states are a fixed list', () => {
    const sql = stage();
    refuses(sql, () => user(sql, 'usr_loose', { role: 'member' }), CHECK("role = 'admin' OR member_id IS NOT NULL"));
    refuses(sql, () => sql.run("UPDATE users SET member_id = NULL WHERE id = 'usr_ada'"), CHECK("role = 'admin' OR member_id IS NOT NULL"));
    refuses(sql, () => user(sql, 'usr_owner', { role: 'owner' }), CHECK("role IN ('admin', 'member')"));
    refuses(sql, () => sql.run("UPDATE users SET status = 'banned' WHERE id = 'usr_ada'"), CHECK("status IN ('active', 'disabled')"));
  });
});

// ---------------------------------------------------------------------------
// P10
// ---------------------------------------------------------------------------

describe('P10  The audit trail cannot be rewritten and holds no addresses or links', () => {
  const frozen = ABORT.audit_no_update;
  const REWRITES = {
    id: 999,
    at: at(1),
    actor_user_id: 'usr_bo',
    actor_role: 'system',
    action: 'nothing.happened',
    entity_type: 'thing',
    entity_id: 'other',
    subject_member_id: 'mbr_bo',
    detail: '{"points":5}',
    request_id: 'req_forged',
  };

  for (const connection of Object.values(CONNECTIONS)) {
    describe(connection.label, () => {
      /** One row about mbr_ada, one about mbr_bo, one about nobody (a settings change). */
      const trail = () => {
        const sql = cast(connection.open());
        const aboutAda = audit(sql, { action: 'ledger.adjust', entity_type: 'ledger_entry', entity_id: '17', subject_member_id: 'mbr_ada', detail: '{"points":-500}', request_id: 'req_1' });
        const aboutBo = audit(sql, { action: 'claim.reject', entity_type: 'claim', entity_id: 'clm_x', subject_member_id: 'mbr_bo', detail: '{"verification_status":"unverified"}' });
        const aboutNobody = audit(sql, { detail: '{"monthly_cap":300}' });
        return { sql, aboutAda, aboutBo, aboutNobody };
      };

      for (const [column, value] of Object.entries(REWRITES)) {
        test(`UPDATE of ${column} is refused`, () => {
          const { sql, aboutAda, aboutNobody } = trail();
          refuses(sql, () => sql.run(`UPDATE audit_log SET ${column} = ? WHERE id = ?`, [value, aboutAda]), frozen);
          refuses(sql, () => sql.run(`UPDATE audit_log SET ${column} = ? WHERE id = ?`, [value, aboutNobody]), frozen);
        });
      }

      test('outside an erasure not even the one permitted change (detail to NULL) is allowed', () => {
        const { sql, aboutAda, aboutNobody } = trail();
        refuses(sql, () => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutAda]), frozen);
        refuses(sql, () => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutNobody]), frozen);
        refuses(sql, () => sql.run('UPDATE audit_log SET detail = detail'), frozen);
        refuses(sql, () => sql.run('UPDATE OR REPLACE audit_log SET id = id WHERE id = ?', [aboutAda]), frozen);
        refuses(sql, () => sql.run('UPDATE OR REPLACE audit_log SET at = NULL WHERE id = ?', [aboutAda]), frozen);
      });

      test('no audit row is ever deleted, not even during an erasure of the member it is about', () => {
        const { sql, aboutAda } = trail();
        refuses(sql, () => sql.run('DELETE FROM audit_log WHERE id = ?', [aboutAda]), ABORT.audit_no_delete);
        refuses(sql, () => sql.run('DELETE FROM audit_log'), ABORT.audit_no_delete);
        setGuard(sql, 'mbr_ada');
        refuses(sql, () => sql.run('DELETE FROM audit_log WHERE id = ?', [aboutAda]), ABORT.audit_no_delete);
        refuses(sql, () => sql.run("DELETE FROM audit_log WHERE subject_member_id = 'mbr_ada'"), ABORT.audit_no_delete);
      });

      test('INSERT OR REPLACE, REPLACE INTO, UPSERT and INSERT OR IGNORE cannot overwrite a row', () => {
        const { sql, aboutAda } = trail();
        const over = { ...auditRow({ actor_role: 'system', action: 'nothing.happened', entity_type: 'thing' }), id: aboutAda };
        refuses(sql, () => insert(sql, 'audit_log', over, { verb: 'INSERT OR REPLACE' }), ABORT.audit_no_replace);
        refuses(sql, () => insert(sql, 'audit_log', over, { verb: 'REPLACE' }), ABORT.audit_no_replace);
        refuses(sql, () => insert(sql, 'audit_log', over, { tail: "ON CONFLICT (id) DO UPDATE SET action = 'nothing.happened'" }), ABORT.audit_no_replace);
        refuses(sql, () => insert(sql, 'audit_log', over, { tail: 'ON CONFLICT DO NOTHING' }), ABORT.audit_no_replace);
        refuses(sql, () => insert(sql, 'audit_log', over, { verb: 'INSERT OR IGNORE' }), ABORT.audit_no_replace);
        refuses(sql, () => insert(sql, 'audit_log', over), ABORT.audit_no_replace);
      });

      test('legal: during an erasure, detail of rows about THAT member may be set to NULL, and nothing else', () => {
        const { sql, aboutAda, aboutBo, aboutNobody } = trail();
        setGuard(sql, 'mbr_ada');
        refuses(sql, () => sql.run("UPDATE audit_log SET detail = '{\"points\":5}' WHERE id = ?", [aboutAda]), frozen);
        refuses(sql, () => sql.run("UPDATE audit_log SET detail = '' WHERE id = ?", [aboutAda]), frozen);
        refuses(sql, () => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutBo]), frozen);
        refuses(sql, () => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutNobody]), frozen);
        refuses(sql, () => sql.run('UPDATE audit_log SET detail = NULL'), frozen);
        // Scrubbing may not smuggle in a change to any other column, NULL on either side included.
        for (const change of ["actor_user_id = 'usr_bo'", 'actor_user_id = NULL', "entity_id = '99'", 'entity_id = NULL', "request_id = 'req_forged'", 'request_id = NULL', "subject_member_id = 'mbr_bo'", "action = 'nothing.happened'", "actor_role = 'system'", "entity_type = 'thing'", 'at = ?', 'id = 999']) {
          refuses(sql, () => sql.run(`UPDATE audit_log SET detail = NULL, ${change} WHERE id = ?`, change.includes('?') ? [at(1), aboutAda] : [aboutAda]), frozen);
        }
        const before = { ...sql.get('SELECT * FROM audit_log WHERE id = ?', [aboutAda]) };
        assert.equal(sql.run("UPDATE audit_log SET detail = NULL WHERE subject_member_id = 'mbr_ada'").changes, 1);
        assert.deepEqual({ ...sql.get('SELECT * FROM audit_log WHERE id = ?', [aboutAda]) }, { ...before, detail: null });
        assert.equal(count(sql, 'audit_log', 'detail IS NOT NULL'), 2);
      });
    });
  }

  test('detail is small, valid JSON with no address and no link in it', () => {
    const sql = stage();
    const impersonal = ABORT.audit_detail_is_impersonal;
    for (const detail of ['{"contact":"someone@example.test"}', '{"link":"https://example.test/x"}', '{"scheme":"ftp://files.example.test"}', '{"a@b":1}', 'not json', "{points:5}", "{'points':5}", '{"points":5', '', '   ', `{"padding":"${'x'.repeat(1990)}"}`]) {
      refuses(sql, () => audit(sql, { detail }), impersonal);
    }
    audit(sql, { detail: null });
    audit(sql, { detail: '{"points":5,"period":"2026-11","on_behalf":false,"claim_id":"clm_1"}' });
    audit(sql, { detail: `{"padding":"${'x'.repeat(1986)}"}` });
    assert.equal(sql.get('SELECT MAX(length(detail)) AS longest FROM audit_log').longest, 2000);
  });

  test('a row about a member says which member, so an erasure can find it', () => {
    const sql = stage();
    const needsSubject = ABORT.audit_member_rows_need_subject;
    for (const entityType of ['claim', 'ledger_entry', 'member']) {
      refuses(sql, () => audit(sql, { entity_type: entityType, entity_id: 'x1', action: 'thing.change' }), needsSubject);
      refuses(sql, () => audit(sql, { entity_type: entityType, actor_role: 'system', actor_user_id: null }), needsSubject);
      audit(sql, { entity_type: entityType, entity_id: 'x1', subject_member_id: 'mbr_ada' });
    }
    refuses(sql, () => audit(sql, { actor_role: 'member', actor_user_id: 'usr_ada', action: 'auth.login', entity_type: 'user' }), needsSubject);
    audit(sql, { actor_role: 'member', actor_user_id: 'usr_ada', action: 'auth.login', entity_type: 'user', subject_member_id: 'mbr_ada' });
    audit(sql, { actor_role: 'system', actor_user_id: null, action: 'tiers.install_defaults', entity_type: 'tiers' });
    assert.equal(count(sql, 'audit_log'), 5);
  });

  test('an audit row has a well-formed time and a known kind of actor', () => {
    const sql = stage();
    const timeRule = CHECK("at IS strftime('%Y-%m-%dT%H:%M:%fZ', at)");
    for (const when of ['2026-11-09 20:00:00', '2026-11-09T20:00:00Z', 'yesterday', '']) refuses(sql, () => audit(sql, { at: when }), timeRule);
    refuses(sql, () => audit(sql, { at: null }), NOT_NULL('audit_log.at'));
    refuses(sql, () => audit(sql, { actor_role: 'superuser' }), CHECK("actor_role IN ('admin', 'member', 'system')"));
    refuses(sql, () => audit(sql, { action: null }), NOT_NULL('audit_log.action'));
    refuses(sql, () => audit(sql, { entity_type: null }), NOT_NULL('audit_log.entity_type'));
  });

  test('an address or a link hidden behind a JSON escape is still refused', DEFECT('audit_detail_is_impersonal looks for the literal characters, so "\\u0040" and ":\\/\\/" store an address or a link that JSON.parse gives back'), () => {
    const sql = stage();
    refuses(sql, () => audit(sql, { detail: '{"contact":"someone\\u0040example.test"}' }), ANY_REFUSAL);
    refuses(sql, () => audit(sql, { detail: '{"link":"https:\\/\\/example.test\\/x"}' }), ANY_REFUSAL);
    refuses(sql, () => audit(sql, { detail: '{"link":"https\\u003a//example.test/x"}' }), ANY_REFUSAL);
  });

  test('the columns that can never be scrubbed hold no address and no link either', DEFECT('only detail is checked: entity_id, request_id, action, actor_user_id, entity_type and subject_member_id accept an address or a link, and no erasure can ever remove it'), () => {
    const sql = stage();
    refuses(sql, () => audit(sql, { entity_type: 'user', entity_id: 'someone@example.test' }), ANY_REFUSAL);
    refuses(sql, () => audit(sql, { request_id: 'https://example.test/from-a-header' }), ANY_REFUSAL);
    refuses(sql, () => audit(sql, { action: 'sign-in of someone@example.test' }), ANY_REFUSAL);
    refuses(sql, () => audit(sql, { actor_user_id: 'someone@example.test' }), ANY_REFUSAL);
  });

  test('an audit row written with id -1 does not stop every later audit row', DEFECT('in a BEFORE INSERT trigger an auto-assigned id reads as -1, so one row with id -1 makes audit_no_replace refuse every later insert; the row can never be removed'), () => {
    const sql = stage();
    attempt(() => insert(sql, 'audit_log', { ...auditRow(), id: -1 }));
    assert.doesNotThrow(() => audit(sql));
  });
});

// ---------------------------------------------------------------------------
// P11
// ---------------------------------------------------------------------------

describe('P11  No points bucket and no XP total ever goes below zero', () => {
  const negative = ABORT.ledger_never_negative;

  test('nothing can be taken from an empty balance', () => {
    const sql = stage();
    refuses(sql, () => entry(sql, { points: -1 }), negative);
    refuses(sql, () => entry(sql, { bucket: 'earned', points: -1 }), negative);
    refuses(sql, () => entry(sql, { xp: -1 }), negative);
    refuses(sql, () => entry(sql, { bucket: 'earned', xp: -1 }), negative);
    refuses(sql, () => entry(sql, { points: -100000, xp: -100000 }), negative);
  });

  test('each bucket stands alone: points in "bonus" do not cover a deduction from "earned", or the other way round', () => {
    const sql = stage();
    entry(sql, { points: 50 });
    refuses(sql, () => entry(sql, { bucket: 'earned', points: -10 }), negative);
    const other = stage();
    approvedClaim(other);
    refuses(other, () => entry(other, { bucket: 'bonus', points: -10 }), negative);
    assert.deepEqual(balance(other), { earned: 25, bonus: 0, xp: 10 });
  });

  test('legal: a balance may be taken to exactly zero, and not one further', () => {
    const sql = stage();
    entry(sql, { points: 50, xp: 7 });
    refuses(sql, () => entry(sql, { points: -51 }), negative);
    refuses(sql, () => entry(sql, { xp: -8 }), negative);
    entry(sql, { points: -50, xp: -7 });
    assert.deepEqual(balance(sql), { earned: 0, bonus: 0, xp: 0 });
    refuses(sql, () => entry(sql, { points: -1 }), negative);
  });

  test('XP is one total across both buckets', () => {
    const sql = stage();
    approvedClaim(sql);
    entry(sql, { bucket: 'bonus', xp: -10 });
    assert.equal(balance(sql).xp, 0);
    refuses(sql, () => entry(sql, { bucket: 'earned', xp: -1 }), negative);
    refuses(sql, () => entry(sql, { bucket: 'earned', points: -5, xp: -1 }), negative);
  });

  test('an entry that adds points cannot hide an XP overdraft, and vice versa', () => {
    const sql = stage();
    entry(sql, { points: 10, xp: 10 });
    refuses(sql, () => entry(sql, { points: 5, xp: -11 }), negative);
    refuses(sql, () => entry(sql, { points: -11, xp: 5 }), negative);
    entry(sql, { points: 5, xp: -10 });
    assert.deepEqual(balance(sql), { earned: 0, bonus: 15, xp: 0 });
  });

  test('a credit that has been spent cannot be reversed until the spending is undone', () => {
    const sql = stage();
    const credit = entry(sql, { points: 50, xp: 5 });
    const spent = entry(sql, { points: -30 });
    refuses(sql, () => reversal(sql, credit), negative);
    reversal(sql, spent);
    reversal(sql, credit);
    assert.deepEqual(balance(sql), { earned: 0, bonus: 0, xp: 0 });
  });

  test('an award cannot be reversed while a deduction has already used it up', () => {
    const sql = stage();
    const { claimId, awardId } = approvedClaim(sql);
    entry(sql, { bucket: 'earned', points: -25 });
    refuses(sql, () => reversal(sql, awardId), negative);
    assert.equal(claimOf(sql, claimId).decision, 'approved');
    const xpOnly = stage();
    const second = approvedClaim(xpOnly);
    entry(xpOnly, { bucket: 'bonus', xp: -4 });
    refuses(xpOnly, () => reversal(xpOnly, second.awardId), negative);
  });

  test('a multi-row statement is judged row by row and fails as a whole', () => {
    const sql = stage();
    entry(sql, { points: 15 });
    const row = (key) => `('mbr_ada', 'adjustment', 'bonus', -10, 0, '${key}', 'Two at once', 'usr_root', '${PERIOD}', '${T0}')`;
    refuses(
      sql,
      () => sql.run(`INSERT INTO ledger_entries (member_id, kind, bucket, points, xp, idempotency_key, reason, actor_user_id, period, created_at) VALUES ${row('req:usr_root:two-a')}, ${row('req:usr_root:two-b')}`),
      negative,
    );
    refuses(sql, () => entry(sql, { points: -16 }, { verb: 'INSERT OR IGNORE' }), negative);
    assert.deepEqual(balance(sql), { earned: 0, bonus: 15, xp: 0 });
  });

  test('one entry moves at most 100000 either way, and never nothing', () => {
    const sql = stage();
    entry(sql, { points: 100000, xp: 100000 });
    refuses(sql, () => entry(sql, { points: 100001 }), CHECK('points BETWEEN -100000 AND 100000'));
    refuses(sql, () => entry(sql, { xp: 100001 }), CHECK('xp BETWEEN -100000 AND 100000'));
    refuses(sql, () => entry(sql, { points: 0, xp: 0 }), CHECK('points <> 0 OR xp <> 0'));
    refuses(sql, () => entry(sql, { points: null, xp: 5 }), NOT_NULL('ledger_entries.points'));
    entry(sql, { points: -100000, xp: -100000 });
    assert.deepEqual(balance(sql), { earned: 0, bonus: 0, xp: 0 });
  });
});

// ---------------------------------------------------------------------------
// P12
// ---------------------------------------------------------------------------

describe('P12  "verified" means a platform attested it; "manually reviewed" means a person did. A decided claim\'s evidence and verification never change afterwards', () => {
  const needsAttestation = ABORT.claims_verified_needs_attestable_task;
  const immutable = ABORT.claims_identity_is_immutable;
  const decidedIsFrozen = ABORT.claims_decided_is_frozen;
  const creative = (overrides = {}) => ({ task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20, evidence_text: null, ...overrides });
  const verify = (sql, claimId, source) => sql.run("UPDATE claims SET verification_status = 'verified', verification_source = ?, verified_at = ?, verification_detail = '{\"check\":\"video_ownership\"}' WHERE id = ?", [source, T0, claimId]);

  const EVIDENCE = {
    'a YouTube link': { evidence_url: 'https://www.youtube.com/watch?v=untracked01', subject_key: 'url:youtube/untracked01' },
    'a TikTok link': { evidence_url: 'https://www.tiktok.com/@someone/video/7399999999999999999', subject_key: 'url:tiktok/7399999999999999999' },
    'a link elsewhere': { evidence_url: 'https://example.test/my-own-video', subject_key: 'url:https://example.test/my-own-video' },
    'a tracked YouTube video': { video_id: 'vid_yt' },
    'a tracked TikTok video': { video_id: 'vid_tt' },
  };
  const ATTESTATIONS = [
    ['a YouTube link', 'youtube_api', true],
    ['a YouTube link', 'tiktok_api', false],
    ['a YouTube link', 'mock_adapter', true],
    ['a TikTok link', 'tiktok_api', true],
    ['a TikTok link', 'youtube_api', false],
    ['a link elsewhere', 'youtube_api', false],
    ['a link elsewhere', 'tiktok_api', false],
    ['a link elsewhere', 'mock_adapter', true],
    ['a tracked YouTube video', 'youtube_api', true],
    ['a tracked YouTube video', 'tiktok_api', false],
    ['a tracked TikTok video', 'tiktok_api', true],
    ['a tracked TikTok video', 'youtube_api', false],
    ['a tracked TikTok video', 'mock_adapter', true],
  ];

  for (const [evidence, source, legal] of ATTESTATIONS) {
    test(`${legal ? 'legal: ' : ''}${evidence} ${legal ? 'can' : 'cannot'} be verified by ${source}`, () => {
      const sql = stage();
      const claimId = claim(sql, creative(EVIDENCE[evidence]));
      if (legal) {
        verify(sql, claimId, source);
        assert.equal(claimOf(sql, claimId).verification_status, 'verified');
      } else {
        refuses(sql, () => verify(sql, claimId, source), needsAttestation);
      }
    });
  }

  test('a claim on a task with no automatic check can never be "verified", whatever the source says', () => {
    const sql = stage();
    const withLink = claim(sql, { evidence_url: 'https://www.youtube.com/watch?v=untracked01' });
    const withVideo = claim(sql, { video_id: 'vid_yt' });
    for (const claimId of [withLink, withVideo]) {
      for (const source of ['youtube_api', 'tiktok_api', 'mock_adapter']) refuses(sql, () => verify(sql, claimId, source), needsAttestation);
    }
  });

  test('only something a platform can look at can be "verified"', () => {
    const sql = stage();
    const textOnly = claim(sql, creative({ evidence_text: 'A description of a video, with no link to it.' }));
    refuses(sql, () => verify(sql, textOnly, 'youtube_api'), needsAttestation);
    refuses(sql, () => verify(sql, textOnly, 'mock_adapter'), CHECK("verification_status <> 'verified' OR video_id IS NOT NULL OR evidence_url IS NOT NULL"));
  });

  test('the attesting platform cannot be swapped afterwards', () => {
    const sql = stage();
    const claimId = claim(sql, creative(EVIDENCE['a YouTube link']));
    verify(sql, claimId, 'youtube_api');
    refuses(sql, () => sql.run("UPDATE claims SET verification_source = 'tiktok_api' WHERE id = ?", [claimId]), needsAttestation);
    sql.run("UPDATE claims SET verification_source = 'mock_adapter' WHERE id = ?", [claimId]);
    assert.equal(claimOf(sql, claimId).verification_source, 'mock_adapter');
  });

  test('status, source and time always agree', () => {
    const sql = stage();
    const claimId = claim(sql, creative(EVIDENCE['a YouTube link']));
    const set = (fields) => () => sql.run(`UPDATE claims SET ${fields} WHERE id = ?`, [claimId]);
    const unverifiedMeansNoSource = CHECK("(verification_status = 'unverified') = (verification_source = 'none')");
    const reviewedMeansPerson = CHECK("(verification_status = 'manually_reviewed') = (verification_source = 'admin_review')");
    const unverifiedMeansNoTime = CHECK("(verification_status = 'unverified') = (verified_at IS NULL)");
    refuses(sql, set("verification_source = 'admin_review'"), unverifiedMeansNoSource);
    refuses(sql, set("verification_source = 'youtube_api'"), unverifiedMeansNoSource);
    refuses(sql, set(`verified_at = '${T0}'`), unverifiedMeansNoTime);
    refuses(sql, set("verification_status = 'manually_reviewed'"), unverifiedMeansNoSource);
    refuses(sql, set(`verification_status = 'manually_reviewed', verification_source = 'youtube_api', verified_at = '${T0}'`), reviewedMeansPerson);
    refuses(sql, set("verification_status = 'manually_reviewed', verification_source = 'admin_review'"), unverifiedMeansNoTime);
    refuses(sql, set(`verification_status = 'verified', verification_source = 'admin_review', verified_at = '${T0}'`), either(needsAttestation, reviewedMeansPerson));
    refuses(sql, set(`verification_status = 'verified', verification_source = 'none', verified_at = '${T0}'`), either(needsAttestation, unverifiedMeansNoSource));
    refuses(sql, set("verification_status = 'verified', verification_source = 'youtube_api'"), unverifiedMeansNoTime);
    refuses(sql, set("verification_status = 'checked'"), CHECK("verification_status IN ('unverified', 'manually_reviewed', 'verified')"));
    refuses(sql, set("verification_source = 'hearsay'"), CHECK("verification_source IN ('none', 'admin_review', 'youtube_api', 'tiktok_api', 'mock_adapter')"));
  });

  test('legal: while a claim is pending its verification may be set, replaced and withdrawn', () => {
    const sql = stage();
    const claimId = claim(sql, creative(EVIDENCE['a YouTube link']));
    verify(sql, claimId, 'youtube_api');
    sql.run("UPDATE claims SET verification_status = 'unverified', verification_source = 'none', verified_at = NULL, verification_detail = '{\"outcome\":\"not_attested\"}' WHERE id = ?", [claimId]);
    markReviewed(sql, claimId);
    assert.equal(claimOf(sql, claimId).verification_status, 'manually_reviewed');
    sql.run("UPDATE claims SET verification_status = 'unverified', verification_source = 'none', verified_at = NULL WHERE id = ?", [claimId]);
    assert.equal(claimOf(sql, claimId).verification_status, 'unverified');
  });

  const IDENTITY_REWRITES = {
    id: 'clm_renamed',
    member_id: 'mbr_bo',
    task_type_id: 'tsk_creative',
    video_id: 'vid_yt',
    subject_key: `text:${sha256('some other text')}`,
    exception_seq: 1,
    exception_reason: 'Added afterwards.',
    points_snapshot: 1000,
    xp_snapshot: 1000,
    created_at: at(1),
    submitted_by_role: 'admin',
    submitted_by: 'usr_bo',
    evidence_text: 'Rewritten after the fact.',
    evidence_url: 'https://example.test/added-later',
    evidence_hash: sha256('rewritten after the fact'),
  };

  for (const decision of ['pending', 'approved']) {
    for (const [column, value] of Object.entries(IDENTITY_REWRITES)) {
      test(`${column} of a ${decision} claim cannot be changed`, () => {
        const sql = stage();
        const claimId = claimIn(sql, decision);
        refuses(sql, () => sql.run(`UPDATE claims SET ${column} = ? WHERE id = ?`, [value, claimId]), immutable);
      });
    }
  }

  test('identity columns cannot be emptied either, and the submitter can be forgotten but not replaced', () => {
    const sql = stage();
    approvedClaim(sql, { evidence_text: 'The base claim.' });
    const exceptionId = claim(sql, { evidence_text: 'The base claim.', exception_seq: 1, exception_reason: 'Agreed by the group.', submitted_by: 'usr_root', submitted_by_role: 'admin' });
    const aboutVideo = claim(sql, { video_id: 'vid_yt', evidence_url: 'https://www.youtube.com/watch?v=ytSample001' });
    refuses(sql, () => sql.run('UPDATE claims SET exception_reason = NULL WHERE id = ?', [exceptionId]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET exception_seq = 0, exception_reason = NULL WHERE id = ?', [exceptionId]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET video_id = NULL WHERE id = ?', [aboutVideo]), immutable);
    refuses(sql, () => sql.run("UPDATE claims SET video_id = 'vid_tt', subject_key = 'video:vid_tt' WHERE id = ?", [aboutVideo]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET evidence_text = NULL WHERE id = ?', [aboutVideo]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET evidence_url = NULL WHERE id = ?', [aboutVideo]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET evidence_hash = NULL WHERE id = ?', [aboutVideo]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [aboutVideo]), immutable);
    sql.run('UPDATE claims SET submitted_by = NULL WHERE id = ?', [aboutVideo]);
    refuses(sql, () => sql.run("UPDATE claims SET submitted_by = 'usr_ada' WHERE id = ?", [aboutVideo]), immutable);
    sql.run('UPDATE claims SET evidence_text = evidence_text, points_snapshot = points_snapshot WHERE id = ?', [aboutVideo]);
  });

  for (const decision of ['approved', 'rejected', 'withdrawn', 'revoked']) {
    test(`once ${decision}, the verification facts and the decision's own details are frozen`, () => {
      const sql = stage();
      const claimId = claimIn(sql, decision);
      const row = claimOf(sql, claimId);
      const set = (fields, params = []) => () => sql.run(`UPDATE claims SET ${fields} WHERE id = ?`, [...params, claimId]);
      const flipReviewMark = row.verification_status === 'unverified'
        ? set("verification_status = 'manually_reviewed', verification_source = 'admin_review', verified_at = ?", [at(2)])
        : set("verification_status = 'unverified', verification_source = 'none', verified_at = NULL");
      refuses(sql, flipReviewMark, decidedIsFrozen);
      refuses(sql, set("verification_status = 'verified', verification_source = 'mock_adapter', verified_at = ?", [at(2)]), either(decidedIsFrozen, needsAttestation));
      refuses(sql, set("verification_detail = '{\"outcome\":\"attested\"}'"), decidedIsFrozen);
      refuses(sql, set('verified_at = ?', [at(3)]), decidedIsFrozen);
      refuses(sql, set('decided_at = ?', [at(3)]), decidedIsFrozen);
      refuses(sql, set("decision_note = 'Rewritten afterwards.'"), decidedIsFrozen);
      refuses(sql, set("decided_by = 'usr_bo'"), decidedIsFrozen);
      refuses(sql, set(`decision = '${decision}', decided_at = ?`, [at(3)]), decidedIsFrozen);
      assert.deepEqual(claimOf(sql, claimId), row);
    });
  }

  test('legal: deleting a reviewer\'s account empties decided_by through the foreign key and changes nothing else', () => {
    const sql = stage();
    user(sql, 'usr_reviewer', { role: 'admin' });
    const { claimId } = approvedClaim(sql, { submitted_by: 'usr_reviewer', submitted_by_role: 'admin' });
    const rejected = claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    sql.run("UPDATE claims SET decision = 'rejected', decided_by = 'usr_reviewer', decided_at = ?, decision_note = 'Not this time.' WHERE id = ?", [T0, rejected]);
    sql.run("UPDATE claims SET decided_by = 'usr_reviewer' WHERE id = ? AND 0", [claimId]);
    const before = claimOf(sql, rejected);
    sql.run("DELETE FROM users WHERE id = 'usr_reviewer'");
    assert.deepEqual(claimOf(sql, rejected), { ...before, decided_by: null });
    assert.equal(claimOf(sql, claimId).submitted_by, null);
    assert.equal(claimOf(sql, claimId).decision, 'approved');
  });

  test('evidence may be blanked only during an erasure, only as a whole, and only if something still identifies the claim', () => {
    const sql = stage();
    const aboutVideo = approvedClaim(sql, { video_id: 'vid_yt', evidence_url: 'https://www.youtube.com/watch?v=ytSample001' }).claimId;
    const textOnly = claim(sql, { evidence_text: 'Words with no video and no link.' });
    const blank = (claimId) => () => sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [claimId]);
    refuses(sql, blank(aboutVideo), immutable);

    setGuard(sql, 'mbr_bo');
    refuses(sql, () => sql.run('UPDATE claims SET evidence_text = NULL WHERE id = ?', [aboutVideo]), immutable);
    refuses(sql, () => sql.run('UPDATE claims SET evidence_text = NULL, evidence_hash = NULL WHERE id = ?', [aboutVideo]), immutable);
    refuses(sql, () => sql.run("UPDATE claims SET evidence_text = '[removed]', evidence_url = NULL, evidence_hash = NULL WHERE id = ?", [aboutVideo]), immutable);
    refuses(sql, blank(textOnly), CHECK('evidence_text IS NOT NULL OR evidence_url IS NOT NULL OR video_id IS NOT NULL'));
    const before = claimOf(sql, aboutVideo);
    blank(aboutVideo)();
    assert.deepEqual(claimOf(sql, aboutVideo), { ...before, evidence_text: null, evidence_url: null, evidence_hash: null });
  });

  test('erasing one member does not unlock the evidence of claims that have nothing to do with them', DEFECT('while ANY guard is set, evidence of ANY video claim may be blanked: a throw-away member is enough to wipe the evidence behind other members\' approved claims'), () => {
    const sql = stage();
    const unrelated = approvedClaim(sql, { video_id: 'vid_yt' }).claimId;
    member(sql, 'mbr_throwaway');
    setGuard(sql, 'mbr_throwaway');
    refuses(sql, () => sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [unrelated]), ANY_REFUSAL);
  });

  test('a task cannot lose its automatic check while claims verified under it exist', DEFECT('task_types.api_check can be set to none afterwards, leaving "verified" claims on a task with no automatic check (integrity.js notices; the schema does not refuse)'), () => {
    const sql = stage();
    const claimId = claim(sql, creative(EVIDENCE['a YouTube link']));
    verify(sql, claimId, 'youtube_api');
    refuses(sql, () => sql.run("UPDATE task_types SET api_check = 'none' WHERE id = 'tsk_creative'"), ANY_REFUSAL);
  });
});

// ---------------------------------------------------------------------------
// The shape of a ledger entry (the CHECKs behind P3, P4 and P5)
// ---------------------------------------------------------------------------

describe('The shape of a ledger entry', () => {
  const periodFormat = CHECK("period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(period, 6, 2) BETWEEN '01' AND '12'");
  const periodOfCreatedAt = CHECK("kind = 'reversal' OR period IN (strftime('%Y-%m', created_at, '-12 hours')");
  const createdAtFormat = CHECK("created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at)");
  const keyNamespace = CHECK("CASE kind WHEN 'task_award' THEN idempotency_key = 'award:' || claim_id");

  test('period is a real calendar month written YYYY-MM', () => {
    const sql = stage();
    for (const period of ['2026-00', '2026-13', '2026-19', '2026-1', '2026-011', '26-11', '2026/11', '2026-1x', 'november', '', ' 2026-11']) {
      refuses(sql, () => entry(sql, { points: 5, period }), periodFormat);
    }
    refuses(sql, () => entry(sql, { points: 5, period: null }), NOT_NULL('ledger_entries.period'));
  });

  test('period is the month of created_at in some real time zone, and no other', () => {
    const sql = stage();
    for (const period of ['2026-10', '2026-12', '2025-11', '2019-01', '2031-07']) {
      refuses(sql, () => entry(sql, { points: 5, period }), periodOfCreatedAt);
    }
    // Legal: at a month boundary the local month may differ from the UTC month, by one, in the right direction.
    entry(sql, { points: 5, created_at: '2026-11-01T05:00:00.000Z', period: '2026-10' });
    entry(sql, { points: 5, created_at: '2026-11-01T05:00:00.000Z', period: '2026-11' });
    entry(sql, { points: 5, created_at: '2026-11-30T12:00:00.000Z', period: '2026-12' });
    refuses(sql, () => entry(sql, { points: 5, created_at: '2026-11-01T12:00:00.000Z', period: '2026-10' }), periodOfCreatedAt);
    refuses(sql, () => entry(sql, { points: 5, created_at: '2026-11-30T09:59:59.999Z', period: '2026-12' }), periodOfCreatedAt);
    refuses(sql, () => entry(sql, { points: 5, created_at: '2026-11-01T05:00:00.000Z', period: '2026-12' }), periodOfCreatedAt);
  });

  test('created_at is exactly what toISOString() writes', () => {
    const sql = stage();
    for (const createdAt of ['2026-11-09 20:00:00', '2026-11-09T20:00:00Z', '2026-11-09T20:00:00.00Z', '2026-11-09T20:00:00.0000Z', '2026-11-09T20:00:00.000+00:00', '2026-11-09t20:00:00.000z', '2026-11-09T20:00:00.000', '2026-11-31T20:00:00.000Z', '2026-11-09T23:59:60.000Z', '2026-11-09T20:00:00.000Z ', '2026-11-09']) {
      refuses(sql, () => entry(sql, { points: 5, created_at: createdAt }), createdAtFormat);
    }
    refuses(sql, () => entry(sql, { points: 5, created_at: 'yesterday' }), either(createdAtFormat, periodOfCreatedAt));
    refuses(sql, () => entry(sql, { points: 5, created_at: null }), NOT_NULL('ledger_entries.created_at'));
    entry(sql, { points: 5, created_at: new Date(Date.UTC(2026, 10, 9, 20, 0, 0, 1)).toISOString() });
  });

  test('the idempotency key of an award or a reversal is a pure function of the row', () => {
    const sql = stage();
    entry(sql, { points: 500, reason: 'Float' });
    const deduction = entry(sql, { points: -20 });
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    refuses(sql, () => award(sql, claimId, { idempotency_key: 'req:usr_root:an-award' }), keyNamespace);
    refuses(sql, () => award(sql, claimId, { idempotency_key: 'award:some-other-claim' }), keyNamespace);
    refuses(sql, () => award(sql, claimId, { idempotency_key: `award:${claimId} ` }), keyNamespace);
    refuses(sql, () => reversal(sql, deduction, { idempotency_key: 'req:usr_root:a-reversal' }), keyNamespace);
    refuses(sql, () => reversal(sql, deduction, { idempotency_key: `reversal:${deduction + 1}` }), keyNamespace);
    refuses(sql, () => reversal(sql, deduction, { idempotency_key: `award:${claimId}` }), keyNamespace);
  });

  test('a key supplied by a client lives in the req: namespace and can never pre-empt a server key', () => {
    const sql = stage();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    for (const key of [`award:${claimId}`, 'reversal:1', 'req:', 'request-1', '', `req:${'k'.repeat(197)}`]) {
      for (const kind of ['adjustment', 'bonus']) refuses(sql, () => entry(sql, { kind, points: 5, idempotency_key: key }), keyNamespace);
    }
    entry(sql, { points: 5, idempotency_key: `req:${'k'.repeat(196)}` });
    entry(sql, { points: 5, idempotency_key: `req:usr_root:award:${claimId}` });
    award(sql, claimId);
    assert.equal(claimOf(sql, claimId).decision, 'approved');
    refuses(sql, () => entry(sql, { points: 5, idempotency_key: null }), NOT_NULL('ledger_entries.idempotency_key'));
  });

  test('only a bonus, or the reversal of one, may belong to a competition', () => {
    const sql = stage();
    competition(sql, 'cmp_one');
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    const competitionKinds = CHECK("competition_id IS NULL OR kind IN ('bonus', 'reversal')");
    refuses(sql, () => entry(sql, { kind: 'adjustment', points: 5, competition_id: 'cmp_one' }), competitionKinds);
    refuses(sql, () => award(sql, claimId, { competition_id: 'cmp_one' }), competitionKinds);
    refuses(sql, () => entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_missing' }), FOREIGN_KEY);
    entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_one' });
  });

  test('every entry has a member, a reason and an author', () => {
    const sql = stage();
    refuses(sql, () => entry(sql, { points: 5, reason: '' }), CHECK('length(reason) BETWEEN 1 AND 500'));
    refuses(sql, () => entry(sql, { points: 5, reason: 'x'.repeat(501) }), CHECK('length(reason) BETWEEN 1 AND 500'));
    refuses(sql, () => entry(sql, { points: 5, reason: null }), NOT_NULL('ledger_entries.reason'));
    refuses(sql, () => entry(sql, { points: 5, actor_user_id: null }), NOT_NULL('ledger_entries.actor_user_id'));
    refuses(sql, () => entry(sql, { points: 5, member_id: null }), NOT_NULL('ledger_entries.member_id'));
    refuses(sql, () => entry(sql, { points: 5, kind: null }), NOT_NULL('ledger_entries.kind'));
    refuses(sql, () => entry(sql, { points: 5, bucket: null }), NOT_NULL('ledger_entries.bucket'));
    entry(sql, { points: 5, reason: 'x'.repeat(500) });
  });

  test('hour 24 is not accepted as a time of day', DEFECT('the timestamp CHECKs accept "T24:MM:SS.sssZ" (SQLite reads it as the next day), so text order and real order disagree: a reversal can be dated before its target'), () => {
    const sql = stage();
    entry(sql, { points: 500, reason: 'Float' });
    refuses(sql, () => entry(sql, { points: 5, created_at: '2026-11-09T24:30:00.000Z' }), ANY_REFUSAL);
    refuses(sql, () => session(sql, { expires_at: '2026-11-09T24:59:59.999Z' }), ANY_REFUSAL);
  });
});

// ---------------------------------------------------------------------------
// Sign-in accounts and sessions (rules P8 and P9 lean on)
// ---------------------------------------------------------------------------

describe('Sign-in accounts and sessions', () => {
  const bindsOnce = ABORT.users_google_sub_binds_once;

  test('a Google identity is bound once, to an active account that has none', () => {
    const sql = stage();
    sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_ada'");
    refuses(sql, () => sql.run("UPDATE users SET google_sub = 'sub-attacker' WHERE id = 'usr_ada'"), bindsOnce);
    refuses(sql, () => sql.run("UPDATE users SET google_sub = 'sub-attacker', last_login_at = ? WHERE email = 'usrada@example.test'", [T0]), bindsOnce);
    refuses(sql, () => sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_bo'"), UNIQUE('users.google_sub'));
    sql.run("UPDATE users SET google_sub = 'sub-ada', last_login_at = ? WHERE id = 'usr_ada'", [T0]);
    assert.equal(sql.get("SELECT google_sub FROM users WHERE id = 'usr_ada'").google_sub, 'sub-ada');
  });

  test('a disabled account cannot be bound, and re-binding takes a deliberate unbind first', () => {
    const sql = stage();
    sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_bo'");
    refuses(sql, () => sql.run("UPDATE users SET google_sub = 'sub-bo' WHERE id = 'usr_bo'"), bindsOnce);
    refuses(sql, () => sql.run("UPDATE users SET google_sub = 'sub-bo' WHERE id = 'usr_bo' AND google_sub IS NULL"), bindsOnce);
    sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_ada'");
    sql.run("UPDATE users SET google_sub = NULL WHERE id = 'usr_ada'");
    sql.run("UPDATE users SET google_sub = 'sub-ada-new' WHERE id = 'usr_ada'");
    sql.run("UPDATE users SET status = 'active', google_sub = 'sub-bo' WHERE id = 'usr_bo'");
    assert.equal(count(sql, 'users', 'google_sub IS NOT NULL'), 2);
  });

  const ENDS_SESSIONS = {
    'a role change': (sql) => sql.run("UPDATE users SET role = 'admin' WHERE id = 'usr_ada'"),
    'being disabled': (sql) => sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_ada'"),
    'being moved to another member': (sql) => {
      member(sql, 'mbr_cy');
      sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_ada'");
    },
    'losing its Google identity': (sql) => sql.run("UPDATE users SET google_sub = NULL WHERE id = 'usr_ada'"),
  };
  for (const [change, apply] of Object.entries(ENDS_SESSIONS)) {
    test(`${change} ends every session of the account, and nobody else's`, () => {
      const sql = stage();
      sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_ada'");
      session(sql, { user_id: 'usr_ada' });
      session(sql, { user_id: 'usr_ada', auth_method: 'google' });
      session(sql, { user_id: 'usr_bo' });
      apply(sql);
      assert.equal(count(sql, 'sessions', "user_id = 'usr_ada'"), 0);
      assert.equal(count(sql, 'sessions', "user_id = 'usr_bo'"), 1);
      witness('sessions_end_on_privilege_change');
    });
  }

  test('gaining or losing a member link ends an admin\'s sessions, NULL on either side', () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    session(sql, { user_id: 'usr_root' });
    sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_root'");
    assert.equal(count(sql, 'sessions', "user_id = 'usr_root'"), 0);
    session(sql, { user_id: 'usr_root' });
    sql.run("UPDATE users SET member_id = NULL WHERE id = 'usr_root'");
    assert.equal(count(sql, 'sessions', "user_id = 'usr_root'"), 0);
  });

  test('legal: a first sign-in, a later sign-in, a new address and a no-op update keep the session', () => {
    const sql = stage();
    session(sql, { user_id: 'usr_ada' });
    sql.run("UPDATE users SET google_sub = 'sub-ada', last_login_at = ? WHERE id = 'usr_ada'", [T0]);
    sql.run("UPDATE users SET last_login_at = ? WHERE id = 'usr_ada'", [at(5)]);
    sql.run("UPDATE users SET email = 'ada-new@example.test' WHERE id = 'usr_ada'");
    sql.run("UPDATE users SET role = role, status = status, member_id = member_id, google_sub = google_sub WHERE id = 'usr_ada'");
    assert.equal(count(sql, 'sessions', "user_id = 'usr_ada'"), 1);
  });

  test('a session row has a hashed token, a known sign-in method and well-formed times', () => {
    const sql = stage();
    const tokenRule = CHECK("length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'");
    for (const tokenHash of ['a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), `${'a'.repeat(63)}g`, `${'a'.repeat(63)} `, '']) {
      refuses(sql, () => session(sql, { token_hash: tokenHash }), tokenRule);
    }
    refuses(sql, () => session(sql, { auth_method: 'password' }), CHECK("auth_method IN ('google', 'dev')"));
    refuses(sql, () => session(sql, { auth_method: null }), NOT_NULL('sessions.auth_method'));
    for (const column of ['created_at', 'expires_at', 'last_seen_at']) {
      for (const value of ['never', '2026-11-16 20:00:00', '2026-11-16T20:00:00Z', '9999', '']) {
        refuses(sql, () => session(sql, { [column]: value }), CHECK(`${column} IS strftime('%Y-%m-%dT%H:%M:%fZ', ${column})`));
      }
    }
    refuses(sql, () => session(sql, { expires_at: T0 }), CHECK('expires_at > created_at'));
    refuses(sql, () => session(sql, { expires_at: at(-1) }), CHECK('expires_at > created_at'));
    refuses(sql, () => session(sql, { user_id: 'usr_nobody' }), FOREIGN_KEY);
    const row = sessionRow();
    insert(sql, 'sessions', row);
    refuses(sql, () => insert(sql, 'sessions', { ...row, user_id: 'usr_bo' }), UNIQUE('sessions.token_hash'));
  });

  test('an allowlist entry is one lower-case address per account, and one account per member', () => {
    const sql = stage();
    refuses(sql, () => user(sql, 'usr_caps', { email: 'Someone@example.test', role: 'admin' }), CHECK("email = lower(email) AND email LIKE '%_@_%'"));
    refuses(sql, () => user(sql, 'usr_noat', { email: 'someone.example.test', role: 'admin' }), CHECK("email = lower(email) AND email LIKE '%_@_%'"));
    refuses(sql, () => user(sql, 'usr_twin', { email: 'usrroot@example.test', role: 'admin' }), UNIQUE('users.email'));
    refuses(sql, () => user(sql, 'usr_second_ada', { member_id: 'mbr_ada' }), UNIQUE('users.member_id'));
    refuses(sql, () => user(sql, 'usr_ghost_member', { member_id: 'mbr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => user(sql, 'usr_root', { email: 'another@example.test', role: 'admin' }), UNIQUE('users.id'));
  });
});

// ---------------------------------------------------------------------------
// The other tables
// ---------------------------------------------------------------------------

describe('The other tables keep their shape', () => {
  test('members: a short lower-case slug, a short name, and a channel link that has its consent time', () => {
    const sql = stage();
    refuses(sql, () => member(sql, 'mbr_cy', { slug: 'Cy' }), CHECK("slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 1 AND 40"));
    refuses(sql, () => member(sql, 'mbr_cy', { slug: '' }), CHECK("slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 1 AND 40"));
    refuses(sql, () => member(sql, 'mbr_cy', { slug: 'c'.repeat(41) }), CHECK("slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 1 AND 40"));
    refuses(sql, () => member(sql, 'mbr_cy', { slug: 'mbrada' }), UNIQUE('members.slug'));
    refuses(sql, () => member(sql, 'mbr_cy', { display_name: '' }), CHECK('length(display_name) BETWEEN 1 AND 40'));
    refuses(sql, () => member(sql, 'mbr_cy', { display_name: 'n'.repeat(41) }), CHECK('length(display_name) BETWEEN 1 AND 40'));
    refuses(sql, () => member(sql, 'mbr_cy', { status: 'hidden' }), CHECK("status IN ('active', 'archived')"));
    const linkRule = CHECK('(youtube_channel_id IS NULL) = (youtube_linked_at IS NULL)');
    refuses(sql, () => sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-01' WHERE id = 'mbr_ada'"), linkRule);
    refuses(sql, () => sql.run("UPDATE members SET youtube_linked_at = ? WHERE id = 'mbr_ada'", [T0]), linkRule);
    sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-01', youtube_linked_at = ? WHERE id = 'mbr_ada'", [T0]);
    refuses(sql, () => sql.run("UPDATE members SET youtube_linked_at = NULL WHERE id = 'mbr_ada'"), linkRule);
    sql.run("UPDATE members SET youtube_channel_id = NULL, youtube_linked_at = NULL WHERE id = 'mbr_ada'");
  });

  test('videos: one row per platform video, and statistics always come with their source and time', () => {
    const sql = stage();
    refuses(sql, () => video(sql, 'vid_dup', { platform_video_id: 'ytSample001' }), UNIQUE('videos.platform, videos.platform_video_id'));
    refuses(sql, () => video(sql, 'vid_short_id', { platform_video_id: 'abc12' }), CHECK('length(platform_video_id) BETWEEN 6 AND 64'));
    refuses(sql, () => video(sql, 'vid_other', { platform: 'elsewhere' }), CHECK("platform IN ('youtube', 'tiktok')"));
    refuses(sql, () => video(sql, 'vid_other', { kind: 'livestream' }), CHECK("kind IN ('video', 'short')"));
    refuses(sql, () => video(sql, 'vid_other', { title: '' }), CHECK('length(title) BETWEEN 1 AND 200'));
    const withTime = CHECK('(stats_json IS NULL) = (stats_fetched_at IS NULL)');
    const withSource = CHECK('(stats_json IS NULL) = (stats_source IS NULL)');
    refuses(sql, () => sql.run("UPDATE videos SET stats_json = '{\"views\":10}' WHERE id = 'vid_yt'"), either(withTime, withSource));
    refuses(sql, () => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'mock_adapter' WHERE id = 'vid_yt'"), withTime);
    refuses(sql, () => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]), withSource);
    refuses(sql, () => sql.run("UPDATE videos SET stats_source = 'mock_adapter' WHERE id = 'vid_yt'"), withSource);
    refuses(sql, () => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'guesswork', stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]), CHECK("stats_source IN ('youtube_api', 'tiktok_api', 'mock_adapter')"));
    sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'mock_adapter', stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]);
    video(sql, 'vid_same_id_other_platform', { platform: 'tiktok', platform_video_id: 'ytSample001' });
  });

  test('task types: worth something, within bounds, with a unique key', () => {
    const sql = stage();
    refuses(sql, () => taskType(sql, 'tsk_nothing', { points: 0, xp: 0 }), CHECK('points > 0 OR xp > 0'));
    refuses(sql, () => taskType(sql, 'tsk_huge', { points: 1001 }), CHECK('points BETWEEN 0 AND 1000'));
    refuses(sql, () => taskType(sql, 'tsk_minus', { xp: -1 }), CHECK('xp BETWEEN 0 AND 1000'));
    refuses(sql, () => taskType(sql, 'tsk_key', { key: 'Ab' }), CHECK("key GLOB '[a-z]*' AND length(key) BETWEEN 3 AND 40"));
    refuses(sql, () => taskType(sql, 'tsk_key', { key: '9lives' }), CHECK("key GLOB '[a-z]*' AND length(key) BETWEEN 3 AND 40"));
    refuses(sql, () => taskType(sql, 'tsk_key', { key: 'constructive_feedback' }), UNIQUE('task_types.key'));
    refuses(sql, () => taskType(sql, 'tsk_label', { label: '' }), CHECK('length(label) BETWEEN 1 AND 60'));
    refuses(sql, () => taskType(sql, 'tsk_flag', { requires_video: 2 }), CHECK('requires_video IN (0, 1)'));
    refuses(sql, () => taskType(sql, 'tsk_flag', { active: 2 }), CHECK('active IN (0, 1)'));
    taskType(sql, 'tsk_xp_only', { points: 0, xp: 5 });
  });

  test('competitions: well-formed times, and an end after the start', () => {
    const sql = stage();
    refuses(sql, () => competition(sql, 'cmp_backwards', { starts_at: at(60), ends_at: at(-60) }), CHECK('ends_at > starts_at'));
    refuses(sql, () => competition(sql, 'cmp_instant', { starts_at: T0, ends_at: T0 }), CHECK('ends_at > starts_at'));
    refuses(sql, () => competition(sql, 'cmp_day', { starts_at: '2026-11-01' }), CHECK("starts_at IS strftime('%Y-%m-%dT%H:%M:%fZ', starts_at)"));
    refuses(sql, () => competition(sql, 'cmp_day', { ends_at: '2026-12-01' }), CHECK("ends_at IS strftime('%Y-%m-%dT%H:%M:%fZ', ends_at)"));
    refuses(sql, () => competition(sql, 'cmp_state', { status: 'secret' }), CHECK("status IN ('draft', 'active', 'closed')"));
    refuses(sql, () => competition(sql, 'cmp_name', { name: '' }), CHECK('length(name) BETWEEN 1 AND 80'));
    competition(sql, 'cmp_fine');
  });

  describe('tiers', () => {
    const ladder = (sql) => {
      for (const [level, minXp] of [[1, 0], [2, 100], [3, 250], [4, 500], [5, 1000]]) {
        insert(sql, 'tiers', { level, name: `Stage ${level}`, min_xp: minXp, art_key: `stage-${level}`, updated_at: T0 });
      }
      return sql;
    };

    test('there are at most five levels, numbered 1 to 5, and level 1 starts at zero', () => {
      const sql = ladder(stage());
      const tier = (level, minXp = 5000) => () => insert(sql, 'tiers', { level, name: 'Extra', min_xp: minXp, art_key: 'extra', updated_at: T0 });
      refuses(sql, tier(6), CHECK('level BETWEEN 1 AND 5'));
      refuses(sql, tier(0), CHECK('level BETWEEN 1 AND 5'));
      refuses(sql, tier(-1), CHECK('level BETWEEN 1 AND 5'));
      refuses(sql, tier(3), UNIQUE('tiers.level'));
      refuses(sql, tier(undefined), CHECK('level BETWEEN 1 AND 5'));
      refuses(sql, () => sql.run('UPDATE tiers SET min_xp = 10 WHERE level = 1'), CHECK('level <> 1 OR min_xp = 0'));
      refuses(sql, () => sql.run('UPDATE tiers SET level = 1 WHERE level = 2'), either(UNIQUE('tiers.level'), CHECK('level <> 1 OR min_xp = 0')));
      refuses(sql, () => sql.run('UPDATE tiers SET min_xp = -1 WHERE level = 2'), CHECK('min_xp >= 0'));
      refuses(sql, () => sql.run("UPDATE tiers SET name = '' WHERE level = 2"), CHECK('length(name) BETWEEN 1 AND 40'));
      assert.equal(count(sql, 'tiers'), 5);
    });

    test('a first tier above zero cannot be the only tier', () => {
      const sql = stage();
      refuses(sql, () => insert(sql, 'tiers', { level: 1, name: 'Stage 1', min_xp: 100, art_key: 'stage-1', updated_at: T0 }), CHECK('level <> 1 OR min_xp = 0'));
    });

    test('what the schema leaves open here, the integrity self-check reports', () => {
      // Fewer than five rows and thresholds that do not climb are not schema errors (recorded as PE-14).
      const sql = ladder(stage());
      const checks = () => checkIntegrity(sql.db).violations.map((violation) => violation.check);
      assert.ok(!checks().includes('tiers_not_five_ascending'));
      sql.run('UPDATE tiers SET min_xp = 50 WHERE level = 5');
      assert.ok(checks().includes('tiers_not_five_ascending'));
      sql.run('UPDATE tiers SET min_xp = 1000 WHERE level = 5');
      sql.run('DELETE FROM tiers WHERE level = 4');
      assert.ok(checks().includes('tiers_not_five_ascending'));
    });

    test('the ladder always has exactly five rungs', DEFECT('(recorded as PE-14) a tier row can be deleted, leaving fewer than five; only integrity.js notices'), () => {
      const sql = ladder(stage());
      refuses(sql, () => sql.run('DELETE FROM tiers WHERE level = 4'), ANY_REFUSAL);
    });
  });

  test('statistics carry a well-formed fetch time, because the 30-day clean-up compares it as text', DEFECT('videos.stats_fetched_at has no format CHECK although videos.js compares it with "<"; a value such as "9999" is never purged'), () => {
    const sql = stage();
    refuses(sql, () => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'mock_adapter', stats_fetched_at = '9999' WHERE id = 'vid_yt'"), ANY_REFUSAL);
  });

  test('one YouTube channel belongs to one member', DEFECT('(recorded as PE-09) two members can hold the same youtube_channel_id, so both would be attested as owner of the same videos'), () => {
    const sql = stage();
    sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-01', youtube_linked_at = ? WHERE id = 'mbr_ada'", [T0]);
    refuses(sql, () => sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-01', youtube_linked_at = ? WHERE id = 'mbr_bo'", [T0]), ANY_REFUSAL);
  });
});

// ---------------------------------------------------------------------------
// Foreign keys and STRICT typing
// ---------------------------------------------------------------------------

describe('Every REFERENCES clause is enforced', () => {
  test('the set of foreign keys is exactly the one this suite attacks', () => {
    const sql = openApplication();
    const keys = sql
      .all(
        `SELECT m.name AS child, f."from" AS column, f."table" AS parent, f.on_delete AS on_delete
           FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) f
          WHERE m.type = 'table' ORDER BY 1, 2`,
      )
      .map((key) => `${key.child}.${key.column} -> ${key.parent} (${key.on_delete})`);
    assert.deepEqual(keys, [
      'claims.decided_by -> users (SET NULL)',
      'claims.member_id -> members (NO ACTION)',
      'claims.submitted_by -> users (SET NULL)',
      'claims.task_type_id -> task_types (NO ACTION)',
      'claims.video_id -> videos (NO ACTION)',
      'competitions.created_by -> users (SET NULL)',
      'ledger_entries.claim_id -> claims (NO ACTION)',
      'ledger_entries.competition_id -> competitions (NO ACTION)',
      'ledger_entries.member_id -> members (NO ACTION)',
      'ledger_entries.reverses_entry_id -> ledger_entries (NO ACTION)',
      'sessions.user_id -> users (CASCADE)',
      'users.member_id -> members (NO ACTION)',
      'videos.added_by -> users (SET NULL)',
      'videos.owner_member_id -> members (SET NULL)',
    ]);
  });

  test('a row cannot point at a parent that does not exist', () => {
    const sql = stage();
    refuses(sql, () => user(sql, 'usr_orphan', { member_id: 'mbr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => session(sql, { user_id: 'usr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => video(sql, 'vid_orphan', { owner_member_id: 'mbr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => video(sql, 'vid_orphan', { added_by: 'usr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => claim(sql, { member_id: 'mbr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => claim(sql, { video_id: 'vid_nobody' }), FOREIGN_KEY);
    refuses(sql, () => claim(sql, { submitted_by: 'usr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => claim(sql, { task_type_id: 'tsk_nobody' }), either(ABORT.claims_snapshot_matches_task, FOREIGN_KEY));
    refuses(sql, () => competition(sql, 'cmp_orphan', { created_by: 'usr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => entry(sql, { points: 5, member_id: 'mbr_nobody' }), FOREIGN_KEY);
    refuses(sql, () => entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_nobody' }), FOREIGN_KEY);
    refuses(sql, () => award(sql, 'clm_nobody'), either(ABORT.ledger_award_requires_reviewed_claim, FOREIGN_KEY));
    refuses(sql, () => entry(sql, { kind: 'reversal', points: 5, reverses_entry_id: 404, idempotency_key: 'reversal:404' }), either(ABORT.ledger_reversal_must_mirror, FOREIGN_KEY));
    const claimId = claim(sql);
    refuses(sql, () => sql.run("UPDATE claims SET decision = 'withdrawn', decided_at = ?, decided_by = 'usr_nobody' WHERE id = ?", [T0, claimId]), FOREIGN_KEY);
  });

  test('a parent that is still referenced cannot be deleted or re-keyed', () => {
    const sql = stage();
    competition(sql, 'cmp_one');
    approvedClaim(sql, { video_id: 'vid_yt' });
    entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_one' });
    session(sql, { user_id: 'usr_ada' });
    for (const statement of [
      "DELETE FROM members WHERE id = 'mbr_ada'",
      "UPDATE members SET id = 'mbr_renamed' WHERE id = 'mbr_ada'",
      "DELETE FROM task_types WHERE id = 'tsk_feedback'",
      "UPDATE task_types SET id = 'tsk_renamed' WHERE id = 'tsk_feedback'",
      "DELETE FROM videos WHERE id = 'vid_yt'",
      "UPDATE videos SET id = 'vid_renamed' WHERE id = 'vid_yt'",
      "DELETE FROM competitions WHERE id = 'cmp_one'",
      "UPDATE competitions SET id = 'cmp_renamed' WHERE id = 'cmp_one'",
      "UPDATE users SET id = 'usr_renamed' WHERE id = 'usr_ada'",
      "UPDATE users SET id = 'usr_renamed' WHERE id = 'usr_root'",
    ]) {
      refuses(sql, () => sql.run(statement), FOREIGN_KEY);
    }
    // Legal: what nothing points at may go.
    sql.run("DELETE FROM videos WHERE id = 'vid_tt'");
    sql.run("DELETE FROM task_types WHERE id = 'tsk_creative'");
  });

  test('deleting an account ends its sessions and forgets it as author, without touching what it wrote', () => {
    const sql = stage();
    user(sql, 'usr_second', { role: 'admin', last_login_at: T0 });
    competition(sql, 'cmp_one', { created_by: 'usr_second' });
    video(sql, 'vid_added', { added_by: 'usr_second' });
    session(sql, { user_id: 'usr_second' });
    const claimId = claim(sql, { submitted_by: 'usr_second', submitted_by_role: 'admin' });
    markReviewed(sql, claimId);
    const awardId = award(sql, claimId, { actor_user_id: 'usr_second' });
    sql.run("DELETE FROM users WHERE id = 'usr_second'");
    assert.equal(count(sql, 'sessions', "user_id = 'usr_second'"), 0);
    assert.equal(sql.get("SELECT created_by FROM competitions WHERE id = 'cmp_one'").created_by, null);
    assert.equal(sql.get("SELECT added_by FROM videos WHERE id = 'vid_added'").added_by, null);
    assert.deepEqual({ decided_by: claimOf(sql, claimId).decided_by, submitted_by: claimOf(sql, claimId).submitted_by, decision: claimOf(sql, claimId).decision }, { decided_by: null, submitted_by: null, decision: 'approved' });
    assert.equal(sql.get('SELECT actor_user_id FROM ledger_entries WHERE id = ?', [awardId]).actor_user_id, 'usr_second', 'the ledger keeps the opaque id of who wrote the entry');
  });

  test('deleting a member with no ledger rows, claims or account releases their videos', () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    video(sql, 'vid_cy', { owner_member_id: 'mbr_cy' });
    sql.run("DELETE FROM members WHERE id = 'mbr_cy'");
    assert.equal(sql.get("SELECT owner_member_id FROM videos WHERE id = 'vid_cy'").owner_member_id, null);
  });
});

describe('STRICT typing', () => {
  test('text that is not a number is refused in an INTEGER column', () => {
    const sql = stage();
    refuses(sql, () => entry(sql, { points: 'ten' }), DATATYPE('cannot store TEXT value in INTEGER column ledger_entries.points'));
    refuses(sql, () => entry(sql, { points: 5, xp: '5 xp' }), DATATYPE('cannot store TEXT value in INTEGER column ledger_entries.xp'));
    refuses(sql, () => entry(sql, { points: 5, id: 'first' }), DATATYPE('ledger_entries.id'));
    refuses(sql, () => claim(sql, { exception_seq: 'one', exception_reason: 'A reason.' }), DATATYPE('cannot store TEXT value in INTEGER column claims.exception_seq'));
    refuses(sql, () => claim(sql, { points_snapshot: 'twenty-five' }), DATATYPE('cannot store TEXT value in INTEGER column claims.points_snapshot'));
    refuses(sql, () => taskType(sql, 'tsk_typed', { active: 'yes' }), DATATYPE('cannot store TEXT value in INTEGER column task_types.active'));
    refuses(sql, () => insert(sql, 'tiers', { level: 'one', name: 'Stage 1', min_xp: 0, art_key: 'stage-1', updated_at: T0 }), DATATYPE('tiers.level'));
    refuses(sql, () => audit(sql, { id: 'latest' }), DATATYPE('audit_log.id'));
  });

  test('a fraction is refused in an INTEGER column, and bytes are refused in a TEXT column', () => {
    const sql = stage();
    refuses(sql, () => entry(sql, { points: 1.5 }), DATATYPE('cannot store REAL value in INTEGER column ledger_entries.points'));
    refuses(sql, () => taskType(sql, 'tsk_half', { points: 12.5 }), DATATYPE('cannot store REAL value in INTEGER column task_types.points'));
    refuses(sql, () => member(sql, 'mbr_bytes', { display_name: new Uint8Array([1, 2, 3]) }), DATATYPE('cannot store BLOB value in TEXT column members.display_name'));
    refuses(sql, () => claim(sql, { evidence_text: new Uint8Array([104, 105]) }), DATATYPE('cannot store BLOB value in TEXT column claims.evidence_text'));
    refuses(sql, () => audit(sql, { detail: new Uint8Array([123, 125]) }), DATATYPE('cannot store BLOB value in TEXT column audit_log.detail'));
  });

  test('legal: a whole number written as text or as a float is stored as an INTEGER', () => {
    const sql = stage();
    const id = entry(sql, { points: '10', xp: 2.0 });
    assert.deepEqual({ ...sql.get('SELECT points, xp, typeof(points) AS points_type, typeof(xp) AS xp_type FROM ledger_entries WHERE id = ?', [id]) }, { points: 10, xp: 2, points_type: 'integer', xp_type: 'integer' });
  });

  test('a primary key is never NULL', () => {
    const sql = stage();
    refuses(sql, () => member(sql, 'mbr_cy', { id: null }), NOT_NULL('members.id'));
    refuses(sql, () => user(sql, 'usr_cy', { id: null, role: 'admin' }), NOT_NULL('users.id'));
    refuses(sql, () => claim(sql, { id: null }), either(NOT_NULL('claims.id'), ABORT.claims_no_replace));
    refuses(sql, () => session(sql, { token_hash: null }), NOT_NULL('sessions.token_hash'));
    refuses(sql, () => taskType(sql, 'tsk_cy', { id: null }), NOT_NULL('task_types.id'));
    refuses(sql, () => video(sql, 'vid_cy', { id: null }), NOT_NULL('videos.id'));
    refuses(sql, () => competition(sql, 'cmp_cy', { id: null }), NOT_NULL('competitions.id'));
    refuses(sql, () => insert(sql, 'settings', { key: null, value: '1', updated_at: T0 }), NOT_NULL('settings.key'));
  });
});

// ---------------------------------------------------------------------------
// Connection settings
// ---------------------------------------------------------------------------

describe('What a mis-configured connection still guarantees, and what it loses', () => {
  const violations = (sql) => checkIntegrity(new Db(sql.raw)).violations.map((violation) => violation.check);

  test('recursive_triggers OFF: the legal flows still work end to end', () => {
    const sql = cast(openBare({ recursiveTriggers: false }));
    const { claimId, awardId } = approvedClaim(sql);
    assert.equal(claimOf(sql, claimId).decision, 'approved');
    reversal(sql, awardId);
    assert.equal(claimOf(sql, claimId).decision, 'revoked');
    refuses(sql, () => entry(sql, { points: -1 }), ABORT.ledger_never_negative);
    assert.ok(violations(sql).includes('pragma_recursive_triggers'), 'and the self-check reports the missing pragma');
  });

  test('recursive_triggers OFF: P9 is lost to REPLACE, which is why the adapter refuses to run without the pragma', () => {
    const lesser = { id: 'usr_root', email: 'usrroot@example.test', role: 'member', member_id: 'mbr_cy', created_at: T0 };
    const sql = cast(openBare({ recursiveTriggers: false }));
    member(sql, 'mbr_cy');
    insert(sql, 'users', lesser, { verb: 'INSERT OR REPLACE' });
    assert.equal(workingAdmins(sql), 0, 'REPLACE removed the last admin without firing users_keep_one_admin_on_delete');
    // The plain statements stay refused.
    const plain = cast(openBare({ recursiveTriggers: false }));
    refuses(plain, () => plain.run("DELETE FROM users WHERE id = 'usr_root'"), ABORT.users_keep_one_admin_on_delete);
    refuses(plain, () => plain.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_root'"), ABORT.users_keep_one_admin_on_update);
  });

  test('foreign_keys OFF: rows can point at nothing, and the self-check says so', () => {
    const sql = cast(openBare({ foreignKeys: false }));
    entry(sql, { points: 5, member_id: 'mbr_nobody' });
    session(sql, { user_id: 'usr_ada' });
    sql.run("DELETE FROM users WHERE id = 'usr_ada'");
    assert.equal(count(sql, 'sessions', "user_id = 'usr_ada'"), 1, 'a session outlived its account');
    const found = violations(sql);
    assert.ok(found.includes('pragma_foreign_keys'));
    assert.ok(found.includes('foreign_key_check'));
  });

  test('foreign_keys OFF: "all-or-nothing" is lost, because the member row can go while their rows stay', () => {
    const sql = cast(openBare({ foreignKeys: false }));
    entry(sql, { points: 50 });
    const deduction = entry(sql, { points: -20 });
    setGuard(sql, 'mbr_ada');
    sql.run('DELETE FROM ledger_entries WHERE id = ?', [deduction]);
    sql.run("DELETE FROM members WHERE id = 'mbr_ada'");
    setGuard(sql, null);
    assert.equal(count(sql, 'ledger_entries', "member_id = 'mbr_ada'"), 1, 'one of two rows was deleted and the guard cleared');
    assert.ok(violations(sql).includes('foreign_key_check'));
    // What does not depend on the pragma still holds.
    refuses(sql, () => sql.run('DELETE FROM ledger_entries'), ABORT.ledger_no_delete);
    refuses(sql, () => sql.run('UPDATE ledger_entries SET points = 0'), ABORT.ledger_no_update);
  });

  test('CHECK constraints ignored: the append-only triggers do not depend on them', () => {
    const sql = cast(openBare({ recursiveTriggers: false }));
    sql.exec('PRAGMA ignore_check_constraints = ON');
    const id = entry(sql, { points: 50 });
    const row = audit(sql);
    refuses(sql, () => sql.run('UPDATE ledger_entries SET points = 0 WHERE id = ?', [id]), ABORT.ledger_no_update);
    refuses(sql, () => sql.run('DELETE FROM ledger_entries WHERE id = ?', [id]), ABORT.ledger_no_delete);
    refuses(sql, () => insert(sql, 'ledger_entries', { ...entryRow({ points: 500 }), id }, { verb: 'INSERT OR REPLACE' }), ABORT.ledger_no_replace);
    refuses(sql, () => sql.run('DELETE FROM audit_log WHERE id = ?', [row]), ABORT.audit_no_delete);
    refuses(sql, () => sql.run('INSERT INTO erasure_guard (id, member_id) VALUES (2, NULL)'), ABORT.erasure_guard_no_insert);
  });

  test('CHECK constraints ignored and recursive_triggers OFF: REPLACE still cannot rewrite a reversal', DEFECT('ledger_no_replace tests id and idempotency_key only; the one-reversal and one-award unique indexes are covered by the key CHECK alone, so with CHECKs ignored REPLACE deletes the old row silently'), () => {
    const sql = cast(openBare({ recursiveTriggers: false }));
    sql.exec('PRAGMA ignore_check_constraints = ON');
    entry(sql, { points: 50 });
    const deduction = entry(sql, { points: -20 });
    const original = reversal(sql, deduction, { reason: 'The first and only undo' });
    attempt(() => insert(sql, 'ledger_entries', reversalRow(sql, deduction, { idempotency_key: 'reversal:rewritten', reason: 'Rewritten history' }), { verb: 'INSERT OR REPLACE' }));
    assert.equal(count(sql, 'ledger_entries', 'id = ? AND reason = ?', [original, 'The first and only undo']), 1);
  });
});

// ---------------------------------------------------------------------------
// Defects in files this suite does not own
// ---------------------------------------------------------------------------

describe('Found on the way: defects outside schema.sql', () => {
  test('src/db/sqlite.js: exec() refuses REPLACE statements like get(), all() and run() do', DEFECT('Db.exec() skips the REPLACE check, so "the adapter rejects them" is only true for parameterised statements'), () => {
    const sql = stage();
    assert.throws(() => sql.db.run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('probe', '1', ?)", [T0]), /REPLACE statements are not allowed/);
    assert.throws(() => sql.db.exec(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('probe', '1', '${T0}')`), /REPLACE statements are not allowed/);
  });

  test('src/domain/claims.js: a percent-encoded link to a tracked video is not a second subject', DEFECT('submitClaim() looks for the tracked id in the raw link, so "v=demoLong00%31" is accepted next to a claim against the video itself and both can be approved'), async () => {
    const { createContext, withActor } = await import('../../src/domain/context.js');
    const { submitClaim } = await import('../../src/domain/claims.js');
    const sql = stage();
    sql.run("INSERT INTO settings (key, value, updated_at) VALUES ('feedback_min_chars', '10', ?)", [T0]);
    video(sql, 'vid_demo', { platform_video_id: 'demoLong001' });
    const ada = withActor(createContext({ db: sql.db, clock: fixedClock(T0) }), { userId: 'usr_ada', role: 'member', memberId: 'mbr_ada' });
    submitClaim(ada, { task_type_id: 'tsk_feedback', video_id: 'vid_demo', evidence_text: 'The hook lands, but the captions cover the product in the second half.' });
    assert.throws(
      () => submitClaim(ada, { task_type_id: 'tsk_feedback', evidence_url: 'https://www.youtube.com/watch?v=demoLong00%31', evidence_text: 'A second paragraph about the very same video, sent through its link.' }),
      (error) => error.name === 'AppError',
    );
    assert.equal(count(sql, 'claims'), 1);
  });
});

// ---------------------------------------------------------------------------
// Coverage of the suite itself
// ---------------------------------------------------------------------------

test('every trigger in schema.sql was fired by this run', (t) => {
  // A partial run (a name filter, or --test-only) cannot have fired everything.
  if (process.execArgv.some((flag) => /^--test-(name-pattern|skip-pattern|only)/.test(flag))) {
    t.skip('partial run');
    return;
  }
  const all = openApplication().all("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").map((trigger) => trigger.name);
  const fired = firedTriggers();
  assert.deepEqual(all.filter((name) => !fired.has(name)), [], 'triggers no test has exercised');
  closeOpened();
});
