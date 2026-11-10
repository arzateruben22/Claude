// Red-team suite for src/db/schema.sql.
//
// The schema's header makes twelve promises (P1-P12) and says each is enforced by the
// database itself, not only by application code. This file takes that literally: it never
// calls src/domain to change data. Every attack writes rows with raw SQL, attempts ONE
// forbidden statement, and requires
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
// green by itself once the schema is fixed.

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
  ROWID_MISMATCH,
  T0,
  UNIQUE,
  approvedClaim,
  at,
  audit,
  auditRow,
  award,
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
  refusedOneByOne,
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

/** Runs one step of a longer attack; a refusal anywhere along the chain is the wanted outcome. */
const attempt = (step) => {
  try {
    step();
    return true;
  } catch {
    return false;
  }
};

const workingAdmins = (sql) => count(sql, 'users', "role = 'admin' AND status = 'active' AND last_login_at IS NOT NULL");
const justTheCast = () => ({ sql: stage() });

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
  const pendingClaim = () => {
    const sql = stage();
    return { sql, claimId: claim(sql) };
  };
  const approve = ({ sql, claimId }) => sql.run("UPDATE claims SET decision = 'approved', decided_at = ?, decided_by = 'usr_root' WHERE id = ?", [T0, claimId]);

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

  describe('approving by UPDATE alone', () => {
    const reviewedClaim = () => {
      const world = pendingClaim();
      markReviewed(world.sql, world.claimId);
      return world;
    };
    refusedOneByOne(pendingClaim, needsAward, { 'a claim nobody reviewed cannot be approved by UPDATE': approve });
    refusedOneByOne(reviewedClaim, needsAward, { 'a reviewed claim cannot be approved by UPDATE either': approve });

    test('beneath the trigger, a CHECK refuses an approved claim that nobody reviewed', () => {
      const world = pendingClaim();
      dropTrigger(world.sql, 'claims_transitions');
      refuses(world.sql, () => approve(world), CHECK("decision <> 'approved' OR verification_status IN"));
    });
  });

  describe('exactly one award', () => {
    const secondAward = either(ABORT.ledger_no_replace, ABORT.ledger_award_requires_reviewed_claim);
    const awarded = () => {
      const sql = stage();
      return { sql, ...approvedClaim(sql) };
    };
    refusedOneByOne(awarded, secondAward, {
      'the same award again is refused': ({ sql, claimId }) => award(sql, claimId),
      'a second award with another date and reason is refused': ({ sql, claimId }) => award(sql, claimId, { created_at: at(9), reason: 'Approved again' }),
      'a second award written by another account is refused': ({ sql, claimId }) => award(sql, claimId, { actor_user_id: 'usr_bo' }),
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
  });

  describe('the twenty possible moves between decisions', () => {
    const moveTo = (sql, claimId, decision) =>
      decision === 'pending'
        ? sql.run("UPDATE claims SET decision = 'pending', decided_at = NULL, decided_by = NULL, decision_note = NULL WHERE id = ?", [claimId])
        : sql.run("UPDATE claims SET decision = ?, decided_at = ?, decided_by = 'usr_root', decision_note = 'A note the member can read.' WHERE id = ?", [decision, at(30), claimId]);

    // An UPDATE on its own may make exactly two of them.
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
  });

  describe('a rejection needs a recorded reviewer and a real note', () => {
    const reject = (decidedBy, note) => ({ sql, claimId }) => sql.run("UPDATE claims SET decision = 'rejected', decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?", [T0, decidedBy, note, claimId]);
    refusedOneByOne(pendingClaim, needsReviewerAndNote, {
      'a rejection with no reviewer is refused': reject(null, 'Too short to review.'),
      'a rejection with no note is refused': reject('usr_root', null),
      'a rejection with a blank note is refused': reject('usr_root', '    '),
      'a rejection with a two-letter note is refused': reject('usr_root', ' no '),
      'a rejection by an account that does not exist is refused': [reject('usr_nobody', 'Too short to review.'), FOREIGN_KEY],
      'a rejection note longer than 500 characters is refused': [reject('usr_root', 'x'.repeat(501)), CHECK('length(decision_note) <= 500')],
    });

    test('legal: a rejection with a reviewer and a note', () => {
      const world = pendingClaim();
      reject('usr_root', 'Too short to review.')(world);
      assert.equal(claimOf(world.sql, world.claimId).decision, 'rejected');
    });
  });

  describe('decision bookkeeping', () => {
    const pendingIsBlank = CHECK("decision <> 'pending' OR (decided_at IS NULL AND decided_by IS NULL AND decision_note IS NULL)");
    refusedOneByOne(pendingClaim, pendingIsBlank, {
      'a pending claim cannot carry a decision time': ({ sql, claimId }) => sql.run('UPDATE claims SET decided_at = ? WHERE id = ?', [T0, claimId]),
      'a pending claim cannot carry a reviewer': ({ sql, claimId }) => sql.run("UPDATE claims SET decided_by = 'usr_root' WHERE id = ?", [claimId]),
      'a pending claim cannot carry a decision note': ({ sql, claimId }) => sql.run("UPDATE claims SET decision_note = 'Looks fine to me.' WHERE id = ?", [claimId]),
      'a decided claim always has a time': [({ sql, claimId }) => sql.run("UPDATE claims SET decision = 'withdrawn' WHERE id = ?", [claimId]), CHECK("decision = 'pending' OR decided_at IS NOT NULL")],
      'a decision outside the five known ones is refused': [({ sql, claimId }) => sql.run("UPDATE claims SET decision = 'archived', decided_at = ? WHERE id = ?", [T0, claimId]), illegal],
      'a NULL decision is refused by a plain UPDATE': [({ sql, claimId }) => sql.run('UPDATE claims SET decision = NULL WHERE id = ?', [claimId]), NOT_NULL('claims.decision')],
    });
  });

  // A NULL written with UPDATE OR REPLACE is replaced by the column default ('pending') AFTER the
  // BEFORE UPDATE triggers ran, and those triggers compare the decision with <>, which is not true for NULL.
  const unDecide = (sql, claimId) => sql.run('UPDATE OR REPLACE claims SET decision = NULL, decided_at = NULL, decided_by = NULL, decision_note = NULL WHERE id = ?', [claimId]);

  for (const from of ['approved', 'rejected', 'withdrawn', 'revoked']) {
    test(`UPDATE OR REPLACE with a NULL decision cannot turn a claim that was ${from} back into a pending one`, DEFECT('claims.decision = NULL under UPDATE OR REPLACE falls back to the column default and un-decides the claim'), () => {
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
    attempt(() => approvedClaim(sql, { evidence_text: text }));
    assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 }, 'the same text was credited twice');
    assert.equal(claimOf(sql, claimId).decision, 'approved');
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

  describe('one live claim per member, task and subject', () => {
    const alreadyClaimed = (decision) => () => {
      const sql = stage();
      claimIn(sql, decision, { evidence_text: TEXT });
      claimIn(sql, decision, { video_id: 'vid_yt' });
      return { sql };
    };
    for (const decision of ['pending', 'approved']) {
      refusedOneByOne(alreadyClaimed(decision), ABORT.claims_no_replace, {
        [`the same text again is refused while the first claim is ${decision}`]: ({ sql }) => claim(sql, { evidence_text: TEXT }),
        [`the same text entered later by an admin is refused while the first claim is ${decision}`]: ({ sql }) => claim(sql, { evidence_text: TEXT, created_at: at(90), submitted_by: 'usr_root', submitted_by_role: 'admin' }),
        [`the same video again is refused while the first claim is ${decision}`]: ({ sql }) => claim(sql, { video_id: 'vid_yt' }),
        [`the same video with different words is refused while the first claim is ${decision}`]: ({ sql }) => claim(sql, { video_id: 'vid_yt', evidence_text: 'Entirely new wording about the same video.' }),
      });
    }

    for (const decision of ['rejected', 'withdrawn', 'revoked']) {
      test(`legal: a ${decision} claim frees the subject, so the member can try again, once`, () => {
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
      claim(sql, { evidence_text: TEXT, task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20 });
      assert.equal(count(sql, 'claims'), 3);
    });

    test('beneath the trigger, the unique index and the primary key refuse the duplicate on their own', () => {
      const sql = stage();
      const existing = claim(sql, { evidence_text: TEXT });
      dropTrigger(sql, 'claims_no_replace');
      refuses(sql, () => claim(sql, { evidence_text: TEXT }), UNIQUE('claims.member_id, claims.task_type_id, claims.subject_key, claims.exception_seq'));
      refuses(sql, () => claim(sql, { id: existing, evidence_text: 'Different text, same id.' }), UNIQUE('claims.id'));
    });
  });

  describe('what a subject key may be', () => {
    refusedOneByOne(justTheCast, subjectIsVideo, {
      'a claim about a tracked video cannot use a url: subject': ({ sql }) => claim(sql, { video_id: 'vid_yt', subject_key: 'url:https://youtu.be/ytSample001' }),
      'a claim about a tracked video cannot use a text: subject': ({ sql }) => claim(sql, { video_id: 'vid_yt', evidence_text: TEXT, subject_key: `text:${sha256(TEXT)}` }),
      'a claim about one tracked video cannot use the subject of another': ({ sql }) => claim(sql, { video_id: 'vid_yt', subject_key: 'video:vid_tt' }),
      'the video subject is compared exactly, not case-insensitively': ({ sql }) => claim(sql, { video_id: 'vid_yt', subject_key: 'video:VID_YT' }),
      'a claim with no video cannot use a video: subject': ({ sql }) => claim(sql, { video_id: null, subject_key: 'video:vid_yt' }),
    });
    refusedOneByOne(justTheCast, subjectPrefix, {
      'a subject with an unknown prefix is refused': ({ sql }) => claim(sql, { subject_key: 'misc:thing' }),
      'a url: subject with nothing after the colon is refused': ({ sql }) => claim(sql, { subject_key: 'url:' }),
      'a subject prefix in capitals is refused': ({ sql }) => claim(sql, { subject_key: 'URL:https://example.test/a' }),
      'an empty subject is refused': ({ sql }) => claim(sql, { subject_key: '' }),
      'a subject with no colon is refused': ({ sql }) => claim(sql, { subject_key: 'video' }),
      'a video: subject with nothing after the colon is refused': [({ sql }) => claim(sql, { subject_key: 'video:' }), either(subjectPrefix, subjectIsVideo)],
      'a missing subject is refused': [({ sql }) => claim(sql, { subject_key: null }), NOT_NULL('claims.subject_key')],
    });

    test('legal: a claim about a tracked video has that video as its subject', () => {
      const sql = stage();
      const claimId = claim(sql, { video_id: 'vid_yt' });
      assert.equal(claimOf(sql, claimId).subject_key, 'video:vid_yt');
    });
  });

  describe('a text: subject is exactly the evidence hash', () => {
    refusedOneByOne(justTheCast, ABORT.claims_text_subject_is_evidence_hash, {
      'a text: subject that is the hash of some other text is refused': ({ sql }) => claim(sql, { evidence_text: TEXT, subject_key: `text:${sha256('some other text')}` }),
      'a text: subject that differs from the hash only in case is refused': ({ sql }) => claim(sql, { evidence_text: TEXT, subject_key: `text:${sha256(TEXT).toUpperCase()}` }),
      'a text: subject on a claim with no evidence hash is refused': ({ sql }) => claim(sql, { evidence_text: TEXT, evidence_hash: null, subject_key: `text:${sha256(TEXT)}` }),
      'a text: subject with nothing after the colon is refused': ({ sql }) => claim(sql, { evidence_text: TEXT, subject_key: 'text:' }),
    });

    test('legal: the hash of the evidence text as the subject', () => {
      const sql = stage();
      const claimId = claim(sql, { evidence_text: TEXT });
      assert.equal(claimOf(sql, claimId).subject_key, `text:${sha256(TEXT)}`);
    });
  });

  describe('a link to a tracked video must be submitted against that video', () => {
    const links = {
      'the watch link of a tracked YouTube video': 'https://www.youtube.com/watch?v=ytSample001',
      'the short link of a tracked YouTube video': 'https://youtu.be/ytSample001?t=42',
      'the mobile link of a tracked YouTube video': 'https://m.youtube.com/watch?feature=share&v=ytSample001',
      'the link of a tracked TikTok video': 'https://www.tiktok.com/@sample/video/7300000000000000001',
    };
    refusedOneByOne(
      justTheCast,
      ABORT.claims_tracked_video_url_must_use_video,
      Object.fromEntries(Object.entries(links).map(([name, link]) => [`${name}, submitted without the video, is refused`, ({ sql }) => claim(sql, { evidence_url: link })])),
    );

    test('legal: the same link next to its video, a link to something untracked, and no link at all', () => {
      const sql = stage();
      const against = claim(sql, { video_id: 'vid_yt', evidence_url: 'https://www.youtube.com/watch?v=ytSample001' });
      assert.equal(claimOf(sql, against).subject_key, 'video:vid_yt');
      claim(sql, { evidence_url: 'https://example.test/portfolio/edit-7' });
      claim(sql, { evidence_url: null });
      assert.equal(count(sql, 'claims'), 3);
    });
  });

  describe('a claim has evidence of some kind', () => {
    const textRule = CHECK('length(evidence_text) <= 4000 AND length(trim(evidence_text)) > 0');
    refusedOneByOne(justTheCast, textRule, {
      'a claim with no text, no link and no video is refused': [({ sql }) => claim(sql, { evidence_text: null, evidence_url: null, video_id: null, subject_key: 'url:nothing-at-all' }), CHECK('evidence_text IS NOT NULL OR evidence_url IS NOT NULL OR video_id IS NOT NULL')],
      'evidence text made of spaces is refused': ({ sql }) => claim(sql, { evidence_text: '   ' }),
      'empty evidence text is refused': ({ sql }) => claim(sql, { evidence_text: '' }),
      'evidence text of 4001 characters is refused': ({ sql }) => claim(sql, { evidence_text: 'x'.repeat(4001) }),
      'an evidence link of more than 500 characters is refused': [({ sql }) => claim(sql, { evidence_url: `https://example.test/${'x'.repeat(480)}` }), CHECK('length(evidence_url) <= 500')],
    });

    test('legal: 4000 characters of text, and a video with no words at all', () => {
      const sql = stage();
      claim(sql, { evidence_text: 'x'.repeat(4000) });
      claim(sql, { evidence_text: null, video_id: 'vid_yt' });
      assert.equal(count(sql, 'claims'), 2);
    });
  });

  describe('exceptions: a logged second credit for something already credited', () => {
    const exception = (overrides = {}) =>
      claimRow({ evidence_text: TEXT, exception_seq: 1, exception_reason: 'Counted again by agreement with the group.', submitted_by: 'usr_root', submitted_by_role: 'admin', ...overrides });
    const grant = (overrides) => ({ sql }) => insert(sql, 'claims', exception(overrides));
    const notNext = ABORT.claims_exception_is_next;
    const pairRule = CHECK('(exception_seq = 0) = (exception_reason IS NULL)');
    const after = (decision) => () => {
      const sql = stage();
      claimIn(sql, decision, { evidence_text: TEXT });
      return { sql };
    };

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

    refusedOneByOne(justTheCast, notNext, { 'an exception with nothing claimed before it is refused': grant() });
    for (const decision of ['pending', 'rejected', 'withdrawn', 'revoked']) {
      refusedOneByOne(after(decision), notNext, { [`an exception after a ${decision} claim is refused`]: grant() });
    }

    refusedOneByOne(after('approved'), notNext, {
      'an exception entered by a member account is refused': grant({ submitted_by: 'usr_ada', submitted_by_role: 'member' }),
      'an exception entered by a member account that calls itself admin is refused': grant({ submitted_by: 'usr_ada' }),
      'an exception with no recorded author is refused': grant({ submitted_by: null }),
      'an exception by an account that does not exist is refused': grant({ submitted_by: 'usr_nobody' }),
      'an exception with a blank reason is refused': grant({ exception_reason: '     ' }),
      'an exception with a two-letter reason is refused': grant({ exception_reason: ' ok ' }),
      'an exception for another member is refused': grant({ member_id: 'mbr_bo' }),
      'an exception for another task is refused': grant({ task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20 }),
      'an exception for another subject is refused': grant({ evidence_text: 'Some other text entirely.' }),
      'an exception that skips a number is refused': grant({ exception_seq: 2 }),
      'an exception far ahead of the sequence is refused': grant({ exception_seq: 7 }),
      'an exception with no reason at all is refused': [grant({ exception_reason: null }), pairRule],
      'an ordinary claim that carries an exception reason is refused': [({ sql }) => claim(sql, { exception_seq: 0, exception_reason: 'A reason with no exception.' }), pairRule],
      'a negative exception number is refused': [grant({ exception_seq: -1 }), CHECK('exception_seq >= 0')],
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
  const creative = (overrides = {}) => ({ task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20, evidence_text: null, evidence_url: 'https://www.youtube.com/watch?v=untracked01', subject_key: 'url:youtube/untracked01', ...overrides });
  /** One claim that has been reviewed and waits for its award, and one that nobody has looked at. */
  const reviewedClaim = () => {
    const sql = stage();
    const claimId = claim(sql);
    markReviewed(sql, claimId);
    const unreviewed = claim(sql, { video_id: 'vid_yt' });
    return { sql, claimId, unreviewed };
  };

  describe('an award needs a pending, reviewed claim and must match it', () => {
    refusedOneByOne(reviewedClaim, needsReviewedClaim, {
      'an award for another member than the claim\'s is refused': ({ sql, claimId }) => award(sql, claimId, { member_id: 'mbr_bo' }),
      'an award worth one point more than the claim is refused': ({ sql, claimId }) => award(sql, claimId, { points: 26 }),
      'an award worth the maximum is refused': ({ sql, claimId }) => award(sql, claimId, { points: 1000 }),
      'an award worth one point less than the claim is refused': ({ sql, claimId }) => award(sql, claimId, { points: 24 }),
      'an award with one XP more than the claim is refused': ({ sql, claimId }) => award(sql, claimId, { xp: 11 }),
      'an award with no XP is refused': ({ sql, claimId }) => award(sql, claimId, { xp: 0 }),
      'an award with points and XP swapped is refused': ({ sql, claimId }) => award(sql, claimId, { points: 10, xp: 25 }),
      'an award for a claim that does not exist is refused': ({ sql }) => award(sql, 'clm_missing'),
      'an award that names no claim is refused': ({ sql }) => entry(sql, { kind: 'task_award', bucket: 'earned', points: 25, xp: 10, idempotency_key: 'award:nothing' }),
      'an award for a claim nobody reviewed is refused': ({ sql, unreviewed }) => award(sql, unreviewed),
      'a bonus cannot name a claim': [({ sql, claimId }) => entry(sql, { kind: 'bonus', points: 25, xp: 10, claim_id: claimId }), CHECK("(kind = 'task_award') = (claim_id IS NOT NULL)")],
      'an adjustment cannot name a claim': [({ sql, claimId }) => entry(sql, { kind: 'adjustment', points: 25, xp: 10, claim_id: claimId }), CHECK("(kind = 'task_award') = (claim_id IS NOT NULL)")],
      'an award cannot land in the bonus bucket': [({ sql, claimId }) => award(sql, claimId, { bucket: 'bonus' }), CHECK("kind <> 'task_award' OR (points >= 0 AND xp >= 0 AND bucket = 'earned')")],
    });

    for (const decision of ['rejected', 'withdrawn']) {
      test(`an award for a ${decision} claim is refused, even one that had been reviewed`, () => {
        const { sql, claimId } = reviewedClaim();
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

    test('legal: a manually reviewed claim and a platform-attested claim can both be awarded', () => {
      const { sql, claimId } = reviewedClaim();
      award(sql, claimId);
      const attested = claim(sql, creative({ member_id: 'mbr_bo', submitted_by: 'usr_bo' }));
      sql.run("UPDATE claims SET verification_status = 'verified', verification_source = 'youtube_api', verified_at = ? WHERE id = ?", [T0, attested]);
      award(sql, attested);
      assert.deepEqual(balance(sql, 'mbr_ada'), { earned: 25, bonus: 0, xp: 10 });
      assert.deepEqual(balance(sql, 'mbr_bo'), { earned: 40, bonus: 0, xp: 20 });
      assert.equal(count(sql, 'claims', "decision = 'approved'"), 2);
      assert.equal(count(sql, 'claims', "decision = 'pending'"), 1, 'the claim nobody reviewed is still waiting');
    });
  });

  describe('"earned" grows only through an award', () => {
    /** mbr_ada: 25 earned and 10 XP from an award, 50 bonus and 50 XP from a credit. */
    const holding = () => {
      const sql = stage();
      approvedClaim(sql);
      entry(sql, { points: 50, xp: 50, reason: 'Starting balance' });
      return { sql };
    };
    const earnedOnlyByAward = CHECK("kind <> 'adjustment' OR bucket = 'bonus' OR (points <= 0 AND xp <= 0)");
    const bonusShape = CHECK("kind <> 'bonus' OR (points >= 0 AND xp >= 0 AND bucket = 'bonus')");
    refusedOneByOne(holding, earnedOnlyByAward, {
      'a positive adjustment into "earned" is refused': ({ sql }) => entry(sql, { bucket: 'earned', points: 5 }),
      'XP alone adjusted into "earned" is refused': ({ sql }) => entry(sql, { bucket: 'earned', xp: 5 }),
      'points into "earned" disguised by an XP deduction are refused': ({ sql }) => entry(sql, { bucket: 'earned', points: 5, xp: -5 }),
      'XP into "earned" disguised by a points deduction is refused': ({ sql }) => entry(sql, { bucket: 'earned', points: -5, xp: 5 }),
      'the largest possible adjustment into "earned" is refused': ({ sql }) => entry(sql, { bucket: 'earned', points: 100000, xp: 100000 }),
      'a bonus cannot land in "earned"': [({ sql }) => entry(sql, { kind: 'bonus', bucket: 'earned', points: 5 }), bonusShape],
      'a bonus cannot take points away': [({ sql }) => entry(sql, { kind: 'bonus', points: -5 }), bonusShape],
      'a bonus cannot take XP away': [({ sql }) => entry(sql, { kind: 'bonus', points: 5, xp: -5 }), bonusShape],
    });

    test('legal: an adjustment may take from "earned" and add to "bonus"; a bonus adds to "bonus"', () => {
      const { sql } = holding();
      entry(sql, { bucket: 'earned', points: -10, xp: -1 });
      entry(sql, { bucket: 'bonus', points: 7, xp: 3 });
      entry(sql, { kind: 'bonus', points: 5 });
      assert.deepEqual(balance(sql), { earned: 15, bonus: 62, xp: 62 });
    });

    test('undoing a deduction can only give back what an award put there', () => {
      const { sql } = holding();
      const deduction = entry(sql, { bucket: 'earned', points: -10 });
      assert.equal(balance(sql).earned, 15);
      reversal(sql, deduction);
      assert.equal(balance(sql).earned, 25, '"earned" is back to exactly the award');
      refuses(sql, () => reversal(sql, deduction), ABORT.ledger_no_replace);
      assert.equal(sql.get("SELECT COALESCE(SUM(points), 0) AS points FROM ledger_entries WHERE bucket = 'earned' AND kind = 'task_award'").points, 25);
    });
  });

  describe('a claim is worth exactly what its task was worth when it was submitted', () => {
    const mismatch = ABORT.claims_snapshot_matches_task;
    const withVideoTask = () => {
      const sql = stage();
      taskType(sql, 'tsk_about_video', { requires_video: 1 });
      taskType(sql, 'tsk_closed', { active: 0 });
      return { sql };
    };
    refusedOneByOne(withVideoTask, mismatch, {
      'a claim worth one point more than its task is refused': ({ sql }) => claim(sql, { points_snapshot: 26 }),
      'a claim worth the maximum is refused': ({ sql }) => claim(sql, { points_snapshot: 1000, xp_snapshot: 1000 }),
      'a claim with less XP than its task is refused': ({ sql }) => claim(sql, { xp_snapshot: 0 }),
      'a claim carrying the values of another task is refused': ({ sql }) => claim(sql, { task_type_id: 'tsk_creative' }),
      'a claim for a task that does not exist is refused': ({ sql }) => claim(sql, { task_type_id: 'tsk_missing' }),
      'a claim for a task that is closed is refused': ({ sql }) => claim(sql, { task_type_id: 'tsk_closed' }),
      'a claim without a video for a task about a video is refused': ({ sql }) => claim(sql, { task_type_id: 'tsk_about_video' }),
      'a link does not stand in for the video such a task requires': ({ sql }) => claim(sql, { task_type_id: 'tsk_about_video', evidence_url: 'https://example.test/not-a-tracked-video' }),
    });

    test('legal: the snapshot follows the task as it is today, and earlier claims keep theirs', () => {
      const { sql } = withVideoTask();
      const before = claim(sql);
      sql.run("UPDATE task_types SET points = 30 WHERE id = 'tsk_feedback'");
      refuses(sql, () => claim(sql), mismatch);
      const afterwards = claim(sql, { points_snapshot: 30 });
      claim(sql, { task_type_id: 'tsk_about_video', video_id: 'vid_yt' });
      assert.equal(claimOf(sql, before).points_snapshot, 25);
      assert.equal(claimOf(sql, afterwards).points_snapshot, 30);
    });

    test('beneath the trigger, a claim worth nothing or out of range cannot exist', () => {
      const sql = stage();
      dropTrigger(sql, 'claims_snapshot_matches_task');
      refuses(sql, () => claim(sql, { points_snapshot: 0, xp_snapshot: 0 }), CHECK('points_snapshot > 0 OR xp_snapshot > 0'));
      refuses(sql, () => claim(sql, { points_snapshot: 1001 }), CHECK('points_snapshot BETWEEN 0 AND 1000'));
      refuses(sql, () => claim(sql, { xp_snapshot: -1 }), CHECK('xp_snapshot BETWEEN 0 AND 1000'));
    });
  });

  describe('a claim starts pending and unverified', () => {
    const reviewedFields = { verification_status: 'manually_reviewed', verification_source: 'admin_review', verified_at: T0 };
    const decidedFields = { decided_at: T0, decided_by: 'usr_root', decision_note: 'Inserted as decided.' };
    refusedOneByOne(justTheCast, ABORT.claims_start_pending, {
      'a claim cannot be inserted already approved': ({ sql }) => claim(sql, { decision: 'approved', ...reviewedFields, ...decidedFields }),
      'a claim cannot be inserted already rejected': ({ sql }) => claim(sql, { decision: 'rejected', ...decidedFields }),
      'a claim cannot be inserted already withdrawn': ({ sql }) => claim(sql, { decision: 'withdrawn', decided_at: T0 }),
      'a claim cannot be inserted already revoked': ({ sql }) => claim(sql, { decision: 'revoked', ...reviewedFields, ...decidedFields }),
      'a claim cannot be inserted already reviewed': ({ sql }) => claim(sql, reviewedFields),
      'a claim cannot be inserted already verified': ({ sql }) => claim(sql, creative({ verification_status: 'verified', verification_source: 'mock_adapter', verified_at: T0 })),
    });

    test('legal: spelling out the starting state is the same as leaving it to the defaults', () => {
      const sql = stage();
      const claimId = claim(sql, { decision: 'pending', verification_status: 'unverified', verification_source: 'none' });
      const row = claimOf(sql, claimId);
      assert.deepEqual([row.decision, row.verification_status, row.verification_source, row.exception_seq], ['pending', 'unverified', 'none', 0]);
    });
  });

  test('an award is never dated before the claim it rewards was submitted', DEFECT('ledger_award_requires_reviewed_claim does not compare dates, so an award (and its cap month) can be backdated to before its claim existed'), () => {
    const { sql, claimId } = reviewedClaim();
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
        const key = sql.get('SELECT idempotency_key FROM ledger_entries WHERE id = ?', [deduction]).idempotency_key;
        return { sql, credit, deduction, key };
      };
      const rewritten = (overrides) => entryRow({ points: 500, reason: 'Rewritten after the fact', ...overrides });

      refusedOneByOne(
        ledger,
        ABORT.ledger_no_update,
        Object.fromEntries(Object.entries(REWRITES).map(([column, value]) => [`UPDATE of ${column} is refused`, ({ sql, deduction }) => sql.run(`UPDATE ledger_entries SET ${column} = ? WHERE id = ?`, [value, deduction])])),
      );

      refusedOneByOne(ledger, ABORT.ledger_no_update, {
        'an UPDATE that changes nothing is refused': ({ sql, deduction }) => sql.run('UPDATE ledger_entries SET points = points WHERE id = ?', [deduction]),
        'an UPDATE aimed at every row is refused': ({ sql }) => sql.run('UPDATE ledger_entries SET points = 0, xp = 1'),
        'UPDATE OR IGNORE is refused, not ignored': ({ sql, deduction }) => sql.run("UPDATE OR IGNORE ledger_entries SET reason = 'Quietly changed' WHERE id = ?", [deduction]),
        'UPDATE OR REPLACE is refused': ({ sql, deduction }) => sql.run("UPDATE OR REPLACE ledger_entries SET idempotency_key = 'req:usr_root:moved' WHERE id = ?", [deduction]),
      });

      refusedOneByOne(ledger, ABORT.ledger_no_delete, {
        'DELETE of one entry is refused': ({ sql, deduction }) => sql.run('DELETE FROM ledger_entries WHERE id = ?', [deduction]),
        'DELETE of a member\'s entries is refused': ({ sql }) => sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada'"),
        'DELETE of every entry is refused': ({ sql }) => sql.run('DELETE FROM ledger_entries'),
        'DELETE ... RETURNING is refused': ({ sql, deduction }) => sql.all('DELETE FROM ledger_entries WHERE id = ? RETURNING id', [deduction]),
      });

      refusedOneByOne(ledger, ABORT.ledger_no_replace, {
        'INSERT OR REPLACE over an existing key is refused': ({ sql, key }) => insert(sql, 'ledger_entries', rewritten({ idempotency_key: key }), { verb: 'INSERT OR REPLACE' }),
        'REPLACE INTO over an existing key is refused': ({ sql, key }) => insert(sql, 'ledger_entries', rewritten({ idempotency_key: key }), { verb: 'REPLACE' }),
        'INSERT OR REPLACE over an existing id, moving the row to another member, is refused': ({ sql, deduction }) => insert(sql, 'ledger_entries', { ...rewritten({ member_id: 'mbr_bo' }), id: deduction }, { verb: 'INSERT OR REPLACE' }),
        'REPLACE INTO over an existing id is refused': ({ sql, deduction }) => insert(sql, 'ledger_entries', { ...rewritten(), id: deduction }, { verb: 'REPLACE' }),
        'an UPSERT that would update on a key conflict is refused': ({ sql, key }) => insert(sql, 'ledger_entries', rewritten({ idempotency_key: key }), { tail: 'ON CONFLICT (idempotency_key) DO UPDATE SET points = 500' }),
        'an UPSERT that would update on an id conflict is refused': ({ sql, deduction }) => insert(sql, 'ledger_entries', { ...rewritten(), id: deduction }, { tail: 'ON CONFLICT (id) DO UPDATE SET points = excluded.points' }),
        'ON CONFLICT DO NOTHING is refused rather than silently doing nothing': ({ sql, key }) => insert(sql, 'ledger_entries', rewritten({ idempotency_key: key }), { tail: 'ON CONFLICT DO NOTHING' }),
        'INSERT OR IGNORE of a duplicate key is refused rather than ignored': ({ sql, key }) => insert(sql, 'ledger_entries', rewritten({ idempotency_key: key }), { verb: 'INSERT OR IGNORE' }),
        'a plain INSERT of a duplicate key is refused': ({ sql, key }) => insert(sql, 'ledger_entries', rewritten({ idempotency_key: key })),
        'a plain INSERT that reuses an id is refused': ({ sql, credit }) => insert(sql, 'ledger_entries', { ...rewritten(), id: credit }),
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

  test('legal: ids are handed out in order, and the high-water mark is remembered', () => {
    const sql = stage();
    const first = entry(sql, { points: 5 });
    const second = entry(sql, { points: 5 });
    assert.equal(second, first + 1);
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

  /**
   * Both members hold plenty, so a refusal here is never the never-negative rule.
   * mbr_ada has a +50 / +5 credit, a -20 / -2 deduction, an October credit, a competition prize, and
   * "restored" (the reversal of a second deduction).
   */
  const wellStocked = () => {
    const sql = stage();
    competition(sql, 'cmp_one');
    competition(sql, 'cmp_two');
    entry(sql, { points: 500, xp: 500, reason: 'Starting balance' });
    entry(sql, { member_id: 'mbr_bo', points: 500, xp: 500, reason: 'Starting balance' });
    const credit = entry(sql, { points: 50, xp: 5, reason: 'Credit' });
    const deduction = entry(sql, { points: -20, xp: -2, reason: 'Deduction' });
    const october = entry(sql, { points: 40, period: '2026-10', created_at: '2026-10-20T10:00:00.000Z', reason: 'October credit' });
    const prize = entry(sql, { kind: 'bonus', points: 30, competition_id: 'cmp_one', reason: 'Prize' });
    const restored = reversal(sql, entry(sql, { points: -10, xp: -1, reason: 'Deduction made by mistake' }));
    return { sql, credit, deduction, october, prize, restored };
  };
  const undo = (target, overrides) => (world) => reversal(world.sql, world[target], overrides);

  refusedOneByOne(wellStocked, mustMirror, {
    'a reversal one point short of its target is refused': undo('credit', { points: -49 }),
    'a reversal one point over its target is refused': undo('credit', { points: -51 }),
    'a reversal that leaves the points in place is refused': undo('credit', { points: 0 }),
    'a reversal one XP short of its target is refused': undo('credit', { xp: -4 }),
    'a reversal that leaves the XP in place is refused': undo('credit', { xp: 0 }),
    'a "reversal" with the same sign as its target is refused': undo('credit', { points: 50, xp: 5 }),
    'a reversal with points and XP swapped is refused': undo('credit', { points: -5, xp: -50 }),
    'a reversal written to another member is refused': undo('credit', { member_id: 'mbr_bo' }),
    'a reversal into the other bucket is refused': undo('deduction', { bucket: 'earned' }),
    'a reversal of a deduction that gives back less is refused': undo('deduction', { points: 19 }),
    'a reversal dated a minute before its target is refused': undo('credit', { created_at: at(-1) }),
    'a reversal dated days before its target is refused': undo('deduction', { created_at: '2026-11-01T00:00:00.000Z' }),
    'a reversal counted in the month it was written, not its target\'s, is refused': undo('october', { period: PERIOD }),
    'a reversal counted in an arbitrary month is refused': undo('october', { period: '2031-07' }),
    'a reversal that adds a competition its target does not have is refused': undo('credit', { competition_id: 'cmp_one' }),
    'a reversal that drops the competition of its target is refused': undo('prize', { competition_id: null }),
    'a reversal that names another competition than its target is refused': undo('prize', { competition_id: 'cmp_two' }),
    'a reversal of an entry that does not exist is refused': ({ sql }) => entry(sql, { kind: 'reversal', points: 5, reverses_entry_id: 9999, idempotency_key: 'reversal:9999' }),
    'a reversal that names no target is refused': ({ sql }) => entry(sql, { kind: 'reversal', points: 5, idempotency_key: 'reversal:1' }),
    'a reversal of a reversal is refused': undo('restored'),
    'an adjustment cannot name a target': [({ sql, credit }) => entry(sql, { kind: 'adjustment', points: 5, reverses_entry_id: credit }), CHECK("(kind = 'reversal') = (reverses_entry_id IS NOT NULL)")],
    'a bonus cannot name a target': [({ sql, credit }) => entry(sql, { kind: 'bonus', points: 5, reverses_entry_id: credit }), CHECK("(kind = 'reversal') = (reverses_entry_id IS NOT NULL)")],
  });

  describe('exactly once', () => {
    const undone = () => {
      const world = wellStocked();
      return { ...world, first: reversal(world.sql, world.deduction) };
    };
    refusedOneByOne(undone, ABORT.ledger_no_replace, {
      'a second reversal of the same entry is refused': undo('deduction'),
      'a second reversal with another date, reason and author is refused': undo('deduction', { created_at: at(60), reason: 'Undone again', actor_user_id: 'usr_bo' }),
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
  });

  test('legal: the exact mirror of an entry undoes it', () => {
    const { sql, credit, deduction } = wellStocked();
    const before = balance(sql);
    const undoCredit = reversal(sql, credit, { created_at: at(10) });
    const undoDeduction = reversal(sql, deduction, { created_at: T0 });
    assert.deepEqual(balance(sql), { earned: 0, bonus: before.bonus - 50 + 20, xp: before.xp - 5 + 2 });
    const row = sql.get('SELECT kind, points, xp, bucket, period, reverses_entry_id, idempotency_key FROM ledger_entries WHERE id = ?', [undoCredit]);
    assert.deepEqual({ ...row }, { kind: 'reversal', points: -50, xp: -5, bucket: 'bonus', period: PERIOD, reverses_entry_id: credit, idempotency_key: `reversal:${credit}` });
    assert.ok(undoDeduction > undoCredit);
  });

  test("legal: a reversal written in November counts in its target's October, and may carry the same timestamp as its target", () => {
    const { sql, october, credit } = wellStocked();
    const undoOctober = reversal(sql, october);
    assert.deepEqual({ ...sql.get('SELECT period, created_at FROM ledger_entries WHERE id = ?', [undoOctober]) }, { period: '2026-10', created_at: T0 });
    reversal(sql, credit, { created_at: T0 });
    assert.equal(count(sql, 'ledger_entries', "kind = 'reversal'"), 3);
  });

  test('legal: a reversal carries the competition of its target, or none when the target has none', () => {
    const { sql, credit, prize } = wellStocked();
    const undoPrize = reversal(sql, prize);
    const undoCredit = reversal(sql, credit);
    assert.equal(sql.get('SELECT competition_id FROM ledger_entries WHERE id = ?', [undoPrize]).competition_id, 'cmp_one');
    assert.equal(sql.get('SELECT competition_id FROM ledger_entries WHERE id = ?', [undoCredit]).competition_id, null);
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

  test('legal: undoing something that is not an award touches no claim', () => {
    const { sql, credit } = wellStocked();
    const { claimId } = approvedClaim(sql);
    const before = claimOf(sql, claimId);
    reversal(sql, credit);
    assert.deepEqual(claimOf(sql, claimId), before);
  });

  describe('after an award has been undone', () => {
    const revoked = () => {
      const sql = stage();
      const { claimId, awardId } = approvedClaim(sql);
      reversal(sql, awardId);
      return { sql, claimId, awardId };
    };
    refusedOneByOne(revoked, ABORT.ledger_no_replace, {
      'the revoked claim cannot be awarded again': [({ sql, claimId }) => award(sql, claimId), either(ABORT.ledger_no_replace, ABORT.ledger_award_requires_reviewed_claim)],
      'its award cannot be reversed a second time': [({ sql, awardId }) => reversal(sql, awardId), either(ABORT.ledger_no_replace, ABORT.ledger_never_negative)],
    });
  });
});

// ---------------------------------------------------------------------------
// P6
// ---------------------------------------------------------------------------

describe('P6  Engagement (likes, comments, views, follows) has NO path to points', () => {
  const POINT_TABLES = ['ledger_entries', 'claims', 'task_types', 'competitions', 'tiers', 'settings'];
  const columnsOf = (sql, table) => sql.all(`SELECT name FROM pragma_table_info('${table}')`).map((column) => column.name);
  const tablesOf = (sql) => sql.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((table) => table.name);

  test('platform statistics live in three columns of one table, and nothing else mentions them', () => {
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

  test('no table, column, index or trigger name trips the wording lint that keeps points virtual', () => {
    const sql = openApplication();
    const names = [
      ...tablesOf(sql).flatMap((table) => [table, ...columnsOf(sql, table)]),
      ...sql.all("SELECT name FROM sqlite_master WHERE type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%'").map((object) => object.name),
    ];
    assert.deepEqual(names.filter((name) => findMoneyTerm(name.replace(/_/g, ' ')) !== null), []);
  });

  refusedOneByOne(justTheCast, CHECK("api_check IN ('none', 'video_ownership')"), {
    'an entry of a kind outside the four contribution kinds is refused': [({ sql }) => entry(sql, { kind: 'engagement', points: 5 }), CHECK("kind IN ('task_award', 'bonus', 'adjustment', 'reversal')")],
    'an entry in a bucket other than earned or bonus is refused': [({ sql }) => entry(sql, { bucket: 'engagement', points: 5 }), CHECK("bucket IN ('earned', 'bonus')")],
    'a task with an automatic check other than video ownership cannot be created': ({ sql }) => taskType(sql, 'tsk_counted', { api_check: 'engagement_count' }),
    'an existing task cannot be given such a check': ({ sql }) => sql.run("UPDATE task_types SET api_check = 'engagement_count' WHERE id = 'tsk_feedback'"),
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
  const populated = (open) => () => {
    const sql = cast(open());
    const ada = approvedClaim(sql);
    const adaDeduction = entry(sql, { bucket: 'earned', points: -5 });
    reversal(sql, adaDeduction);
    const adaPending = claim(sql, { video_id: 'vid_yt' });
    const bo = approvedClaim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    const boPending = claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    markReviewed(sql, boPending);
    audit(sql, { action: 'ledger.adjust', entity_type: 'ledger_entry', entity_id: String(adaDeduction), subject_member_id: 'mbr_ada', detail: '{"points":-5}' });
    session(sql, { user_id: 'usr_ada' });
    return { sql, ada, adaDeduction, adaPending, bo, boPending };
  };
  const erasing = (open, memberId) => () => {
    const world = populated(open)();
    setGuard(world.sql, memberId);
    return world;
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
      const world = populated(connection.open);
      const erasingAda = erasing(connection.open, 'mbr_ada');

      refusedOneByOne(world, ABORT.claims_no_delete, {
        'with no erasure in progress, a pending claim cannot be deleted': ({ sql, adaPending }) => sql.run('DELETE FROM claims WHERE id = ?', [adaPending]),
        'with no erasure in progress, an approved claim cannot be deleted': ({ sql, ada }) => sql.run('DELETE FROM claims WHERE id = ?', [ada.claimId]),
        'with no erasure in progress, all pending claims cannot be deleted at once': ({ sql }) => sql.run("DELETE FROM claims WHERE decision = 'pending'"),
        'with no erasure in progress, the claims table cannot be emptied': ({ sql }) => sql.run('DELETE FROM claims'),
      });

      refusedOneByOne(erasingAda, ABORT.ledger_no_delete, {
        'the guard set for one member does not unlock another member\'s ledger entry': ({ sql, bo }) => sql.run('DELETE FROM ledger_entries WHERE id = ?', [bo.awardId]),
        'the guard set for one member does not unlock all of another member\'s ledger': ({ sql }) => sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_bo'"),
        'the guard set for one member does not unlock the whole ledger': ({ sql }) => sql.run('DELETE FROM ledger_entries'),
        'the guard set for one member does not unlock another member\'s claim': [({ sql, boPending }) => sql.run('DELETE FROM claims WHERE id = ?', [boPending]), ABORT.claims_no_delete],
        'the guard set for one member does not unlock the whole claims table': [({ sql }) => sql.run('DELETE FROM claims'), either(ABORT.claims_no_delete, FOREIGN_KEY)],
        'the guard permits deleting, never rewriting, the member\'s ledger rows': [({ sql }) => sql.run("UPDATE ledger_entries SET points = 0 WHERE member_id = 'mbr_ada'"), ABORT.ledger_no_update],
      });

      refusedOneByOne(world, ABORT.erasure_guard_set, {
        'the guard cannot name a member that does not exist': ({ sql }) => setGuard(sql, 'mbr_nobody'),
        'the guard cannot be set to an empty id': ({ sql }) => setGuard(sql, ''),
      });
      refusedOneByOne(erasingAda, ABORT.erasure_guard_set, {
        'the guard cannot be moved to a second member while it is set': ({ sql }) => setGuard(sql, 'mbr_bo'),
        'the guard cannot be set twice for the same member': ({ sql }) => setGuard(sql, 'mbr_ada'),
      });

      const partlyErased = () => {
        const erasure = erasingAda();
        erasure.sql.run('DELETE FROM ledger_entries WHERE reverses_entry_id = ?', [erasure.adaDeduction]);
        erasure.sql.run('DELETE FROM ledger_entries WHERE id = ?', [erasure.adaDeduction]);
        return erasure;
      };
      refusedOneByOne(erasingAda, ABORT.erasure_guard_clear, { 'the guard cannot be cleared while the member still exists': ({ sql }) => setGuard(sql, null) });
      refusedOneByOne(partlyErased, ABORT.erasure_guard_clear, { 'the guard cannot be cleared after deleting only some of the member\'s rows': ({ sql }) => setGuard(sql, null) });

      refusedOneByOne(world, ABORT.erasure_guard_no_insert, {
        'a second guard row cannot be inserted': ({ sql }) => sql.run('INSERT INTO erasure_guard (id, member_id) VALUES (2, NULL)'),
        'the guard row cannot be inserted again under its own id': ({ sql }) => sql.run("INSERT INTO erasure_guard (id, member_id) VALUES (1, 'mbr_ada')"),
        'INSERT OR REPLACE cannot set the guard': ({ sql }) => sql.run("INSERT OR REPLACE INTO erasure_guard (id, member_id) VALUES (1, 'mbr_ada')"),
        'REPLACE INTO cannot set the guard': ({ sql }) => sql.run("REPLACE INTO erasure_guard (id, member_id) VALUES (1, 'mbr_ada')"),
        'INSERT OR IGNORE into the guard is refused rather than ignored': ({ sql }) => sql.run('INSERT OR IGNORE INTO erasure_guard (id, member_id) VALUES (1, NULL)'),
        'the guard row cannot be deleted': [({ sql }) => sql.run('DELETE FROM erasure_guard'), ABORT.erasure_guard_no_delete],
        'the guard row cannot be deleted by id': [({ sql }) => sql.run('DELETE FROM erasure_guard WHERE id = 1'), ABORT.erasure_guard_no_delete],
        'the guard row cannot be renumbered': [({ sql }) => sql.run('UPDATE erasure_guard SET id = 2'), CHECK('id = 1')],
      });

      refusedOneByOne(erasingAda, ABORT.ledger_no_insert_during_erasure, {
        'during an erasure no ledger entry can be written for the member being erased': ({ sql }) => entry(sql, { points: 5 }),
        'during an erasure no ledger entry can be written for anyone else': ({ sql }) => entry(sql, { member_id: 'mbr_bo', points: 5 }),
        'during an erasure no claim can be awarded': ({ sql, boPending }) => award(sql, boPending),
        'during an erasure the member being erased cannot submit a claim': [({ sql }) => claim(sql), ABORT.claims_no_insert_during_erasure],
        'during an erasure nobody else can submit a claim': [({ sql }) => claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo', video_id: 'vid_tt' }), ABORT.claims_no_insert_during_erasure],
      });

      describe('REPLACE and UPSERT against claims', () => {
        const overId = ({ ada }) => claimRow({ id: ada.claimId, member_id: 'mbr_bo', submitted_by: 'usr_bo', evidence_text: 'Swapped in over an approved claim.' });
        const overSubject = ({ sql, boPending }) => claimRow({ member_id: 'mbr_bo', submitted_by: 'usr_bo', evidence_text: claimOf(sql, boPending).evidence_text });
        const cases = {};
        for (const verb of ['INSERT OR REPLACE', 'REPLACE', 'INSERT OR IGNORE', 'INSERT']) {
          cases[`${verb} over the id of an approved claim is refused`] = (w) => insert(w.sql, 'claims', overId(w), { verb });
          cases[`${verb} over the subject of a pending claim is refused`] = (w) => insert(w.sql, 'claims', overSubject(w), { verb });
        }
        cases['an UPSERT that would rewrite a claim on an id conflict is refused'] = (w) => insert(w.sql, 'claims', overId(w), { tail: "ON CONFLICT (id) DO UPDATE SET evidence_text = 'rewritten'" });
        cases['ON CONFLICT DO NOTHING over an existing claim is refused rather than silently doing nothing'] = (w) => insert(w.sql, 'claims', overId(w), { tail: 'ON CONFLICT DO NOTHING' });
        refusedOneByOne(world, ABORT.claims_no_replace, cases);
      });

      test('legal: the guard is a one-row switch that starts and ends clear', () => {
        const { sql } = world();
        assert.deepEqual(sql.all('SELECT id, member_id FROM erasure_guard').map((row) => ({ ...row })), [{ id: 1, member_id: null }]);
        setGuard(sql, null);
        assert.equal(guard(sql), null);
        setGuard(sql, 'mbr_ada');
        assert.equal(guard(sql), 'mbr_ada');
      });

      test('legal: an erasure deletes the member\'s rows for real and leaves everyone else exactly as they were', () => {
        const { sql, bo } = world();
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
        const { sql, adaPending } = world();
        const before = snapshot(sql);
        sql.exec('BEGIN IMMEDIATE');
        setGuard(sql, 'mbr_ada');
        sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada' AND kind = 'reversal'");
        sql.run('DELETE FROM claims WHERE id = ?', [adaPending]);
        refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
        sql.exec('ROLLBACK');
        assert.deepEqual(snapshot(sql), before);
      });

      test('a guard that was left set cannot go unnoticed: every later ledger and claim insert fails', () => {
        const { sql } = erasingAda();
        sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada' AND kind = 'reversal'");
        refuses(sql, () => entry(sql, { member_id: 'mbr_bo', points: 5 }), ABORT.ledger_no_insert_during_erasure);
        refuses(sql, () => claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo', video_id: 'vid_tt' }), ABORT.claims_no_insert_during_erasure);
        refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
      });
    });
  }

  describe('with foreign keys on, the member row is the last thing to go', () => {
    const removeMember = ({ sql }) => sql.run("DELETE FROM members WHERE id = 'mbr_ada'");
    const stepsTaken = (...statements) => () => {
      const world = erasing(openApplication, 'mbr_ada')();
      for (const statement of statements) world.sql.run(statement);
      return world;
    };
    const ledgerGone = "DELETE FROM ledger_entries WHERE member_id = 'mbr_ada'";
    const claimsGone = "DELETE FROM claims WHERE member_id = 'mbr_ada'";
    refusedOneByOne(stepsTaken(), FOREIGN_KEY, { 'the member row cannot be deleted while ledger rows point at it': removeMember });
    refusedOneByOne(stepsTaken(ledgerGone), FOREIGN_KEY, { 'the member row cannot be deleted while claims point at it': removeMember });
    refusedOneByOne(stepsTaken(ledgerGone, claimsGone), FOREIGN_KEY, {
      'the member row cannot be deleted while an account points at it': removeMember,
      'the member row cannot be re-keyed while an account points at it': ({ sql }) => sql.run("UPDATE members SET id = 'mbr_renamed' WHERE id = 'mbr_ada'"),
    });

    test('legal: once nothing points at the member the row can go, and only then does the guard clear', () => {
      const { sql } = stepsTaken(ledgerGone, claimsGone, "DELETE FROM users WHERE member_id = 'mbr_ada'")();
      refuses(sql, () => setGuard(sql, null), ABORT.erasure_guard_clear);
      removeMember({ sql });
      setGuard(sql, null);
      assert.equal(guard(sql), null);
    });
  });

  test('what the guard really guarantees: it never clears while a ledger row, claim or account of that member remains', () => {
    // The guard asks "is there still a member row with this id?". Re-keying the row answers no, just as
    // deleting and re-creating it would, and no schema can tell those apart. What cannot be got round is
    // that neither is possible until every row that points at the member is gone.
    const sql = stage();
    entry(sql, { points: 50 });
    claim(sql);
    setGuard(sql, 'mbr_ada');
    const rename = () => sql.run("UPDATE members SET id = 'mbr_parked' WHERE id = 'mbr_ada'");
    refuses(sql, rename, FOREIGN_KEY);
    sql.run("DELETE FROM ledger_entries WHERE member_id = 'mbr_ada'");
    refuses(sql, rename, FOREIGN_KEY);
    sql.run("DELETE FROM claims WHERE member_id = 'mbr_ada'");
    refuses(sql, rename, FOREIGN_KEY);
    sql.run("DELETE FROM users WHERE member_id = 'mbr_ada'");
    rename();
    setGuard(sql, null);
    assert.equal(count(sql, 'ledger_entries', "member_id IN ('mbr_ada', 'mbr_parked')") + count(sql, 'claims', "member_id IN ('mbr_ada', 'mbr_parked')"), 0);
  });

  test('with recursive_triggers OFF, un-deciding a claim cannot delete another claim through REPLACE', DEFECT('UPDATE OR REPLACE ... SET decision = NULL re-enters the live index; with recursive_triggers OFF the conflicting pending claim is deleted without claims_no_delete firing'), () => {
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
  const self = { actor_user_id: 'usr_ada' };
  /**
   * usr_ada becomes an admin who is also the member mbr_ada. mbr_ada holds 50 / 50 in "bonus", 25 / 10
   * "earned", a deduction in each bucket, and a reviewed claim waiting for its award.
   */
  const selfLinkedAdmin = () => {
    const sql = stage();
    sql.run("UPDATE users SET role = 'admin', last_login_at = ? WHERE id = 'usr_ada'", [T0]);
    entry(sql, { points: 50, xp: 50, reason: 'Starting balance' });
    approvedClaim(sql);
    const bonusDeduction = entry(sql, { points: -20, xp: -2 });
    const earnedDeduction = entry(sql, { bucket: 'earned', points: -5 });
    const waiting = claim(sql, { video_id: 'vid_yt' });
    markReviewed(sql, waiting);
    return { sql, bonusDeduction, earnedDeduction, waiting };
  };

  refusedOneByOne(selfLinkedAdmin, ABORT.ledger_no_self_credit, {
    'a linked account cannot grant its member a points bonus': ({ sql }) => entry(sql, { ...self, kind: 'bonus', points: 5 }),
    'a linked account cannot grant its member an XP bonus': ({ sql }) => entry(sql, { ...self, kind: 'bonus', xp: 5 }),
    'a linked account cannot write its member a positive adjustment': ({ sql }) => entry(sql, { ...self, points: 5 }),
    'a linked account cannot write its member a single XP': ({ sql }) => entry(sql, { ...self, xp: 1 }),
    'a linked account cannot swap its member\'s points for XP': ({ sql }) => entry(sql, { ...self, points: -5, xp: 5 }),
    'a linked account cannot swap its member\'s XP for points': ({ sql }) => entry(sql, { ...self, points: 5, xp: -5 }),
    'a linked account cannot write its member the largest possible credit': ({ sql }) => entry(sql, { ...self, points: 100000, xp: 100000 }),
    'a linked account cannot award its own member\'s claim': ({ sql, waiting }) => award(sql, waiting, self),
    'INSERT OR IGNORE does not get a self-award past the rule': ({ sql, waiting }) => award(sql, waiting, self, { verb: 'INSERT OR IGNORE' }),
    'a linked account cannot undo a bonus deduction on its own member': ({ sql, bonusDeduction }) => reversal(sql, bonusDeduction, self),
    'a linked account cannot undo an earned deduction on its own member': ({ sql, earnedDeduction }) => reversal(sql, earnedDeduction, self),
  });

  test('legal: a linked account may take away from its own member, credit other members, and be credited by someone else', () => {
    const { sql, bonusDeduction, waiting } = selfLinkedAdmin();
    const credit = entry(sql, { points: 10, xp: 1 });
    entry(sql, { ...self, points: -5, xp: -5 });
    reversal(sql, credit, self);
    reversal(sql, bonusDeduction);
    entry(sql, { ...self, member_id: 'mbr_bo', kind: 'bonus', points: 5 });
    const bosClaim = claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
    markReviewed(sql, bosClaim);
    award(sql, bosClaim, self);
    assert.equal(claimOf(sql, bosClaim).decided_by, 'usr_ada');
    award(sql, waiting, { actor_user_id: 'usr_bo' });
    assert.equal(claimOf(sql, waiting).decision, 'approved');
    assert.deepEqual(balance(sql), { earned: 45, bonus: 45, xp: 65 });
  });

  test('the rule follows the link as it is when the entry is written, NULL included', () => {
    const { sql } = selfLinkedAdmin();
    member(sql, 'mbr_cy');
    sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_ada'");
    entry(sql, { ...self, points: 5 });
    refuses(sql, () => entry(sql, { ...self, member_id: 'mbr_cy', points: 5 }), ABORT.ledger_no_self_credit);
    sql.run("UPDATE users SET member_id = NULL WHERE id = 'usr_ada'");
    entry(sql, { ...self, member_id: 'mbr_cy', points: 5 });
    assert.equal(balance(sql, 'mbr_cy').bonus, 5);
  });

  test('beneath ledger_no_self_credit, the approval itself refuses a reviewer linked to the member', () => {
    const { sql, waiting } = selfLinkedAdmin();
    dropTrigger(sql, 'ledger_no_self_credit');
    refuses(sql, () => award(sql, waiting, self), ABORT.claims_no_self_approval);
    assert.equal(count(sql, 'ledger_entries', 'claim_id = ?', [waiting]), 0, 'the award row went with the refused approval');
  });

  describe('an approval always has a recorded reviewer who is not the member', () => {
    // With the trigger that normally performs the approval removed, the UPDATE can be attempted by hand.
    const awardedButNotApproved = () => {
      const world = selfLinkedAdmin();
      dropTrigger(world.sql, 'ledger_award_approves_claim');
      award(world.sql, world.waiting);
      return world;
    };
    const approveAs = (decidedBy) => ({ sql, waiting }) => sql.run("UPDATE claims SET decision = 'approved', decided_at = ?, decided_by = ? WHERE id = ?", [T0, decidedBy, waiting]);
    refusedOneByOne(awardedButNotApproved, ABORT.claims_no_self_approval, {
      'an approval with no reviewer is refused': approveAs(null),
      'an approval by the account linked to the claim\'s member is refused': approveAs('usr_ada'),
      'an approval by an account that does not exist is refused': [approveAs('usr_nobody'), FOREIGN_KEY],
    });

    test('legal: an approval recorded for an account linked to a different member', () => {
      const world = awardedButNotApproved();
      approveAs('usr_bo')(world);
      assert.equal(claimOf(world.sql, world.waiting).decision, 'approved');
    });
  });
});

// ---------------------------------------------------------------------------
// P9
// ---------------------------------------------------------------------------

describe('P9  There is always an admin who can sign in', () => {
  const lastAdminUpdate = ABORT.users_keep_one_admin_on_update;
  const lastAdminDelete = ABORT.users_keep_one_admin_on_delete;
  /** usr_root is the only working admin; usr_typo never signed in and usr_former is disabled. */
  const oneWorkingAdmin = () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    user(sql, 'usr_typo', { role: 'admin' });
    user(sql, 'usr_former', { role: 'admin', status: 'disabled', last_login_at: T0 });
    return { sql };
  };
  const twoWorkingAdmins = () => {
    const sql = stage();
    user(sql, 'usr_second', { role: 'admin', last_login_at: T0 });
    return { sql };
  };
  const lesser = { id: 'usr_root', email: 'usrroot@example.test', role: 'member', member_id: 'mbr_cy', created_at: T0 };

  refusedOneByOne(oneWorkingAdmin, lastAdminUpdate, {
    'the last working admin cannot be demoted': ({ sql }) => sql.run("UPDATE users SET role = 'member', member_id = 'mbr_cy' WHERE id = 'usr_root'"),
    'the last working admin cannot be disabled': ({ sql }) => sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_root'"),
    'the last working admin cannot be made to look never-signed-in': ({ sql }) => sql.run("UPDATE users SET last_login_at = NULL WHERE id = 'usr_root'"),
    'the last working admin cannot be demoted, disabled and reset in one statement': ({ sql }) => sql.run("UPDATE users SET role = 'member', status = 'disabled', member_id = 'mbr_cy', last_login_at = NULL WHERE id = 'usr_root'"),
    'the last working admin cannot be deleted': [({ sql }) => sql.run("DELETE FROM users WHERE id = 'usr_root'"), lastAdminDelete],
    'the last working admin cannot be deleted along with the other admin rows': [({ sql }) => sql.run("DELETE FROM users WHERE role = 'admin'"), lastAdminDelete],
    'INSERT OR REPLACE cannot swap the last working admin for a member row': [({ sql }) => insert(sql, 'users', lesser, { verb: 'INSERT OR REPLACE' }), lastAdminDelete],
    'REPLACE INTO cannot take the last working admin\'s address for another row': [({ sql }) => insert(sql, 'users', { ...lesser, id: 'usr_other' }, { verb: 'REPLACE' }), lastAdminDelete],
    'UPDATE OR REPLACE cannot take the last working admin\'s address for another row': [({ sql }) => sql.run("UPDATE OR REPLACE users SET email = 'usrroot@example.test' WHERE id = 'usr_bo'"), lastAdminDelete],
  });

  refusedOneByOne(twoWorkingAdmins, lastAdminUpdate, {
    'one statement cannot disable every admin': ({ sql }) => sql.run("UPDATE users SET status = 'disabled' WHERE role = 'admin'"),
    'one statement cannot reset every sign-in': ({ sql }) => sql.run('UPDATE users SET last_login_at = NULL'),
    'one statement cannot delete every admin': [({ sql }) => sql.run("DELETE FROM users WHERE role = 'admin'"), lastAdminDelete],
  });

  for (const [how, leave] of Object.entries({
    disabled: "UPDATE users SET status = 'disabled' WHERE id = 'usr_second'",
    deleted: "DELETE FROM users WHERE id = 'usr_second'",
    'reset to never-signed-in': "UPDATE users SET last_login_at = NULL WHERE id = 'usr_second'",
  })) {
    test(`legal: with two working admins one may be ${how}, and then the survivor is protected`, () => {
      const { sql } = twoWorkingAdmins();
      sql.run(leave);
      assert.equal(workingAdmins(sql), 1);
      refuses(sql, () => sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_root'"), lastAdminUpdate);
      refuses(sql, () => sql.run("DELETE FROM users WHERE id = 'usr_root'"), lastAdminDelete);
    });
  }

  test('legal: admin rows that cannot sign in are not protected, and removing them leaves the working admin', () => {
    const { sql } = oneWorkingAdmin();
    sql.run("DELETE FROM users WHERE id = 'usr_typo'");
    sql.run("DELETE FROM users WHERE id = 'usr_former'");
    assert.equal(workingAdmins(sql), 1);
  });

  test('legal: everything else about the last admin may change', () => {
    const { sql } = oneWorkingAdmin();
    sql.run("UPDATE users SET last_login_at = ? WHERE id = 'usr_root'", [at(5)]);
    sql.run("UPDATE users SET email = 'renamed@example.test' WHERE id = 'usr_root'");
    sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_root'");
    sql.run("UPDATE users SET role = 'admin', status = 'active' WHERE id = 'usr_root'");
    assert.equal(workingAdmins(sql), 1);
  });

  refusedOneByOne(justTheCast, CHECK("role = 'admin' OR member_id IS NOT NULL"), {
    'an account that is not an admin must be attached to a member': ({ sql }) => user(sql, 'usr_loose', { role: 'member' }),
    'a member account cannot be detached from its member': ({ sql }) => sql.run("UPDATE users SET member_id = NULL WHERE id = 'usr_ada'"),
    'a role outside admin and member is refused': [({ sql }) => user(sql, 'usr_owner', { role: 'owner' }), CHECK("role IN ('admin', 'member')")],
    'a status outside active and disabled is refused': [({ sql }) => sql.run("UPDATE users SET status = 'banned' WHERE id = 'usr_ada'"), CHECK("status IN ('active', 'disabled')")],
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
      /**
       * aboutAda      every column filled, about mbr_ada
       * sparseAda     about mbr_ada, with every nullable column NULL except detail
       * aboutBo       about mbr_bo
       * aboutNobody   a settings change with no subject
       */
      const trail = () => {
        const sql = cast(connection.open());
        const aboutAda = audit(sql, { action: 'ledger.adjust', entity_type: 'ledger_entry', entity_id: '17', subject_member_id: 'mbr_ada', detail: '{"points":-500}', request_id: 'req_1' });
        const sparseAda = audit(sql, { actor_user_id: null, actor_role: 'system', action: 'member.restore', entity_type: 'member', subject_member_id: 'mbr_ada', detail: '{"restored":true}' });
        const aboutBo = audit(sql, { action: 'claim.reject', entity_type: 'claim', entity_id: 'clm_x', subject_member_id: 'mbr_bo', detail: '{"verification_status":"unverified"}' });
        const aboutNobody = audit(sql, { detail: '{"monthly_cap":300}' });
        return { sql, aboutAda, sparseAda, aboutBo, aboutNobody };
      };
      const erasingAda = () => {
        const world = trail();
        setGuard(world.sql, 'mbr_ada');
        return world;
      };
      const over = ({ aboutAda }) => ({ ...auditRow({ actor_role: 'system', action: 'nothing.happened', entity_type: 'thing' }), id: aboutAda });

      refusedOneByOne(
        trail,
        frozen,
        Object.fromEntries(
          Object.entries(REWRITES).flatMap(([column, value]) => [
            [`UPDATE of ${column} on a row about a member is refused`, ({ sql, aboutAda }) => sql.run(`UPDATE audit_log SET ${column} = ? WHERE id = ?`, [value, aboutAda])],
            [`UPDATE of ${column} on a row with no subject is refused`, ({ sql, aboutNobody }) => sql.run(`UPDATE audit_log SET ${column} = ? WHERE id = ?`, [value, aboutNobody])],
          ]),
        ),
      );

      refusedOneByOne(trail, frozen, {
        'outside an erasure, detail of a row about a member cannot be set to NULL': ({ sql, aboutAda }) => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutAda]),
        'outside an erasure, detail of a row with no subject cannot be set to NULL': ({ sql, aboutNobody }) => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutNobody]),
        'an UPDATE that changes nothing is refused': ({ sql }) => sql.run('UPDATE audit_log SET detail = detail'),
        'UPDATE OR REPLACE is refused': ({ sql, aboutAda }) => sql.run('UPDATE OR REPLACE audit_log SET id = id WHERE id = ?', [aboutAda]),
        'UPDATE OR REPLACE with a NULL time is refused': ({ sql, aboutAda }) => sql.run('UPDATE OR REPLACE audit_log SET at = NULL WHERE id = ?', [aboutAda]),
      });

      refusedOneByOne(trail, ABORT.audit_no_delete, {
        'DELETE of one audit row is refused': ({ sql, aboutAda }) => sql.run('DELETE FROM audit_log WHERE id = ?', [aboutAda]),
        'DELETE of a row with no subject is refused': ({ sql, aboutNobody }) => sql.run('DELETE FROM audit_log WHERE id = ?', [aboutNobody]),
        'DELETE of the whole trail is refused': ({ sql }) => sql.run('DELETE FROM audit_log'),
      });
      refusedOneByOne(erasingAda, ABORT.audit_no_delete, {
        'even during an erasure, a row about the erased member cannot be deleted': ({ sql, aboutAda }) => sql.run('DELETE FROM audit_log WHERE id = ?', [aboutAda]),
        'even during an erasure, the erased member\'s rows cannot be deleted together': ({ sql }) => sql.run("DELETE FROM audit_log WHERE subject_member_id = 'mbr_ada'"),
      });

      refusedOneByOne(trail, ABORT.audit_no_replace, {
        'INSERT OR REPLACE over an existing audit row is refused': (w) => insert(w.sql, 'audit_log', over(w), { verb: 'INSERT OR REPLACE' }),
        'REPLACE INTO over an existing audit row is refused': (w) => insert(w.sql, 'audit_log', over(w), { verb: 'REPLACE' }),
        'an UPSERT that would update an audit row is refused': (w) => insert(w.sql, 'audit_log', over(w), { tail: "ON CONFLICT (id) DO UPDATE SET action = 'nothing.happened'" }),
        'ON CONFLICT DO NOTHING over an audit row is refused rather than silently doing nothing': (w) => insert(w.sql, 'audit_log', over(w), { tail: 'ON CONFLICT DO NOTHING' }),
        'INSERT OR IGNORE over an audit row is refused rather than ignored': (w) => insert(w.sql, 'audit_log', over(w), { verb: 'INSERT OR IGNORE' }),
        'a plain INSERT that reuses an audit id is refused': (w) => insert(w.sql, 'audit_log', over(w)),
      });

      describe('scrubbing during an erasure', () => {
        const scrubAnd = (change, params = []) => ({ sql, aboutAda }) => sql.run(`UPDATE audit_log SET detail = NULL, ${change} WHERE id = ?`, [...params, aboutAda]);
        const scrubSparseAnd = (change) => ({ sql, sparseAda }) => sql.run(`UPDATE audit_log SET detail = NULL, ${change} WHERE id = ?`, [sparseAda]);
        refusedOneByOne(erasingAda, frozen, {
          'detail cannot be replaced by other JSON': ({ sql, aboutAda }) => sql.run("UPDATE audit_log SET detail = '{\"points\":5}' WHERE id = ?", [aboutAda]),
          'detail cannot be replaced by an empty string': ({ sql, aboutAda }) => sql.run("UPDATE audit_log SET detail = '' WHERE id = ?", [aboutAda]),
          'a row about another member cannot be scrubbed': ({ sql, aboutBo }) => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutBo]),
          'a row with no subject cannot be scrubbed': ({ sql, aboutNobody }) => sql.run('UPDATE audit_log SET detail = NULL WHERE id = ?', [aboutNobody]),
          'the whole trail cannot be scrubbed at once': ({ sql }) => sql.run('UPDATE audit_log SET detail = NULL'),
          'a scrub cannot also change who acted': scrubAnd("actor_user_id = 'usr_bo'"),
          'a scrub cannot also forget who acted': scrubAnd('actor_user_id = NULL'),
          'a scrub cannot also name an actor where there was none': scrubSparseAnd("actor_user_id = 'usr_bo'"),
          'a scrub cannot also change the entity id': scrubAnd("entity_id = '99'"),
          'a scrub cannot also forget the entity id': scrubAnd('entity_id = NULL'),
          'a scrub cannot also add an entity id where there was none': scrubSparseAnd("entity_id = '99'"),
          'a scrub cannot also change the request id': scrubAnd("request_id = 'req_forged'"),
          'a scrub cannot also forget the request id': scrubAnd('request_id = NULL'),
          'a scrub cannot also add a request id where there was none': scrubSparseAnd("request_id = 'req_forged'"),
          'a scrub cannot also move the row to another member': scrubAnd("subject_member_id = 'mbr_bo'"),
          'a scrub cannot also remove the subject': scrubAnd('subject_member_id = NULL'),
          'a scrub cannot also change the action': scrubAnd("action = 'nothing.happened'"),
          'a scrub cannot also change the role of the actor': scrubAnd("actor_role = 'system'"),
          'a scrub cannot also change the entity type': scrubAnd("entity_type = 'thing'"),
          'a scrub cannot also change the time': scrubAnd('at = ?', [at(1)]),
          'a scrub cannot also change the id': scrubAnd('id = 999'),
        });

        test('legal: detail of rows about THAT member is set to NULL, and nothing else changes', () => {
          const { sql, aboutAda, sparseAda } = erasingAda();
          const before = sql.all('SELECT * FROM audit_log ORDER BY id').map((row) => ({ ...row }));
          assert.equal(sql.run("UPDATE audit_log SET detail = NULL WHERE subject_member_id = 'mbr_ada'").changes, 2);
          const expected = before.map((row) => (row.id === aboutAda || row.id === sparseAda ? { ...row, detail: null } : row));
          assert.deepEqual(sql.all('SELECT * FROM audit_log ORDER BY id').map((row) => ({ ...row })), expected);
        });
      });
    });
  }

  describe('detail is small, valid JSON with no address and no link in it', () => {
    const details = {
      'an e-mail address in detail': '{"contact":"someone@example.test"}',
      'a link in detail': '{"link":"https://example.test/x"}',
      'a link with another scheme in detail': '{"scheme":"ftp://files.example.test"}',
      'an "@" in a key of detail': '{"a@b":1}',
      'detail that is not JSON': 'not json',
      'detail with unquoted keys': '{points:5}',
      'detail with single-quoted keys': "{'points':5}",
      'detail that is cut off': '{"points":5',
      'an empty detail string': '',
      'a detail string of spaces': '   ',
      'detail of 2001 characters': `{"padding":"${'x'.repeat(1987)}"}`,
    };
    refusedOneByOne(
      justTheCast,
      ABORT.audit_detail_is_impersonal,
      Object.fromEntries(Object.entries(details).map(([name, detail]) => [`${name} is refused`, ({ sql }) => audit(sql, { detail })])),
    );

    test('legal: no detail, small detail, and detail of exactly 2000 characters', () => {
      const sql = stage();
      audit(sql, { detail: null });
      audit(sql, { detail: '{"points":5,"period":"2026-11","on_behalf":false,"claim_id":"clm_1"}' });
      audit(sql, { detail: `{"padding":"${'x'.repeat(1986)}"}` });
      assert.equal(sql.get('SELECT MAX(length(detail)) AS longest FROM audit_log').longest, 2000);
    });
  });

  describe('a row about a member says which member, so an erasure can find it', () => {
    const cases = {};
    for (const entityType of ['claim', 'ledger_entry', 'member']) {
      cases[`a row about a ${entityType} with no subject is refused`] = ({ sql }) => audit(sql, { entity_type: entityType, entity_id: 'x1', action: 'thing.change' });
      cases[`a system row about a ${entityType} with no subject is refused`] = ({ sql }) => audit(sql, { entity_type: entityType, actor_role: 'system', actor_user_id: null });
    }
    cases['a row written by a member with no subject is refused'] = ({ sql }) => audit(sql, { actor_role: 'member', actor_user_id: 'usr_ada', action: 'auth.login', entity_type: 'user' });
    refusedOneByOne(justTheCast, ABORT.audit_member_rows_need_subject, cases);

    test('legal: the same rows with their subject, and rows about nobody without one', () => {
      const sql = stage();
      for (const entityType of ['claim', 'ledger_entry', 'member']) audit(sql, { entity_type: entityType, entity_id: 'x1', subject_member_id: 'mbr_ada' });
      audit(sql, { actor_role: 'member', actor_user_id: 'usr_ada', action: 'auth.login', entity_type: 'user', subject_member_id: 'mbr_ada' });
      audit(sql, { actor_role: 'system', actor_user_id: null, action: 'tiers.install_defaults', entity_type: 'tiers' });
      assert.equal(count(sql, 'audit_log'), 5);
    });
  });

  describe('an audit row has a well-formed time and a known kind of actor', () => {
    const timeRule = CHECK("at IS strftime('%Y-%m-%dT%H:%M:%fZ', at)");
    refusedOneByOne(justTheCast, timeRule, {
      'a time in SQLite\'s own format is refused': ({ sql }) => audit(sql, { at: '2026-11-09 20:00:00' }),
      'a time without milliseconds is refused': ({ sql }) => audit(sql, { at: '2026-11-09T20:00:00Z' }),
      'a time in words is refused': ({ sql }) => audit(sql, { at: 'yesterday' }),
      'an empty time is refused': ({ sql }) => audit(sql, { at: '' }),
      'a missing time is refused': [({ sql }) => audit(sql, { at: null }), NOT_NULL('audit_log.at')],
      'an actor role outside admin, member and system is refused': [({ sql }) => audit(sql, { actor_role: 'superuser' }), CHECK("actor_role IN ('admin', 'member', 'system')")],
      'a row with no action is refused': [({ sql }) => audit(sql, { action: null }), NOT_NULL('audit_log.action')],
      'a row with no entity type is refused': [({ sql }) => audit(sql, { entity_type: null }), NOT_NULL('audit_log.entity_type')],
    });
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

  refusedOneByOne(justTheCast, negative, {
    'a point cannot be taken from an empty bonus bucket': ({ sql }) => entry(sql, { points: -1 }),
    'a point cannot be taken from an empty earned bucket': ({ sql }) => entry(sql, { bucket: 'earned', points: -1 }),
    'an XP cannot be taken from an empty total': ({ sql }) => entry(sql, { xp: -1 }),
    'an XP cannot be taken from an empty total through the earned bucket': ({ sql }) => entry(sql, { bucket: 'earned', xp: -1 }),
    'the largest possible deduction from nothing is refused': ({ sql }) => entry(sql, { points: -100000, xp: -100000 }),
  });

  describe('each bucket stands alone, and XP is one total', () => {
    /** 50 points and 7 XP in "bonus"; 25 points and 10 XP "earned". */
    const bothBuckets = () => {
      const sql = stage();
      const credit = entry(sql, { points: 50, xp: 7 });
      const approved = approvedClaim(sql);
      return { sql, credit, ...approved };
    };
    refusedOneByOne(bothBuckets, negative, {
      'points in "bonus" do not cover a deduction from "earned"': ({ sql }) => entry(sql, { bucket: 'earned', points: -26 }),
      'points in "earned" do not cover a deduction from "bonus"': ({ sql }) => entry(sql, { bucket: 'bonus', points: -51 }),
      'both buckets together do not cover a deduction larger than either': ({ sql }) => entry(sql, { bucket: 'bonus', points: -75 }),
      'XP cannot go one below the total of both buckets': ({ sql }) => entry(sql, { xp: -18 }),
      'XP cannot go one below the total through the earned bucket': ({ sql }) => entry(sql, { bucket: 'earned', xp: -18 }),
      'an entry that adds points cannot hide an XP shortfall': ({ sql }) => entry(sql, { points: 5, xp: -18 }),
      'an entry that adds XP cannot hide a points shortfall': ({ sql }) => entry(sql, { points: -51, xp: 5 }),
      'INSERT OR IGNORE does not turn a shortfall into a silent no-op': ({ sql }) => entry(sql, { points: -51 }, { verb: 'INSERT OR IGNORE' }),
      'two deductions in one statement cannot go below zero together': ({ sql }) => {
        const row = (key) => `('mbr_ada', 'adjustment', 'bonus', -30, 0, '${key}', 'Two at once', 'usr_root', '${PERIOD}', '${T0}')`;
        return sql.run(`INSERT INTO ledger_entries (member_id, kind, bucket, points, xp, idempotency_key, reason, actor_user_id, period, created_at) VALUES ${row('req:usr_root:two-a')}, ${row('req:usr_root:two-b')}`);
      },
    });

    const after = (deduction) => () => {
      const world = bothBuckets();
      entry(world.sql, deduction);
      return world;
    };
    refusedOneByOne(after({ points: -30 }), negative, { 'a credit that has since been deducted from cannot be reversed': ({ sql, credit }) => reversal(sql, credit) });
    refusedOneByOne(after({ bucket: 'earned', points: -25 }), negative, { 'an award cannot be reversed while a deduction has used it up': ({ sql, awardId }) => reversal(sql, awardId) });
    refusedOneByOne(after({ bucket: 'bonus', xp: -8 }), negative, { 'an award cannot be reversed while its XP has been taken away elsewhere': ({ sql, awardId }) => reversal(sql, awardId) });

    test('legal: each balance may be taken to exactly zero', () => {
      const { sql } = bothBuckets();
      entry(sql, { bucket: 'bonus', points: -50 });
      entry(sql, { bucket: 'earned', points: -25 });
      entry(sql, { bucket: 'bonus', xp: -17 });
      assert.deepEqual(balance(sql), { earned: 0, bonus: 0, xp: 0 });
      refuses(sql, () => entry(sql, { points: -1 }), negative);
      refuses(sql, () => entry(sql, { xp: -1 }), negative);
    });

    test('legal: once the later deduction is undone, the credit can be reversed', () => {
      const { sql, credit } = bothBuckets();
      const deduction = entry(sql, { points: -30 });
      refuses(sql, () => reversal(sql, credit), negative);
      reversal(sql, deduction);
      reversal(sql, credit);
      assert.deepEqual(balance(sql), { earned: 25, bonus: 0, xp: 10 });
    });
  });

  describe('the size of one entry', () => {
    const holdingTheMaximum = () => {
      const sql = stage();
      entry(sql, { points: 100000, xp: 100000 });
      return { sql };
    };
    refusedOneByOne(holdingTheMaximum, CHECK('points BETWEEN -100000 AND 100000'), {
      'an entry of more than 100000 points is refused': ({ sql }) => entry(sql, { points: 100001 }),
      'a deduction of more than 100000 points is refused': [({ sql }) => entry(sql, { points: -100001 }), either(CHECK('points BETWEEN -100000 AND 100000'), negative)],
      'an entry of more than 100000 XP is refused': [({ sql }) => entry(sql, { xp: 100001 }), CHECK('xp BETWEEN -100000 AND 100000')],
      'an entry that moves nothing is refused': [({ sql }) => entry(sql, { points: 0, xp: 0 }), CHECK('points <> 0 OR xp <> 0')],
      'an entry with no points value is refused': [({ sql }) => entry(sql, { points: null, xp: 5 }), NOT_NULL('ledger_entries.points')],
      'an entry with no XP value is refused': [({ sql }) => entry(sql, { points: 5, xp: null }), NOT_NULL('ledger_entries.xp')],
    });

    test('legal: exactly 100000 either way', () => {
      const { sql } = holdingTheMaximum();
      entry(sql, { points: -100000, xp: -100000 });
      assert.deepEqual(balance(sql), { earned: 0, bonus: 0, xp: 0 });
    });
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
  const creativeClaim = (evidence) => () => {
    const sql = stage();
    return { sql, claimId: claim(sql, creative(EVIDENCE[evidence])) };
  };

  describe('who may attest what', () => {
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
        const { sql, claimId } = creativeClaim(evidence)();
        if (legal) {
          verify(sql, claimId, source);
          assert.equal(claimOf(sql, claimId).verification_status, 'verified');
        } else {
          refuses(sql, () => verify(sql, claimId, source), needsAttestation);
        }
      });
    }

    for (const source of ['youtube_api', 'tiktok_api', 'mock_adapter']) {
      const onPlainTask = () => {
        const sql = stage();
        return { sql, withLink: claim(sql, { evidence_url: 'https://www.youtube.com/watch?v=untracked01' }), withVideo: claim(sql, { video_id: 'vid_yt' }) };
      };
      refusedOneByOne(onPlainTask, needsAttestation, {
        [`a link claimed for a task with no automatic check cannot be verified by ${source}`]: ({ sql, withLink }) => verify(sql, withLink, source),
        [`a video claimed for a task with no automatic check cannot be verified by ${source}`]: ({ sql, withVideo }) => verify(sql, withVideo, source),
      });
    }

    const textOnly = () => {
      const sql = stage();
      return { sql, claimId: claim(sql, creative({ evidence_text: 'A description of a video, with no link to it.' })) };
    };
    refusedOneByOne(textOnly, needsAttestation, {
      'words alone cannot be verified by a platform': ({ sql, claimId }) => verify(sql, claimId, 'youtube_api'),
      'words alone cannot be verified even by the mock adapter': [({ sql, claimId }) => verify(sql, claimId, 'mock_adapter'), CHECK("verification_status <> 'verified' OR video_id IS NOT NULL OR evidence_url IS NOT NULL")],
    });

    test('the attesting platform cannot be swapped for the wrong one afterwards', () => {
      const { sql, claimId } = creativeClaim('a YouTube link')();
      verify(sql, claimId, 'youtube_api');
      refuses(sql, () => sql.run("UPDATE claims SET verification_source = 'tiktok_api' WHERE id = ?", [claimId]), needsAttestation);
      sql.run("UPDATE claims SET verification_source = 'mock_adapter' WHERE id = ?", [claimId]);
      assert.equal(claimOf(sql, claimId).verification_source, 'mock_adapter');
    });
  });

  describe('status, source and time always agree', () => {
    const set = (fields) => ({ sql, claimId }) => sql.run(`UPDATE claims SET ${fields} WHERE id = ?`, [claimId]);
    const unverifiedMeansNoSource = CHECK("(verification_status = 'unverified') = (verification_source = 'none')");
    const reviewedMeansPerson = CHECK("(verification_status = 'manually_reviewed') = (verification_source = 'admin_review')");
    const unverifiedMeansNoTime = CHECK("(verification_status = 'unverified') = (verified_at IS NULL)");
    refusedOneByOne(creativeClaim('a YouTube link'), unverifiedMeansNoSource, {
      'an unverified claim cannot name a reviewer as its source': set("verification_source = 'admin_review'"),
      'an unverified claim cannot name a platform as its source': set("verification_source = 'youtube_api'"),
      'a claim cannot be marked reviewed without a source': set("verification_status = 'manually_reviewed'"),
      'an unverified claim cannot carry a verification time': [set(`verified_at = '${T0}'`), unverifiedMeansNoTime],
      '"manually reviewed" cannot be credited to a platform': [set(`verification_status = 'manually_reviewed', verification_source = 'youtube_api', verified_at = '${T0}'`), reviewedMeansPerson],
      'a review mark without a time is refused': [set("verification_status = 'manually_reviewed', verification_source = 'admin_review'"), unverifiedMeansNoTime],
      '"verified" cannot be credited to a person': [set(`verification_status = 'verified', verification_source = 'admin_review', verified_at = '${T0}'`), either(needsAttestation, reviewedMeansPerson)],
      '"verified" cannot have no source': [set(`verification_status = 'verified', verification_source = 'none', verified_at = '${T0}'`), either(needsAttestation, unverifiedMeansNoSource)],
      '"verified" without a time is refused': [set("verification_status = 'verified', verification_source = 'youtube_api'"), unverifiedMeansNoTime],
      'a verification status outside the three known ones is refused': [set("verification_status = 'checked'"), CHECK("verification_status IN ('unverified', 'manually_reviewed', 'verified')")],
      'a verification source outside the five known ones is refused': [set("verification_source = 'hearsay'"), CHECK("verification_source IN ('none', 'admin_review', 'youtube_api', 'tiktok_api', 'mock_adapter')")],
    });

    test('legal: while a claim is pending its verification may be set, replaced and withdrawn', () => {
      const { sql, claimId } = creativeClaim('a YouTube link')();
      verify(sql, claimId, 'youtube_api');
      sql.run("UPDATE claims SET verification_status = 'unverified', verification_source = 'none', verified_at = NULL, verification_detail = '{\"outcome\":\"not_attested\"}' WHERE id = ?", [claimId]);
      markReviewed(sql, claimId);
      assert.equal(claimOf(sql, claimId).verification_status, 'manually_reviewed');
      sql.run("UPDATE claims SET verification_status = 'unverified', verification_source = 'none', verified_at = NULL WHERE id = ?", [claimId]);
      assert.equal(claimOf(sql, claimId).verification_status, 'unverified');
    });
  });

  describe('who a claim belongs to, what it is for, what was submitted and what it is worth never change', () => {
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
      const textClaim = () => {
        const sql = stage();
        return { sql, claimId: claimIn(sql, decision) };
      };
      refusedOneByOne(
        textClaim,
        immutable,
        Object.fromEntries(Object.entries(IDENTITY_REWRITES).map(([column, value]) => [`${column} of a ${decision} claim cannot be changed`, ({ sql, claimId }) => sql.run(`UPDATE claims SET ${column} = ? WHERE id = ?`, [value, claimId])])),
      );
    }

    /** An exception claim (number and reason set), and a claim about a video with a link, words and a hash. */
    const filledIn = () => {
      const sql = stage();
      approvedClaim(sql, { evidence_text: 'The base claim.' });
      const exceptionId = claim(sql, { evidence_text: 'The base claim.', exception_seq: 1, exception_reason: 'Agreed by the group.', submitted_by: 'usr_root', submitted_by_role: 'admin' });
      const aboutVideo = claim(sql, { video_id: 'vid_yt', evidence_url: 'https://www.youtube.com/watch?v=ytSample001', submitted_by: null });
      const wordless = claim(sql, { video_id: 'vid_tt', evidence_text: null });
      return { sql, exceptionId, aboutVideo, wordless };
    };
    refusedOneByOne(filledIn, immutable, {
      'an exception reason cannot be removed': ({ sql, exceptionId }) => sql.run('UPDATE claims SET exception_reason = NULL WHERE id = ?', [exceptionId]),
      'an exception cannot be turned back into an ordinary claim': ({ sql, exceptionId }) => sql.run('UPDATE claims SET exception_seq = 0, exception_reason = NULL WHERE id = ?', [exceptionId]),
      'a claim cannot be detached from its video': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET video_id = NULL WHERE id = ?', [aboutVideo]),
      'a claim cannot be moved to another video, subject and all': ({ sql, aboutVideo }) => sql.run("UPDATE claims SET video_id = 'vid_tt', subject_key = 'video:vid_tt' WHERE id = ?", [aboutVideo]),
      'outside an erasure, evidence text cannot be removed': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET evidence_text = NULL WHERE id = ?', [aboutVideo]),
      'outside an erasure, an evidence link cannot be removed': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET evidence_url = NULL WHERE id = ?', [aboutVideo]),
      'outside an erasure, an evidence hash cannot be removed': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET evidence_hash = NULL WHERE id = ?', [aboutVideo]),
      'outside an erasure, evidence cannot be blanked as a whole': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [aboutVideo]),
      'words cannot be added to a claim that was submitted without any': ({ sql, wordless }) => sql.run("UPDATE claims SET evidence_text = 'Added later.', evidence_hash = ? WHERE id = ?", [sha256('Added later.'), wordless]),
      'a submitter cannot be named on a claim that has none': ({ sql, aboutVideo }) => sql.run("UPDATE claims SET submitted_by = 'usr_ada' WHERE id = ?", [aboutVideo]),
    });

    test('legal: an UPDATE that restates the same values, and forgetting the submitter', () => {
      const { sql, exceptionId } = filledIn();
      const before = claimOf(sql, exceptionId);
      sql.run('UPDATE claims SET evidence_text = evidence_text, points_snapshot = points_snapshot, video_id = video_id WHERE id = ?', [exceptionId]);
      sql.run('UPDATE claims SET submitted_by = NULL WHERE id = ?', [exceptionId]);
      assert.deepEqual(claimOf(sql, exceptionId), { ...before, submitted_by: null });
    });
  });

  describe('once decided, the verification facts and the decision\'s own details are frozen', () => {
    for (const decision of ['approved', 'rejected', 'withdrawn', 'revoked']) {
      const decided = () => {
        const sql = stage();
        return { sql, claimId: claimIn(sql, decision) };
      };
      const set = (fields, params = []) => ({ sql, claimId }) => sql.run(`UPDATE claims SET ${fields} WHERE id = ?`, [...params, claimId]);
      const reviewed = decision === 'approved' || decision === 'revoked';
      const hasNote = decision === 'rejected' || decision === 'revoked';
      refusedOneByOne(decided, decidedIsFrozen, {
        [`the review mark of a ${decision} claim cannot be ${reviewed ? 'taken back' : 'added'}`]: reviewed
          ? set("verification_status = 'unverified', verification_source = 'none', verified_at = NULL")
          : set("verification_status = 'manually_reviewed', verification_source = 'admin_review', verified_at = ?", [at(2)]),
        [`a ${decision} claim cannot be upgraded to "verified"`]: [set("verification_status = 'verified', verification_source = 'mock_adapter', verified_at = ?", [at(2)]), either(decidedIsFrozen, needsAttestation)],
        [`verification detail cannot be added to a ${decision} claim`]: set("verification_detail = '{\"outcome\":\"attested\"}'"),
        [`the verification time of a ${decision} claim cannot be changed`]: set('verified_at = ?', [at(3)]),
        [`the decision time of a ${decision} claim cannot be changed`]: set('decided_at = ?', [at(3)]),
        [`the decision note of a ${decision} claim cannot be ${hasNote ? 'rewritten' : 'added'}`]: set("decision_note = 'Rewritten afterwards.'"),
        ...(hasNote ? { [`the decision note of a ${decision} claim cannot be removed`]: set('decision_note = NULL') } : {}),
        [`the reviewer of a ${decision} claim cannot be replaced`]: set("decided_by = 'usr_bo'"),
        [`restating the decision of a ${decision} claim cannot carry a new time`]: set(`decision = '${decision}', decided_at = ?`, [at(3)]),
      });
    }

    test('legal: deleting a reviewer\'s account empties decided_by through the foreign key and changes nothing else', () => {
      const sql = stage();
      user(sql, 'usr_reviewer', { role: 'admin' });
      const { claimId } = approvedClaim(sql, { submitted_by: 'usr_reviewer', submitted_by_role: 'admin' });
      const rejected = claim(sql, { member_id: 'mbr_bo', submitted_by: 'usr_bo' });
      sql.run("UPDATE claims SET decision = 'rejected', decided_by = 'usr_reviewer', decided_at = ?, decision_note = 'Not this time.' WHERE id = ?", [T0, rejected]);
      const before = { approved: claimOf(sql, claimId), rejected: claimOf(sql, rejected) };
      sql.run("DELETE FROM users WHERE id = 'usr_reviewer'");
      assert.deepEqual(claimOf(sql, rejected), { ...before.rejected, decided_by: null });
      assert.deepEqual(claimOf(sql, claimId), { ...before.approved, submitted_by: null });
    });
  });

  describe('blanking evidence during an erasure', () => {
    /** mbr_bo (owner of vid_yt) is being erased; mbr_ada has an approved claim about that video and a text-only one. */
    const erasingTheOwner = () => {
      const sql = stage();
      const aboutVideo = approvedClaim(sql, { video_id: 'vid_yt', evidence_url: 'https://www.youtube.com/watch?v=ytSample001' }).claimId;
      const textOnly = claim(sql, { evidence_text: 'Words with no video and no link.' });
      setGuard(sql, 'mbr_bo');
      return { sql, aboutVideo, textOnly };
    };
    refusedOneByOne(erasingTheOwner, immutable, {
      'even during an erasure, the text alone cannot be blanked': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET evidence_text = NULL WHERE id = ?', [aboutVideo]),
      'even during an erasure, text and hash cannot be blanked while the link stays': ({ sql, aboutVideo }) => sql.run('UPDATE claims SET evidence_text = NULL, evidence_hash = NULL WHERE id = ?', [aboutVideo]),
      'even during an erasure, evidence cannot be replaced by a placeholder': ({ sql, aboutVideo }) => sql.run("UPDATE claims SET evidence_text = '[removed]', evidence_url = NULL, evidence_hash = NULL WHERE id = ?", [aboutVideo]),
      'even during an erasure, a claim is not left with nothing that identifies it': [({ sql, textOnly }) => sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [textOnly]), CHECK('evidence_text IS NOT NULL OR evidence_url IS NOT NULL OR video_id IS NOT NULL')],
    });

    test('legal: during the erasure of a video\'s owner, the evidence of a claim about that video is blanked as a whole', () => {
      const { sql, aboutVideo } = erasingTheOwner();
      const before = claimOf(sql, aboutVideo);
      sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [aboutVideo]);
      assert.deepEqual(claimOf(sql, aboutVideo), { ...before, evidence_text: null, evidence_url: null, evidence_hash: null });
    });
  });

  test('erasing one member does not unlock the evidence of claims that have nothing to do with them', DEFECT('while ANY guard is set, evidence of ANY video claim may be blanked: a throw-away member is enough to wipe the evidence behind other members\' approved claims'), () => {
    const sql = stage();
    const unrelated = approvedClaim(sql, { video_id: 'vid_yt' }).claimId;
    member(sql, 'mbr_throwaway');
    setGuard(sql, 'mbr_throwaway');
    refuses(sql, () => sql.run('UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL WHERE id = ?', [unrelated]), ANY_REFUSAL);
  });

  test('a task cannot lose its automatic check while claims verified under it exist', DEFECT('task_types.api_check can be set to none afterwards, leaving "verified" claims on a task with no automatic check (integrity.js notices; the schema does not refuse)'), () => {
    const { sql, claimId } = creativeClaim('a YouTube link')();
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
  const competitionKinds = CHECK("competition_id IS NULL OR kind IN ('bonus', 'reversal')");
  const reasonLength = CHECK('length(reason) BETWEEN 1 AND 500');
  const labelled = (values, name, attack) => Object.fromEntries(values.map((value) => [name(JSON.stringify(value)), (world) => attack(world, value)]));

  describe('period', () => {
    refusedOneByOne(justTheCast, periodFormat, {
      ...labelled(['2026-00', '2026-13', '2026-19', '2026-1', '2026-011', '26-11', '2026/11', '2026-1x', 'november', '', ' 2026-11'], (period) => `period ${period} is refused`, ({ sql }, period) => entry(sql, { points: 5, period })),
      'a missing period is refused': [({ sql }) => entry(sql, { points: 5, period: null }), NOT_NULL('ledger_entries.period')],
    });
    refusedOneByOne(justTheCast, periodOfCreatedAt, {
      ...labelled(['2026-10', '2026-12', '2025-11', '2019-01', '2031-07'], (period) => `an entry written on 9 November cannot count in ${period}`, ({ sql }, period) => entry(sql, { points: 5, period })),
      'midday UTC on the 1st is not the previous month anywhere': ({ sql }) => entry(sql, { points: 5, created_at: '2026-11-01T12:00:00.000Z', period: '2026-10' }),
      'just before 10:00 UTC on the 30th is not yet the next month anywhere': ({ sql }) => entry(sql, { points: 5, created_at: '2026-11-30T09:59:59.999Z', period: '2026-12' }),
      'early on the 1st cannot count in the month after': ({ sql }) => entry(sql, { points: 5, created_at: '2026-11-01T05:00:00.000Z', period: '2026-12' }),
    });

    test('legal: at a month boundary the local month may differ from the UTC month, by one, in the right direction', () => {
      const sql = stage();
      entry(sql, { points: 5, created_at: '2026-11-01T05:00:00.000Z', period: '2026-10' });
      entry(sql, { points: 5, created_at: '2026-11-01T05:00:00.000Z', period: '2026-11' });
      entry(sql, { points: 5, created_at: '2026-11-30T12:00:00.000Z', period: '2026-12' });
      assert.equal(count(sql, 'ledger_entries'), 3);
    });
  });

  describe('created_at is exactly what toISOString() writes', () => {
    const malformed = ['2026-11-09 20:00:00', '2026-11-09T20:00:00Z', '2026-11-09T20:00:00.00Z', '2026-11-09T20:00:00.0000Z', '2026-11-09T20:00:00.000+00:00', '2026-11-09t20:00:00.000z', '2026-11-09T20:00:00.000', '2026-11-31T20:00:00.000Z', '2026-11-09T23:59:60.000Z', '2026-11-09T20:00:00.000Z ', '2026-11-09'];
    refusedOneByOne(justTheCast, createdAtFormat, {
      ...labelled(malformed, (createdAt) => `created_at ${createdAt} is refused`, ({ sql }, createdAt) => entry(sql, { points: 5, created_at: createdAt })),
      'created_at in words is refused': [({ sql }) => entry(sql, { points: 5, created_at: 'yesterday' }), either(createdAtFormat, periodOfCreatedAt)],
      'a missing created_at is refused': [({ sql }) => entry(sql, { points: 5, created_at: null }), NOT_NULL('ledger_entries.created_at')],
    });

    test('legal: any instant as JavaScript writes it', () => {
      const sql = stage();
      const clock = fixedClock(T0);
      clock.advance(1);
      entry(sql, { points: 5, created_at: clock.now().toISOString() });
      clock.advance(86_399_998);
      entry(sql, { points: 5, created_at: clock.now().toISOString() });
      assert.deepEqual(sql.all('SELECT created_at FROM ledger_entries ORDER BY id').map((row) => row.created_at), ['2026-11-09T20:00:00.001Z', '2026-11-10T19:59:59.999Z']);
    });
  });

  describe('idempotency keys', () => {
    const withTargets = () => {
      const sql = stage();
      entry(sql, { points: 500, reason: 'Starting balance' });
      const deduction = entry(sql, { points: -20 });
      const claimId = claim(sql);
      markReviewed(sql, claimId);
      return { sql, deduction, claimId };
    };
    const clientKeys = (world) => [`award:${world.claimId}`, 'reversal:1', 'req:', 'request-1', '', `req:${'k'.repeat(197)}`];
    const clientKeyNames = ['an award: key', 'a reversal: key', 'a req: key with nothing after the colon', 'a key outside every namespace', 'an empty key', 'a key of more than 200 characters'];
    const clientCases = {};
    for (const kind of ['adjustment', 'bonus']) {
      clientKeyNames.forEach((name, index) => {
        clientCases[`${name} on ${kind === 'adjustment' ? 'an adjustment' : 'a bonus'} is refused`] = (world) => entry(world.sql, { kind, points: 5, idempotency_key: clientKeys(world)[index] });
      });
    }
    refusedOneByOne(withTargets, keyNamespace, {
      'an award under a client key is refused': ({ sql, claimId }) => award(sql, claimId, { idempotency_key: 'req:usr_root:an-award' }),
      'an award under the key of another claim is refused': ({ sql, claimId }) => award(sql, claimId, { idempotency_key: 'award:some-other-claim' }),
      'an award under its own key with a trailing space is refused': ({ sql, claimId }) => award(sql, claimId, { idempotency_key: `award:${claimId} ` }),
      'a reversal under a client key is refused': ({ sql, deduction }) => reversal(sql, deduction, { idempotency_key: 'req:usr_root:a-reversal' }),
      'a reversal under the key of another entry is refused': ({ sql, deduction }) => reversal(sql, deduction, { idempotency_key: `reversal:${deduction + 1}` }),
      'a reversal under an award key is refused': ({ sql, deduction, claimId }) => reversal(sql, deduction, { idempotency_key: `award:${claimId}` }),
      ...clientCases,
      'a missing key is refused': [({ sql }) => entry(sql, { points: 5, idempotency_key: null }), NOT_NULL('ledger_entries.idempotency_key')],
    });

    test('legal: a client key that merely looks like a server key lives in req: and cannot pre-empt the award', () => {
      const { sql, claimId } = withTargets();
      entry(sql, { points: 5, idempotency_key: `req:${'k'.repeat(196)}` });
      entry(sql, { points: 5, idempotency_key: `req:usr_root:award:${claimId}` });
      award(sql, claimId);
      assert.equal(claimOf(sql, claimId).decision, 'approved');
    });
  });

  describe('competitions, reasons and authors', () => {
    const withCompetition = () => {
      const sql = stage();
      competition(sql, 'cmp_one');
      const claimId = claim(sql);
      markReviewed(sql, claimId);
      return { sql, claimId };
    };
    refusedOneByOne(withCompetition, competitionKinds, {
      'an adjustment cannot belong to a competition': ({ sql }) => entry(sql, { kind: 'adjustment', points: 5, competition_id: 'cmp_one' }),
      'an award cannot belong to a competition': ({ sql, claimId }) => award(sql, claimId, { competition_id: 'cmp_one' }),
      'a bonus cannot belong to a competition that does not exist': [({ sql }) => entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_missing' }), FOREIGN_KEY],
      'an entry with an empty reason is refused': [({ sql }) => entry(sql, { points: 5, reason: '' }), reasonLength],
      'an entry with a reason of 501 characters is refused': [({ sql }) => entry(sql, { points: 5, reason: 'x'.repeat(501) }), reasonLength],
      'an entry with no reason is refused': [({ sql }) => entry(sql, { points: 5, reason: null }), NOT_NULL('ledger_entries.reason')],
      'an entry with no author is refused': [({ sql }) => entry(sql, { points: 5, actor_user_id: null }), NOT_NULL('ledger_entries.actor_user_id')],
      'an entry with no member is refused': [({ sql }) => entry(sql, { points: 5, member_id: null }), NOT_NULL('ledger_entries.member_id')],
      'an entry with no kind is refused': [({ sql }) => entry(sql, { points: 5, kind: null }), NOT_NULL('ledger_entries.kind')],
      'an entry with no bucket is refused': [({ sql }) => entry(sql, { points: 5, bucket: null }), NOT_NULL('ledger_entries.bucket')],
    });

    test('legal: a competition bonus, and a reason of exactly 500 characters', () => {
      const { sql } = withCompetition();
      entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_one' });
      entry(sql, { points: 5, reason: 'x'.repeat(500) });
      assert.equal(balance(sql).bonus, 10);
    });
  });

  test('hour 24 is not accepted as a time of day', DEFECT('the timestamp CHECKs accept "T24:MM:SS.sssZ" (SQLite reads it as the next day), so text order and real order disagree: a reversal can be dated before its target'), () => {
    const sql = stage();
    entry(sql, { points: 500, reason: 'Starting balance' });
    refuses(sql, () => entry(sql, { points: 5, created_at: '2026-11-09T24:30:00.000Z' }), ANY_REFUSAL);
    refuses(sql, () => session(sql, { expires_at: '2026-11-09T24:59:59.999Z' }), ANY_REFUSAL);
  });
});

// ---------------------------------------------------------------------------
// Sign-in accounts and sessions (rules P8 and P9 lean on)
// ---------------------------------------------------------------------------

describe('Sign-in accounts and sessions', () => {
  describe('a Google identity is bound once, to an active account that has none', () => {
    /** usr_ada is bound to "sub-ada"; usr_bo is disabled and unbound. */
    const bound = () => {
      const sql = stage();
      sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_ada'");
      sql.run("UPDATE users SET status = 'disabled' WHERE id = 'usr_bo'");
      return { sql };
    };
    refusedOneByOne(bound, ABORT.users_google_sub_binds_once, {
      'a bound account cannot be pointed at another Google identity': ({ sql }) => sql.run("UPDATE users SET google_sub = 'sub-attacker' WHERE id = 'usr_ada'"),
      'a sign-in that matches by e-mail cannot overwrite an existing binding': ({ sql }) => sql.run("UPDATE users SET google_sub = 'sub-attacker', last_login_at = ? WHERE email = 'usrada@example.test'", [T0]),
      'a disabled account cannot be bound': ({ sql }) => sql.run("UPDATE users SET google_sub = 'sub-bo' WHERE id = 'usr_bo'"),
      'a disabled account cannot be bound even by the guarded first-sign-in statement': ({ sql }) => sql.run("UPDATE users SET google_sub = 'sub-bo' WHERE id = 'usr_bo' AND google_sub IS NULL"),
      'one Google identity cannot be bound to two accounts': [({ sql }) => sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_root'"), UNIQUE('users.google_sub')],
    });

    test('legal: a first binding, the same value again, an unbind followed by a new binding, and binding while re-enabling', () => {
      const { sql } = bound();
      sql.run("UPDATE users SET google_sub = 'sub-root', last_login_at = ? WHERE id = 'usr_root' AND google_sub IS NULL", [T0]);
      sql.run("UPDATE users SET google_sub = 'sub-ada', last_login_at = ? WHERE id = 'usr_ada'", [T0]);
      sql.run("UPDATE users SET google_sub = NULL WHERE id = 'usr_ada'");
      sql.run("UPDATE users SET google_sub = NULL WHERE id = 'usr_ada'");
      sql.run("UPDATE users SET google_sub = 'sub-ada-new' WHERE id = 'usr_ada'");
      sql.run("UPDATE users SET status = 'active', google_sub = 'sub-bo' WHERE id = 'usr_bo'");
      assert.deepEqual(sql.all('SELECT google_sub FROM users ORDER BY id').map((row) => row.google_sub), ['sub-ada-new', 'sub-bo', 'sub-root']);
    });
  });

  describe('any change to what an account may do signs it out everywhere', () => {
    const signedIn = () => {
      const sql = stage();
      member(sql, 'mbr_cy');
      sql.run("UPDATE users SET google_sub = 'sub-ada' WHERE id = 'usr_ada'");
      session(sql, { user_id: 'usr_ada' });
      session(sql, { user_id: 'usr_ada', auth_method: 'google' });
      session(sql, { user_id: 'usr_bo' });
      session(sql, { user_id: 'usr_root' });
      return sql;
    };
    const sessionsOf = (sql, userId) => count(sql, 'sessions', 'user_id = ?', [userId]);
    const ENDS_SESSIONS = {
      'a role change': ["UPDATE users SET role = 'admin' WHERE id = 'usr_ada'", 'usr_ada'],
      'being disabled': ["UPDATE users SET status = 'disabled' WHERE id = 'usr_ada'", 'usr_ada'],
      'being moved to another member': ["UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_ada'", 'usr_ada'],
      'losing its Google identity': ["UPDATE users SET google_sub = NULL WHERE id = 'usr_ada'", 'usr_ada'],
      'gaining a member link it did not have': ["UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_root'", 'usr_root'],
    };
    for (const [change, [statement, userId]] of Object.entries(ENDS_SESSIONS)) {
      test(`${change} ends every session of the account, and nobody else's`, () => {
        const sql = signedIn();
        sql.run(statement);
        assert.equal(sessionsOf(sql, userId), 0);
        assert.equal(count(sql, 'sessions', 'user_id <> ?', [userId]), userId === 'usr_ada' ? 2 : 3);
        witness('sessions_end_on_privilege_change');
      });
    }

    test('losing a member link ends an admin\'s sessions too', () => {
      const sql = signedIn();
      sql.run("UPDATE users SET member_id = 'mbr_cy' WHERE id = 'usr_root'");
      session(sql, { user_id: 'usr_root' });
      sql.run("UPDATE users SET member_id = NULL WHERE id = 'usr_root'");
      assert.equal(sessionsOf(sql, 'usr_root'), 0);
    });

    test('legal: a first sign-in, a later sign-in, a new address and a no-op update keep the session', () => {
      const sql = signedIn();
      sql.run("UPDATE users SET google_sub = 'sub-bo', last_login_at = ? WHERE id = 'usr_bo'", [T0]);
      sql.run("UPDATE users SET last_login_at = ? WHERE id = 'usr_bo'", [at(5)]);
      sql.run("UPDATE users SET email = 'bo-new@example.test' WHERE id = 'usr_bo'");
      sql.run("UPDATE users SET role = role, status = status, member_id = member_id, google_sub = google_sub WHERE id = 'usr_bo'");
      assert.equal(sessionsOf(sql, 'usr_bo'), 1);
    });
  });

  describe('a session row has a hashed token, a known sign-in method and well-formed times', () => {
    const tokenRule = CHECK("length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'");
    const tokens = { 'of 63 characters': 'a'.repeat(63), 'of 65 characters': 'a'.repeat(65), 'in capitals': 'A'.repeat(64), 'with a letter outside hex': `${'a'.repeat(63)}g`, 'with a space': `${'a'.repeat(63)} `, 'that is empty': '' };
    refusedOneByOne(justTheCast, tokenRule, {
      ...Object.fromEntries(Object.entries(tokens).map(([name, tokenHash]) => [`a token hash ${name} is refused`, ({ sql }) => session(sql, { token_hash: tokenHash })])),
      'a sign-in method outside google and dev is refused': [({ sql }) => session(sql, { auth_method: 'password' }), CHECK("auth_method IN ('google', 'dev')")],
      'a session with no sign-in method is refused': [({ sql }) => session(sql, { auth_method: null }), NOT_NULL('sessions.auth_method')],
      'a session that expires the moment it starts is refused': [({ sql }) => session(sql, { expires_at: T0 }), CHECK('expires_at > created_at')],
      'a session that expires before it starts is refused': [({ sql }) => session(sql, { expires_at: at(-1) }), CHECK('expires_at > created_at')],
      'a session for an account that does not exist is refused': [({ sql }) => session(sql, { user_id: 'usr_nobody' }), FOREIGN_KEY],
    });
    const oneSession = () => {
      const sql = stage();
      const row = sessionRow();
      insert(sql, 'sessions', row);
      return { sql, row };
    };
    refusedOneByOne(oneSession, UNIQUE('sessions.token_hash'), {
      'a second session under the same token hash is refused': ({ sql, row }) => insert(sql, 'sessions', { ...row, user_id: 'usr_bo' }),
    });
    for (const column of ['created_at', 'expires_at', 'last_seen_at']) {
      refusedOneByOne(
        justTheCast,
        CHECK(`${column} IS strftime('%Y-%m-%dT%H:%M:%fZ', ${column})`),
        Object.fromEntries(['never', '2026-11-16 20:00:00', '2026-11-16T20:00:00Z', '9999', ''].map((value) => [`${column} ${JSON.stringify(value)} is refused`, ({ sql }) => session(sql, { [column]: value })])),
      );
    }

    test('legal: a session for each sign-in method, and its end when the account is deleted', () => {
      const sql = stage();
      session(sql, { user_id: 'usr_bo', auth_method: 'dev' });
      session(sql, { user_id: 'usr_bo', auth_method: 'google', expires_at: at(1) });
      assert.equal(count(sql, 'sessions'), 2);
      sql.run("DELETE FROM users WHERE id = 'usr_bo'");
      assert.equal(count(sql, 'sessions'), 0);
    });
  });

  refusedOneByOne(justTheCast, CHECK("email = lower(email) AND email LIKE '%_@_%'"), {
    'an address with capitals is refused': ({ sql }) => user(sql, 'usr_caps', { email: 'Someone@example.test', role: 'admin' }),
    'an address without an @ is refused': ({ sql }) => user(sql, 'usr_noat', { email: 'someone.example.test', role: 'admin' }),
    'a second account for the same address is refused': [({ sql }) => user(sql, 'usr_twin', { email: 'usrroot@example.test', role: 'admin' }), UNIQUE('users.email')],
    'a second account for the same member is refused': [({ sql }) => user(sql, 'usr_second_ada', { member_id: 'mbr_ada' }), UNIQUE('users.member_id')],
    'an account for a member that does not exist is refused': [({ sql }) => user(sql, 'usr_ghost_member', { member_id: 'mbr_nobody' }), FOREIGN_KEY],
    'a second account under the same id is refused': [({ sql }) => user(sql, 'usr_root', { email: 'another@example.test', role: 'admin' }), UNIQUE('users.id')],
  });
});

// ---------------------------------------------------------------------------
// The other tables
// ---------------------------------------------------------------------------

describe('The other tables keep their shape', () => {
  describe('members', () => {
    const slugRule = CHECK("slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 1 AND 40");
    const linkRule = CHECK('(youtube_channel_id IS NULL) = (youtube_linked_at IS NULL)');
    const linked = () => {
      const sql = stage();
      sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-01', youtube_linked_at = ? WHERE id = 'mbr_bo'", [T0]);
      return { sql };
    };
    refusedOneByOne(linked, slugRule, {
      'a slug that starts with a capital is refused': ({ sql }) => member(sql, 'mbr_cy', { slug: 'Cy' }),
      'an empty slug is refused': ({ sql }) => member(sql, 'mbr_cy', { slug: '' }),
      'a slug of 41 characters is refused': ({ sql }) => member(sql, 'mbr_cy', { slug: 'c'.repeat(41) }),
      'a slug that is already taken is refused': [({ sql }) => member(sql, 'mbr_cy', { slug: 'mbrada' }), UNIQUE('members.slug')],
      'an empty display name is refused': [({ sql }) => member(sql, 'mbr_cy', { display_name: '' }), CHECK('length(display_name) BETWEEN 1 AND 40')],
      'a display name of 41 characters is refused': [({ sql }) => member(sql, 'mbr_cy', { display_name: 'n'.repeat(41) }), CHECK('length(display_name) BETWEEN 1 AND 40')],
      'a member status outside active and archived is refused': [({ sql }) => member(sql, 'mbr_cy', { status: 'hidden' }), CHECK("status IN ('active', 'archived')")],
      'a channel id without its consent time is refused': [({ sql }) => sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-02' WHERE id = 'mbr_ada'"), linkRule],
      'a consent time without a channel id is refused': [({ sql }) => sql.run("UPDATE members SET youtube_linked_at = ? WHERE id = 'mbr_ada'", [T0]), linkRule],
      'a link cannot lose its consent time and keep the channel id': [({ sql }) => sql.run("UPDATE members SET youtube_linked_at = NULL WHERE id = 'mbr_bo'"), linkRule],
      'a link cannot lose its channel id and keep the consent time': [({ sql }) => sql.run("UPDATE members SET youtube_channel_id = NULL WHERE id = 'mbr_bo'"), linkRule],
    });

    test('legal: linking and unlinking a channel with both columns together', () => {
      const { sql } = linked();
      sql.run("UPDATE members SET youtube_channel_id = NULL, youtube_linked_at = NULL WHERE id = 'mbr_bo'");
      sql.run("UPDATE members SET youtube_channel_id = 'UC-sample-02', youtube_linked_at = ? WHERE id = 'mbr_ada'", [T0]);
      assert.equal(count(sql, 'members', 'youtube_channel_id IS NOT NULL'), 1);
    });
  });

  describe('videos', () => {
    const withTime = CHECK('(stats_json IS NULL) = (stats_fetched_at IS NULL)');
    const withSource = CHECK('(stats_json IS NULL) = (stats_source IS NULL)');
    refusedOneByOne(justTheCast, withSource, {
      'a second row for the same platform video is refused': [({ sql }) => video(sql, 'vid_dup', { platform_video_id: 'ytSample001' }), UNIQUE('videos.platform, videos.platform_video_id')],
      'a platform video id shorter than 6 characters is refused': [({ sql }) => video(sql, 'vid_short_id', { platform_video_id: 'abc12' }), CHECK('length(platform_video_id) BETWEEN 6 AND 64')],
      'a platform outside youtube and tiktok is refused': [({ sql }) => video(sql, 'vid_other', { platform: 'elsewhere' }), CHECK("platform IN ('youtube', 'tiktok')")],
      'a kind outside video and short is refused': [({ sql }) => video(sql, 'vid_other', { kind: 'livestream' }), CHECK("kind IN ('video', 'short')")],
      'a video with an empty title is refused': [({ sql }) => video(sql, 'vid_other', { title: '' }), CHECK('length(title) BETWEEN 1 AND 200')],
      'statistics without a source or a time are refused': [({ sql }) => sql.run("UPDATE videos SET stats_json = '{\"views\":10}' WHERE id = 'vid_yt'"), either(withTime, withSource)],
      'statistics without a fetch time are refused': [({ sql }) => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'mock_adapter' WHERE id = 'vid_yt'"), withTime],
      'statistics without a source are refused': ({ sql }) => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]),
      'a source without statistics is refused': ({ sql }) => sql.run("UPDATE videos SET stats_source = 'mock_adapter' WHERE id = 'vid_yt'"),
      'a fetch time without statistics is refused': [({ sql }) => sql.run("UPDATE videos SET stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]), withTime],
      'statistics from an unknown source are refused': [({ sql }) => sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'guesswork', stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]), CHECK("stats_source IN ('youtube_api', 'tiktok_api', 'mock_adapter')")],
    });

    test('legal: statistics with their source and time, and the same id on the other platform', () => {
      const sql = stage();
      sql.run("UPDATE videos SET stats_json = '{\"views\":10}', stats_source = 'mock_adapter', stats_fetched_at = ? WHERE id = 'vid_yt'", [T0]);
      video(sql, 'vid_same_id_other_platform', { platform: 'tiktok', platform_video_id: 'ytSample001' });
      assert.equal(count(sql, 'videos'), 3);
    });
  });

  describe('task types', () => {
    const keyRule = CHECK("key GLOB '[a-z]*' AND length(key) BETWEEN 3 AND 40");
    refusedOneByOne(justTheCast, keyRule, {
      'a task worth nothing is refused': [({ sql }) => taskType(sql, 'tsk_nothing', { points: 0, xp: 0 }), CHECK('points > 0 OR xp > 0')],
      'a task worth more than 1000 points is refused': [({ sql }) => taskType(sql, 'tsk_huge', { points: 1001 }), CHECK('points BETWEEN 0 AND 1000')],
      'a task with negative XP is refused': [({ sql }) => taskType(sql, 'tsk_minus', { xp: -1 }), CHECK('xp BETWEEN 0 AND 1000')],
      'a task key of two characters is refused': ({ sql }) => taskType(sql, 'tsk_key', { key: 'Ab' }),
      'a task key that starts with a digit is refused': ({ sql }) => taskType(sql, 'tsk_key', { key: '9lives' }),
      'a task key that is already taken is refused': [({ sql }) => taskType(sql, 'tsk_key', { key: 'constructive_feedback' }), UNIQUE('task_types.key')],
      'a task with an empty label is refused': [({ sql }) => taskType(sql, 'tsk_label', { label: '' }), CHECK('length(label) BETWEEN 1 AND 60')],
      'requires_video is 0 or 1': [({ sql }) => taskType(sql, 'tsk_flag', { requires_video: 2 }), CHECK('requires_video IN (0, 1)')],
      'active is 0 or 1': [({ sql }) => taskType(sql, 'tsk_flag', { active: 2 }), CHECK('active IN (0, 1)')],
      'an existing task cannot be made worth nothing': [({ sql }) => sql.run("UPDATE task_types SET points = 0, xp = 0 WHERE id = 'tsk_feedback'"), CHECK('points > 0 OR xp > 0')],
    });

    test('legal: a task worth XP only', () => {
      const sql = stage();
      taskType(sql, 'tsk_xp_only', { points: 0, xp: 5 });
      assert.equal(count(sql, 'task_types'), 3);
    });
  });

  describe('competitions', () => {
    refusedOneByOne(justTheCast, CHECK('ends_at > starts_at'), {
      'a competition that ends before it starts is refused': ({ sql }) => competition(sql, 'cmp_backwards', { starts_at: at(60), ends_at: at(-60) }),
      'a competition that ends the moment it starts is refused': ({ sql }) => competition(sql, 'cmp_instant', { starts_at: T0, ends_at: T0 }),
      'a start given as a bare date is refused': [({ sql }) => competition(sql, 'cmp_day', { starts_at: '2026-11-01' }), CHECK("starts_at IS strftime('%Y-%m-%dT%H:%M:%fZ', starts_at)")],
      'an end given as a bare date is refused': [({ sql }) => competition(sql, 'cmp_day', { ends_at: '2026-12-01' }), CHECK("ends_at IS strftime('%Y-%m-%dT%H:%M:%fZ', ends_at)")],
      'a competition status outside draft, active and closed is refused': [({ sql }) => competition(sql, 'cmp_state', { status: 'secret' }), CHECK("status IN ('draft', 'active', 'closed')")],
      'a competition with an empty name is refused': [({ sql }) => competition(sql, 'cmp_name', { name: '' }), CHECK('length(name) BETWEEN 1 AND 80')],
    });

    test('legal: a competition with a start before its end', () => {
      const sql = stage();
      competition(sql, 'cmp_fine');
      assert.equal(sql.get("SELECT status FROM competitions WHERE id = 'cmp_fine'").status, 'draft');
    });
  });

  describe('tiers', () => {
    const ladder = () => {
      const sql = stage();
      for (const [level, minXp] of [[1, 0], [2, 100], [3, 250], [4, 500], [5, 1000]]) {
        insert(sql, 'tiers', { level, name: `Stage ${level}`, min_xp: minXp, art_key: `stage-${level}`, updated_at: T0 });
      }
      return { sql };
    };
    const extra = (level) => ({ sql }) => insert(sql, 'tiers', { level, name: 'Extra', min_xp: 5000, art_key: 'extra', updated_at: T0 });
    const levels = CHECK('level BETWEEN 1 AND 5');
    const firstIsZero = CHECK('level <> 1 OR min_xp = 0');
    refusedOneByOne(ladder, levels, {
      'a sixth tier is refused': extra(6),
      'a tier numbered 0 is refused': extra(0),
      'a tier with a negative number is refused': extra(-1),
      'a tier with no number, which would become the sixth, is refused': extra(undefined),
      'a second tier with the same number is refused': [extra(3), UNIQUE('tiers.level')],
      'the first tier cannot start above zero': [({ sql }) => sql.run('UPDATE tiers SET min_xp = 10 WHERE level = 1'), firstIsZero],
      'another tier cannot be renumbered into the first': [({ sql }) => sql.run('UPDATE tiers SET level = 1 WHERE level = 2'), either(UNIQUE('tiers.level'), firstIsZero)],
      'a negative threshold is refused': [({ sql }) => sql.run('UPDATE tiers SET min_xp = -1 WHERE level = 2'), CHECK('min_xp >= 0')],
      'a tier with an empty name is refused': [({ sql }) => sql.run("UPDATE tiers SET name = '' WHERE level = 2"), CHECK('length(name) BETWEEN 1 AND 40')],
    });
    refusedOneByOne(justTheCast, firstIsZero, {
      'on an empty table, a first tier above zero is refused': ({ sql }) => insert(sql, 'tiers', { level: 1, name: 'Stage 1', min_xp: 100, art_key: 'stage-1', updated_at: T0 }),
    });

    test('what the schema leaves open here, the integrity self-check reports', () => {
      // Fewer than five rows and thresholds that do not climb are not schema errors today (recorded as PE-14).
      const { sql } = ladder();
      const checks = () => checkIntegrity(sql.db).violations.map((violation) => violation.check);
      assert.ok(!checks().includes('tiers_not_five_ascending'));
      sql.run('UPDATE tiers SET min_xp = 50 WHERE level = 5');
      assert.ok(checks().includes('tiers_not_five_ascending'));
    });

    test('the ladder always has exactly five rungs', DEFECT('(recorded as PE-14) a tier row can be deleted, leaving fewer than five; only integrity.js notices'), () => {
      const { sql } = ladder();
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

  describe('a row cannot point at a parent that does not exist', () => {
    const withPendingClaim = () => {
      const sql = stage();
      return { sql, claimId: claim(sql) };
    };
    refusedOneByOne(withPendingClaim, FOREIGN_KEY, {
      'users.member_id': ({ sql }) => user(sql, 'usr_orphan', { member_id: 'mbr_nobody' }),
      'sessions.user_id': ({ sql }) => session(sql, { user_id: 'usr_nobody' }),
      'videos.owner_member_id': ({ sql }) => video(sql, 'vid_orphan', { owner_member_id: 'mbr_nobody' }),
      'videos.added_by': ({ sql }) => video(sql, 'vid_orphan', { added_by: 'usr_nobody' }),
      'claims.member_id': ({ sql }) => claim(sql, { member_id: 'mbr_nobody' }),
      'claims.video_id': ({ sql }) => claim(sql, { video_id: 'vid_nobody' }),
      'claims.submitted_by': ({ sql }) => claim(sql, { submitted_by: 'usr_nobody' }),
      'claims.decided_by': ({ sql, claimId }) => sql.run("UPDATE claims SET decision = 'withdrawn', decided_at = ?, decided_by = 'usr_nobody' WHERE id = ?", [T0, claimId]),
      'claims.task_type_id': [({ sql }) => claim(sql, { task_type_id: 'tsk_nobody' }), either(ABORT.claims_snapshot_matches_task, FOREIGN_KEY)],
      'competitions.created_by': ({ sql }) => competition(sql, 'cmp_orphan', { created_by: 'usr_nobody' }),
      'ledger_entries.member_id': ({ sql }) => entry(sql, { points: 5, member_id: 'mbr_nobody' }),
      'ledger_entries.competition_id': ({ sql }) => entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_nobody' }),
      'ledger_entries.claim_id': [({ sql }) => award(sql, 'clm_nobody'), either(ABORT.ledger_award_requires_reviewed_claim, FOREIGN_KEY)],
      'ledger_entries.reverses_entry_id': [({ sql }) => entry(sql, { kind: 'reversal', points: 5, reverses_entry_id: 404, idempotency_key: 'reversal:404' }), either(ABORT.ledger_reversal_must_mirror, FOREIGN_KEY)],
    });

    test('beneath the triggers, the foreign keys of the ledger and of claims.task_type_id refuse on their own', () => {
      const sql = stage();
      for (const trigger of ['claims_snapshot_matches_task', 'ledger_award_requires_reviewed_claim', 'ledger_award_approves_claim', 'ledger_reversal_must_mirror', 'ledger_reversal_revokes_claim']) dropTrigger(sql, trigger);
      refuses(sql, () => claim(sql, { task_type_id: 'tsk_nobody' }), FOREIGN_KEY);
      refuses(sql, () => award(sql, 'clm_nobody'), FOREIGN_KEY);
      refuses(sql, () => entry(sql, { kind: 'reversal', points: 5, reverses_entry_id: 404, idempotency_key: 'reversal:404' }), FOREIGN_KEY);
    });
  });

  describe('a parent that is still referenced cannot be deleted or re-keyed', () => {
    const referenced = () => {
      const sql = stage();
      competition(sql, 'cmp_one');
      approvedClaim(sql, { video_id: 'vid_yt' });
      entry(sql, { kind: 'bonus', points: 5, competition_id: 'cmp_one' });
      session(sql, { user_id: 'usr_ada' });
      return { sql };
    };
    const statements = [
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
    ];
    refusedOneByOne(referenced, FOREIGN_KEY, Object.fromEntries(statements.map((statement) => [`${statement} is refused`, ({ sql }) => sql.run(statement)])));

    test('legal: what nothing points at may go', () => {
      const { sql } = referenced();
      sql.run("DELETE FROM videos WHERE id = 'vid_tt'");
      sql.run("DELETE FROM task_types WHERE id = 'tsk_creative'");
      assert.equal(count(sql, 'videos') + count(sql, 'task_types'), 2);
    });
  });

  test('legal: deleting an account ends its sessions and forgets it as author, without touching what it wrote', () => {
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
    const row = claimOf(sql, claimId);
    assert.deepEqual([row.decided_by, row.submitted_by, row.decision], [null, null, 'approved']);
    assert.equal(sql.get('SELECT actor_user_id FROM ledger_entries WHERE id = ?', [awardId]).actor_user_id, 'usr_second', 'the ledger keeps the opaque id of who wrote the entry');
  });

  test('legal: deleting a member with no ledger rows, claims or account releases their videos', () => {
    const sql = stage();
    member(sql, 'mbr_cy');
    video(sql, 'vid_cy', { owner_member_id: 'mbr_cy' });
    sql.run("DELETE FROM members WHERE id = 'mbr_cy'");
    assert.equal(sql.get("SELECT owner_member_id FROM videos WHERE id = 'vid_cy'").owner_member_id, null);
  });
});

describe('STRICT typing', () => {
  const tier = (level) => ({ sql }) => insert(sql, 'tiers', { level, name: 'Stage 1', min_xp: 0, art_key: 'stage-1', updated_at: T0 });
  refusedOneByOne(justTheCast, ROWID_MISMATCH, {
    'text in ledger_entries.points is refused': [({ sql }) => entry(sql, { points: 'ten' }), DATATYPE('cannot store TEXT value in INTEGER column ledger_entries.points')],
    'text in ledger_entries.xp is refused': [({ sql }) => entry(sql, { points: 5, xp: '5 xp' }), DATATYPE('cannot store TEXT value in INTEGER column ledger_entries.xp')],
    'text in claims.exception_seq is refused': [({ sql }) => claim(sql, { exception_seq: 'one', exception_reason: 'A reason.' }), DATATYPE('cannot store TEXT value in INTEGER column claims.exception_seq')],
    'text in claims.points_snapshot is refused': [({ sql }) => claim(sql, { points_snapshot: 'twenty-five' }), DATATYPE('cannot store TEXT value in INTEGER column claims.points_snapshot')],
    'text in task_types.active is refused': [({ sql }) => taskType(sql, 'tsk_typed', { active: 'yes' }), DATATYPE('cannot store TEXT value in INTEGER column task_types.active')],
    'text in members.sort_order is refused': [({ sql }) => member(sql, 'mbr_cy', { sort_order: 'first' }), DATATYPE('cannot store TEXT value in INTEGER column members.sort_order')],
    'a fraction in ledger_entries.points is refused': [({ sql }) => entry(sql, { points: 1.5 }), DATATYPE('cannot store REAL value in INTEGER column ledger_entries.points')],
    'a fraction in task_types.points is refused': [({ sql }) => taskType(sql, 'tsk_half', { points: 12.5 }), DATATYPE('cannot store REAL value in INTEGER column task_types.points')],
    'bytes in members.display_name are refused': [({ sql }) => member(sql, 'mbr_bytes', { display_name: new Uint8Array([1, 2, 3]) }), DATATYPE('cannot store BLOB value in TEXT column members.display_name')],
    'bytes in claims.evidence_text are refused': [({ sql }) => claim(sql, { evidence_text: new Uint8Array([104, 105]) }), DATATYPE('cannot store BLOB value in TEXT column claims.evidence_text')],
    'bytes in audit_log.detail are refused': [({ sql }) => audit(sql, { detail: new Uint8Array([123, 125]) }), DATATYPE('cannot store BLOB value in TEXT column audit_log.detail')],
    'text as a ledger entry id is refused': ({ sql }) => entry(sql, { points: 5, id: 'first' }),
    'text as an audit row id is refused': ({ sql }) => audit(sql, { id: 'latest' }),
    'text as a tier level is refused': tier('one'),
    'a fraction as a tier level is refused': tier(1.5),
  });

  test('legal: a whole number written as text or as a float is stored as an INTEGER', () => {
    const sql = stage();
    const id = entry(sql, { points: '10', xp: 2.0 });
    assert.deepEqual({ ...sql.get('SELECT points, xp, typeof(points) AS points_type, typeof(xp) AS xp_type FROM ledger_entries WHERE id = ?', [id]) }, { points: 10, xp: 2, points_type: 'integer', xp_type: 'integer' });
  });

  // A text primary key may be NULL in an ordinary SQLite table; in a STRICT table it may not.
  const nullKeys = {
    'members.id': ({ sql }) => member(sql, 'mbr_cy', { id: null }),
    'users.id': ({ sql }) => user(sql, 'usr_cy', { id: null, role: 'admin' }),
    'claims.id': ({ sql }) => claim(sql, { id: null, evidence_text: 'A claim with no id.' }),
    'sessions.token_hash': ({ sql }) => session(sql, { token_hash: null }),
    'task_types.id': ({ sql }) => taskType(sql, 'tsk_cy', { id: null }),
    'videos.id': ({ sql }) => video(sql, 'vid_cy', { id: null }),
    'competitions.id': ({ sql }) => competition(sql, 'cmp_cy', { id: null }),
    'settings.key': ({ sql }) => insert(sql, 'settings', { key: null, value: '1', updated_at: T0 }),
  };
  for (const [column, attack] of Object.entries(nullKeys)) {
    refusedOneByOne(justTheCast, NOT_NULL(column), { [`${column} cannot be NULL`]: attack });
  }
});

// ---------------------------------------------------------------------------
// Connection settings
// ---------------------------------------------------------------------------

describe('What a mis-configured connection still guarantees, and what it loses', () => {
  const violations = (sql) => checkIntegrity(new Db(sql.raw)).violations.map((violation) => violation.check);

  test('recursive_triggers OFF: the legal flows still work end to end, and the self-check reports the pragma', () => {
    const sql = cast(openBare({ recursiveTriggers: false }));
    const { claimId, awardId } = approvedClaim(sql);
    assert.equal(claimOf(sql, claimId).decision, 'approved');
    reversal(sql, awardId);
    assert.equal(claimOf(sql, claimId).decision, 'revoked');
    refuses(sql, () => entry(sql, { points: -1 }), ABORT.ledger_never_negative);
    assert.ok(violations(sql).includes('pragma_recursive_triggers'));
  });

  test('recursive_triggers OFF: P9 is lost to REPLACE, which is why the adapter refuses to run without the pragma', () => {
    const sql = cast(openBare({ recursiveTriggers: false }));
    member(sql, 'mbr_cy');
    insert(sql, 'users', { id: 'usr_root', email: 'usrroot@example.test', role: 'member', member_id: 'mbr_cy', created_at: T0 }, { verb: 'INSERT OR REPLACE' });
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
    refuses(sql, () => sql.run('UPDATE audit_log SET action = ? WHERE id = ?', ['nothing.happened', row]), ABORT.audit_no_update);
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
    video(sql, 'vid_demo', { platform_video_id: 'demoLong001' });
    const ada = withActor(createContext({ db: sql.db, clock: fixedClock(T0) }), { userId: 'usr_ada', role: 'member', memberId: 'mbr_ada' });
    const words = 'The hook lands in the first five seconds, but the captions cover the product; move them up and shorten the outro.';
    submitClaim(ada, { task_type_id: 'tsk_feedback', video_id: 'vid_demo', evidence_text: words });
    assert.throws(
      () => submitClaim(ada, { task_type_id: 'tsk_feedback', evidence_url: 'https://www.youtube.com/watch?v=demoLong00%31', evidence_text: `${words} Sent again through the link.` }),
      (error) => error.name === 'AppError',
    );
    assert.equal(count(sql, 'claims'), 1);
  });

  test('src/domain/taskTypes.js: an ordinary admin edit cannot leave the database failing its own start-up check', DEFECT('updateTaskType() lets api_check go to none while verified claims exist; checkIntegrity() then reports verified_claim_on_unattestable_task and the server would refuse to start'), async () => {
    const { createContext, withActor } = await import('../../src/domain/context.js');
    const { updateTaskType } = await import('../../src/domain/taskTypes.js');
    const sql = stage();
    for (const [level, minXp] of [[1, 0], [2, 100], [3, 250], [4, 500], [5, 1000]]) insert(sql, 'tiers', { level, name: `Stage ${level}`, min_xp: minXp, art_key: `stage-${level}`, updated_at: T0 });
    const claimId = claim(sql, { task_type_id: 'tsk_creative', points_snapshot: 40, xp_snapshot: 20, evidence_text: null, evidence_url: 'https://www.youtube.com/watch?v=untracked01', subject_key: 'url:youtube/untracked01' });
    sql.run("UPDATE claims SET verification_status = 'verified', verification_source = 'mock_adapter', verified_at = ? WHERE id = ?", [T0, claimId]);
    assert.equal(checkIntegrity(sql.db).ok, true);
    const root = withActor(createContext({ db: sql.db, clock: fixedClock(T0) }), { userId: 'usr_root', role: 'admin', memberId: null });
    attempt(() => updateTaskType(root, 'tsk_creative', { api_check: 'none' }));
    assert.deepEqual(checkIntegrity(sql.db).violations, []);
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
});
