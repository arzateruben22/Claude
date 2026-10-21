// What you own: the set of entitlement ids (cosmetics.json) your purchases granted, for the signed-in account.
//
// TEST MODE: kept in this browser's storage per test account, with the test receipts, as in Lumevina's demo.
// LIVE: read from Supabase's `entitlements` table (row-level security: you read only your own rows; only the Stripe
// webhook writes them) and cached on the device, so your cosmetics still show offline. restore() reads it again.
//
//   has(id), list(), restore(), onStoreChange(fn) (from ./bus) for the change event the game listens to.
//   serialOf(id): the Founder Edition number the server wrote on that entitlement row, or null (never made up here).
//   storeCars() and syncGarage(book): the cars the store grants, put in the garage outside the slot count.
//   ULTRA_ENTITLEMENT and ultraUnlocked(): the Ultra graphics mode's flag (decision 15), for the graphics-modes lane.
import { CONFIG, sbHeaders } from './config';
import { load, save, emit, onStoreChange } from './bus';
import { current, accessToken } from './account';
import { skuById, COSMETICS } from './catalog';

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

// The Ultra graphics mode (decision 15, PROJECT_OC_DECISIONS.md): Low and HD are free, and Ultra is the paid tier as
// an entitlement flag only. Defined like the Founder Edition's car: an entitlement id that only the server's webhook
// grants and has() reads, and owner mode unlocks it (owner mode is compiled out of public builds or tied to the
// owner's account before any live sale: PROJECT_OC_MONETIZATION.md §12). No sku grants it and it has no price: nothing
// is sold for it until the owner prices it and connects a payment processor, and catalog.json and cosmetics.json gain
// it only then (the checker refuses an entitlement no sku grants). A test-mode build (every build today) unlocks it
// for everyone, so nothing the game has today is taken away. The graphics-modes lane (claude/modes) reads it here.
export const ULTRA_ENTITLEMENT = 'graphics-ultra';
export const ultraUnlocked = (o: { owner?: boolean } = {}): boolean => !CONFIG.live || o.owner === true || has(ULTRA_ENTITLEMENT);

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

// live: after signing in, load what the account owns
let lastUser: string | null = current()?.userId ?? null;
onStoreChange(() => {
  const u = current()?.userId ?? null;
  if (u !== lastUser) { lastUser = u; if (u && CONFIG.live) void restore(); }
});
