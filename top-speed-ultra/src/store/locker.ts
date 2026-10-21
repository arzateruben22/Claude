// What you've put on: the store paint each car wears (or its factory paint), checked against what you own every
// time it is read, so a refund or a sign-out puts the factory paint back. Kept on this device.
//
// What the game can show today (inGame): paints, through PlayerCar.setPaint(hex, finish) with the finish numbers
// from cosmetics.json, and the Founder '26 badge and the Founders frame on the run card (src/ui/runCard.ts). Wheels,
// driver styles, liveries, kits, outfits and the club items are data only until their hooks exist in the car and
// cockpit code; buying them in test mode records them on the account and nothing more.
import { load, save, emit } from './bus';
import { has } from './entitlements';
import { entById, COSMETICS, Entitlement, FinishName } from './catalog';

const KEY = 'ocu.store.equipped';
interface Locker { paint: Record<string, string> }       // car id -> paint entitlement id

export interface EquippedPaint { id: string; name: string; hex: number; finish: { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; flake: boolean } }

// gloss and satin are solid colours (no metallic flake); metallic and pearl keep the car's flake
const FLAKE: Record<FinishName, boolean> = { gloss: false, satin: false, metallic: true, pearl: true };
export function finishOf(name: FinishName) {
  const f = COSMETICS.paint_finishes[name];
  return { metalness: f.metalness, roughness: f.roughness, clearcoat: f.clearcoat, clearcoatRoughness: f.clearcoatRoughness, flake: FLAKE[name] };
}

const fits = (e: Entitlement | null, car: string) => !!e && e.type === 'paint' && (e.cars === 'all' || e.cars === car);

export function equippedPaint(car: string): EquippedPaint | null {
  const id = load<Locker>(KEY, { paint: {} }).paint?.[car];
  const e = id ? entById(id) : null;
  if (!e || !fits(e, car) || !has(e.id) || !e.hex || !e.finish) return null;
  return { id: e.id, name: e.name, hex: parseInt(e.hex.slice(1), 16), finish: finishOf(e.finish) };
}
export const equippedPaintId = (car: string) => equippedPaint(car)?.id ?? null;

// null puts the factory paint back
export function equipPaint(car: string, id: string | null): boolean {
  if (id && (!fits(entById(id), car) || !has(id))) return false;
  const l = load<Locker>(KEY, { paint: {} });
  const paint = { ...(l.paint ?? {}) };
  if (id) paint[car] = id; else delete paint[car];
  save(KEY, { ...l, paint });
  emit();
  return true;
}

// the paints you own, for the picker
export const ownedPaints = (car: string) => COSMETICS.entitlements.filter((e) => fits(e, car) && has(e.id));

// does this grant show up in the game yet? (a paint for a car still being built, like OC Founder Silver, doesn't; the
// Ultra graphics tier does: the Ultra preset is in the game, chosen in Settings)
const SHOWN = new Set(['badge-founder-26', 'frame-founder-runcard']);
export const inGame = (id: string) => { const e = entById(id); return (e?.type === 'paint' && e.status !== 'build') || e?.type === 'graphics' || SHOWN.has(id); };
