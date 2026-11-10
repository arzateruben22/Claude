// Members: the people shown on the dashboard.

import { conflict, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import * as v from '../lib/validate.js';
import { isUniqueViolation } from '../db/sqlite.js';
import { nowIso, requireAdmin, requireSelfOrAdmin, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const AVATAR_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{4,40}$/;

const slugify = (name) =>
  name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'member';

/** What other signed-in people may see about a member. The channel id itself is not included. */
function publicView(row) {
  return {
    id: row.id,
    slug: row.slug,
    display_name: row.display_name,
    avatar_key: row.avatar_key,
    sort_order: row.sort_order,
    status: row.status,
    youtube_linked: row.youtube_channel_id !== null,
    created_at: row.created_at,
  };
}

const privateView = (row) => ({ ...publicView(row), youtube_channel_id: row.youtube_channel_id, youtube_linked_at: row.youtube_linked_at });

function load(ctx, memberId) {
  const row = ctx.db.get('SELECT * FROM members WHERE id = ?', [memberId]);
  if (!row) throw notFound('member_not_found', 'That member does not exist.');
  return row;
}

export function listMembers(ctx, { includeArchived = false } = {}) {
  requireSignedIn(ctx);
  const rows = ctx.db.all(
    `SELECT * FROM members ${includeArchived ? '' : "WHERE status = 'active'"} ORDER BY sort_order, display_name COLLATE NOCASE, id`,
  );
  return rows.map(publicView);
}

/** A member as seen by the caller: the member themselves and admins also get the linked channel id. */
export function getMember(ctx, memberId) {
  requireSignedIn(ctx);
  const row = load(ctx, memberId);
  const own = ctx.actor.memberId === memberId;
  return own || ctx.actor.role !== 'member' ? privateView(row) : publicView(row);
}

/** Raw row for other domain modules (no authorization: callers have already decided). */
export function requireMemberRow(ctx, memberId) {
  return load(ctx, memberId);
}

export function createMember(ctx, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['display_name', 'slug', 'avatar_key', 'sort_order']);
  const displayName = v.string(data.display_name, 'display_name', { max: 40 });
  const slug = data.slug === undefined ? slugify(displayName) : v.string(data.slug, 'slug', { max: 40, pattern: SLUG });
  const avatarKey = data.avatar_key === undefined ? 'placeholder' : v.string(data.avatar_key, 'avatar_key', { max: 40, pattern: AVATAR_KEY });
  const sortOrder = data.sort_order === undefined ? 0 : v.integer(data.sort_order, 'sort_order', { min: 0, max: 9999 });
  const id = newId('mbr');
  return ctx.db.tx(() => {
    try {
      ctx.db.run('INSERT INTO members (id, slug, display_name, avatar_key, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        id,
        slug,
        displayName,
        avatarKey,
        sortOrder,
        nowIso(ctx),
      ]);
    } catch (error) {
      if (isUniqueViolation(error, 'members.slug')) throw conflict('slug_taken', 'Another member already uses that short name.');
      throw error;
    }
    recordAudit(ctx, { action: 'member.create', entityType: 'member', entityId: id, subjectMemberId: id });
    return privateView(load(ctx, id));
  });
}

export function updateMember(ctx, memberId, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['display_name', 'avatar_key', 'sort_order', 'status']);
  const changes = {
    display_name: v.optional(data.display_name, (x) => v.string(x, 'display_name', { max: 40 })),
    avatar_key: v.optional(data.avatar_key, (x) => v.string(x, 'avatar_key', { max: 40, pattern: AVATAR_KEY })),
    sort_order: v.optional(data.sort_order, (x) => v.integer(x, 'sort_order', { min: 0, max: 9999 })),
    status: v.optional(data.status, (x) => v.oneOf(x, 'status', ['active', 'archived'])),
  };
  const fields = Object.keys(changes).filter((key) => changes[key] !== undefined);
  return ctx.db.tx(() => {
    const before = load(ctx, memberId);
    const changed = fields.filter((key) => before[key] !== changes[key]);
    if (changed.length > 0) {
      ctx.db.run(`UPDATE members SET ${changed.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [...changed.map((key) => changes[key]), memberId]);
      recordAudit(ctx, {
        action: 'member.update',
        entityType: 'member',
        entityId: memberId,
        subjectMemberId: memberId,
        detail: { fields: changed, ...(changed.includes('status') ? { status: changes.status } : {}) },
      });
    }
    return privateView(load(ctx, memberId));
  });
}

/**
 * Records a member's YouTube channel id.
 *
 * TRUSTED CALLERS ONLY: the id must come from the platform after the member's own
 * consent (the OAuth "my channel" lookup), or from the demo seed. No HTTP route may pass
 * a channel id taken from a request body to this function.
 * @param {{ memberId: string, channelId: string, attestedBy: 'oauth'|'demo_seed' }} input
 */
export function linkYoutubeChannel(ctx, { memberId, channelId, attestedBy }) {
  requireSelfOrAdmin(ctx, memberId);
  if (attestedBy !== 'oauth' && attestedBy !== 'demo_seed') throw new TypeError('linkYoutubeChannel: attestedBy must be "oauth" or "demo_seed"');
  if (typeof channelId !== 'string' || !YOUTUBE_CHANNEL_ID.test(channelId)) throw new TypeError('linkYoutubeChannel: not a channel id');
  return ctx.db.tx(() => {
    load(ctx, memberId);
    ctx.db.run('UPDATE members SET youtube_channel_id = ?, youtube_linked_at = ? WHERE id = ?', [channelId, nowIso(ctx), memberId]);
    recordAudit(ctx, { action: 'member.link_youtube', entityType: 'member', entityId: memberId, subjectMemberId: memberId, detail: { attested_by: attestedBy } });
    return privateView(load(ctx, memberId));
  });
}

/** Removes the stored channel id immediately. The member themselves or an admin. */
export function unlinkYoutubeChannel(ctx, memberId) {
  requireSelfOrAdmin(ctx, memberId);
  return ctx.db.tx(() => {
    const before = load(ctx, memberId);
    if (before.youtube_channel_id !== null) {
      ctx.db.run('UPDATE members SET youtube_channel_id = NULL, youtube_linked_at = NULL WHERE id = ?', [memberId]);
      recordAudit(ctx, { action: 'member.unlink_youtube', entityType: 'member', entityId: memberId, subjectMemberId: memberId });
    }
    return privateView(load(ctx, memberId));
  });
}
