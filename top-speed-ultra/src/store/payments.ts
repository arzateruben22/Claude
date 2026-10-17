// OC Ultra: the payment engine. One module owns the card checks and the checkout for every item in the store, so
// real payments plug in at exactly one point (Lumevina's shared payment engine, shaped for a game).
//
// ═══ STRIPE INTEGRATION POINT ═══ (checkout() below)
//   TEST MODE (the default; see config.ts): the game's own checkout sheet. The card form checks the number (Luhn),
//     the expiry and the CVC, and takes Stripe's test cards only: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002
//     is declined. Any other card number, real or not, is refused unread. Nothing leaves the browser; the receipt
//     and the items are kept in this browser's storage (entitlements.ts).
//   LIVE (VITE_PAYMENTS_LIVE=true and Supabase set): the card form is never shown. checkout() calls the
//     `create-checkout` Supabase Edge Function with your sign-in token and the item's sku only (never a price: the
//     server charges what its own copy of the catalog says), and sends you to Stripe's hosted Checkout page, which
//     takes the card (and Apple Pay or Google Pay where the device has them). Card data never touches the game.
//     Stripe sends you back here; confirmReturn() waits for the server (the `stripe-webhook` function writes the
//     purchase and its entitlements) and shows the receipt.
import { CONFIG, sbHeaders } from './config';
import { sessionLoad, sessionSave, shortId } from './bus';
import { current, accessToken, ensureProfile, ageState } from './account';
import { grantTest, restore, Receipt } from './entitlements';
import { skuById, saleState, carFor, CAR_NAMES, Sku } from './catalog';

// ------------------------------------------------------------------------------------------- card checks (test mode)
export function luhnValid(digits: string) {
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return digits.length > 0 && sum % 10 === 0;
}
export const digitsOf = (v: string) => v.replace(/\D/g, '');
export const cardValid = (v: string) => { const d = digitsOf(v); return d.length >= 13 && d.length <= 19 && luhnValid(d); };
export function expiryValid(v: string, now = new Date()) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const month = Number(m[1]), year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}
export const cvcValid = (v: string, brand = '') => (brand === 'Amex' ? /^\d{4}$/ : /^\d{3}$/).test(v.trim());
export function cardBrand(v: string) {
  const d = digitsOf(v);
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^6(011|5)/.test(d)) return 'Discover';
  return 'Card';
}
export const formatCard = (v: string) => digitsOf(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
export function formatExpiry(v: string) { const d = digitsOf(v).slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; }

// Stripe's published test cards (docs.stripe.com/testing). Only these work in test mode.
export const TEST_CARDS: Record<string, { result: 'ok' } | { result: 'declined'; why: string }> = {
  '4242424242424242': { result: 'ok' },
  '5555555555554444': { result: 'ok' },
  '378282246310005': { result: 'ok' },
  '4000000000000002': { result: 'declined', why: 'Your card was declined.' },
  '4000000000009995': { result: 'declined', why: 'Your card has insufficient funds.' },
};

// ------------------------------------------------------------------------------------------- one checkout
export interface CheckoutRequest {
  sku: string;
  // test mode's pay-what-you-want amount (live, you choose it on Stripe's page and the page sends no amount)
  tipCents?: number;
  // "I'm 18 or over, or a parent or guardian has said yes": required for every purchase
  adultOrGuardian: boolean;
  // a subscription's renewal terms, ticked by you (California's automatic renewal law)
  renewalAgreed?: boolean;
  // the Founder Pack's optional name on the Founders roll (the owner approves each one before it is added)
  rollName?: string | null;
  // car ids in your garage, for car-specific items (the garage lives on this device)
  garage: string[];
}
export interface TestCard { number: string; expiry: string; cvc: string }
export type CheckoutResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; code: 'invalid' | 'declined' | 'refused' | 'auth' | 'network'; message: string }
  | { ok: 'redirect' };

export function cleanRollName(v: string | null | undefined): string | null {
  const t = (v ?? '').replace(/\s+/g, ' ').trim();
  return t && /^[\p{L}\p{N} .'-]{1,24}$/u.test(t) ? t : null;
}

// the rules every checkout checks first; the server checks them again (except the garage, which it can't see)
export function precheck(req: CheckoutRequest, now = Date.now()): { ok: true; item: Sku } | { ok: false; code: 'invalid' | 'refused' | 'auth'; message: string } {
  const item = skuById(req.sku);
  if (!item) return { ok: false, code: 'refused', message: 'That item is not in the store.' };
  const sale = saleState(item, now);
  if (!sale.ok) return { ok: false, code: 'refused', message: sale.why };
  if (ageState() !== 'ok') return { ok: false, code: 'refused', message: 'The store is for players 13 and over.' };
  if (!current()) return { ok: false, code: 'auth', message: 'Sign in first, so your items are saved to your account.' };
  if (!req.adultOrGuardian) return { ok: false, code: 'invalid', message: 'Tick the box to say you are 18 or over, or that a parent or guardian has said yes.' };
  if (item.mode === 'subscription' && !req.renewalAgreed) return { ok: false, code: 'invalid', message: 'Tick the box to agree to the renewal terms.' };
  const car = carFor(item);
  if (car && !req.garage.includes(car)) return { ok: false, code: 'refused', message: `Earn the ${CAR_NAMES[car] ?? car} first: this set is for that car.` };
  if (item.kind === 'tip' && !CONFIG.live) {
    const a = item.custom_amount!, t = req.tipCents ?? a.preset_cents;
    if (!Number.isInteger(t) || t < a.minimum_cents || t > a.maximum_cents) return { ok: false, code: 'invalid', message: `Choose an amount from $${a.minimum_cents / 100} to $${a.maximum_cents / 100}.` };
  }
  return { ok: true, item };
}

export async function checkout(req: CheckoutRequest, card?: TestCard): Promise<CheckoutResult> {
  const pre = precheck(req);
  if (!pre.ok) return pre;
  // ═══ STRIPE INTEGRATION POINT ═══
  return CONFIG.live ? startStripeCheckout(pre.item, req) : processTest(pre.item, req, card);
}

// TEST MODE: a simulated charge. The card number is checked here and thrown away; the receipt keeps the last four
// digits of the test card only.
async function processTest(item: Sku, req: CheckoutRequest, card?: TestCard): Promise<CheckoutResult> {
  if (!card) return { ok: false, code: 'invalid', message: 'Type the test card number.' };
  const d = digitsOf(card.number), brand = cardBrand(d);
  if (!cardValid(d)) return { ok: false, code: 'invalid', message: 'That card number is not valid. Use 4242 4242 4242 4242.' };
  if (!expiryValid(card.expiry)) return { ok: false, code: 'invalid', message: 'Use an expiry date in the future, as MM/YY.' };
  if (!cvcValid(card.cvc, brand)) return { ok: false, code: 'invalid', message: brand === 'Amex' ? 'The CVC is 4 digits on this card.' : 'The CVC is the 3 digits on the back.' };
  const test = TEST_CARDS[d];
  if (!test) return { ok: false, code: 'refused', message: 'Test mode takes Stripe test cards only, so no real card is ever typed here. Use 4242 4242 4242 4242.' };
  await new Promise((r) => setTimeout(r, 700));
  if (test.result === 'declined') return { ok: false, code: 'declined', message: `${test.why} Nothing was charged and nothing was added. (Test card ${formatCard(d)} is always declined.)` };
  const receipt: Receipt = {
    id: 'OCU-TEST-' + shortId(8), sku: item.sku, name: item.name,
    amount_cents: item.kind === 'tip' ? req.tipCents ?? item.custom_amount!.preset_cents : item.price_cents,
    currency: item.currency, card: `${brand} •••• ${d.slice(-4)}`, at: new Date().toISOString(), test: true, grants: item.grants.slice(),
    roll_name: item.sku === 'founder-pack-2026' ? cleanRollName(req.rollName) : null,
  };
  grantTest(receipt);
  return { ok: true, receipt };
}

// LIVE: create the Checkout Session on the server and go to Stripe's page
const PENDING = 'ocu.store.pending';
async function startStripeCheckout(item: Sku, req: CheckoutRequest): Promise<CheckoutResult> {
  if (!CONFIG.canRedirect) return { ok: false, code: 'refused', message: 'Buying works on the game\'s website, not from a copy opened from disk.' };
  const token = await accessToken();
  if (!token) return { ok: false, code: 'auth', message: 'Your sign-in has expired. Sign in again.' };
  if (!(await ensureProfile())) return { ok: false, code: 'network', message: 'Your account could not be updated. Check your connection and try again.' };
  let r: Response;
  try {
    r = await fetch(`${CONFIG.supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST', headers: sbHeaders(token),
      body: JSON.stringify({ sku: item.sku, roll_name: item.sku === 'founder-pack-2026' ? cleanRollName(req.rollName) : null, renewal_agreed: !!req.renewalAgreed, adult_or_guardian: req.adultOrGuardian }),
    });
  } catch { return { ok: false, code: 'network', message: 'No connection. Check your signal and try again.' }; }
  const j = await r.json().catch(() => ({})) as { url?: string; error?: string };
  if (!r.ok || !j.url) return { ok: false, code: r.status === 401 ? 'auth' : 'refused', message: j.error ?? `The checkout could not start (${r.status}).` };
  // only ever send the player to Stripe's own page
  if (!/^https:\/\/checkout\.stripe\.com\//.test(j.url)) return { ok: false, code: 'refused', message: 'The checkout link was not Stripe\'s. Nothing was charged.' };
  sessionSave(PENDING, { sku: item.sku, at: Date.now() });
  location.assign(j.url);
  return { ok: 'redirect' };
}

// ------------------------------------------------------------------------------------------- coming back from Stripe
export type ReturnState = { kind: 'none' } | { kind: 'cancelled' } | { kind: 'waiting' } | { kind: 'paid'; receipt: Receipt } | { kind: 'slow'; message: string };
export function checkoutReturn(): 'success' | 'cancel' | null {
  if (!CONFIG.live || typeof location !== 'object') return null;
  const v = new URLSearchParams(location.search).get('checkout');
  return v === 'success' || v === 'cancel' ? v : null;
}
// true when the page was opened by a Stripe return or a sign-in link: the game opens the store at once
export function storeReturnPending() {
  if (!CONFIG.live || typeof location !== 'object') return false;
  return !!checkoutReturn() || new URLSearchParams(location.search).get('store') === 'signin' || /[#&]access_token=/.test(location.hash) || sessionLoad('ocu.store.reopen', false);
}

// Poll our own purchases table for the session Stripe sent you back with, then reload your items. The webhook
// usually lands within seconds; after about 20 s the store says so and the items appear on the next Restore.
export async function confirmReturn(onState: (s: ReturnState) => void): Promise<void> {
  const kind = checkoutReturn();
  sessionSave('ocu.store.reopen', null);
  if (!kind) { onState({ kind: 'none' }); return; }
  const q = new URLSearchParams(location.search);
  const sessionId = q.get('session_id') ?? '';
  for (const k of ['checkout', 'session_id']) q.delete(k);
  try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '')); } catch { /* sandboxed */ }
  sessionSave(PENDING, null);
  if (kind === 'cancel') { onState({ kind: 'cancelled' }); return; }
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) { onState({ kind: 'slow', message: 'Back from checkout. Tap Restore purchases to load your items.' }); return; }
  onState({ kind: 'waiting' });
  for (let i = 0; i < 14; i++) {
    const token = await accessToken();
    if (token) {
      try {
        const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/purchases?select=sku,amount_cents,currency,status,created_at&stripe_session_id=eq.${encodeURIComponent(sessionId)}`, { headers: sbHeaders(token, false) });
        const rows = r.ok ? await r.json() as { sku: string; amount_cents: number; currency: string; status: string; created_at: string }[] : [];
        if (rows[0]?.status === 'paid') {
          await restore();
          const item = skuById(rows[0].sku);
          onState({ kind: 'paid', receipt: { id: sessionId, sku: rows[0].sku, name: item?.name ?? rows[0].sku, amount_cents: rows[0].amount_cents, currency: rows[0].currency, at: rows[0].created_at, test: sessionId.startsWith('cs_test_'), grants: item?.grants ?? [] } });
          return;
        }
      } catch { /* offline for a moment: keep trying */ }
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  onState({ kind: 'slow', message: 'Your payment went through on Stripe\'s page. Your items will appear in a minute or two: tap Restore purchases. Stripe emails your receipt.' });
}

// live: which skus the server will sell right now (available, in window, and, with live Stripe keys, built and in the
// game). Test mode sells every available item.
export async function onSaleFromServer(): Promise<{ on_sale: string[]; livemode: boolean } | null> {
  if (!CONFIG.live) return null;
  try {
    const r = await fetch(`${CONFIG.supabaseUrl}/functions/v1/create-checkout`, { headers: sbHeaders(null, false) });
    return r.ok ? await r.json() as { on_sale: string[]; livemode: boolean } : null;
  } catch { return null; }
}
