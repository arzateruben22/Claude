// create-checkout: the only way into a live purchase.
//
//   GET   -> { livemode, on_sale: [sku...] }   what may be bought right now (the store greys out the rest)
//   POST  { sku, roll_name?, adult_or_guardian, renewal_agreed? }  with the player's Supabase access token
//         -> { url }   Stripe Checkout's hosted page for that one item
//
// The page sends a sku, never a price: the price, the grants, the mode and the window all come from this server's
// copy of the catalog (_shared/catalog.json). Checks, in order: a valid sign-in; the item exists, is available, is
// inside its window and, with live Stripe keys, is built and in the game; the player's profile says 13 or over;
// the 18-or-guardian box was ticked (and, for a subscription, the renewal terms); the player doesn't already own
// everything it grants. Then a Checkout Session: client_reference_id = the user's id, metadata.sku, success and
// cancel URLs from SITE_URL. Deploy with --no-verify-jwt (the function checks the token itself; see README).
import { SKUS, skuById, sellable, stripeLive, cors, json, rest, userFrom, stripe, env } from '../_shared/store.ts';

const ROLL = /^[\p{L}\p{N} .'-]{1,24}$/u;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === 'GET') return json(req, 200, { livemode: stripeLive(), on_sale: SKUS.filter((s) => sellable(s).ok).map((s) => s.sku) });
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' });
  if (!env('STRIPE_SECRET_KEY') || !env('SITE_URL')) return json(req, 503, { error: 'The store is not set up yet.' });

  const user = await userFrom(req);
  if (!user) return json(req, 401, { error: 'Sign in again to buy.' });

  let body: { sku?: unknown; roll_name?: unknown; adult_or_guardian?: unknown; renewal_agreed?: unknown };
  try { body = await req.json(); } catch { return json(req, 400, { error: 'Bad request.' }); }
  const item = skuById(body.sku);
  const sale = sellable(item);
  if (!sale.ok || !item) return json(req, 409, { error: sale.ok ? 'That item is not in the store.' : sale.why });
  if (body.adult_or_guardian !== true) return json(req, 400, { error: 'Tick the box to say you are 18 or over, or that a parent or guardian has said yes.' });
  if (item.mode === 'subscription' && body.renewal_agreed !== true) return json(req, 400, { error: 'Tick the box to agree to the renewal terms.' });

  const prof = await rest<{ is_13_plus: boolean }[]>('GET', `profiles?id=eq.${user.id}&select=is_13_plus`);
  if (!prof.ok) return json(req, 502, { error: 'The store could not check your account. Try again.' });
  if (!prof.data[0]?.is_13_plus) return json(req, 403, { error: 'The store is for players 13 and over.' });

  if (item.kind !== 'tip') {
    const own = await rest<{ entitlement: string }[]>('GET', `entitlements?user_id=eq.${user.id}&revoked_at=is.null&select=entitlement`);
    if (own.ok && item.grants.every((g) => own.data.some((o) => o.entitlement === g))) return json(req, 409, { error: 'You already have everything in this item.' });
  }

  const site = env('SITE_URL'), sep = site.includes('?') ? '&' : '?';
  const roll = item.sku === 'founder-pack-2026' && typeof body.roll_name === 'string' && ROLL.test(body.roll_name.trim()) ? body.roll_name.trim() : undefined;
  const meta = { sku: item.sku, user_id: user.id, roll_name: roll, consent_adult_or_guardian: 'yes', consent_renewal: item.mode === 'subscription' ? 'yes' : undefined };

  let line: Record<string, unknown>;
  if (item.custom_amount) {
    // pay what you want: a Stripe Price with a custom amount, found by its lookup key (made once, then reused)
    const price = await tipPrice(item.sku, item.name, item.currency, item.custom_amount);
    if (!price) return json(req, 502, { error: 'The checkout could not start. Try again.' });
    line = { price, quantity: 1 };
  } else {
    line = {
      quantity: 1,
      price_data: {
        currency: item.currency, unit_amount: item.price_cents,
        product_data: { name: item.name, metadata: { sku: item.sku } },
        recurring: item.mode === 'subscription' ? { interval: item.interval } : undefined,
      },
    };
  }
  const s = await stripe<{ id: string; url: string }>('POST', 'checkout/sessions', {
    mode: item.mode,
    line_items: [line],
    client_reference_id: user.id,
    customer_email: user.email || undefined,
    success_url: `${site}${sep}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${sep}checkout=cancel`,
    metadata: meta,
    payment_intent_data: item.mode === 'payment' ? { metadata: { sku: item.sku, user_id: user.id } } : undefined,
    subscription_data: item.mode === 'subscription' ? { metadata: { sku: item.sku, user_id: user.id } } : undefined,
  });
  if (!s.ok || !s.data.url) {
    console.error('stripe: checkout session failed', s.status, s.data.error?.message);
    return json(req, 502, { error: 'The checkout could not start. Try again in a moment.' });
  }
  return json(req, 200, { url: s.data.url });
});

async function tipPrice(sku: string, name: string, currency: string, a: { minimum_cents: number; preset_cents: number; maximum_cents: number }): Promise<string | null> {
  type Price = { id: string; custom_unit_amount?: { minimum: number; maximum: number; preset: number } | null };
  const found = await stripe<{ data: Price[] }>('GET', 'prices', { lookup_keys: [sku], active: 'true', limit: 1 });
  const p = found.ok ? found.data.data[0] : undefined;
  const same = p?.custom_unit_amount && p.custom_unit_amount.minimum === a.minimum_cents && p.custom_unit_amount.maximum === a.maximum_cents && p.custom_unit_amount.preset === a.preset_cents;
  if (p && same) return p.id;
  // none yet, or the catalog's amounts changed: make one and move the lookup key to it
  const made = await stripe<{ id: string }>('POST', 'prices', {
    currency, lookup_key: sku, transfer_lookup_key: p ? 'true' : undefined,
    custom_unit_amount: { enabled: 'true', minimum: a.minimum_cents, maximum: a.maximum_cents, preset: a.preset_cents },
    product_data: { name, metadata: { sku } },
  });
  if (!made.ok) console.error('stripe: tip price failed', made.status, made.data.error?.message);
  return made.ok ? made.data.id : null;
}
