// The read model for the single screen: one payload with everything the dashboard shows.
//
// What members may see about each other is decided HERE and nowhere else:
//   * totals (earned, bonus, pending, XP), tier and rank
//   * a public activity item is exactly { type, label, video_title, points, xp, at } for
//     an approved submission or a bonus that has not been reversed
// Reasons, notes, evidence, rejected / withdrawn / pending submissions and deductions are
// visible only to the member they belong to and to admins (see claims.js and ledger.js).
//
// Points, XP, tiers and rank come ONLY from the ledger. Platform statistics are carried
// separately under `videos[].stats` and are never an input to any of them.

import { notFound } from '../lib/errors.js';
import { nowIso, requireSignedIn } from './context.js';
import { allBalances } from './ledger.js';
import { capStatus, currentPeriod } from './caps.js';
import { pendingPointsByMember, submissionAllowance } from './claims.js';
import { getSettings } from './settings.js';
import { listTiers, tierForXp } from './tiers.js';
import { listTaskTypes } from './taskTypes.js';
import { listVideos, purgeStaleStats } from './videos.js';
import { POINTS_DISCLAIMER } from './policy.js';

const PUBLIC_ACTIVITY = `
  SELECT e.id, e.member_id, e.kind, e.points, e.xp, e.created_at,
         t.label AS task_label, vd.title AS video_title, cp.name AS competition_name
    FROM ledger_entries e
    LEFT JOIN claims c ON c.id = e.claim_id
    LEFT JOIN task_types t ON t.id = c.task_type_id
    LEFT JOIN videos vd ON vd.id = c.video_id AND vd.status = 'active'
    LEFT JOIN competitions cp ON cp.id = e.competition_id
   WHERE e.kind IN ('task_award', 'bonus')
     AND NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.reverses_entry_id = e.id)`;

const publicItem = (row) => ({
  id: row.id,
  type: row.kind === 'task_award' ? 'task' : 'bonus',
  label: row.kind === 'task_award' ? row.task_label : row.competition_name ? `Bonus: ${row.competition_name}` : 'Bonus',
  video_title: row.video_title ?? null,
  points: row.points,
  xp: row.xp,
  at: row.created_at,
});

/**
 * Places for a list of { points, xp } rows under the configured ordering.
 * Ties on both numbers share a place, and the next place skips (1, 1, 3).
 * @param {{ id: string, total: number, xp: number, sort_order: number, display_name: string }[]} rows
 * @param {'points'|'xp'} rankBy
 */
export function rankMembers(rows, rankBy) {
  const [first, second] = rankBy === 'xp' ? ['xp', 'total'] : ['total', 'xp'];
  const sorted = [...rows].sort(
    (a, b) => b[first] - a[first] || b[second] - a[second] || a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id),
  );
  let place = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    if (!previous || previous[first] !== row[first] || previous[second] !== row[second]) place = index + 1;
    return { ...row, rank: place };
  });
}

/**
 * Everything the dashboard needs, in one read.
 * @param {{ registry: { mode: string, simulated: boolean, capabilities(): object }, authMode: string }} environment
 */
export function dashboard(ctx, { registry, authMode }) {
  requireSignedIn(ctx);
  purgeStaleStats(ctx);
  const settings = getSettings(ctx);
  const tiers = listTiers(ctx).map(({ level, name, min_xp, art_key }) => ({ level, name, min_xp, art_key }));
  const balances = allBalances(ctx);
  const pending = pendingPointsByMember(ctx);
  const period = currentPeriod(ctx);
  const staff = ctx.actor.role === 'admin' || ctx.actor.role === 'system';

  const rows = ctx.db.all("SELECT * FROM members WHERE status = 'active'").map((member) => {
    const balance = balances.get(member.id) ?? { earned: 0, bonus: 0, total: 0, xp: 0 };
    return { ...member, total: balance.total, xp: balance.xp, balance };
  });
  const ranked = rankMembers(rows, settings.leaderboard_rank_by);

  const recentByMember = new Map();
  for (const member of ranked) {
    recentByMember.set(member.id, ctx.db.all(`${PUBLIC_ACTIVITY} AND e.member_id = ? ORDER BY e.id DESC LIMIT 5`, [member.id]).map(publicItem));
  }

  const members = ranked.map((member) => {
    const own = ctx.actor.memberId === member.id;
    const waiting = pending.get(member.id) ?? { points: 0, xp: 0, claims: 0 };
    return {
      id: member.id,
      slug: member.slug,
      display_name: member.display_name,
      avatar_key: member.avatar_key,
      is_you: own,
      rank: member.rank,
      points: { earned: member.balance.earned, bonus: member.balance.bonus, pending: waiting.points, total: member.balance.total },
      xp: member.xp,
      tier: tierForXp(tiers, member.xp),
      youtube_linked: member.youtube_channel_id !== null,
      recent_activity: recentByMember.get(member.id),
      // Cap usage and the pending count are the member's own business (and the admin's).
      ...(own || staff ? { pending_submissions: waiting.claims, cap: capStatus(ctx, member.id, period).member } : {}),
    };
  });

  return {
    generated_at: nowIso(ctx),
    viewer: {
      user_id: ctx.actor.userId ?? null,
      role: ctx.actor.role,
      member_id: ctx.actor.memberId ?? null,
      ...(ctx.actor.memberId ? { submissions_today: submissionAllowance(ctx, ctx.actor.memberId) } : {}),
    },
    // `demo_mode` true means platform checks and statistics are simulated sample data.
    // `auth_mode` "dev" means sign-in itself is simulated. The UI must say so on screen.
    demo_mode: registry.simulated,
    auth_mode: authMode,
    platform_mode: registry.mode,
    disclaimer: POINTS_DISCLAIMER,
    period: {
      month: period,
      time_zone: settings.time_zone,
      rank_by: settings.leaderboard_rank_by,
      budget: capStatus(ctx, null, period).budget,
      cap_per_member: settings.monthly_cap_per_member,
    },
    tiers,
    members,
    leaderboard: members.map((member) => ({ rank: member.rank, member_id: member.id, display_name: member.display_name, avatar_key: member.avatar_key, points: member.points.total, xp: member.xp, tier_level: member.tier?.level ?? null })),
    task_types: listTaskTypes(ctx),
    videos: listVideos(ctx),
    platforms: registry.capabilities(),
  };
}

/**
 * A member's public activity, newest first, keyset-paginated — what anyone signed in
 * may see when they expand that member on the dashboard.
 * @param {{ limit?: number, beforeId?: number }} [page]
 */
export function memberActivity(ctx, memberId, { limit = 20, beforeId } = {}) {
  requireSignedIn(ctx);
  if (!ctx.db.get("SELECT 1 AS ok FROM members WHERE id = ? AND status = 'active'", [memberId])) {
    throw notFound('member_not_found', 'That member does not exist.');
  }
  const size = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const params = [memberId];
  let cursor = '';
  if (beforeId !== undefined && beforeId !== null) {
    cursor = 'AND e.id < ?';
    params.push(Number(beforeId));
  }
  const rows = ctx.db.all(`${PUBLIC_ACTIVITY} AND e.member_id = ? ${cursor} ORDER BY e.id DESC LIMIT ?`, [...params, size + 1]);
  const items = rows.slice(0, size).map(publicItem);
  return { items, nextBeforeId: rows.length > size ? items[items.length - 1].id : null };
}
