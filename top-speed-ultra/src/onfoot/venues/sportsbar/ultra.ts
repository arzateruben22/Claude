// Ultra is an entitlement flag only (decision 15; PROJECT_OC_SPORTS_BAR.md, "Graphics: Low, HD, Ultra", and O29): owner
// mode and the test build unlock it. There is no price and no purchase path anywhere on the page, and nothing here
// ever offers one: a locked Ultra button reads "Ultra · locked" and opens nothing.
// RS2's shared entitlement hasn't landed on any branch merged here (checked at S4, 2026-11-09: only a WIP
// src/store/entitlements.ts on claude/wip-modes, not kept). So this reads, in order: the game's own settings' owner
// flag (`owner` in tsu.settings, which the game's settings carry on retro/port), this device's owner flag (tsu.owner,
// S1's), and the test build's ?ultra=1 (or ?quality=ultra). When RS2 lands, its reader goes first here.
export type UltraSource = 'test' | 'owner-settings' | 'owner-device' | null;

export function ultraEntitlement(q: URLSearchParams): { unlocked: boolean; by: UltraSource } {
  if (q.get('ultra') === '1' || q.get('quality') === 'ultra') return { unlocked: true, by: 'test' };
  try {
    const s = JSON.parse(localStorage.getItem('tsu.settings') ?? 'null') as { owner?: unknown } | null;
    if (s && s.owner === true) return { unlocked: true, by: 'owner-settings' };
  } catch { /* no settings: not the owner */ }
  try { if (localStorage.getItem('tsu.owner') === '1') return { unlocked: true, by: 'owner-device' }; } catch { /* storage blocked */ }
  return { unlocked: false, by: null };
}

/** the quality ids: the bar keeps Lot 57's 'high' for HD; Lot 57's P1d names it 'hd' (with 'high' still read), so the
 *  bar reads either */
export function asQuality(s: string | null | undefined): 'low' | 'high' | 'ultra' | null {
  if (s === 'hd' || s === 'high') return 'high';
  if (s === 'low' || s === 'ultra') return s;
  return null;
}
