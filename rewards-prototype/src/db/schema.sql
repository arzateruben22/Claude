-- Rewards prototype — schema v1
--
-- Design rule: every correctness promise the product makes is enforced HERE, by the
-- database, and not only by application code. If a bug or a second code path tries to
-- break one of these promises, the write fails.
--
--   P1  One approved claim produces exactly one ledger entry.          -> ledger_one_award_per_claim
--   P2  A duplicate submission can never be credited twice.            -> claims_one_live_per_subject
--   P3  Nothing is credited unless it was reviewed or API-attested.    -> claims CHECK + ledger_award_requires_reviewed_claim
--   P4  The ledger is append-only; corrections are new entries.        -> ledger_no_update / ledger_no_delete
--   P5  A correction can be undone exactly once, and mirrors its target-> ledger_one_reversal_per_entry / ledger_reversal_must_mirror
--   P6  Engagement (likes, comments, views, follows) has NO path to points.
--       There is deliberately no table or column that links an engagement
--       statistic to a ledger entry. Only task_types (contributions) can.
--   P7  Erasing a member removes their rows for real, and is the ONLY way
--       ledger rows are ever deleted.                                  -> erasure_guard
--
-- Conventions: ids are opaque text (prefix + random), timestamps are ISO-8601 UTC text,
-- booleans are INTEGER 0/1, JSON is stored as TEXT. All tables are STRICT.
-- The connection must run with PRAGMA foreign_keys = ON (src/db/sqlite.js does this).

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
  -- Set only from an OAuth-consented "my channel" lookup, never typed in by anyone.
  youtube_channel_id TEXT,
  youtube_linked_at  TEXT,
  created_at         TEXT NOT NULL,
  CHECK ((youtube_channel_id IS NULL) = (youtube_linked_at IS NULL))
) STRICT;

-- A user is someone allowed to sign in. Access is by allowlist: a row must exist
-- (keyed by email) before the first Google sign-in; after that the Google `sub`
-- is the identity and the email is informational.
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

-- Server-side sessions. Only a SHA-256 of the cookie token is stored.
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  csrf_token   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
) STRICT;
CREATE INDEX sessions_by_user ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- Things members can do
-- ---------------------------------------------------------------------------

CREATE TABLE videos (
  id                TEXT PRIMARY KEY,
  platform          TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok')),
  platform_video_id TEXT NOT NULL CHECK (length(platform_video_id) BETWEEN 1 AND 64),
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
--   decision            : what the admin decided about crediting it
CREATE TABLE claims (
  id                  TEXT PRIMARY KEY,
  member_id           TEXT NOT NULL REFERENCES members (id),
  task_type_id        TEXT NOT NULL REFERENCES task_types (id),
  video_id            TEXT REFERENCES videos (id),
  -- What uniqueness is measured on: 'video:<videos.id>', 'url:<normalized url>' or 'text:<sha256>'.
  subject_key         TEXT NOT NULL CHECK (subject_key GLOB 'video:*' OR subject_key GLOB 'url:*' OR subject_key GLOB 'text:*'),
  -- 0 for ordinary claims. An admin may grant an explicit, logged exception that lets a
  -- member be credited again for the same subject; each exception takes the next number.
  exception_seq       INTEGER NOT NULL DEFAULT 0 CHECK (exception_seq >= 0),
  exception_reason    TEXT,
  evidence_text       TEXT CHECK (evidence_text IS NULL OR length(evidence_text) <= 4000),
  evidence_url        TEXT CHECK (evidence_url IS NULL OR length(evidence_url) <= 500),
  -- sha256 of the normalized evidence text; lets us flag the same text coming from two members.
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
  created_at          TEXT NOT NULL,

  CHECK ((exception_seq = 0) = (exception_reason IS NULL)),
  CHECK (evidence_text IS NOT NULL OR evidence_url IS NOT NULL OR video_id IS NOT NULL),
  -- "verified" may only ever come from a platform adapter; "manually reviewed" only from a person.
  CHECK ((verification_status = 'unverified') = (verification_source = 'none')),
  CHECK ((verification_status = 'manually_reviewed') = (verification_source = 'admin_review')),
  CHECK ((verification_status = 'unverified') = (verified_at IS NULL)),
  -- P3: an unverified claim can never be approved.
  CHECK (decision <> 'approved' OR verification_status IN ('manually_reviewed', 'verified')),
  CHECK ((decision IN ('pending', 'withdrawn')) OR decided_at IS NOT NULL)
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
  starts_at   TEXT NOT NULL,
  ends_at     TEXT NOT NULL,
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
  -- task_award : created by approving a claim
  -- bonus      : admin-granted bonus (competition result, streak, easter egg)
  -- adjustment : manual admin correction, positive or negative
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
  actor_user_id     TEXT,                       -- no FK: the entry must outlive the account that made it
  -- Calendar month the entry counts toward for caps, in the configured time zone: 'YYYY-MM'.
  period            TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  created_at        TEXT NOT NULL,

  CHECK (points <> 0 OR xp <> 0),
  CHECK ((kind = 'task_award') = (claim_id IS NOT NULL)),
  CHECK ((kind = 'reversal') = (reverses_entry_id IS NOT NULL)),
  CHECK (kind <> 'task_award' OR (points >= 0 AND xp >= 0 AND bucket = 'earned')),
  CHECK (kind <> 'bonus' OR (points >= 0 AND xp >= 0 AND bucket = 'bonus'))
) STRICT;

-- P1
CREATE UNIQUE INDEX ledger_one_award_per_claim
  ON ledger_entries (claim_id) WHERE kind = 'task_award';
-- P5
CREATE UNIQUE INDEX ledger_one_reversal_per_entry
  ON ledger_entries (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL;
CREATE INDEX ledger_by_member ON ledger_entries (member_id, id);
CREATE INDEX ledger_by_period ON ledger_entries (period, member_id);

-- P7: a single-row switch that is non-NULL only inside an erasure transaction.
CREATE TABLE erasure_guard (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  member_id TEXT
) STRICT;
INSERT INTO erasure_guard (id, member_id) VALUES (1, NULL);

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

-- P3: an award must match an approved, reviewed claim of the same member, value for value.
CREATE TRIGGER ledger_award_requires_reviewed_claim
BEFORE INSERT ON ledger_entries
WHEN NEW.kind = 'task_award'
BEGIN
  SELECT RAISE(ABORT, 'task_award requires an approved and reviewed claim of the same member')
  WHERE NOT EXISTS (
    SELECT 1 FROM claims c
    WHERE c.id = NEW.claim_id
      AND c.member_id = NEW.member_id
      AND c.decision = 'approved'
      AND c.verification_status IN ('manually_reviewed', 'verified')
      AND c.points_snapshot = NEW.points
      AND c.xp_snapshot = NEW.xp
  );
END;

-- P5: a reversal negates exactly one earlier non-reversal entry of the same member.
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
  );
END;

-- An approved claim may only leave 'approved' by being revoked (which the application
-- pairs with a reversal entry in the same transaction).
CREATE TRIGGER claims_approved_is_sticky
BEFORE UPDATE OF decision ON claims
WHEN OLD.decision = 'approved' AND NEW.decision NOT IN ('approved', 'revoked')
BEGIN
  SELECT RAISE(ABORT, 'an approved claim can only be revoked');
END;

-- Terminal decisions never reopen.
CREATE TRIGGER claims_terminal_is_final
BEFORE UPDATE OF decision ON claims
WHEN OLD.decision IN ('rejected', 'withdrawn', 'revoked') AND NEW.decision <> OLD.decision
BEGIN
  SELECT RAISE(ABORT, 'a rejected, withdrawn or revoked claim is final');
END;

-- Who a claim belongs to, what it is for, and what it is worth never change after submission.
CREATE TRIGGER claims_identity_is_immutable
BEFORE UPDATE ON claims
WHEN NEW.member_id <> OLD.member_id
  OR NEW.task_type_id <> OLD.task_type_id
  OR NEW.subject_key <> OLD.subject_key
  OR NEW.exception_seq <> OLD.exception_seq
  OR NEW.points_snapshot <> OLD.points_snapshot
  OR NEW.xp_snapshot <> OLD.xp_snapshot
BEGIN
  SELECT RAISE(ABORT, 'claim identity and value are immutable');
END;

-- ---------------------------------------------------------------------------
-- Configuration
-- ---------------------------------------------------------------------------

-- Exactly five evolution tiers. Names, thresholds and art are placeholders until approved.
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
-- Audit trail
-- ---------------------------------------------------------------------------
-- Every state-changing action writes one row in the same transaction as the change.
-- `detail` holds ids, enum values, numbers and admin-entered reasons only: never
-- evidence text, e-mail addresses, tokens or other personal content.

CREATE TABLE audit_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  at                TEXT NOT NULL,
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

CREATE TRIGGER audit_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

-- The only permitted update is scrubbing `detail` for the member being erased.
CREATE TRIGGER audit_no_update
BEFORE UPDATE ON audit_log
WHEN (SELECT member_id FROM erasure_guard WHERE id = 1) IS NOT OLD.subject_member_id
  OR NEW.id <> OLD.id
  OR NEW.at <> OLD.at
  OR NEW.action <> OLD.action
  OR NEW.actor_role <> OLD.actor_role
  OR NEW.entity_type <> OLD.entity_type
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
