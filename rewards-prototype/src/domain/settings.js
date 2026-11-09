// Admin-configurable numbers. Every default here is a PLACEHOLDER awaiting the owner's
// approval (see DECISIONS.md). Values are validated on write and audit-logged.

import { isValidTimeZone } from '../lib/clock.js';
import { unprocessable } from '../lib/errors.js';
import { nowIso, requireAdmin } from './context.js';
import { recordAudit } from './audit.js';

const intBetween = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;
const oneOf = (...options) => (value) => options.includes(value);

/** key -> { default, valid(value), describe } */
export const SETTING_DEFINITIONS = Object.freeze({
  // Most points one member can receive from task awards and bonuses in a calendar month.
  monthly_cap_per_member: { default: 300, valid: intBetween(0, 100000), describe: 'whole number 0–100000' },
  // Most points all members together can receive from task awards and bonuses in a calendar month.
  monthly_budget_total: { default: 750, valid: intBetween(0, 1000000), describe: 'whole number 0–1000000' },
  // Anti-abuse: how many claims one member may submit per local calendar day.
  daily_claim_limit_per_member: { default: 5, valid: intBetween(1, 100), describe: 'whole number 1–100' },
  // Written feedback shorter than this is not accepted as a submission.
  feedback_min_chars: { default: 80, valid: intBetween(0, 2000), describe: 'whole number 0–2000' },
  // Calendar months and days are evaluated in this IANA time zone.
  time_zone: { default: 'America/Los_Angeles', valid: isValidTimeZone, describe: 'IANA time zone name' },
  leaderboard_rank_by: { default: 'points', valid: oneOf('points', 'xp'), describe: '"points" or "xp"' },
  // Aggregate platform statistics older than this are dropped rather than shown as current.
  platform_stats_max_age_days: { default: 30, valid: intBetween(1, 30), describe: 'whole number 1–30' },
});

export const SETTING_KEYS = Object.freeze(Object.keys(SETTING_DEFINITIONS));

/** All settings with defaults applied. Readable by anyone the caller chooses to show them to. */
export function getSettings(ctx) {
  const stored = new Map(ctx.db.all('SELECT key, value FROM settings').map((row) => [row.key, row.value]));
  const out = {};
  for (const key of SETTING_KEYS) {
    out[key] = stored.has(key) ? JSON.parse(stored.get(key)) : SETTING_DEFINITIONS[key].default;
  }
  return out;
}

export function getSetting(ctx, key) {
  if (!(key in SETTING_DEFINITIONS)) throw new TypeError(`unknown setting: ${key}`);
  const row = ctx.db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : SETTING_DEFINITIONS[key].default;
}

/**
 * Applies a partial update. All-or-nothing: one invalid value rejects the whole patch.
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown>} the full settings after the update
 */
export function updateSettings(ctx, patch) {
  requireAdmin(ctx);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw unprocessable('invalid_settings', 'Send an object of settings to change.');
  }
  const entries = Object.entries(patch);
  if (entries.length === 0) throw unprocessable('invalid_settings', 'Nothing to change.');
  for (const [key, value] of entries) {
    const definition = Object.hasOwn(SETTING_DEFINITIONS, key) ? SETTING_DEFINITIONS[key] : null;
    if (!definition) throw unprocessable('unknown_setting', `Unknown setting "${key}".`, { key });
    if (!definition.valid(value)) {
      throw unprocessable('invalid_setting', `"${key}" must be: ${definition.describe}.`, { key });
    }
  }
  return ctx.db.tx(() => {
    const before = getSettings(ctx);
    const changed = {};
    const at = nowIso(ctx);
    for (const [key, value] of entries) {
      if (before[key] === value) continue;
      ctx.db.run(
        `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        [key, JSON.stringify(value), at, ctx.actor.userId ?? null],
      );
      changed[key] = { from: before[key], to: value };
    }
    if (Object.keys(changed).length > 0) {
      recordAudit(ctx, { action: 'settings.update', entityType: 'settings', detail: { changed } });
    }
    return getSettings(ctx);
  });
}
