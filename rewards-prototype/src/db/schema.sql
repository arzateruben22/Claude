-- Rewards prototype — schema v1
--
-- Design rule: every correctness promise the product makes is enforced HERE, by the
-- database, and not only by application code. If a bug or a second code path tries to
-- break one of these promises, the write fails.
--
--   P1  An approved claim has exactly one ledger award, and a claim becomes approved
--       ONLY by that award being written.            -> ledger_one_award_per_claim, ledger_award_approves_claim, claims_transitions
--   P2  A duplicate submission can never be credited twice.
--                                                    -> claims_one_live_per_subject, subject CHECKs, claims_exception_is_next
--   P3  No task award exists without a reviewed or API-attested claim, and the "earned"
--       bucket can only grow through such an award.  -> ledger_award_requires_reviewed_claim, adjustment CHECK
--   P4  The ledger is append-only; corrections are new entries.
--                                                    -> ledger_no_update, ledger_no_delete, ledger_no_replace
--   P5  A correction can be undone exactly once, mirrors its target, and counts in its
--       target's month. Undoing an award revokes the claim.
--                                                    -> ledger_one_reversal_per_entry, ledger_reversal_must_mirror, ledger_reversal_revokes_claim
--   P6  Engagement (likes, comments, views, follows) has NO path to points. There is
--       deliberately no table or column that links an engagement statistic to a ledger
--       entry. Only task_types (contributions) can. (Structural; src/domain/policy.js
--       additionally lints the wording of tasks and reasons.)
--   P7  Erasing a member removes their rows for real, is all-or-nothing, and is the ONLY
--       way ledger rows or claims are ever deleted.  -> erasure_guard and its triggers
--   P8  Nobody credits themselves: an account linked to a member can neither approve
--       that member's claims nor write them a positive entry.
--                                                    -> claims_no_self_approval, ledger_no_self_credit
--   P9  There is always an admin who can sign in.    -> users_keep_one_admin_on_update / _on_delete
--   P10 The audit trail cannot be rewritten and holds no addresses or links.
--                                                    -> audit_* triggers
--   P11 No points bucket and no XP total ever goes below zero.
--                                                    -> ledger_never_negative
--   P12 "verified" means a platform attested it; "manually reviewed" means a person did.
--       A decided claim's evidence and verification never change afterwards.
--                                                    -> claims CHECKs, claims_verified_needs_attestable_task,
--                                                       claims_identity_is_immutable, claims_decided_is_frozen
--
-- What the schema CANNOT express is asserted by src/domain/integrity.js, which runs at
-- boot, after every erasure and in the test suite.
--
-- Conventions
--   * ids are opaque text (prefix + random); booleans are INTEGER 0/1; JSON is TEXT.
--   * All tables are STRICT.
--   * Timestamps are ISO-8601 UTC text exactly as JavaScript's toISOString() writes
--     them. Those that are compared or sorted carry a format CHECK, so comparing them
--     as text is correct. Always compare against the application clock's ISO string,
--     never against SQLite's datetime('now'), which uses a different format.
--   * In triggers, nullable columns are compared with IS / IS NOT, never = / <>.
--   * The connection must run with PRAGMA foreign_keys = ON and
--     PRAGMA recursive_triggers = ON (src/db/sqlite.js sets both and refuses to continue
--     otherwise). The *_no_replace triggers keep the append-only promises true even if
--     the second pragma were ever off.
--   * Application code never uses INSERT OR REPLACE / REPLACE INTO (the adapter rejects them).

-- ---------------------------------------------------------------------------
-- The erasure guard (P7)
-- ---------------------------------------------------------------------------
-- One permanent row. `member_id` is non-NULL only inside an erasure transaction, and names
-- the one member whose rows may be deleted. It can be set only for an existing member and
-- cleared only once that member is gone, so an erasure cannot be partial.

CREATE TABLE erasure_guard (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  member_id TEXT
) STRICT;
INSERT INTO erasure_guard (id, member_id) VALUES (1, NULL);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- A member is someone shown on the dashboard (avatar, piggy bank, rank).
CREATE TABLE members (
  id                 TEXT PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 1 AND 40),
  display_name       TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
  avatar_key         TEXT NOT NULL DEFAULT 'placeholder',
  sort_order         INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  -- Set only from an OAuth-consented "my channel" lookup (or the demo seed), never typed in.
  youtube_channel_id TEXT,
  youtube_linked_at  TEXT,
  created_at         TEXT NOT NULL,
  CHECK ((youtube_channel_id IS NULL) = (youtube_linked_at IS NULL))
) STRICT;

-- A user is someone allowed to sign in. Access is by allowlist: a row must exist
-- (keyed by e-mail) before the first Google sign-in; after that the Google `sub`
-- is the identity and the e-mail is informational.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND email LIKE '%_@_%'),
  google_sub    TEXT UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  member_id     TEXT UNIQUE REFERENCES members (id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  -- A non-admin account only makes sense attached to a member.
  CHECK (role = 'admin' OR member_id IS NOT NULL)
) STRICT;

-- Server-side sessions. Only a SHA-256 of the cookie token is stored. The CSRF token is
-- not stored at all: it is an HMAC of the session token, recomputed on each request.
-- `auth_method` records how the session was created; a session is only honoured when it
-- matches the configured sign-in mode, so a dev-mode session can never be used once the
-- same database is served with Google sign-in.
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  auth_method  TEXT NOT NULL CHECK (auth_method IN ('google', 'dev')),
  created_at   TEXT NOT NULL CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at)),
  expires_at   TEXT NOT NULL CHECK (expires_at IS strftime('%Y-%m-%dT%H:%M:%fZ', expires_at)),
  last_seen_at TEXT NOT NULL CHECK (last_seen_at IS strftime('%Y-%m-%dT%H:%M:%fZ', last_seen_at)),
  CHECK (expires_at > created_at)
) STRICT;
CREATE INDEX sessions_by_user ON sessions (user_id);

-- Any change to what an account may do signs it out everywhere, immediately.
CREATE TRIGGER sessions_end_on_privilege_change
AFTER UPDATE OF role, status, member_id, google_sub ON users
WHEN NEW.role IS NOT OLD.role
  OR NEW.status IS NOT OLD.status
  OR NEW.member_id IS NOT OLD.member_id
  OR (OLD.google_sub IS NOT NULL AND NEW.google_sub IS NOT OLD.google_sub)
BEGIN
  DELETE FROM sessions WHERE user_id = NEW.id;
END;

-- A Google identity is bound once, to an active account that has none yet.
CREATE TRIGGER users_google_sub_binds_once
BEFORE UPDATE OF google_sub ON users
WHEN NEW.google_sub IS NOT NULL
 AND (OLD.google_sub IS NOT NULL OR NEW.status <> 'active')
 AND NEW.google_sub IS NOT OLD.google_sub
BEGIN
  SELECT RAISE(ABORT, 'google_sub can only be set on an active, unbound account');
END;

-- P9: the last active admin who has actually signed in cannot be demoted, disabled or
-- deleted. (An allowlisted admin row that has never signed in does not count: it may be
-- a mistyped address.)
CREATE TRIGGER users_keep_one_admin_on_update
BEFORE UPDATE OF role, status, last_login_at ON users
WHEN OLD.role = 'admin' AND OLD.status = 'active' AND OLD.last_login_at IS NOT NULL
 AND (NEW.role <> 'admin' OR NEW.status <> 'active' OR NEW.last_login_at IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'at least one active, signed-in admin must remain')
  WHERE NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id <> OLD.id AND u.role = 'admin' AND u.status = 'active' AND u.last_login_at IS NOT NULL
  );
END;

CREATE TRIGGER users_keep_one_admin_on_delete
BEFORE DELETE ON users
WHEN OLD.role = 'admin' AND OLD.status = 'active' AND OLD.last_login_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'at least one active, signed-in admin must remain')
  WHERE NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id <> OLD.id AND u.role = 'admin' AND u.status = 'active' AND u.last_login_at IS NOT NULL
  );
END;

-- ---------------------------------------------------------------------------
-- Things members can do
-- ---------------------------------------------------------------------------

CREATE TABLE videos (
  id                TEXT PRIMARY KEY,
  platform          TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok')),
  -- At least 6 characters, so that looking for this id inside a submitted link
  -- (claims_tracked_video_url_must_use_video) cannot match by accident.
  platform_video_id TEXT NOT NULL CHECK (length(platform_video_id) BETWEEN 6 AND 64),
  kind              TEXT NOT NULL CHECK (kind IN ('video', 'short')),
  url               TEXT NOT NULL,
  title             TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  owner_member_id   TEXT REFERENCES members (id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  -- Informational aggregate statistics only (views / likes / comments counts).
  -- Platform API data must be refreshed or dropped on a schedule; see docs/PLATFORM_CAPABILITIES.md.
  stats_json        TEXT,
  stats_source      TEXT CHECK (stats_source IN ('youtube_api', 'tiktok_api', 'mock_adapter')),
  stats_fetched_at  TEXT,
  added_by          TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  UNIQUE (platform, platform_video_id),
  CHECK ((stats_json IS NULL) = (stats_fetched_at IS NULL)),
  CHECK ((stats_json IS NULL) = (stats_source IS NULL))
) STRICT;

-- Rewardable task types. These are CONTRIBUTIONS (for example private constructive
-- feedback, or an original creative submission). Engagement actions are not
-- representable here on purpose; src/domain/policy.js additionally refuses keys and
-- labels that describe likes, comments, views, shares, follows or subscriptions.
CREATE TABLE task_types (
  id             TEXT PRIMARY KEY,
  key            TEXT NOT NULL UNIQUE CHECK (key GLOB '[a-z]*' AND length(key) BETWEEN 3 AND 40),
  label          TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  description    TEXT NOT NULL DEFAULT '',
  points         INTEGER NOT NULL CHECK (points BETWEEN 0 AND 1000),
  xp             INTEGER NOT NULL CHECK (xp BETWEEN 0 AND 1000),
  requires_video INTEGER NOT NULL DEFAULT 0 CHECK (requires_video IN (0, 1)),
  -- 'none'            : evidence is reviewed by a human only
  -- 'video_ownership' : a platform adapter can attest that the submitted video belongs
  --                     to the member's own linked channel
  api_check      TEXT NOT NULL DEFAULT 'none' CHECK (api_check IN ('none', 'video_ownership')),
  active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  CHECK (points > 0 OR xp > 0)
) STRICT;

-- A claim is a member saying "I did this task". It carries two independent facts:
--   verification_status : how well the activity itself is established
--   decision            : what was decided about crediting it
CREATE TABLE claims (
  id                  TEXT PRIMARY KEY,
  member_id           TEXT NOT NULL REFERENCES members (id),
  task_type_id        TEXT NOT NULL REFERENCES task_types (id),
  video_id            TEXT REFERENCES videos (id),
  -- What uniqueness is measured on, in this fixed order of precedence:
  --   'video:<videos.id>'  when the claim is about a tracked video
  --   'url:<normalised>'   otherwise, when a link was submitted
  --   'text:<sha256>'      otherwise (the hash of the normalised evidence text)
  subject_key         TEXT NOT NULL CHECK (subject_key GLOB 'video:?*' OR subject_key GLOB 'url:?*' OR subject_key GLOB 'text:?*'),
  -- 0 for ordinary claims. An admin may grant an explicit, logged exception that lets a
  -- member be credited again for a subject that was already credited; each takes the next number.
  exception_seq       INTEGER NOT NULL DEFAULT 0 CHECK (exception_seq >= 0),
  exception_reason    TEXT,
  evidence_text       TEXT CHECK (evidence_text IS NULL OR (length(evidence_text) <= 4000 AND length(trim(evidence_text)) > 0)),
  evidence_url        TEXT CHECK (evidence_url IS NULL OR length(evidence_url) <= 500),
  -- sha256 of the normalised evidence text; lets us flag the same text coming from two members.
  evidence_hash       TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (verification_status IN ('unverified', 'manually_reviewed', 'verified')),
  verification_source TEXT NOT NULL DEFAULT 'none'
                      CHECK (verification_source IN ('none', 'admin_review', 'youtube_api', 'tiktok_api', 'mock_adapter')),
  verification_detail TEXT,
  verified_at         TEXT,
  decision            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (decision IN ('pending', 'approved', 'rejected', 'withdrawn', 'revoked')),
  decided_by          TEXT REFERENCES users (id) ON DELETE SET NULL,
  decided_at          TEXT,
  decision_note       TEXT CHECK (decision_note IS NULL OR length(decision_note) <= 500),
  -- Task values frozen at submission time: what "pending" displays and what approval awards.
  points_snapshot     INTEGER NOT NULL CHECK (points_snapshot BETWEEN 0 AND 1000),
  xp_snapshot         INTEGER NOT NULL CHECK (xp_snapshot BETWEEN 0 AND 1000),
  submitted_by        TEXT REFERENCES users (id) ON DELETE SET NULL,
  -- Kept separately from submitted_by so the daily limit still works after an account is deleted.
  submitted_by_role   TEXT NOT NULL CHECK (submitted_by_role IN ('member', 'admin')),
  created_at          TEXT NOT NULL CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at)),

  CHECK ((exception_seq = 0) = (exception_reason IS NULL)),
  CHECK (evidence_text IS NOT NULL OR evidence_url IS NOT NULL OR video_id IS NOT NULL),
  -- A claim that could never produce a ledger entry cannot exist.
  CHECK (points_snapshot > 0 OR xp_snapshot > 0),
  -- P2: the subject of a claim about a tracked video IS that video. (CASE, because a NULL CHECK passes.)
  CHECK (CASE WHEN video_id IS NULL THEN subject_key NOT GLOB 'video:*' ELSE subject_key = 'video:' || video_id END),
  -- P12: "verified" may only ever come from a platform adapter; "manually reviewed" only from a person.
  CHECK ((verification_status = 'unverified') = (verification_source = 'none')),
  CHECK ((verification_status = 'manually_reviewed') = (verification_source = 'admin_review')),
  CHECK ((verification_status = 'unverified') = (verified_at IS NULL)),
  -- P12: only something a platform can look at can be "verified".
  CHECK (verification_status <> 'verified' OR video_id IS NOT NULL OR evidence_url IS NOT NULL),
  -- P3: an unverified claim can never be approved.
  CHECK (decision <> 'approved' OR verification_status IN ('manually_reviewed', 'verified')),
  CHECK (decision <> 'pending' OR (decided_at IS NULL AND decided_by IS NULL AND decision_note IS NULL)),
  CHECK (decision = 'pending' OR decided_at IS NOT NULL)
) STRICT;

-- P2: at most one live (pending or approved) claim per member + task + subject.
-- A rejected, withdrawn or revoked claim frees the slot so the member can try again.
CREATE UNIQUE INDEX claims_one_live_per_subject
  ON claims (member_id, task_type_id, subject_key, exception_seq)
  WHERE decision IN ('pending', 'approved');
CREATE INDEX claims_by_member ON claims (member_id, created_at);
CREATE INDEX claims_by_decision ON claims (decision, created_at);
CREATE INDEX claims_by_evidence_hash ON claims (evidence_hash) WHERE evidence_hash IS NOT NULL;

CREATE TABLE competitions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '',
  starts_at   TEXT NOT NULL CHECK (starts_at IS strftime('%Y-%m-%dT%H:%M:%fZ', starts_at)),
  ends_at     TEXT NOT NULL CHECK (ends_at IS strftime('%Y-%m-%dT%H:%M:%fZ', ends_at)),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  CHECK (ends_at > starts_at)
) STRICT;

-- ---------------------------------------------------------------------------
-- The point ledger
-- ---------------------------------------------------------------------------
-- Virtual points only. No currency, no redemption, no cash value. Balances are never
-- stored; they are always SUM(points) over this table, so they cannot drift.

CREATE TABLE ledger_entries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id         TEXT NOT NULL REFERENCES members (id),
  -- task_award : written when a reviewed claim is approved; writing it IS the approval
  -- bonus      : admin-granted bonus (competition result, streak, surprise)
  -- adjustment : manual admin correction
  -- reversal   : exact undo of one earlier entry
  kind              TEXT NOT NULL CHECK (kind IN ('task_award', 'bonus', 'adjustment', 'reversal')),
  bucket            TEXT NOT NULL CHECK (bucket IN ('earned', 'bonus')),
  points            INTEGER NOT NULL CHECK (points BETWEEN -100000 AND 100000),
  xp                INTEGER NOT NULL CHECK (xp BETWEEN -100000 AND 100000),
  claim_id          TEXT REFERENCES claims (id),
  reverses_entry_id INTEGER REFERENCES ledger_entries (id),
  competition_id    TEXT REFERENCES competitions (id),
  idempotency_key   TEXT NOT NULL UNIQUE,
  reason            TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  -- The admin account that wrote the entry. No FK: the entry must outlive the account.
  actor_user_id     TEXT NOT NULL,
  -- Calendar month the entry counts toward for caps, in the configured time zone: 'YYYY-MM'.
  -- Fixed when the entry is written; changing the time-zone setting later never moves it.
  period            TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(period, 6, 2) BETWEEN '01' AND '12'),
  created_at        TEXT NOT NULL CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at)),

  CHECK (points <> 0 OR xp <> 0),
  CHECK ((kind = 'task_award') = (claim_id IS NOT NULL)),
  CHECK ((kind = 'reversal') = (reverses_entry_id IS NOT NULL)),
  CHECK (kind <> 'task_award' OR (points >= 0 AND xp >= 0 AND bucket = 'earned')),
  CHECK (kind <> 'bonus' OR (points >= 0 AND xp >= 0 AND bucket = 'bonus')),
  -- P3: "earned" grows only through a reviewed claim. An adjustment may take points away
  -- from either bucket, but may add them only to "bonus".
  CHECK (kind <> 'adjustment' OR bucket = 'bonus' OR (points <= 0 AND xp <= 0)),
  CHECK (competition_id IS NULL OR kind IN ('bonus', 'reversal')),
  -- A non-reversal entry's period is the month of created_at in SOME real time zone (UTC-12 .. UTC+14).
  CHECK (kind = 'reversal' OR period IN (strftime('%Y-%m', created_at, '-12 hours'), strftime('%Y-%m', created_at), strftime('%Y-%m', created_at, '+14 hours'))),
  -- Keys the server owns are a pure function of the row; client keys live in their own namespace.
  CHECK (CASE kind WHEN 'task_award' THEN idempotency_key = 'award:' || claim_id
                   WHEN 'reversal'   THEN idempotency_key = 'reversal:' || reverses_entry_id
                   ELSE idempotency_key GLOB 'req:?*' AND length(idempotency_key) <= 200 END)
) STRICT;

-- P1
CREATE UNIQUE INDEX ledger_one_award_per_claim
  ON ledger_entries (claim_id) WHERE kind = 'task_award';
-- P5
CREATE UNIQUE INDEX ledger_one_reversal_per_entry
  ON ledger_entries (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL;
CREATE INDEX ledger_by_member ON ledger_entries (member_id, id);
CREATE INDEX ledger_by_period ON ledger_entries (period, member_id);

-- P4
CREATE TRIGGER ledger_no_update
BEFORE UPDATE ON ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'ledger_entries is append-only');
END;

-- P4 + P7
CREATE TRIGGER ledger_no_delete
BEFORE DELETE ON ledger_entries
WHEN (SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT OLD.member_id
BEGIN
  SELECT RAISE(ABORT, 'ledger_entries is append-only');
END;

-- P4, independent of PRAGMA recursive_triggers: an INSERT that would replace a row is refused.
CREATE TRIGGER ledger_no_replace
BEFORE INSERT ON ledger_entries
WHEN EXISTS (SELECT 1 FROM ledger_entries WHERE id = NEW.id OR idempotency_key = NEW.idempotency_key)
BEGIN
  SELECT RAISE(ABORT, 'ledger_entries is append-only (id or idempotency_key already exists)');
END;

-- P7: nothing is written to the ledger while an erasure is in progress.
CREATE TRIGGER ledger_no_insert_during_erasure
BEFORE INSERT ON ledger_entries
WHEN (SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'an erasure is in progress (guard is set)');
END;

-- P3: an award must match a PENDING, reviewed claim of the same member, value for value.
CREATE TRIGGER ledger_award_requires_reviewed_claim
BEFORE INSERT ON ledger_entries
WHEN NEW.kind = 'task_award'
BEGIN
  SELECT RAISE(ABORT, 'task_award requires a pending, reviewed claim of the same member')
  WHERE NOT EXISTS (
    SELECT 1 FROM claims c
    WHERE c.id = NEW.claim_id
      AND c.member_id = NEW.member_id
      AND c.decision = 'pending'
      AND c.verification_status IN ('manually_reviewed', 'verified')
      AND c.points_snapshot = NEW.points
      AND c.xp_snapshot = NEW.xp
  );
END;

-- P1: writing the award is what approves the claim.
CREATE TRIGGER ledger_award_approves_claim
AFTER INSERT ON ledger_entries
WHEN NEW.kind = 'task_award'
BEGIN
  UPDATE claims SET decision = 'approved', decided_at = NEW.created_at, decided_by = NEW.actor_user_id
  WHERE id = NEW.claim_id;
END;

-- P5: a reversal negates exactly one earlier non-reversal entry of the same member, and
-- carries that entry's period so the cap arithmetic for a month is unaffected by when
-- the correction was made.
CREATE TRIGGER ledger_reversal_must_mirror
BEFORE INSERT ON ledger_entries
WHEN NEW.kind = 'reversal'
BEGIN
  SELECT RAISE(ABORT, 'reversal must mirror one earlier non-reversal entry of the same member')
  WHERE NOT EXISTS (
    SELECT 1 FROM ledger_entries t
    WHERE t.id = NEW.reverses_entry_id
      AND t.kind <> 'reversal'
      AND t.member_id = NEW.member_id
      AND t.bucket = NEW.bucket
      AND t.points = -NEW.points
      AND t.xp = -NEW.xp
      AND t.period = NEW.period
      AND t.competition_id IS NEW.competition_id
      AND t.created_at <= NEW.created_at
  );
END;

-- P5: undoing an award is what revokes the claim.
CREATE TRIGGER ledger_reversal_revokes_claim
AFTER INSERT ON ledger_entries
WHEN NEW.kind = 'reversal'
BEGIN
  UPDATE claims SET decision = 'revoked', decided_at = NEW.created_at, decided_by = NEW.actor_user_id, decision_note = NEW.reason
  WHERE id = (SELECT claim_id FROM ledger_entries WHERE id = NEW.reverses_entry_id AND kind = 'task_award');
END;

-- P11: no points bucket and no XP total below zero.
CREATE TRIGGER ledger_never_negative
BEFORE INSERT ON ledger_entries
WHEN NEW.points < 0 OR NEW.xp < 0
BEGIN
  SELECT RAISE(ABORT, 'would_go_negative')
  WHERE (SELECT COALESCE(SUM(points), 0) FROM ledger_entries WHERE member_id = NEW.member_id AND bucket = NEW.bucket) + NEW.points < 0
     OR (SELECT COALESCE(SUM(xp), 0) FROM ledger_entries WHERE member_id = NEW.member_id) + NEW.xp < 0;
END;

-- P8: no account may write a positive entry for the member it is linked to. This covers
-- awards, bonuses, adjustments AND reversals (undoing a penalty on one's own member is a
-- credit too): another admin has to do it.
CREATE TRIGGER ledger_no_self_credit
BEFORE INSERT ON ledger_entries
WHEN NEW.points > 0 OR NEW.xp > 0
BEGIN
  SELECT RAISE(ABORT, 'an account cannot credit the member it is linked to')
  WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.actor_user_id AND u.member_id = NEW.member_id);
END;

-- ---------------------------------------------------------------------------
-- Claim rules
-- ---------------------------------------------------------------------------

-- A claim starts pending and unverified. Everything else happens through an UPDATE.
CREATE TRIGGER claims_start_pending
BEFORE INSERT ON claims
WHEN NEW.decision <> 'pending' OR NEW.verification_status <> 'unverified'
BEGIN
  SELECT RAISE(ABORT, 'a claim is created pending and unverified');
END;

-- P2, independent of PRAGMA recursive_triggers.
CREATE TRIGGER claims_no_replace
BEFORE INSERT ON claims
WHEN EXISTS (SELECT 1 FROM claims WHERE id = NEW.id)
  OR EXISTS (SELECT 1 FROM claims
              WHERE member_id = NEW.member_id AND task_type_id = NEW.task_type_id
                AND subject_key = NEW.subject_key AND exception_seq = NEW.exception_seq
                AND decision IN ('pending', 'approved'))
BEGIN
  SELECT RAISE(ABORT, 'duplicate_claim');
END;

-- P7
CREATE TRIGGER claims_no_delete
BEFORE DELETE ON claims
WHEN (SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT OLD.member_id
BEGIN
  SELECT RAISE(ABORT, 'claims are deleted only by member erasure');
END;

CREATE TRIGGER claims_no_insert_during_erasure
BEFORE INSERT ON claims
WHEN (SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'an erasure is in progress (guard is set)');
END;

-- A new claim snapshots its task type exactly, and the task must be open.
CREATE TRIGGER claims_snapshot_matches_task
BEFORE INSERT ON claims
BEGIN
  SELECT RAISE(ABORT, 'claim must snapshot an active task type and satisfy its video rule')
  WHERE NOT EXISTS (
    SELECT 1 FROM task_types t
    WHERE t.id = NEW.task_type_id AND t.active = 1
      AND t.points = NEW.points_snapshot AND t.xp = NEW.xp_snapshot
      AND (t.requires_video = 0 OR NEW.video_id IS NOT NULL)
  );
END;

-- P2: a text subject is exactly the evidence hash.
CREATE TRIGGER claims_text_subject_is_evidence_hash
BEFORE INSERT ON claims
WHEN NEW.subject_key GLOB 'text:*' AND NEW.subject_key IS NOT 'text:' || NEW.evidence_hash
BEGIN
  SELECT RAISE(ABORT, 'a text: subject is the evidence hash');
END;

-- P2: a link to a tracked video must be submitted against that video, so that the same
-- video cannot be credited once per spelling of its link.
CREATE TRIGGER claims_tracked_video_url_must_use_video
BEFORE INSERT ON claims
WHEN NEW.video_id IS NULL AND NEW.evidence_url IS NOT NULL
 AND EXISTS (SELECT 1 FROM videos v WHERE instr(NEW.evidence_url, v.platform_video_id) > 0)
BEGIN
  SELECT RAISE(ABORT, 'evidence_url points at a tracked video: submit the claim against that video');
END;

-- P2: an exception is the next number after an APPROVED claim for the same subject,
-- and is entered by an admin with a reason.
CREATE TRIGGER claims_exception_is_next
BEFORE INSERT ON claims
WHEN NEW.exception_seq > 0
BEGIN
  SELECT RAISE(ABORT, 'an exception follows an approved claim for the same subject and is submitted by an admin with a reason')
  WHERE NOT EXISTS (SELECT 1 FROM claims p
                     WHERE p.member_id = NEW.member_id AND p.task_type_id = NEW.task_type_id
                       AND p.subject_key = NEW.subject_key AND p.exception_seq = NEW.exception_seq - 1
                       AND p.decision = 'approved')
     OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.submitted_by AND u.role = 'admin')
     OR length(trim(NEW.exception_reason)) < 3;
END;

-- The only legal moves, and what each one needs.
CREATE TRIGGER claims_transitions
BEFORE UPDATE OF decision ON claims
WHEN NEW.decision <> OLD.decision
BEGIN
  SELECT RAISE(ABORT, 'illegal claim transition')
  WHERE NOT ((OLD.decision = 'pending'  AND NEW.decision IN ('approved', 'rejected', 'withdrawn'))
          OR (OLD.decision = 'approved' AND NEW.decision = 'revoked'));
  SELECT RAISE(ABORT, 'a claim becomes approved only by inserting its task_award')
  WHERE NEW.decision = 'approved'
    AND NOT EXISTS (SELECT 1 FROM ledger_entries e WHERE e.claim_id = NEW.id AND e.kind = 'task_award');
  SELECT RAISE(ABORT, 'a claim becomes revoked only by reversing its task_award')
  WHERE NEW.decision = 'revoked'
    AND NOT EXISTS (SELECT 1 FROM ledger_entries a JOIN ledger_entries r ON r.reverses_entry_id = a.id
                     WHERE a.claim_id = NEW.id AND a.kind = 'task_award');
  SELECT RAISE(ABORT, 'a rejection needs a recorded reviewer and a note')
  WHERE NEW.decision = 'rejected'
    AND (NEW.decided_by IS NULL OR NEW.decision_note IS NULL OR length(trim(NEW.decision_note)) < 3);
END;

-- P8: an approval needs a recorded reviewer, and that reviewer's account must not be
-- linked to the claim's member.
CREATE TRIGGER claims_no_self_approval
BEFORE UPDATE OF decision ON claims
WHEN NEW.decision = 'approved' AND OLD.decision <> 'approved'
BEGIN
  SELECT RAISE(ABORT, 'approval needs a recorded reviewer who is not linked to the member')
  WHERE NEW.decided_by IS NULL
     OR EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.decided_by AND u.member_id = NEW.member_id);
END;

-- P12: who a claim belongs to, what it is for, what was submitted and what it is worth
-- never change. The one exception: during an erasure, evidence may be blanked (other
-- members' feedback about the erased member's videos).
CREATE TRIGGER claims_identity_is_immutable
BEFORE UPDATE ON claims
WHEN NEW.id IS NOT OLD.id
  OR NEW.member_id IS NOT OLD.member_id
  OR NEW.task_type_id IS NOT OLD.task_type_id
  OR NEW.video_id IS NOT OLD.video_id
  OR NEW.subject_key IS NOT OLD.subject_key
  OR NEW.exception_seq IS NOT OLD.exception_seq
  OR NEW.exception_reason IS NOT OLD.exception_reason
  OR NEW.points_snapshot IS NOT OLD.points_snapshot
  OR NEW.xp_snapshot IS NOT OLD.xp_snapshot
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.submitted_by_role IS NOT OLD.submitted_by_role
  OR (NEW.submitted_by IS NOT OLD.submitted_by AND NEW.submitted_by IS NOT NULL)
  OR ((NEW.evidence_text IS NOT OLD.evidence_text OR NEW.evidence_url IS NOT OLD.evidence_url OR NEW.evidence_hash IS NOT OLD.evidence_hash)
      AND NOT ((SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT NULL
               AND NEW.evidence_text IS NULL AND NEW.evidence_url IS NULL AND NEW.evidence_hash IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'claim identity, evidence and value are immutable');
END;

-- P12: once decided, the verification facts and the decision's own details are frozen.
-- (A reviewer account being deleted may still null decided_by through its foreign key.)
CREATE TRIGGER claims_decided_is_frozen
BEFORE UPDATE ON claims
WHEN OLD.decision <> 'pending' AND (
     NEW.verification_status IS NOT OLD.verification_status
  OR NEW.verification_source IS NOT OLD.verification_source
  OR NEW.verification_detail IS NOT OLD.verification_detail
  OR NEW.verified_at IS NOT OLD.verified_at
  OR (NEW.decision IS OLD.decision AND (
          NEW.decided_at IS NOT OLD.decided_at
       OR NEW.decision_note IS NOT OLD.decision_note
       OR (NEW.decided_by IS NOT OLD.decided_by AND NEW.decided_by IS NOT NULL))))
BEGIN
  SELECT RAISE(ABORT, 'a decided claim is frozen');
END;

-- P12: "verified" needs a task with an automatic check, and a source that matches the
-- platform the evidence is on (or the clearly-labelled mock adapter).
CREATE TRIGGER claims_verified_needs_attestable_task
BEFORE UPDATE OF verification_status, verification_source ON claims
WHEN NEW.verification_status = 'verified'
BEGIN
  SELECT RAISE(ABORT, 'verified requires an api-checkable task and evidence on the attesting platform')
  WHERE NOT EXISTS (SELECT 1 FROM task_types t WHERE t.id = NEW.task_type_id AND t.api_check <> 'none')
     OR (NEW.verification_source <> 'mock_adapter'
         AND NEW.verification_source IS NOT COALESCE(
               (CASE
                  WHEN NEW.video_id IS NOT NULL THEN (SELECT v.platform FROM videos v WHERE v.id = NEW.video_id)
                  WHEN NEW.evidence_url GLOB 'https://www.youtube.com/*' THEN 'youtube'
                  WHEN NEW.evidence_url GLOB 'https://www.tiktok.com/*' THEN 'tiktok'
                END) || '_api',
               'no platform'));
END;

-- ---------------------------------------------------------------------------
-- Erasure guard rules (P7)
-- ---------------------------------------------------------------------------

CREATE TRIGGER erasure_guard_set
BEFORE UPDATE ON erasure_guard
WHEN NEW.member_id IS NOT NULL
 AND (OLD.member_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id))
BEGIN
  SELECT RAISE(ABORT, 'erasure guard: already set, or no such member');
END;

CREATE TRIGGER erasure_guard_clear
BEFORE UPDATE ON erasure_guard
WHEN NEW.member_id IS NULL AND OLD.member_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id)
BEGIN
  SELECT RAISE(ABORT, 'erasure guard: the member still exists; erasure is all-or-nothing');
END;

CREATE TRIGGER erasure_guard_no_delete
BEFORE DELETE ON erasure_guard
BEGIN
  SELECT RAISE(ABORT, 'erasure guard row is permanent');
END;

CREATE TRIGGER erasure_guard_no_insert
BEFORE INSERT ON erasure_guard
BEGIN
  SELECT RAISE(ABORT, 'erasure guard row is permanent');
END;

-- ---------------------------------------------------------------------------
-- Configuration
-- ---------------------------------------------------------------------------

-- Exactly five evolution tiers (src/domain/tiers.js replaces all five at once and
-- integrity.js asserts the set). Names, thresholds and art are placeholders until approved.
CREATE TABLE tiers (
  level      INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 5),
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  min_xp     INTEGER NOT NULL CHECK (min_xp >= 0),
  art_key    TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (level <> 1 OR min_xp = 0)
) STRICT;

-- Key/value settings (JSON values), validated by src/domain/settings.js.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
) STRICT;

-- ---------------------------------------------------------------------------
-- Audit trail (P10)
-- ---------------------------------------------------------------------------
-- Every state-changing action writes one row in the same transaction as the change.
-- `detail` holds ids, enum values, numbers and booleans only. Reasons and notes are NOT
-- copied here (they live on the ledger entry or claim, which erasure deletes); evidence
-- text, e-mail addresses, URLs and tokens never appear here.

CREATE TABLE audit_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  at                TEXT NOT NULL CHECK (at IS strftime('%Y-%m-%dT%H:%M:%fZ', at)),
  actor_user_id     TEXT,                     -- no FK: must survive account deletion
  actor_role        TEXT NOT NULL CHECK (actor_role IN ('admin', 'member', 'system')),
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         TEXT,
  subject_member_id TEXT,                     -- whose data the row concerns; used to scrub on erasure
  detail            TEXT,
  request_id        TEXT
) STRICT;
CREATE INDEX audit_by_subject ON audit_log (subject_member_id);
CREATE INDEX audit_by_entity ON audit_log (entity_type, entity_id);

CREATE TRIGGER audit_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

CREATE TRIGGER audit_no_replace
BEFORE INSERT ON audit_log
WHEN EXISTS (SELECT 1 FROM audit_log WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

-- The only permitted update is setting `detail` to NULL on rows about the member who is
-- being erased right now. Every other column, and every other row, is frozen.
CREATE TRIGGER audit_no_update
BEFORE UPDATE ON audit_log
WHEN OLD.subject_member_id IS NULL
  OR (SELECT member_id FROM erasure_guard WHERE id = 1) IS NULL
  OR (SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT OLD.subject_member_id
  OR NEW.detail IS NOT NULL
  OR NEW.id IS NOT OLD.id
  OR NEW.at IS NOT OLD.at
  OR NEW.actor_user_id IS NOT OLD.actor_user_id
  OR NEW.actor_role IS NOT OLD.actor_role
  OR NEW.action IS NOT OLD.action
  OR NEW.entity_type IS NOT OLD.entity_type
  OR NEW.entity_id IS NOT OLD.entity_id
  OR NEW.subject_member_id IS NOT OLD.subject_member_id
  OR NEW.request_id IS NOT OLD.request_id
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

-- Detail is small JSON with no addresses and no links.
CREATE TRIGGER audit_detail_is_impersonal
BEFORE INSERT ON audit_log
WHEN NEW.detail IS NOT NULL
 AND (NOT json_valid(NEW.detail) OR length(NEW.detail) > 2000 OR instr(NEW.detail, '@') > 0 OR instr(NEW.detail, '://') > 0)
BEGIN
  SELECT RAISE(ABORT, 'audit detail must be small JSON without addresses or URLs');
END;

-- A row about a member must say which member, or erasure could never scrub it.
CREATE TRIGGER audit_member_rows_need_subject
BEFORE INSERT ON audit_log
WHEN NEW.subject_member_id IS NULL
 AND (NEW.actor_role = 'member' OR NEW.entity_type IN ('claim', 'ledger_entry', 'member'))
BEGIN
  SELECT RAISE(ABORT, 'audit rows about a member must name subject_member_id');
END;
