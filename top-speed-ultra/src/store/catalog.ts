// The catalog, typed. `catalog.json` (what is sold, for how much, what it grants) and `cosmetics.json` (what each
// grant unlocks in the game) are the single source of truth; nothing here adds an item or a price. The server keeps
// its own copy (server/supabase/functions/_shared/catalog.json, written by `npm run store:sync`) and charges what
// that copy says, never what the page sends.
import catalogJson from './catalog.json';
import cosmeticsJson from './cosmetics.json';
import founderJson from './founder.json';

// The one founder window (src/store/founder.json): the Founder Pack and the OC Hypercar Founder Edition are sold until
// the last second of December 31, 2026, Pacific time. catalog.json's founder items name it ("FOUNDER_UNTIL"); the
// server's copy and the checker read the same file.
export const FOUNDER_UNTIL: string = founderJson.FOUNDER_UNTIL;

export type Kind = 'pack' | 'livery' | 'kit' | 'style' | 'tip' | 'club';
export type Status = 'ready' | 'hook' | 'build';
export type FinishName = 'gloss' | 'metallic' | 'satin' | 'pearl';

export interface Sku {
  sku: string;
  name: string;
  kind: Kind;
  price_cents: number;
  currency: 'usd';
  mode: 'payment' | 'subscription';
  interval?: 'month' | 'year';
  window?: { until: string };
  serial?: boolean;                // the server numbers each sale (migration 0002); the device never does
  custom_amount?: { minimum_cents: number; preset_cents: number; maximum_cents: number };
  grants: string[];
  description: string;
  available: boolean;
  unavailable_reason?: string;     // why it can't be sold yet, in words the store shows
  caveat?: string;                 // a note for the owner (not shown in the store)
}

export interface Swatch { name: string; hex: string }
export interface Entitlement {
  id: string;
  type: string;                    // paint, livery, wheels, style, badge, frame, credits-roll, paint-series, access, body-kit, car, outfit
  name: string;
  status: Status;
  hex?: string;
  finish?: FinishName;
  cars?: string;
  car?: string;                    // a car-specific grant (wheels, kits)
  style?: string;
  rim?: Swatch;
  caliper?: Swatch;
  gloves?: Swatch | null;
  watch?: { model: string; kind: string; dial: Swatch };
  sleeve?: Swatch & { end: string };
  nails?: Swatch & { applies: string };
  while?: string;                  // "subscribed": taken back when the subscription ends
  exclusive?: string;
  never_resold?: boolean;
  needs?: string;
  hook?: string;
  vehicle?: string;                // a car the store grants: its id in src/game/cars.ts
  outside_slots?: boolean;         // ...which takes no garage slot
  sell_back?: boolean;             // false: never sold back for credits
  leds?: Swatch & { accent: string };
}

export interface Finish { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; status: Status }

interface Cosmetics {
  version: number;
  entitlements: Entitlement[];
  paint_finishes: Record<FinishName, Finish> & { note?: string };
}

export const CATALOG = (catalogJson as unknown as Sku[]).map((s) => (s.window?.until === 'FOUNDER_UNTIL' ? { ...s, window: { until: FOUNDER_UNTIL } } : s));
export const COSMETICS = cosmeticsJson as unknown as Cosmetics;
const ENTS = new Map(COSMETICS.entitlements.map((e) => [e.id, e]));
const SKUS = new Map(CATALOG.map((s) => [s.sku, s]));

export const skuById = (id: string) => SKUS.get(id) ?? null;
export const entById = (id: string) => ENTS.get(id) ?? null;
export const FOUNDER_SKU = 'founder-pack-2026';
export const HYPERCAR_SKU = 'hypercar-founder';

// the order and the headings the store shows
export const KINDS: { kind: Kind; label: string; blurb: string }[] = [
  { kind: 'pack', label: 'Packs', blurb: '' },
  { kind: 'livery', label: 'Paints and liveries', blurb: 'For every car in your garage.' },
  { kind: 'kit', label: 'Wheels and kits', blurb: 'Same size wheels and tyres as the factory set: looks only.' },
  { kind: 'style', label: 'Driver styles', blurb: 'Gloves, watch, sleeves and nails: what you see on the wheel.' },
  { kind: 'tip', label: 'Support', blurb: '' },
  { kind: 'club', label: 'Club', blurb: '' },
];

export const CAR_NAMES: Record<string, string> = { 'rossini-gt': 'Rossini GT', 'rossini-brio': 'Rossini Brio', 'rossini-corsa': 'Rossini Corsa', 'vela-e': 'Vela E' };

// on sale right now? (available, and inside its window if it has one)
export function saleState(s: Sku, now = Date.now()): { ok: true } | { ok: false; why: string } {
  if (!s.available) return { ok: false, why: s.unavailable_reason ?? 'Not on sale yet: it goes on sale once it is in the game.' };
  // "never sold again" is the Founder Pack's promise only: for the OC Hypercar Founder Edition, what it covers is the
  // owner's open decision (PROJECT_OC_MONETIZATION.md §12), so its copy gives the end date and no more
  if (s.window && now > Date.parse(s.window.until)) return { ok: false, why: `${s.name} was sold until ${windowDate(s)}${s.sku === FOUNDER_SKU ? ' and is never sold again' : ''}.` };
  return { ok: true };
}
export const forSale = (now = Date.now()) => CATALOG.filter((s) => saleState(s, now).ok);

// "December 31, 2026" (or "Dec 31, 2026" short), in the window's own (Pacific) time
export function windowDate(s: Sku, month: 'long' | 'short' = 'long') {
  if (!s.window) return '';
  return new Date(s.window.until).toLocaleDateString('en-US', { month, day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
}

// $3 on a card, $3.00 on a receipt
export function money(cents: number, exact = false) {
  const d = cents / 100;
  return '$' + (exact || cents % 100 ? d.toFixed(2) : String(d));
}
export function priceLine(s: Sku) {
  if (s.kind === 'tip' && s.custom_amount) return `From ${money(s.custom_amount.minimum_cents)}, pay what you want`;
  if (s.mode === 'subscription') return `${money(s.price_cents)} a ${s.interval ?? 'month'}`;
  return money(s.price_cents);
}

// the one car a sku's grants are for (a wheel set, a kit), or null when they fit any car
export function carFor(s: Sku): string | null {
  const cars = new Set(s.grants.map((g) => ENTS.get(g)?.car).filter((c): c is string => !!c));
  return cars.size === 1 && s.grants.every((g) => !!ENTS.get(g)?.car) ? [...cars][0] : null;
}

// every grant works through a code path the game has today (cosmetics.json's 'ready'); live mode sells only these
export const grantsReady = (s: Sku) => s.grants.every((g) => ENTS.get(g)?.status === 'ready');

// a short line for each grant: what it is, for the item card
export function grantLine(e: Entitlement): string {
  switch (e.type) {
    case 'paint': return `${e.name} paint (${e.finish})${e.leds ? `, ${e.leds.name} lights` : ''}`;
    case 'plaque': return `${e.name}, numbered`;
    case 'wheels': return `${e.name} wheels, ${e.caliper?.name.toLowerCase()} calipers`;
    case 'style': return `${e.name}: ${[e.gloves?.name ?? 'bare hands', e.watch ? `the ${e.watch.model} watch` : '', e.sleeve?.name.toLowerCase()].filter(Boolean).join(', ')}`;
    case 'badge': return `${e.name} badge`;
    case 'frame': return e.name;
    case 'credits-roll': return `${e.name} (optional)`;
    default: return e.name;
  }
}
