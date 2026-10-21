// What you own: the set of entitlement ids (cosmetics.json) your purchases granted, for the signed-in account.
//
// TEST MODE: kept in this browser's storage per test account, with the test receipts, as in Lumevina's demo.
// LIVE: read from Supabase's `entitlements` table (row-level security: you read only your own rows; only the Stripe
// webhook writes them) and cached on the device, so your cosmetics still show offline. restore() reads it again.
//
//   has(id), list(), restore(), onStoreChange(fn) (from ./bus) for the change event the game listens to.
//   serialOf(id): the Founder Edition number the server wrote on that entitlement row, or null (never made up here).
//   storeCars() and syncGarage(book): the cars the store grants, put in the garage outside the slot count.
//   ULTRA_ENTITLEMENT, ultraUnlocked(), ultraState() and gateQuality(): the Ultra graphics tier's flag (decision 15),
//   which the settings picker and the graphics-modes lane read; ownerMode(): owner mode's switch, read where it lives
//   (test builds only).
import { CONFIG, sbHeaders } from './config';
import { load, save, emit, onStoreChange } from './bus';
import { current, accessToken, ready } from './account';
import { skuById, COSMETICS, ULTRA_SKU, saleState, grantsReady } from './catalog';

// serial: the number the stripe-webhook assigned when the payment succeeded (migration 0002). Test purchases have
// none: only the server numbers a sale.
export interface Owned { entitlement: string; sku: string; granted_at: string; serial?: number | null }
export interface Receipt {
  id: string;                     // OCU-TEST-… in test mode, the Stripe Checkout Session id live
  sku: string;
  name: string;
  amount_cents: number;
  currency: string;
  card?: string;                  // "Visa •••• 4242" (test mode only; live, Stripe's page took the card)
  at: string;
  test: boolean;
  grants: string[];
  roll_name?: string | null;
}

const OWNED_KEY = 'ocu.store.owned';          // { [userId]: { items, at } }: the test ledger, or the live cache
const RECEIPTS_KEY = 'ocu.store.receipts';    // { [userId]: Receipt[] }  test mode's order history
type Book = Record<string, { items: Owned[]; at: number }>;

let book = load<Book>(OWNED_KEY, {});
const mine = (): Owned[] => { const s = current(); return s ? book[s.userId]?.items ?? [] : []; };

export const list = (): Owned[] => mine().slice();
export const has = (id: string) => mine().some((o) => o.entitlement === id);
export const ownsSku = (sku: string) => { const s = skuById(sku); return !!s && s.grants.every(has); };
export function serialOf(id: string): number | null {
  const n = mine().find((o) => o.entitlement === id)?.serial;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : null;
}
// No. 0000 is owner mode's test number (PROJECT_OC_HYPERCAR.md §7); a sale's number starts at 0001
export const OWNER_TEST_SERIAL = 0;
export const serialLabel = (n: number) => n === OWNER_TEST_SERIAL ? 'No. 0000 · TEST' : `No. ${String(n).padStart(4, '0')}`;

// The cars the store grants (cosmetics.json: type 'car' with a `vehicle`, `outside_slots` and `sell_back: false`).
// `all` are the vehicles only the store gives; `owned` are those the signed-in account owns right now.
export function storeCars(): { owned: string[]; all: string[] } {
  const cars = COSMETICS.entitlements.filter((e) => e.type === 'car' && !!e.vehicle && e.outside_slots);
  return { owned: cars.filter((e) => has(e.id)).map((e) => e.vehicle!), all: cars.map((e) => e.vehicle!) };
}
// Put them in the game's garage (src/game/profile.ts setStoreCars): in it while owned, outside the slot count, never
// sold back for credits; a refund or a sign-out takes the car out, and signing in again (Restore) puts it back.
export function syncGarage(book: { setStoreCars(owned: string[], all: string[]): boolean }): boolean {
  const c = storeCars();
  return book.setStoreCars(c.owned, c.all);
}

// Owner mode: claude/hypercar's switch for test builds (#owner on, #owner=0 off, then saved as `owner` in the game's
// settings, tsu.settings; settings.ts owns it there). Read here from the same two places, so the store's flags follow
// it on a branch whose settings don't have it yet. A switch on the device, not security, so a live build ignores it:
// anyone can type #owner, and in a live build it would unlock what others pay for. It stays off there until decision 5
// (pending; PROJECT_OC_MONETIZATION.md §12) compiles it out of public builds or ties it to the owner's account; the
// store's copy says "test builds only", and tools/store-check-catalog.mjs refuses to mark Ultra 'ready' without this.
export function ownerMode(): boolean {
  if (CONFIG.live) return false;
  try {
    const h = location.hash.toLowerCase();
    if (h === '#owner' || h === '#owner=1') return true;
    if (h === '#owner=0') return false;
  } catch { /* no address to read */ }
  return load<{ owner?: unknown }>('tsu.settings', {}).owner === true;
}

// The Ultra graphics tier (decision 15, PROJECT_OC_DECISIONS.md): Low and HD are free, and Ultra is the paid tier as an
// entitlement flag only. The Ultra Graphics sku (catalog.json `graphics-ultra`) grants it: in test mode through the
// 4242 test card, live only through the stripe-webhook, which writes the row; has() reads it, a refund takes it back
// and Restore purchases brings it back. Who has Ultra (ultraState):
//   'test'    any test-mode build (every build today): unlocked for everyone, bought or not, so nothing the game has
//             today is taken away and nothing is charged
//   'owned'   this account holds graphics-ultra (a test purchase, or a paid one the server recorded)
//   'owner'   owner mode is on (above), in a test build only: a live build ignores it, even passed in as { owner }
//   'free'    a live build where the sku can't be bought yet (not available, or a grant not 'ready' in cosmetics.json,
//             the server's live-key rule): unlocked for everyone, because a tier is never locked before it can be bought
//   'locked'  a live build, the sku on sale, and none of the above: the settings picker sends you to the Store
// The lock is on the device (the game draws what the device decides); the server only records who paid.
export const ULTRA_ENTITLEMENT = 'graphics-ultra';
export type UltraState = 'test' | 'owned' | 'owner' | 'free' | 'locked';
export function ultraForSale(now = Date.now()): boolean {
  const s = skuById(ULTRA_SKU);
  return !!s && saleState(s, now).ok && grantsReady(s);
}
export function ultraState(o: { owner?: boolean } = {}): UltraState {
  if (has(ULTRA_ENTITLEMENT)) return 'owned';
  if (!CONFIG.live && (o.owner ?? ownerMode())) return 'owner';
  if (!CONFIG.live) return 'test';
  return ultraForSale() ? 'locked' : 'free';
}
export const ultraUnlocked = (o: { owner?: boolean } = {}): boolean => ultraState(o) !== 'locked';
// The quality the game may draw: a saved 'ultra' draws as the fallback (High here; HD after RS2) while Ultra is locked,
// and comes back by itself when it unlocks, since the saved choice is kept. App.tsx applies it where settings reach
// the game; the graphics-modes lane keeps it at its own mode switch.
export function gateQuality<Q extends string, F extends string = 'high'>(q: Q, fallback: F = 'high' as F, o: { owner?: boolean } = {}): Q | F {
  return q === 'ultra' && !ultraUnlocked(o) ? fallback : q;
}

export const receipts = (): Receipt[] => { const s = current(); return s ? load<Record<string, Receipt[]>>(RECEIPTS_KEY, {})[s.userId] ?? [] : []; };

function put(userId: string, items: Owned[]) {
  book = { ...load<Book>(OWNED_KEY, {}), [userId]: { items, at: Date.now() } };
  save(OWNED_KEY, book);
  emit();
}

// TEST MODE ONLY: payments.ts calls this after a successful test-card payment
export function grantTest(r: Receipt) {
  const s = current();
  if (CONFIG.live || !s?.test) throw new Error('grantTest is for test mode');
  const at = r.at, now = mine().filter((o) => !r.grants.includes(o.entitlement));
  put(s.userId, [...now, ...r.grants.map((g) => ({ entitlement: g, sku: r.sku, granted_at: at }))]);
  const all = load<Record<string, Receipt[]>>(RECEIPTS_KEY, {});
  all[s.userId] = [r, ...(all[s.userId] ?? [])].slice(0, 50);
  save(RECEIPTS_KEY, all);
}

// read your items again: test mode from this browser, live from the server (and refresh the cache)
export async function restore(): Promise<{ ok: boolean; count: number; message: string }> {
  const s = current();
  if (!s) return { ok: false, count: 0, message: 'Sign in with the email you bought with to restore your items.' };
  if (!CONFIG.live) {
    book = load<Book>(OWNED_KEY, {});
    emit();
    const n = mine().length;
    return { ok: true, count: n, message: n ? `${n} item${n === 1 ? '' : 's'} on this account (test mode: kept in this browser).` : 'No test purchases on this account yet.' };
  }
  const token = await accessToken();
  if (!token) return { ok: false, count: mine().length, message: 'Sign in again to restore your items.' };
  try {
    const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/entitlements?select=entitlement,sku,granted_at,serial&revoked_at=is.null&order=granted_at.asc`, { headers: sbHeaders(token, false) });
    if (!r.ok) return { ok: false, count: mine().length, message: `Your items could not be loaded (${r.status}). The ones on this device still work.` };
    const rows = await r.json() as Owned[];
    put(s.userId, rows);
    return { ok: true, count: rows.length, message: rows.length ? `${rows.length} item${rows.length === 1 ? '' : 's'} restored.` : 'No purchases on this account.' };
  } catch {
    return { ok: false, count: mine().length, message: 'No connection. The items on this device still work offline.' };
  }
}

// live: after signing in, load what the account owns; and at boot, when already signed in, read it once from the
// server too, so an item bought on another device (Ultra above all, which works outside the Store) shows without
// opening the Store, and a refund seen since the last visit takes it away
let lastUser: string | null = current()?.userId ?? null;
onStoreChange(() => {
  const u = current()?.userId ?? null;
  if (u !== lastUser) { lastUser = u; if (u && CONFIG.live) void restore(); }
});
if (CONFIG.live && lastUser) void ready.then(() => { if (current()?.userId === lastUser) void restore(); });
