// Competitions: a named time window with its own standings. A competition does not
// change how points are earned — standings are just the ledger, filtered to the window.
// A result bonus, if any, is granted by an admin through ledger.grantBonus() with this
// competition's id (client key `competition:<competition id>:<member id>`, so granting
// twice is a replay, not a second bonus).
//
// Competitions here are about contributions inside the app. They are not tied to
// platform engagement in any way.

import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import * as v from '../lib/validate.js';
import { nowIso, requireAdmin, requireSignedIn } from './context.js';
import { recordAudit } from './audit.js';
import { assertRewardableName, assertRewardableText } from './policy.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const NEXT_STATUS = { draft: ['active'], active: ['closed'], closed: [] };

function isoInstant(value, field) {
  const text = v.string(value, field, { min: 20, max: 30 });
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw unprocessable('invalid_input', `"${field}" must be a date and time.`, { field });
  const iso = date.toISOString();
  if (!ISO.test(iso)) throw unprocessable('invalid_input', `"${field}" must be a date and time.`, { field });
  return iso;
}

const view = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  starts_at: row.starts_at,
  ends_at: row.ends_at,
  status: row.status,
  created_at: row.created_at,
});

function load(ctx, competitionId) {
  const row = ctx.db.get('SELECT * FROM competitions WHERE id = ?', [competitionId]);
  if (!row) throw notFound('competition_not_found', 'That competition does not exist.');
  return row;
}

/** Members see active and closed competitions; drafts are for admins. */
export function listCompetitions(ctx) {
  requireSignedIn(ctx);
  const staff = ctx.actor.role === 'admin' || ctx.actor.role === 'system';
  return ctx.db.all(`SELECT * FROM competitions ${staff ? '' : "WHERE status <> 'draft'"} ORDER BY starts_at DESC, id`).map(view);
}

export function createCompetition(ctx, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['name', 'description', 'starts_at', 'ends_at']);
  const name = v.string(data.name, 'name', { max: 80 });
  const description = data.description === undefined ? '' : v.string(data.description, 'description', { min: 0, max: 500 });
  assertRewardableName('name', name);
  assertRewardableText('description', description);
  const startsAt = isoInstant(data.starts_at, 'starts_at');
  const endsAt = isoInstant(data.ends_at, 'ends_at');
  if (endsAt <= startsAt) throw unprocessable('invalid_input', 'The end must be after the start.', { field: 'ends_at' });
  const id = newId('cmp');
  return ctx.db.tx(() => {
    ctx.db.run('INSERT INTO competitions (id, name, description, starts_at, ends_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      id,
      name,
      description,
      startsAt,
      endsAt,
      ctx.actor.userId ?? null,
      nowIso(ctx),
    ]);
    recordAudit(ctx, { action: 'competition.create', entityType: 'competition', entityId: id });
    return view(load(ctx, id));
  });
}

/** Text and dates can change while it is a draft; status only moves draft -> active -> closed. */
export function updateCompetition(ctx, competitionId, input) {
  requireAdmin(ctx);
  const data = v.only(input, ['name', 'description', 'starts_at', 'ends_at', 'status']);
  const changes = {
    name: v.optional(data.name, (x) => v.string(x, 'name', { max: 80 })),
    description: v.optional(data.description, (x) => v.string(x, 'description', { min: 0, max: 500 })),
    starts_at: v.optional(data.starts_at, (x) => isoInstant(x, 'starts_at')),
    ends_at: v.optional(data.ends_at, (x) => isoInstant(x, 'ends_at')),
    status: v.optional(data.status, (x) => v.oneOf(x, 'status', ['draft', 'active', 'closed'])),
  };
  if (changes.name !== undefined) assertRewardableName('name', changes.name);
  if (changes.description !== undefined) assertRewardableText('description', changes.description);
  return ctx.db.tx(() => {
    const before = load(ctx, competitionId);
    const changed = Object.keys(changes).filter((key) => changes[key] !== undefined && changes[key] !== before[key]);
    if (changed.includes('status') && !NEXT_STATUS[before.status].includes(changes.status)) {
      throw conflict('invalid_status_change', `A ${before.status} competition cannot become ${changes.status}.`);
    }
    if (before.status !== 'draft' && changed.some((key) => key === 'starts_at' || key === 'ends_at')) {
      throw conflict('competition_started', 'Dates can only be changed while the competition is a draft.');
    }
    const after = { ...before, ...Object.fromEntries(changed.map((key) => [key, changes[key]])) };
    if (after.ends_at <= after.starts_at) throw unprocessable('invalid_input', 'The end must be after the start.', { field: 'ends_at' });
    if (changed.length > 0) {
      ctx.db.run(`UPDATE competitions SET ${changed.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [...changed.map((key) => changes[key]), competitionId]);
      recordAudit(ctx, { action: 'competition.update', entityType: 'competition', entityId: competitionId, detail: { fields: changed, ...(changed.includes('status') ? { status: changes.status } : {}) } });
    }
    return view(load(ctx, competitionId));
  });
}

/**
 * Standings for the window: points and XP from approved submissions (task awards that
 * have not been reversed) written inside [starts_at, ends_at). Active members only.
 * Ties share a place (1, 1, 3).
 */
export function competitionStandings(ctx, competitionId) {
  requireSignedIn(ctx);
  const competition = load(ctx, competitionId);
  const staff = ctx.actor.role === 'admin' || ctx.actor.role === 'system';
  if (competition.status === 'draft' && !staff) throw notFound('competition_not_found', 'That competition does not exist.');
  const rows = ctx.db.all(
    `SELECT m.id AS member_id, m.display_name, m.avatar_key,
            COALESCE(SUM(e.points), 0) AS points, COALESCE(SUM(e.xp), 0) AS xp, COUNT(e.id) AS approved_submissions
       FROM members m
       LEFT JOIN ledger_entries e ON e.member_id = m.id AND e.kind = 'task_award'
            AND e.created_at >= ? AND e.created_at < ?
            AND NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.reverses_entry_id = e.id)
      WHERE m.status = 'active'
      GROUP BY m.id
      ORDER BY points DESC, xp DESC, m.sort_order, m.display_name COLLATE NOCASE, m.id`,
    [competition.starts_at, competition.ends_at],
  );
  let place = 0;
  const standings = rows.map((row, index) => {
    const previous = rows[index - 1];
    if (!previous || previous.points !== row.points || previous.xp !== row.xp) place = index + 1;
    return { place, member_id: row.member_id, display_name: row.display_name, avatar_key: row.avatar_key, points: row.points, xp: row.xp, approved_submissions: row.approved_submissions };
  });
  return { competition: view(competition), standings };
}
