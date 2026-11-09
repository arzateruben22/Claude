// Exactly five evolution tiers, driven by XP. Names, thresholds and art are placeholders
// until the owner approves them; an admin can replace all five at once.

import { unprocessable } from '../lib/errors.js';
import { nowIso, requireAdmin } from './context.js';
import { recordAudit } from './audit.js';
import { assertRewardableText } from './policy.js';

export const TIER_COUNT = 5;

/** Placeholder ladder used by the seed script. */
export const DEFAULT_TIERS = Object.freeze([
  { level: 1, name: 'Stage 1', min_xp: 0, art_key: 'stage-1' },
  { level: 2, name: 'Stage 2', min_xp: 100, art_key: 'stage-2' },
  { level: 3, name: 'Stage 3', min_xp: 250, art_key: 'stage-3' },
  { level: 4, name: 'Stage 4', min_xp: 500, art_key: 'stage-4' },
  { level: 5, name: 'Stage 5', min_xp: 1000, art_key: 'stage-5' },
]);

export function listTiers(ctx) {
  return ctx.db.all('SELECT level, name, min_xp, art_key, updated_at FROM tiers ORDER BY level');
}

function validateTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length !== TIER_COUNT) {
    throw unprocessable('invalid_tiers', `Send exactly ${TIER_COUNT} tiers.`);
  }
  const sorted = [...tiers].sort((a, b) => a.level - b.level);
  sorted.forEach((tier, index) => {
    const level = index + 1;
    if (!tier || tier.level !== level) throw unprocessable('invalid_tiers', 'Tier levels must be 1, 2, 3, 4 and 5.');
    if (typeof tier.name !== 'string' || tier.name.trim().length < 1 || tier.name.trim().length > 40) {
      throw unprocessable('invalid_tiers', `Tier ${level} needs a name of 1–40 characters.`, { level });
    }
    assertRewardableText(`tiers[${level}].name`, tier.name);
    if (!Number.isInteger(tier.min_xp) || tier.min_xp < 0 || tier.min_xp > 10000000) {
      throw unprocessable('invalid_tiers', `Tier ${level} needs a whole-number XP threshold.`, { level });
    }
    if (typeof tier.art_key !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(tier.art_key)) {
      throw unprocessable('invalid_tiers', `Tier ${level} needs an art key (lower-case letters, digits, dashes).`, { level });
    }
    if (level === 1 && tier.min_xp !== 0) throw unprocessable('invalid_tiers', 'Tier 1 must start at 0 XP.');
    if (level > 1 && tier.min_xp <= sorted[index - 1].min_xp) {
      throw unprocessable('invalid_tiers', `Tier ${level} must need more XP than tier ${level - 1}.`, { level });
    }
  });
  return sorted.map((tier) => ({ level: tier.level, name: tier.name.trim(), min_xp: tier.min_xp, art_key: tier.art_key }));
}

/** Replaces all five tiers atomically. */
export function replaceTiers(ctx, tiers) {
  requireAdmin(ctx);
  const clean = validateTiers(tiers);
  return ctx.db.tx(() => {
    const at = nowIso(ctx);
    for (const tier of clean) {
      ctx.db.run(
        `INSERT INTO tiers (level, name, min_xp, art_key, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (level) DO UPDATE SET name = excluded.name, min_xp = excluded.min_xp, art_key = excluded.art_key, updated_at = excluded.updated_at`,
        [tier.level, tier.name, tier.min_xp, tier.art_key, at],
      );
    }
    recordAudit(ctx, { action: 'tiers.replace', entityType: 'tiers', detail: { thresholds: clean.map((tier) => tier.min_xp) } });
    return listTiers(ctx);
  });
}

/**
 * Where a given XP total sits on the ladder.
 * @param {{ level: number, name: string, min_xp: number, art_key: string }[]} tiers ordered by level
 * @param {number} xp
 */
export function tierForXp(tiers, xp) {
  if (!tiers.length) return null;
  const total = Math.max(0, Number(xp) || 0);
  let current = tiers[0];
  for (const tier of tiers) {
    if (total >= tier.min_xp) current = tier;
  }
  const next = tiers.find((tier) => tier.level === current.level + 1) ?? null;
  const span = next ? next.min_xp - current.min_xp : 0;
  const into = total - current.min_xp;
  return {
    level: current.level,
    name: current.name,
    art_key: current.art_key,
    min_xp: current.min_xp,
    xp_into_tier: into,
    next: next ? { level: next.level, name: next.name, min_xp: next.min_xp, xp_needed: next.min_xp - total } : null,
    // 0..1 progress toward the next tier; 1 at the top tier.
    progress: next ? Math.min(1, Math.max(0, into / span)) : 1,
  };
}
