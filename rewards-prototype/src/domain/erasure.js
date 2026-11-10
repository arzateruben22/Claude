// Export and erasure of a person's data.
//
// Erasure is a real delete, in one transaction, and is the ONLY code path that removes
// ledger rows (the schema's erasure_guard allows it for exactly one member at a time).
// What goes:
//   * the member's ledger entries, claims (with their evidence), sign-in account, sessions
//   * the member row itself (name, slug, avatar key, linked channel id)
//   * videos the member owned; if another member's claim still points at one, that video
//     is kept as an anonymous, archived placeholder, the other claim's evidence — which
//     was written ABOUT the erased member's video — is blanked, and its subject no longer
//     carries the real platform video id
//   * the `detail` of every audit row about the member
// What stays: opaque random ids in the audit trail and in other members' rows. Ids are
// never derived from a name or an e-mail address, so they identify nobody once the rows
// above are gone.
//
// After the transaction commits, the caller must also (see src/db/tombstones.js):
//   * append the member id to the tombstone file, so a restored backup is re-erased at boot
//   * delete the member's avatar file, once real photos exist

import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { isTriggerAbort } from '../db/sqlite.js';
import { SYSTEM_ACTOR, nowIso, requireAdmin, requireSelfOrAdmin, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';

export const ERASE_CONFIRMATION = 'ERASE';

const parseJson = (text) => (text ? JSON.parse(text) : null);

/**
 * Everything stored about a member, as plain data. The member themselves or an admin;
 * an admin exporting someone else's data is audit-logged.
 */
export function exportMemberData(ctx, memberId) {
  requireSelfOrAdmin(ctx, memberId);
  const member = ctx.db.get('SELECT * FROM members WHERE id = ?', [memberId]);
  if (!member) throw notFound('member_not_found', 'That member does not exist.');
  const own = ctx.actor.memberId === memberId;
  const data = {
    exported_at: nowIso(ctx),
    notice: 'Points are virtual. They have no cash value and cannot be redeemed.',
    member: {
      id: member.id,
      slug: member.slug,
      display_name: member.display_name,
      avatar_key: member.avatar_key,
      status: member.status,
      youtube_channel_id: member.youtube_channel_id,
      youtube_linked_at: member.youtube_linked_at,
      created_at: member.created_at,
    },
    // No Google account id, no session data and nobody else's e-mail address.
    account: ctx.db.get('SELECT id, email, role, status, created_at, last_login_at FROM users WHERE member_id = ?', [memberId]) ?? null,
    claims: ctx.db
      .all(
        `SELECT id, task_type_id, video_id, evidence_text, evidence_url, verification_status, verification_source, verification_detail,
                verified_at, decision, decided_at, decision_note, points_snapshot, xp_snapshot, created_at
           FROM claims WHERE member_id = ? ORDER BY created_at, id`,
        [memberId],
      )
      .map((row) => ({ ...row, verification_detail: parseJson(row.verification_detail) })),
    ledger_entries: ctx.db.all(
      'SELECT id, kind, bucket, points, xp, claim_id, reverses_entry_id, competition_id, reason, period, created_at FROM ledger_entries WHERE member_id = ? ORDER BY id',
      [memberId],
    ),
    videos: ctx.db.all('SELECT id, platform, platform_video_id, kind, url, title, status, created_at FROM videos WHERE owner_member_id = ? ORDER BY created_at, id', [memberId]),
    audit_trail: ctx.db
      .all('SELECT id, at, actor_role, action, entity_type, entity_id, detail FROM audit_log WHERE subject_member_id = ? ORDER BY id', [memberId])
      .map((row) => ({ ...row, detail: parseJson(row.detail) })),
  };
  if (!own && ctx.actor.role === 'admin') {
    recordAudit(ctx, { action: 'member.export', entityType: 'member', entityId: memberId, subjectMemberId: memberId });
  }
  return data;
}

/** For an account that is not attached to a member (an admin-only login): just the account row. */
export function exportOwnAccount(ctx) {
  requireSignedIn(ctx);
  if (!ctx.actor.userId) throw unprocessable('no_account', 'There is no account to export.');
  return {
    exported_at: nowIso(ctx),
    account: ctx.db.get('SELECT id, email, role, status, created_at, last_login_at FROM users WHERE id = ?', [ctx.actor.userId]) ?? null,
  };
}

function translateLastAdmin(error) {
  if (isTriggerAbort(error, 'at least one active')) {
    return conflict('last_admin', 'This is the only admin who can sign in. Add another admin before erasing this one.');
  }
  return error;
}

/**
 * Erases a member and everything attached to them. The member themselves or an admin.
 * @param {{ confirm: string }} input  must be the literal ERASE_CONFIRMATION
 * @returns {{ erased: true, member_id: string, counts: Record<string, number> }}
 */
export function eraseMember(ctx, memberId, { confirm } = {}) {
  requireSelfOrAdmin(ctx, memberId);
  if (confirm !== ERASE_CONFIRMATION) {
    throw unprocessable('confirmation_required', `Type ${ERASE_CONFIRMATION} to confirm. This cannot be undone.`, { field: 'confirm' });
  }
  const selfErasure = ctx.actor.memberId === memberId;
  try {
    return ctx.db.tx(() => {
      if (!ctx.db.get('SELECT 1 AS ok FROM members WHERE id = ?', [memberId])) throw notFound('member_not_found', 'That member does not exist.');
      const counts = {};
      ctx.db.run('UPDATE erasure_guard SET member_id = ? WHERE id = 1', [memberId]);

      // Other members' claims about this member's videos are content about this member:
      // blank what was written, and detach the subject from the real platform video id
      // (which would otherwise identify the erased member's video for ever).
      counts.other_claims_blanked = 0;
      for (const video of ctx.db.all('SELECT id, platform, platform_video_id FROM videos WHERE owner_member_id = ?', [memberId])) {
        counts.other_claims_blanked += ctx.db.run(
          `UPDATE claims SET evidence_text = NULL, evidence_url = NULL, evidence_hash = NULL, subject_key = ?
            WHERE member_id <> ? AND subject_key = ?`,
          [`video:erased:${video.id}`, memberId, `video:${video.platform}:${video.platform_video_id}`],
        ).changes;
      }

      counts.ledger_entries = ctx.db.run('DELETE FROM ledger_entries WHERE member_id = ?', [memberId]).changes;
      counts.claims = ctx.db.run('DELETE FROM claims WHERE member_id = ?', [memberId]).changes;

      counts.videos_deleted = ctx.db.run(
        'DELETE FROM videos WHERE owner_member_id = ? AND id NOT IN (SELECT video_id FROM claims WHERE video_id IS NOT NULL)',
        [memberId],
      ).changes;
      counts.videos_anonymised = ctx.db.run(
        `UPDATE videos SET url = 'about:blank', title = '[removed]', platform_video_id = 'erased-' || id, stats_json = NULL,
                stats_source = NULL, stats_fetched_at = NULL, status = 'archived', owner_member_id = NULL
          WHERE owner_member_id = ?`,
        [memberId],
      ).changes;

      counts.audit_rows_scrubbed = ctx.db.run('UPDATE audit_log SET detail = NULL WHERE subject_member_id = ? AND detail IS NOT NULL', [memberId]).changes;

      // The sign-in account goes too — unless it is the only admin who can sign in. Then
      // the member data is still erased and the account stays, detached from the member
      // (it is signed out everywhere), so the dashboard is never left without an admin.
      const account = ctx.db.get('SELECT id, role, status, last_login_at FROM users WHERE member_id = ?', [memberId]);
      counts.accounts = 0;
      counts.accounts_kept_as_last_admin = 0;
      if (account) {
        const workingAdmin = account.role === 'admin' && account.status === 'active' && account.last_login_at !== null;
        const others = ctx.db.get("SELECT COUNT(*) AS n FROM users WHERE id <> ? AND role = 'admin' AND status = 'active' AND last_login_at IS NOT NULL", [account.id]).n;
        if (workingAdmin && others === 0) {
          ctx.db.run('UPDATE users SET member_id = NULL WHERE id = ?', [account.id]);
          counts.accounts_kept_as_last_admin = 1;
        } else {
          counts.accounts = ctx.db.run('DELETE FROM users WHERE id = ?', [account.id]).changes; // sessions cascade
        }
      }
      ctx.db.run('DELETE FROM members WHERE id = ?', [memberId]);
      ctx.db.run('UPDATE erasure_guard SET member_id = NULL WHERE id = 1');

      // Written last so its own detail (counts only) is not scrubbed. A self-erasure is
      // recorded without the id of the account that has just been deleted.
      recordAudit(selfErasure ? { ...ctx, actor: SYSTEM_ACTOR } : ctx, {
        action: 'member.erase',
        entityType: 'member',
        entityId: memberId,
        subjectMemberId: memberId,
        detail: { self_erasure: selfErasure, ...counts },
      });
      return { erased: true, member_id: memberId, counts };
    });
  } catch (error) {
    throw translateLastAdmin(error);
  }
}

/**
 * Deletes the caller's own sign-in account when it is not attached to a member (an
 * admin-only login). A member account is erased with eraseMember() instead.
 */
export function eraseOwnAccount(ctx, { confirm } = {}) {
  requireSignedIn(ctx);
  if (!ctx.actor.userId) throw unprocessable('no_account', 'There is no account to erase.');
  if (ctx.actor.memberId) throw unprocessable('use_member_erasure', 'This account belongs to a member; erase the member instead.');
  if (confirm !== ERASE_CONFIRMATION) {
    throw unprocessable('confirmation_required', `Type ${ERASE_CONFIRMATION} to confirm. This cannot be undone.`, { field: 'confirm' });
  }
  try {
    return ctx.db.tx(() => {
      const removed = ctx.db.run('DELETE FROM users WHERE id = ?', [ctx.actor.userId]).changes; // sessions cascade
      recordAudit({ ...ctx, actor: SYSTEM_ACTOR }, { action: 'user.erase_self', entityType: 'user', entityId: ctx.actor.userId });
      return { erased: removed === 1 };
    });
  } catch (error) {
    throw translateLastAdmin(error);
  }
}

/**
 * Boot-time: erase again any member id in the tombstone list that is present in the
 * database (which happens when an older backup has been restored).
 * @param {string[]} memberIds
 * @returns {string[]} the ids that had to be erased again
 */
export function replayErasures(ctx, memberIds) {
  requireAdmin(ctx); // the system actor at boot
  const again = [];
  for (const memberId of memberIds) {
    if (!ctx.db.get('SELECT 1 AS ok FROM members WHERE id = ?', [memberId])) continue;
    eraseMember(ctx, memberId, { confirm: ERASE_CONFIRMATION });
    again.push(memberId);
  }
  return again;
}
