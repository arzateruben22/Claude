// stripe-webhook: Stripe tells the server what was paid, refunded or cancelled; this writes it down. It is the only
// writer of purchases and entitlements (with the service role; players can only read their own rows).
//
//   checkout.session.completed (and .async_payment_succeeded): record the purchase once (stripe_session_id is
//     unique, so a redelivered event changes nothing) and grant what the server's catalog says the sku grants.
//     A founder item (a `window`) is honoured when Stripe created its Checkout Session inside the window, even if
//     it is paid after the deadline; a session created after it (which create-checkout never makes) grants nothing,
//     is recorded as 'refused' and is refunded in full. A numbered sku (`serial`, the OC Hypercar Founder Edition)
//     then gets its number from the database (migration 0002's assign_serial): one per Checkout Session, so a
//     retried delivery gets the same number back, written to the entitlement rows. A second one for a player who
//     already holds a live number (two checkouts opened side by side) gets no number: assign_serial marks it
//     'refused' and it is refunded in full. A delivery for a purchase refunded since takes back anything a delivery
//     racing that refund granted.
//   charge.refunded (a full refund): mark the purchase refunded and take back its grants, except any that another
//     paid purchase of yours also grants (a refunded Founder Pack leaves the Coast paints you bought on their own).
//     Marking it refunded retires its serial, if it had one (a trigger in 0002): that number is never issued again,
//     and the entitlement rows go back to the player's lowest live number, or none. Stripe doesn't promise the order
//     of events: a refund that arrives before its checkout.session.completed finds no purchase, so it asks Stripe
//     for the Checkout Session behind the payment and records the purchase as refunded; the completion that follows
//     then reads 'refunded' and grants nothing. A charge with no Checkout Session isn't ours: 200 and ignored.
//   customer.subscription.deleted: mark the club purchase ended and take back its while-subscribed grants (the
//     club badge, early builds); the club paints you received stay yours.
//   anything else: 200 and ignored.
//
// Every delivery is checked first: Stripe-Signature, HMAC-SHA256 with STRIPE_WEBHOOK_SECRET and a 300 s timestamp
// tolerance (_shared/stripe-signature.ts). A failed check is a 400 and nothing is written. A database failure is a
// 500, so Stripe retries (for up to three days in live mode). Deploy with --no-verify-jwt: Stripe sends no
// Supabase token, the signature is the check.
import { verifyStripeSignature } from '../_shared/stripe-signature.ts';
import { SKUS, skuById, inWindow, rest, stripe, env } from '../_shared/store.ts';

const ok = (body: unknown = { received: true }) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, msg: string) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Purchase { id: string; user_id: string; sku: string; status: string }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'POST only');
  const raw = await req.text();
  const v = await verifyStripeSignature(raw, req.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET'));
  if (!v.ok) { console.warn('webhook: signature check failed:', v.reason); return fail(400, 'bad signature'); }

  let event: { id: string; type: string; livemode: boolean; created?: number; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(raw); } catch { return fail(400, 'bad json'); }
  const o = event.data?.object ?? {};
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return await completed(o, event.created);
      case 'charge.refunded':
        return await refunded(o);
      case 'customer.subscription.deleted':
        return await subscriptionEnded(o);
      default:
        return ok({ received: true, ignored: event.type });
    }
  } catch (e) {
    console.error('webhook:', event.type, event.id, e);
    return fail(500, 'not recorded; Stripe will retry');
  }
});

async function completed(s: Record<string, unknown>, eventCreated?: number) {
  // a delayed payment method (a bank debit) completes the session unpaid and pays later, in async_payment_succeeded
  if (s.payment_status !== 'paid') return ok({ received: true, waiting: s.payment_status });
  const meta = (s.metadata ?? {}) as Record<string, string>;
  const user = String(s.client_reference_id ?? ''), item = skuById(meta.sku);
  if (!UUID.test(user) || !item) { console.error('webhook: session without a user or a known sku', s.id, meta.sku); return ok({ received: true, ignored: 'unknown user or sku' }); }

  // the founder window: judged by when Stripe created the session (Stripe's clock), never by when it was paid
  const createdSec = typeof s.created === 'number' ? s.created : typeof eventCreated === 'number' ? eventCreated : Math.floor(Date.now() / 1000);
  if (!inWindow(item, createdSec * 1000)) return await outsideWindow(s, user, item.sku, item.currency);

  const ins = await rest('POST', 'purchases?on_conflict=stripe_session_id', {
    user_id: user, sku: item.sku, stripe_session_id: s.id,
    stripe_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null,
    stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
    amount_cents: Number(s.amount_total ?? 0), currency: String(s.currency ?? item.currency),
    status: 'paid', roll_name: item.sku === 'founder-pack-2026' ? meta.roll_name ?? null : null,
  }, 'resolution=ignore-duplicates,return=minimal');
  if (!ins.ok) throw new Error(`purchase insert ${ins.status} ${JSON.stringify(ins.data)}`);

  // read it back: a redelivery of an event for a purchase refunded since must not grant again
  const row = await rest<Purchase[]>('GET', `purchases?stripe_session_id=eq.${encodeURIComponent(String(s.id))}&select=id,user_id,sku,status`);
  if (!row.ok) throw new Error(`purchase read ${row.status}`);
  const p = row.data[0];
  // refused earlier by assign_serial (a second Founder Edition): this is a retry, so make sure the refund went through
  if (p?.status === 'refused') return await refundRefused(s, item.sku, 'already holds a live Founder Edition number', `founder-duplicate-${String(s.id)}`);
  if (p?.status !== 'paid') {
    // refunded since: a delivery that raced the refund may have granted after the refund took things back (its
    // assign_serial then refused, and Stripe retried), so take back again; idempotent, and it keeps whatever another
    // paid purchase grants
    if (p?.status === 'refunded') await takeBack(p.user_id, item.grants);
    return ok({ received: true, skipped: p?.status ?? 'missing' });
  }

  const now = new Date().toISOString();
  const up = await rest('POST', 'entitlements?on_conflict=user_id,entitlement',
    item.grants.map((g) => ({ user_id: user, entitlement: g, sku: item.sku, granted_at: now, revoked_at: null })),
    'resolution=merge-duplicates,return=minimal');
  if (!up.ok) throw new Error(`entitlements upsert ${up.status} ${JSON.stringify(up.data)}`);

  // the Founder Edition's number: issued by the database once per purchase (a retry gets the same one back). null:
  // refused, because this player already holds a live number (the grants above are the ones they already own)
  if (item.serial) {
    const n = await rest<number | null>('POST', 'rpc/assign_serial', { p_purchase: p.id });
    if (n.ok && n.data === null) return await refundRefused(s, item.sku, 'already holds a live Founder Edition number', `founder-duplicate-${String(s.id)}`);
    if (!n.ok || typeof n.data !== 'number') throw new Error(`assign_serial ${n.status} ${JSON.stringify(n.data)}`);
    return ok({ received: true, granted: item.grants.length, serial: n.data });
  }
  return ok({ received: true, granted: item.grants.length });
}

// Paid for a founder item through a session created after the window closed: grant nothing, number nothing, record
// it as 'refused' and refund it in full.
async function outsideWindow(s: Record<string, unknown>, user: string, sku: string, currency: string) {
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : '';
  const ins = await rest('POST', 'purchases?on_conflict=stripe_session_id', {
    user_id: user, sku, stripe_session_id: s.id, stripe_payment_intent: pi || null,
    amount_cents: Number(s.amount_total ?? 0), currency: String(s.currency ?? currency), status: 'refused',
  }, 'resolution=ignore-duplicates,return=minimal');
  if (!ins.ok) throw new Error(`purchase insert ${ins.status} ${JSON.stringify(ins.data)}`);
  console.warn('webhook: founder window closed before this session was created; refunding', s.id, sku);
  return await refundRefused(s, sku, 'outside the founder window', `founder-window-${String(s.id)}`, 'founder window closed before checkout');
}

// Refund a refused purchase in full (outside the founder window, or a second Founder Edition for the same player).
// The idempotency key is the session, so a retried delivery never refunds twice (and one after Stripe's 24-hour key
// memory finds it already refunded); a failed refund is a 500, so Stripe retries until it goes through.
async function refundRefused(s: Record<string, unknown>, sku: string, refused: string, key: string, why = refused) {
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : '';
  if (pi) {
    const r = await stripe('POST', 'refunds', { payment_intent: pi, metadata: { sku, why } }, key);
    // Stripe keeps an idempotency key for 24 hours: a retry after that asks again and is told it's already refunded
    const code = (r.data.error as { code?: string } | undefined)?.code;
    if (!r.ok && code !== 'charge_already_refunded') throw new Error(`refund ${r.status} ${r.data.error?.message ?? ''}`);
  }
  return ok({ received: true, refused, refunded: !!pi });
}

async function refunded(c: Record<string, unknown>) {
  if (c.refunded !== true) return ok({ received: true, ignored: 'partial refund' });     // only a full refund takes items back
  const pi = typeof c.payment_intent === 'string' ? c.payment_intent : '';
  if (!pi) return ok({ received: true, ignored: 'no payment intent' });
  const found = await rest<Purchase[]>('GET', `purchases?stripe_payment_intent=eq.${encodeURIComponent(pi)}&select=id,user_id,sku,status`);
  if (!found.ok) throw new Error(`purchase read ${found.status}`);
  const p = found.data[0] ?? await refundedFirst(pi);
  if (!p) return ok({ received: true, ignored: 'no checkout session for this charge' });
  if (p.status !== 'refunded') {
    // for a numbered sku this also retires its serial (the purchases_retire_serial trigger, migration 0002)
    const r = await rest('PATCH', `purchases?id=eq.${p.id}`, { status: 'refunded', refunded_at: new Date().toISOString() }, 'return=minimal');
    if (!r.ok) throw new Error(`purchase update ${r.status}`);
  }
  // a 'refused' purchase (outside the founder window) was never granted anything, so there is nothing to take back
  if (p.status !== 'refused') await takeBack(p.user_id, skuById(p.sku)?.grants ?? []);
  if (skuById(p.sku)?.serial) {
    const sr = await rest<{ serial: number; retired_at: string | null }[]>('GET', `serials?purchase_id=eq.${p.id}&select=serial,retired_at`);
    if (!sr.ok) throw new Error(`serial read ${sr.status}`);
    return ok({ received: true, refunded: p.sku, retired: sr.data[0]?.serial ?? null });
  }
  return ok({ received: true, refunded: p.sku });
}

// The refund arrived before the completion (Stripe doesn't promise the order): find the Checkout Session behind the
// payment and record its purchase as refunded, so the completion that follows reads 'refunded' and grants nothing.
// Returns the purchase row (the completion's own, if it was written in the meantime), or null for a charge that no
// Checkout Session of ours made. A failed lookup is a 500, so Stripe retries.
async function refundedFirst(pi: string): Promise<Purchase | null> {
  const r = await stripe<{ data?: Record<string, unknown>[] }>('GET', 'checkout/sessions', { payment_intent: pi, limit: 1 });
  if (!r.ok) throw new Error(`session lookup ${r.status} ${r.data.error?.message ?? ''}`);
  const s = r.data.data?.[0];
  if (!s) return null;
  const meta = (s.metadata ?? {}) as Record<string, string>;
  const user = String(s.client_reference_id ?? ''), item = skuById(meta.sku);
  if (!UUID.test(user) || !item) return null;
  const ins = await rest('POST', 'purchases?on_conflict=stripe_session_id', {
    user_id: user, sku: item.sku, stripe_session_id: s.id, stripe_payment_intent: pi,
    stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
    amount_cents: Number(s.amount_total ?? 0), currency: String(s.currency ?? item.currency),
    status: 'refunded', refunded_at: new Date().toISOString(),
  }, 'resolution=ignore-duplicates,return=minimal');
  if (!ins.ok) throw new Error(`purchase insert ${ins.status} ${JSON.stringify(ins.data)}`);
  console.warn('webhook: refund arrived before the checkout completed; recorded as refunded', s.id, item.sku);
  const row = await rest<Purchase[]>('GET', `purchases?stripe_session_id=eq.${encodeURIComponent(String(s.id))}&select=id,user_id,sku,status`);
  if (!row.ok) throw new Error(`purchase read ${row.status}`);
  return row.data[0] ?? null;
}

async function subscriptionEnded(sub: Record<string, unknown>) {
  const id = String(sub.id ?? '');
  const found = await rest<Purchase[]>('GET', `purchases?stripe_subscription_id=eq.${encodeURIComponent(id)}&select=id,user_id,sku,status`);
  if (!found.ok) throw new Error(`purchase read ${found.status}`);
  if (!found.data.length) return ok({ received: true, ignored: 'no purchase for this subscription' });
  for (const p of found.data) {
    if (p.status === 'paid') {
      const r = await rest('PATCH', `purchases?id=eq.${p.id}`, { status: 'ended' }, 'return=minimal');
      if (!r.ok) throw new Error(`purchase update ${r.status}`);
    }
    await takeBack(p.user_id, skuById(p.sku)?.while_subscribed ?? []);
  }
  return ok({ received: true, ended: id });
}

// revoke these grants, unless another of the user's paid purchases grants them too
async function takeBack(user: string, grants: string[]) {
  if (!grants.length) return;
  const paid = await rest<{ sku: string }[]>('GET', `purchases?user_id=eq.${user}&status=eq.paid&select=sku`);
  if (!paid.ok) throw new Error(`purchases read ${paid.status}`);
  const covered = new Set(paid.data.flatMap((p) => SKUS.find((s) => s.sku === p.sku)?.grants ?? []));
  const revoke = grants.filter((g) => !covered.has(g));
  if (!revoke.length) return;
  const list = revoke.map((g) => `"${g.replace(/"/g, '')}"`).join(',');
  const r = await rest('PATCH', `entitlements?user_id=eq.${user}&entitlement=in.(${encodeURIComponent(list)})&revoked_at=is.null`, { revoked_at: new Date().toISOString() }, 'return=minimal');
  if (!r.ok) throw new Error(`entitlements revoke ${r.status}`);
}
