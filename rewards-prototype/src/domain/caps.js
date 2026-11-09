// Monthly cap (per member) and monthly budget (all members together).
//
// What counts: positive points from `task_award` and `bonus` entries whose `period` is the
// month in question, EXCLUDING entries that have since been reversed. Manual
// `adjustment` entries do not count: they are explicit, audited corrections.
//
// An entry's period is fixed when it is written, so changing the time-zone setting later
// never moves old entries between months.

import { conflict } from '../lib/errors.js';
import { periodOf } from '../lib/clock.js';
import { getSetting } from './settings.js';

export function currentPeriod(ctx) {
  return periodOf(ctx.clock.now(), getSetting(ctx, 'time_zone'));
}

const CAPPED_SUM = `
  SELECT COALESCE(SUM(e.points), 0) AS used
    FROM ledger_entries e
   WHERE e.period = ?
     AND e.kind IN ('task_award', 'bonus')
     AND e.points > 0
     AND NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.reverses_entry_id = e.id)`;

/** Points already counted against the caps in a period. */
export function periodUsage(ctx, period, memberId) {
  const total = Number(ctx.db.get(CAPPED_SUM, [period]).used);
  const member = memberId ? Number(ctx.db.get(`${CAPPED_SUM} AND e.member_id = ?`, [period, memberId]).used) : null;
  return { period, total, member };
}

/** Cap figures for display: limits, usage and what is left, for one member (optional) and overall. */
export function capStatus(ctx, memberId, period = currentPeriod(ctx)) {
  const perMember = getSetting(ctx, 'monthly_cap_per_member');
  const budget = getSetting(ctx, 'monthly_budget_total');
  const usage = periodUsage(ctx, period, memberId);
  return {
    period,
    budget: { limit: budget, used: usage.total, remaining: Math.max(0, budget - usage.total) },
    member: memberId
      ? { member_id: memberId, limit: perMember, used: usage.member, remaining: Math.max(0, perMember - usage.member) }
      : null,
  };
}

/**
 * Throws 409 cap_exceeded when adding `points` for `memberId` in `period` would pass the
 * member's monthly cap or the overall monthly budget. Call inside the same transaction
 * that writes the entry.
 */
export function assertWithinCaps(ctx, { memberId, points, period }) {
  if (points <= 0) return;
  const status = capStatus(ctx, memberId, period);
  if (points > status.member.remaining) {
    throw conflict('cap_exceeded', "This would pass the member's monthly point cap. Nothing was changed.", {
      scope: 'member',
      period,
      limit: status.member.limit,
      used: status.member.used,
      remaining: status.member.remaining,
      requested: points,
    });
  }
  if (points > status.budget.remaining) {
    throw conflict('cap_exceeded', 'This would pass the monthly point budget. Nothing was changed.', {
      scope: 'budget',
      period,
      limit: status.budget.limit,
      used: status.budget.used,
      remaining: status.budget.remaining,
      requested: points,
    });
  }
}
