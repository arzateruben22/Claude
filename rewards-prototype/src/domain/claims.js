// Claims: a member saying "I did this task", and what happens to it.
//
// Two independent facts live on every claim:
//   verification_status  unverified | manually_reviewed | verified   (how well the activity is established)
//   decision             pending | approved | rejected | withdrawn | revoked   (what was decided about crediting it)
//
// Rules this module upholds (the schema backs each one up):
//   * "verified" is written ONLY from a platform adapter's positive attestation.
//   * "manually_reviewed" is written ONLY when an admin approves after looking at it.
//   * A claim becomes approved ONLY by its ledger award being written (a schema trigger
//     flips the decision), and revoked ONLY by that award being reversed.
//   * At most one live (pending/approved) claim per member + task + subject, unless an
//     admin grants an explicit, audit-logged exception for something already credited.
//   * An admin who is also a member can never decide their own claim.
//   * Once decided, a claim's evidence, verification and decision details never change.

import { conflict, forbidden, notFound, tooManyRequests, unprocessable } from '../lib/errors.js';
import { localDateOf } from '../lib/clock.js';
import { newId, sha256Hex } from '../lib/ids.js';
import * as v from '../lib/validate.js';
import { isTriggerAbort, isUniqueViolation } from '../db/sqlite.js';
import { nowIso, requireAdmin, requireAdminUser, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';
import { getSetting } from './settings.js';
import { awardForClaim, getEntry, reverseEntry } from './ledger.js';
import { assertRewardableText } from './policy.js';
import { parseVideoUrl } from './videos.js';
import { outcomeForError } from '../platforms/contract.js';

const DECISIONS = ['pending', 'approved', 'rejected', 'withdrawn', 'revoked'];

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const SELECT = `
  SELECT c.*, t.key AS task_key, t.label AS task_label, t.api_check AS task_api_check,
         vd.title AS video_title, vd.platform AS video_platform, vd.kind AS video_kind,
         (SELECT e.id FROM ledger_entries e WHERE e.claim_id = c.id AND e.kind = 'task_award') AS award_entry_id
    FROM claims c
    JOIN task_types t ON t.id = c.task_type_id
    LEFT JOIN videos vd ON vd.id = c.video_id`;

/** What every signed-in person may see: what it was for and where it stands. No evidence. */
function summaryView(row) {
  return {
    id: row.id,
    member_id: row.member_id,
    task_type: { id: row.task_type_id, key: row.task_key, label: row.task_label },
    video: row.video_id ? { id: row.video_id, title: row.video_title, platform: row.video_platform, kind: row.video_kind } : null,
    verification_status: row.verification_status,
    verification_source: row.verification_source,
    // True when the "verified" came from sample data, not from a real platform.
    simulated: row.verification_source === 'mock_adapter',
    decision: row.decision,
    points: row.points_snapshot,
    xp: row.xp_snapshot,
    created_at: row.created_at,
    decided_at: row.decided_at,
  };
}

/** For the claim's own member and for admins: adds the evidence and the reasons. */
function detailView(row, { admin }) {
  return {
    ...summaryView(row),
    evidence_text: row.evidence_text,
    evidence_url: row.evidence_url,
    verification_detail: row.verification_detail ? JSON.parse(row.verification_detail) : null,
    verified_at: row.verified_at,
    decision_note: row.decision_note,
    is_exception: row.exception_seq > 0,
    award_entry_id: row.award_entry_id,
    ...(admin
      ? {
          exception_reason: row.exception_reason,
          submitted_by: row.submitted_by,
          decided_by: row.decided_by,
          api_check: row.task_api_check,
        }
      : {}),
  };
}

const isStaff = (ctx) => ctx.actor.role === 'admin' || ctx.actor.role === 'system';
const canSeeEvidence = (ctx, row) => isStaff(ctx) || (ctx.actor.memberId !== null && ctx.actor.memberId === row.member_id);
const viewFor = (ctx, row) => (canSeeEvidence(ctx, row) ? detailView(row, { admin: isStaff(ctx) }) : summaryView(row));

function load(ctx, claimId) {
  const row = ctx.db.get(`${SELECT} WHERE c.id = ?`, [claimId]);
  if (!row) throw notFound('claim_not_found', 'That submission does not exist.');
  return row;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** A member can open only their own claims; someone else's id answers "not found". */
export function getClaim(ctx, claimId) {
  requireSignedIn(ctx);
  const row = load(ctx, claimId);
  if (!canSeeEvidence(ctx, row)) throw notFound('claim_not_found', 'That submission does not exist.');
  return viewFor(ctx, row);
}

/**
 * Newest first, keyset-paginated by (created_at, id).
 * A member sees ONLY their own claims (pending, rejected and withdrawn ones are nobody
 * else's business); an admin sees everyone's, with `flags` for review. What other
 * members may see of someone's activity comes from leaderboard.js, not from here.
 * @param {{ memberId?: string, decision?: string, limit?: number, before?: string }} [filter]
 */
export function listClaims(ctx, { memberId, decision, limit = 50, before } = {}) {
  requireSignedIn(ctx);
  if (!isStaff(ctx)) {
    if (!ctx.actor.memberId) throw forbidden('not_yours', 'There are no submissions to show for this account.');
    if (memberId && memberId !== ctx.actor.memberId) throw forbidden('not_yours', 'You can only see your own submissions.');
    memberId = ctx.actor.memberId;
  }
  const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const where = [];
  const params = [];
  if (memberId) {
    where.push('c.member_id = ?');
    params.push(memberId);
  }
  if (decision) {
    if (!DECISIONS.includes(decision)) throw unprocessable('invalid_input', 'Unknown decision filter.', { field: 'decision' });
    where.push('c.decision = ?');
    params.push(decision);
  }
  if (before) {
    const [createdAt, id] = String(before).split('|');
    where.push('(c.created_at < ? OR (c.created_at = ? AND c.id < ?))');
    params.push(createdAt, createdAt, id ?? '');
  }
  const rows = ctx.db.all(
    `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.created_at DESC, c.id DESC LIMIT ?`,
    [...params, size + 1],
  );
  const page = rows.slice(0, size);
  const items = page.map((row) => {
    const view = viewFor(ctx, row);
    return isStaff(ctx) ? { ...view, flags: reviewFlags(ctx, row) } : view;
  });
  const last = page[page.length - 1];
  return { items, next: rows.length > size ? `${last.created_at}|${last.id}` : null };
}

/** Things an admin should notice before deciding. */
function reviewFlags(ctx, row) {
  const flags = [];
  if (row.evidence_hash) {
    const other = ctx.db.get('SELECT 1 AS hit FROM claims WHERE evidence_hash = ? AND member_id <> ? LIMIT 1', [row.evidence_hash, row.member_id]);
    if (other) flags.push('same_text_as_another_member');
    const own = ctx.db.get('SELECT 1 AS hit FROM claims WHERE evidence_hash = ? AND member_id = ? AND id <> ? LIMIT 1', [row.evidence_hash, row.member_id, row.id]);
    if (own) flags.push('same_text_as_own_earlier_submission');
  }
  if (row.exception_seq > 0) flags.push('admin_exception');
  if (row.verification_source === 'mock_adapter') flags.push('simulated_verification');
  return flags;
}

// ---------------------------------------------------------------------------
// Submitting
// ---------------------------------------------------------------------------

const normaliseText = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

function normaliseGenericUrl(url) {
  const params = [...url.searchParams.entries()].filter(([key]) => !/^(utm_|si$|feature$|fbclid$|gclid$)/i.test(key)).sort(([a], [b]) => a.localeCompare(b));
  const query = params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`;
}

function submissionsToday(ctx, memberId, timeZone) {
  const now = ctx.clock.now();
  const today = localDateOf(now, timeZone);
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  return ctx.db
    .all('SELECT created_at FROM claims WHERE member_id = ? AND submitted_by_role = ? AND created_at >= ?', [memberId, 'member', since])
    .filter((row) => localDateOf(new Date(row.created_at), timeZone) === today).length;
}

/**
 * A member submits for themselves. An admin may submit on a member's behalf by passing
 * `member_id`, and may pass `exception_reason` to allow a second credit for the same subject.
 * @param {{ task_type_id: string, video_id?: string, evidence_text?: string, evidence_url?: string,
 *           member_id?: string, exception_reason?: string }} input
 */
export function submitClaim(ctx, input) {
  requireSignedIn(ctx);
  const data = v.only(input, ['task_type_id', 'video_id', 'evidence_text', 'evidence_url', 'member_id', 'exception_reason']);
  const staff = isStaff(ctx);

  // Whose claim is this? Ownership comes from the session, never from the body.
  let memberId = ctx.actor.memberId;
  if (data.member_id !== undefined && data.member_id !== null) {
    const requested = v.string(data.member_id, 'member_id', { max: 64 });
    if (!staff && requested !== ctx.actor.memberId) throw forbidden('not_yours', 'You can only submit for yourself.');
    memberId = requested;
  }
  if (!memberId) throw unprocessable('member_required', 'Say which member this submission is for.', { field: 'member_id' });
  const onBehalf = staff && memberId !== ctx.actor.memberId;

  let exceptionReason = null;
  if (data.exception_reason !== undefined && data.exception_reason !== null) {
    if (!staff) throw forbidden('admin_only', 'Only an admin can grant an exception.');
    exceptionReason = v.string(data.exception_reason, 'exception_reason', { min: 3, max: 500 });
  }

  const taskTypeId = v.string(data.task_type_id, 'task_type_id', { max: 64 });
  const videoId = data.video_id === undefined || data.video_id === null ? null : v.string(data.video_id, 'video_id', { max: 64 });
  const evidenceText = data.evidence_text === undefined || data.evidence_text === null ? null : v.string(data.evidence_text, 'evidence_text', { min: 1, max: 4000 });
  const rawUrl = data.evidence_url === undefined || data.evidence_url === null ? null : v.httpsUrl(data.evidence_url, 'evidence_url');

  const outcome = ctx.db.tx(() => {
    const member = ctx.db.get('SELECT id, status FROM members WHERE id = ?', [memberId]);
    if (!member) throw notFound('member_not_found', 'That member does not exist.');
    if (member.status !== 'active') throw conflict('member_not_active', 'That member is archived.');

    const task = ctx.db.get('SELECT * FROM task_types WHERE id = ?', [taskTypeId]);
    if (!task) throw notFound('task_type_not_found', 'That task does not exist.');
    if (task.active !== 1) throw conflict('task_not_active', 'That task is not open for submissions right now.');

    if (task.requires_video === 1 && !videoId) throw unprocessable('video_required', 'Choose the video this is about.', { field: 'video_id' });
    if (videoId) {
      const video = ctx.db.get('SELECT id, status FROM videos WHERE id = ?', [videoId]);
      if (!video) throw notFound('video_not_found', 'That video is not on the list.');
      if (video.status !== 'active') throw conflict('video_not_active', 'That video is archived.');
    }

    // Evidence rules depend on how the task is checked.
    let effectiveVideoId = videoId;
    let evidenceUrl = null;
    let urlKey = null;
    if (task.api_check === 'video_ownership') {
      if (!rawUrl) throw unprocessable('evidence_url_required', 'Add the link to your video.', { field: 'evidence_url' });
      const parsed = parseVideoUrl(rawUrl.href);
      evidenceUrl = parsed.url;
      urlKey = `${parsed.platform}/${parsed.platformVideoId}`;
      // If that video is already on the tracked list, the claim is about that video: one
      // subject per video, however its link is spelled.
      const tracked = ctx.db.get('SELECT id, status FROM videos WHERE platform = ? AND platform_video_id = ?', [parsed.platform, parsed.platformVideoId]);
      if (tracked) {
        if (videoId && videoId !== tracked.id) throw unprocessable('video_mismatch', 'The link and the chosen video are different videos.', { field: 'evidence_url' });
        if (tracked.status !== 'active') throw conflict('video_not_active', 'That video is archived.');
        effectiveVideoId = tracked.id;
      } else if (videoId) {
        throw unprocessable('video_mismatch', 'The link and the chosen video are different videos.', { field: 'evidence_url' });
      }
    } else {
      const minChars = getSetting(ctx, 'feedback_min_chars');
      if (!evidenceText || evidenceText.length < minChars) {
        throw unprocessable('evidence_too_short', `Write at least ${minChars} characters so there is something to review.`, { field: 'evidence_text', min: minChars });
      }
      if (rawUrl) {
        evidenceUrl = rawUrl.href;
        urlKey = normaliseGenericUrl(rawUrl);
        if (!videoId) {
          const tracked = ctx.db.get('SELECT id FROM videos WHERE instr(?, platform_video_id) > 0 LIMIT 1', [evidenceUrl]);
          if (tracked) {
            throw unprocessable('use_tracked_video', 'That link is one of the tracked videos. Choose the video from the list instead.', { field: 'evidence_url', video_id: tracked.id });
          }
        }
      }
    }

    const evidenceHash = evidenceText ? sha256Hex(normaliseText(evidenceText)) : null;
    const subjectKey = effectiveVideoId ? `video:${effectiveVideoId}` : urlKey ? `url:${urlKey}` : `text:${evidenceHash}`;

    // Anti-abuse: a member's own submissions per local day. Admin entries are not limited.
    if (!staff) {
      const limit = getSetting(ctx, 'daily_claim_limit_per_member');
      if (submissionsToday(ctx, memberId, getSetting(ctx, 'time_zone')) >= limit) {
        throw tooManyRequests(`You have reached today's limit of ${limit} submissions. Try again tomorrow.`, { limit });
      }
    }

    // P2: one live claim per member + task + subject. An exception is the next number
    // after the latest APPROVED claim for that subject, and only an admin can grant it.
    let exceptionSeq = 0;
    if (exceptionReason) {
      const credited = ctx.db.get(
        "SELECT MAX(exception_seq) AS seq FROM claims WHERE member_id = ? AND task_type_id = ? AND subject_key = ? AND decision = 'approved'",
        [memberId, taskTypeId, subjectKey],
      );
      if (credited.seq === null) {
        throw conflict('exception_not_applicable', 'An exception is only for something that has already been credited. Submit it normally instead.');
      }
      exceptionSeq = credited.seq + 1;
    }
    const live = ctx.db.get(
      "SELECT id, decision FROM claims WHERE member_id = ? AND task_type_id = ? AND subject_key = ? AND exception_seq = ? AND decision IN ('pending', 'approved')",
      [memberId, taskTypeId, subjectKey, exceptionSeq],
    );
    if (live) {
      // Record the blocked attempt and COMMIT that record; the caller gets the 409 afterwards.
      recordAudit(ctx, { action: 'claim.duplicate_blocked', entityType: 'claim', entityId: live.id, subjectMemberId: memberId, detail: { task_type_id: taskTypeId, existing_decision: live.decision } });
      return { duplicate: live };
    }

    const id = newId('clm');
    try {
      ctx.db.run(
        `INSERT INTO claims (id, member_id, task_type_id, video_id, subject_key, exception_seq, exception_reason, evidence_text, evidence_url,
                             evidence_hash, points_snapshot, xp_snapshot, submitted_by, submitted_by_role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, memberId, taskTypeId, effectiveVideoId, subjectKey, exceptionSeq, exceptionReason, evidenceText, evidenceUrl, evidenceHash, task.points, task.xp, ctx.actor.userId ?? null, staff ? 'admin' : 'member', nowIso(ctx)],
      );
    } catch (error) {
      // The schema is the backstop if anything slips past the checks above.
      if (isUniqueViolation(error, 'claims.member_id') || isTriggerAbort(error, 'duplicate_claim')) return { duplicate: { id: null, decision: 'pending' } };
      if (isTriggerAbort(error, 'an erasure is in progress')) throw conflict('erasure_in_progress', 'An erasure is in progress. Try again in a moment.');
      throw error;
    }
    recordAudit(ctx, { action: 'claim.submit', entityType: 'claim', entityId: id, subjectMemberId: memberId, detail: { task_type_id: taskTypeId, video_id: effectiveVideoId, on_behalf: onBehalf, points: task.points, xp: task.xp } });
    if (exceptionSeq > 0) {
      recordAudit(ctx, { action: 'claim.exception_granted', entityType: 'claim', entityId: id, subjectMemberId: memberId, detail: { exception_seq: exceptionSeq } });
    }
    return { id };
  });

  if (outcome.duplicate) {
    throw conflict('duplicate_claim', 'There is already a submission for this. It cannot be credited twice.', {
      existing_claim_id: outcome.duplicate.id,
      existing_decision: outcome.duplicate.decision,
    });
  }
  return viewFor(ctx, load(ctx, outcome.id));
}

// ---------------------------------------------------------------------------
// Platform check
// ---------------------------------------------------------------------------

/**
 * Asks the platform adapter to attest the claim (only for tasks with an automatic check).
 * A positive attestation sets "verified". Anything else — not attested, unsupported,
 * not connected, API failure — leaves the claim "unverified" and records why.
 * @param {{ get(platform: string): object }} registry  src/platforms/registry.js
 * @returns {Promise<{ claim: object, check: { outcome: string, reason: string, evidence: object } }>}
 */
export async function runApiCheck(ctx, claimId, registry) {
  requireAdmin(ctx);
  const before = load(ctx, claimId);
  if (before.decision !== 'pending') throw conflict('claim_not_pending', 'Only a pending submission can be checked.', { decision: before.decision });
  if (before.task_api_check !== 'video_ownership') {
    throw unprocessable('no_api_check', 'This kind of task is reviewed by a person. There is nothing to check automatically.');
  }
  const parsed = parseVideoUrl(before.evidence_url);
  const adapter = registry.get(parsed.platform);
  const member = ctx.db.get('SELECT youtube_channel_id FROM members WHERE id = ?', [before.member_id]);
  const memberChannelId = parsed.platform === 'youtube' ? (member?.youtube_channel_id ?? null) : null;

  // The network call happens OUTSIDE any transaction.
  let check;
  try {
    check = await adapter.checkVideoOwnership({ platformVideoId: parsed.platformVideoId, memberChannelId });
  } catch {
    // Adapters should not throw; if one does, treat it as an outage rather than guess.
    check = { outcome: outcomeForError({ code: 'unavailable' }), reason: 'The platform check failed unexpectedly. Try again later.', evidence: {} };
  }

  const attested = check.outcome === 'attested';
  const source = attested ? (adapter.mode === 'mock' ? 'mock_adapter' : `${parsed.platform}_api`) : 'none';
  const detail = JSON.stringify({ check: 'video_ownership', platform: parsed.platform, adapter_mode: adapter.mode, outcome: check.outcome, reason: check.reason, evidence: check.evidence ?? {}, checked_at: nowIso(ctx) });

  ctx.db.tx(() => {
    const current = load(ctx, claimId);
    if (current.decision !== 'pending') throw conflict('claim_not_pending', 'The submission was decided while it was being checked.', { decision: current.decision });
    ctx.db.run('UPDATE claims SET verification_status = ?, verification_source = ?, verified_at = ?, verification_detail = ? WHERE id = ?', [
      attested ? 'verified' : 'unverified',
      source,
      attested ? nowIso(ctx) : null,
      detail,
      claimId,
    ]);
    recordAudit(ctx, { action: 'claim.api_check', entityType: 'claim', entityId: claimId, subjectMemberId: current.member_id, detail: { platform: parsed.platform, adapter_mode: adapter.mode, outcome: check.outcome } });
  });
  return { claim: viewFor(ctx, load(ctx, claimId)), check };
}

// ---------------------------------------------------------------------------
// Deciding
// ---------------------------------------------------------------------------

/**
 * Approve or reject a pending claim. Needs a real admin account (the audit trail and
 * the ledger record who decided).
 *   approve -> the claim is marked reviewed and its single ledger award is written, which
 *              approves it (same transaction). If a monthly cap would be passed, nothing
 *              changes (409 cap_exceeded). An optional note is kept with the award.
 *   reject  -> needs a note the member can read.
 * Approving an already-approved claim changes nothing and returns `already_applied: true`.
 * @param {{ outcome: 'approve'|'reject', note?: string }} input
 * @returns {{ claim: object, entry: object|null, already_applied: boolean }}
 */
export function reviewClaim(ctx, claimId, input) {
  requireAdminUser(ctx);
  const data = v.only(input, ['outcome', 'note']);
  const outcome = v.oneOf(data.outcome, 'outcome', ['approve', 'reject']);
  const note = data.note === undefined || data.note === null || data.note === '' ? null : v.string(data.note, 'note', { min: 3, max: 400 });
  if (outcome === 'reject' && !note) throw unprocessable('note_required', 'Say why, so the member knows what to change.', { field: 'note' });
  // An approval note becomes part of the award's reason, so it follows the same wording rules.
  if (outcome === 'approve' && note) assertRewardableText('note', note);

  return ctx.db.tx(() => {
    const claim = load(ctx, claimId);
    if (claim.decision === 'approved' && outcome === 'approve') {
      return { claim: viewFor(ctx, claim), entry: getEntry(ctx, claim.award_entry_id), already_applied: true };
    }
    if (claim.decision !== 'pending') throw conflict('claim_not_pending', 'That submission has already been decided.', { decision: claim.decision });
    if (ctx.actor.memberId && ctx.actor.memberId === claim.member_id) {
      throw forbidden('self_review_forbidden', 'You cannot decide your own submission. Another admin has to.');
    }
    const at = nowIso(ctx);

    if (outcome === 'reject') {
      ctx.db.run("UPDATE claims SET decision = 'rejected', decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?", [ctx.actor.userId, at, note, claimId]);
      recordAudit(ctx, { action: 'claim.reject', entityType: 'claim', entityId: claimId, subjectMemberId: claim.member_id, detail: { verification_status: claim.verification_status } });
      return { claim: viewFor(ctx, load(ctx, claimId)), entry: null, already_applied: false };
    }

    const member = ctx.db.get('SELECT status FROM members WHERE id = ?', [claim.member_id]);
    if (member.status !== 'active') throw conflict('member_not_active', 'That member is archived.');

    // A human approving a not-yet-attested claim is what "manually reviewed" means.
    const becomesReviewed = claim.verification_status === 'unverified';
    if (becomesReviewed) {
      ctx.db.run("UPDATE claims SET verification_status = 'manually_reviewed', verification_source = 'admin_review', verified_at = ? WHERE id = ?", [at, claimId]);
    }
    // Writing the award approves the claim (schema trigger). cap_exceeded (409) or any
    // other refusal rolls the whole transaction back, including the review mark above.
    let entry;
    try {
      entry = awardForClaim(ctx, claim, note ? `Approved: ${claim.task_label} — ${note}` : `Approved: ${claim.task_label}`);
    } catch (error) {
      if (isTriggerAbort(error, 'reviewer who is not linked to the member')) {
        throw forbidden('self_review_forbidden', 'You cannot decide your own submission. Another admin has to.');
      }
      throw error;
    }
    const after = load(ctx, claimId);
    if (after.decision !== 'approved') throw new Error(`claim ${claimId} was awarded but is not approved`);
    recordAudit(ctx, {
      action: 'claim.approve',
      entityType: 'claim',
      entityId: claimId,
      subjectMemberId: claim.member_id,
      detail: { ledger_entry_id: entry.id, points: entry.points, xp: entry.xp, verification_status: after.verification_status },
    });
    return { claim: viewFor(ctx, after), entry, already_applied: false };
  });
}

/** The member (or an admin) takes back a submission that has not been decided yet. */
export function withdrawClaim(ctx, claimId) {
  requireSignedIn(ctx);
  return ctx.db.tx(() => {
    const claim = load(ctx, claimId);
    if (!canSeeEvidence(ctx, claim)) throw forbidden('not_yours', 'You can only withdraw your own submission.');
    if (claim.decision === 'withdrawn') return viewFor(ctx, claim);
    if (claim.decision !== 'pending') throw conflict('claim_not_pending', 'That submission has already been decided.', { decision: claim.decision });
    ctx.db.run("UPDATE claims SET decision = 'withdrawn', decided_by = ?, decided_at = ? WHERE id = ?", [ctx.actor.userId ?? null, nowIso(ctx), claimId]);
    recordAudit(ctx, { action: 'claim.withdraw', entityType: 'claim', entityId: claimId, subjectMemberId: claim.member_id });
    return viewFor(ctx, load(ctx, claimId));
  });
}

/**
 * Takes back an approved claim: reverses its award and marks it revoked, atomically.
 * @returns {{ claim: object, entry: object, replayed: boolean }}
 */
export function revokeClaim(ctx, claimId, { reason } = {}) {
  requireAdmin(ctx);
  return ctx.db.tx(() => {
    const claim = load(ctx, claimId);
    if (claim.decision === 'revoked') {
      const award = getEntry(ctx, claim.award_entry_id);
      return { claim: viewFor(ctx, claim), entry: getEntry(ctx, award.reversed_by_entry_id), replayed: true };
    }
    if (claim.decision !== 'approved') throw conflict('claim_not_approved', 'Only an approved submission can be revoked.', { decision: claim.decision });
    const { entry, replayed } = reverseEntry(ctx, { entryId: claim.award_entry_id, reason });
    return { claim: viewFor(ctx, load(ctx, claimId)), entry, replayed };
  });
}

/** Points sitting in pending claims, per member — what the dashboard shows as "pending". */
export function pendingPointsByMember(ctx) {
  const rows = ctx.db.all("SELECT member_id, COALESCE(SUM(points_snapshot), 0) AS points, COALESCE(SUM(xp_snapshot), 0) AS xp, COUNT(*) AS claims FROM claims WHERE decision = 'pending' GROUP BY member_id");
  return new Map(rows.map((row) => [row.member_id, { points: row.points, xp: row.xp, claims: row.claims }]));
}
