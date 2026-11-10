// Tracked videos, and their INFORMATIONAL aggregate statistics.
//
// Statistics (views / likes / comments) are for display only. They are never an input
// to points, XP, tiers or rank, and they are dropped once older than the configured
// maximum age (platform storage rules; see docs/PLATFORM_CAPABILITIES.md §2).

import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import * as v from '../lib/validate.js';
import { isUniqueViolation } from '../db/sqlite.js';
import { nowIso, requireAdmin, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';
import { getSetting } from './settings.js';

// At least 6 characters, matching the schema (a shorter id could match inside an unrelated link).
const PLATFORM_VIDEO_ID = /^[A-Za-z0-9_-]{6,64}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Works out platform, video id and kind from a pasted link.
 * Accepts youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, and tiktok.com/@user/video/<digits>.
 * @returns {{ platform: 'youtube'|'tiktok', platformVideoId: string, kind: 'video'|'short', url: string }}
 */
export function parseVideoUrl(value) {
  const url = v.httpsUrl(value, 'url', { hosts: ['youtube.com', 'youtu.be', 'tiktok.com'] });
  const host = url.hostname.replace(/^(www|m)\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  const bad = () => unprocessable('unrecognised_video_link', 'That does not look like a YouTube or TikTok video link.', { field: 'url' });

  if (host === 'youtu.be') {
    if (!YOUTUBE_ID.test(segments[0] ?? '')) throw bad();
    return { platform: 'youtube', platformVideoId: segments[0], kind: 'video', url: `https://www.youtube.com/watch?v=${segments[0]}` };
  }
  if (host === 'youtube.com') {
    if (segments[0] === 'shorts' && YOUTUBE_ID.test(segments[1] ?? '')) {
      return { platform: 'youtube', platformVideoId: segments[1], kind: 'short', url: `https://www.youtube.com/shorts/${segments[1]}` };
    }
    const id = url.searchParams.get('v') ?? '';
    if (segments[0] === 'watch' && YOUTUBE_ID.test(id)) {
      return { platform: 'youtube', platformVideoId: id, kind: 'video', url: `https://www.youtube.com/watch?v=${id}` };
    }
    throw bad();
  }
  if (host === 'tiktok.com') {
    const index = segments.indexOf('video');
    const id = index >= 0 ? (segments[index + 1] ?? '') : '';
    if (!/^\d{6,32}$/.test(id) || !/^@[\w.-]{1,40}$/.test(segments[0] ?? '')) throw bad();
    return { platform: 'tiktok', platformVideoId: id, kind: 'short', url: `https://www.tiktok.com/${segments[0]}/video/${id}` };
  }
  throw bad();
}

function view(row) {
  const stats = row.stats_json ? JSON.parse(row.stats_json) : null;
  return {
    id: row.id,
    platform: row.platform,
    platform_video_id: row.platform_video_id,
    kind: row.kind,
    url: row.url,
    title: row.title,
    owner_member_id: row.owner_member_id,
    status: row.status,
    // Informational only. `simulated` is true for sample data from a mock adapter.
    stats: stats ? { ...stats, source: row.stats_source, fetched_at: row.stats_fetched_at, simulated: row.stats_source === 'mock_adapter' } : null,
    created_at: row.created_at,
  };
}

function load(ctx, videoId) {
  const row = ctx.db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
  if (!row) throw notFound('video_not_found', 'That video is not on the list.');
  return row;
}

export function requireVideoRow(ctx, videoId) {
  return load(ctx, videoId);
}

export function listVideos(ctx, { includeArchived = false } = {}) {
  requireSignedIn(ctx);
  return ctx.db.all(`SELECT * FROM videos ${includeArchived ? '' : "WHERE status = 'active'"} ORDER BY created_at DESC, id`).map(view);
}

export function getVideo(ctx, videoId) {
  requireSignedIn(ctx);
  return view(load(ctx, videoId));
}

/**
 * Adds a video. Give either a pasted `url`, or (sample data only) an explicit
 * `platform` + `platform_video_id` + `kind`.
 */
export function createVideo(ctx, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['url', 'platform', 'platform_video_id', 'kind', 'title', 'owner_member_id']);
  const title = v.string(data.title, 'title', { max: 200 });
  const ownerMemberId = data.owner_member_id === undefined || data.owner_member_id === null ? null : v.string(data.owner_member_id, 'owner_member_id', { max: 64 });

  let parsed;
  if (data.platform_video_id !== undefined) {
    const platform = v.oneOf(data.platform, 'platform', ['youtube', 'tiktok']);
    const platformVideoId = v.string(data.platform_video_id, 'platform_video_id', { max: 64, pattern: PLATFORM_VIDEO_ID });
    const kind = v.oneOf(data.kind ?? 'video', 'kind', ['video', 'short']);
    const url = platform === 'youtube' ? `https://www.youtube.com/watch?v=${platformVideoId}` : `https://www.tiktok.com/video/${platformVideoId}`;
    parsed = { platform, platformVideoId, kind, url };
  } else {
    parsed = parseVideoUrl(data.url);
    if (data.kind !== undefined) parsed.kind = v.oneOf(data.kind, 'kind', ['video', 'short']);
  }

  const id = newId('vid');
  return ctx.db.tx(() => {
    if (ownerMemberId && !ctx.db.get('SELECT 1 AS ok FROM members WHERE id = ?', [ownerMemberId])) {
      throw notFound('member_not_found', 'That member does not exist.');
    }
    try {
      ctx.db.run(
        'INSERT INTO videos (id, platform, platform_video_id, kind, url, title, owner_member_id, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, parsed.platform, parsed.platformVideoId, parsed.kind, parsed.url, title, ownerMemberId, ctx.actor.userId ?? null, nowIso(ctx)],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'videos.platform')) throw conflict('video_exists', 'That video is already on the list.');
      throw error;
    }
    recordAudit(ctx, { action: 'video.create', entityType: 'video', entityId: id, subjectMemberId: ownerMemberId, detail: { platform: parsed.platform, kind: parsed.kind } });
    return view(load(ctx, id));
  });
}

export function updateVideo(ctx, videoId, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['title', 'kind', 'status', 'owner_member_id']);
  const changes = {
    title: v.optional(data.title, (x) => v.string(x, 'title', { max: 200 })),
    kind: v.optional(data.kind, (x) => v.oneOf(x, 'kind', ['video', 'short'])),
    status: v.optional(data.status, (x) => v.oneOf(x, 'status', ['active', 'archived'])),
    owner_member_id: v.nullable(data.owner_member_id, (x) => v.string(x, 'owner_member_id', { max: 64 })),
  };
  const fields = Object.keys(changes).filter((key) => changes[key] !== undefined);
  return ctx.db.tx(() => {
    const before = load(ctx, videoId);
    const changed = fields.filter((key) => before[key] !== changes[key]);
    if (changed.includes('owner_member_id') && changes.owner_member_id !== null && !ctx.db.get('SELECT 1 AS ok FROM members WHERE id = ?', [changes.owner_member_id])) {
      throw notFound('member_not_found', 'That member does not exist.');
    }
    if (changed.length > 0) {
      ctx.db.run(`UPDATE videos SET ${changed.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [...changed.map((key) => changes[key]), videoId]);
      recordAudit(ctx, { action: 'video.update', entityType: 'video', entityId: videoId, detail: { fields: changed } });
    }
    return view(load(ctx, videoId));
  });
}

/**
 * Asks the platform adapter for fresh aggregate statistics and stores them.
 * On failure nothing stored is changed and the adapter's error is returned as-is, so the
 * caller can show exactly what went wrong (quota, not found, not connected, ...).
 * @param {{ fetchVideoStats(id: string): Promise<object> }} adapter
 * @returns {Promise<{ video: object, result: object }>}
 */
export async function refreshVideoStats(ctx, videoId, adapter) {
  requireAdmin(ctx);
  const row = load(ctx, videoId);
  // The network call happens OUTSIDE any transaction.
  const result = await adapter.fetchVideoStats(row.platform_video_id);
  if (result.ok) {
    ctx.db.run('UPDATE videos SET stats_json = ?, stats_source = ?, stats_fetched_at = ? WHERE id = ?', [
      JSON.stringify(result.stats),
      result.source,
      result.fetched_at,
      videoId,
    ]);
  }
  return { video: view(load(ctx, videoId)), result };
}

/**
 * Drops stored statistics older than `platform_stats_max_age_days`. Safe to call often.
 * @returns {number} how many videos had their statistics cleared
 */
export function purgeStaleStats(ctx) {
  const maxAgeDays = getSetting(ctx, 'platform_stats_max_age_days');
  const cutoff = new Date(ctx.clock.now().getTime() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  return ctx.db.run(
    'UPDATE videos SET stats_json = NULL, stats_source = NULL, stats_fetched_at = NULL WHERE stats_fetched_at IS NOT NULL AND stats_fetched_at < ?',
    [cutoff],
  ).changes;
}
