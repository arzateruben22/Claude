// The pack characters' lock (owner, 2026-11-11/12): "Chad" and "Chadaline" (src/onfoot/cast.ts CAST_PACK) are playable
// only with the pack. ONE rule, read by the picker, the cockpit's arms (Game.configureCar) and the on-foot avatar
// (src/onfoot/lot57/driver.ts):
//   - the store's entitlement 'cast-pack-duo-characters' (src/store/entitlements.ts has): what a purchase would grant.
//     The pack is not on sale (catalog.json: available false), so no one holds it today;
//   - or, in a TEST-MODE build only (src/store/config.ts CONFIG.live false: every build today), the TEST unlock: a
//     switch the picker shows, clearly labelled TEST, saved as Settings.packTest. It is not a purchase: it grants no
//     store entitlement, writes no receipt, and a live build ignores it.
// Without either, a saved pack character is not played: the game falls back to the look without a character, and the
// picker shows the two as locked ("coming soon, $22.22, 18+"), with their preview and turntable.
import { CONFIG } from '../store/config';
import { has } from '../store/entitlements';
import { skuById } from '../store/catalog';
import { CAST_PACK, playable, CastEntry } from '../onfoot/cast';

/** a test-mode build: the TEST unlock is offered (never in a live build) */
export const packTestOffered = (): boolean => !CONFIG.live;
/** the store's entitlement for the pack's two characters (a purchase; none can be made today) */
export const packOwned = (): boolean => has(CAST_PACK.entitlement);
export function packUnlocked(s: { packTest?: boolean } | null | undefined): boolean {
  return packOwned() || (!CONFIG.live && s?.packTest === true);
}
/** the character a save plays as: null for no character, or for a pack character while the pack is locked */
export const playableCharacter = (s: { character?: string; packTest?: boolean }): CastEntry | null => playable(s.character, packUnlocked(s));
/** the pack's price as the store's catalog has it ("$22.22"), its age rule, and whether it is on sale */
export function packOffer() {
  const sku = skuById(CAST_PACK.sku);
  return { price: sku ? '$' + (sku.price_cents / 100).toFixed(2) : '', age: 18, onSale: !!sku?.available, name: sku?.name ?? 'Chad & Chadaline pack' };
}
