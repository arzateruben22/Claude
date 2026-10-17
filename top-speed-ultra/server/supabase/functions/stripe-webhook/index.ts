// stripe-webhook: Stripe tells the server what was paid, refunded or cancelled; this writes it down. It is the only
// writer of purchases and entitlements (with the service role; players can only read their own rows).
//
//   checkout.session.completed (and .async_payment_succeeded): record the purchase once (stripe_session_id is
//     unique, so a redelivered event changes nothing) and grant what the server's catalog says the sku grants.
//   charge.refunded (a full refund): mark the purchase refunded and take back its grants, except any that another
//     paid purchase of yours also grants (a refunded Founder Pack leaves the Coast paints you bought on their own).
//   customer.subscription.deleted: mark the club purchase ended and take back its while-subscribed grants (the
//     club badge, early builds); the club paints you received stay yours.
//   anything else: 200 and ignored.
//
// Every delivery is checked first: Stripe-Signature, HMAC-SHA256 with STRIPE_WEBHOOK_SECRET and a 300 s timestamp
// tolerance (_shared/stripe-signature.ts). A failed check is a 400 and nothing is written. A database failure is a
// 500, so Stripe retries (for up to three days in live mode). Deploy with --no-verify-jwt: Stripe sends no
// Supabase token, the signature is the check.
import { verifyStripeSignature } from '../_shared/stripe-signature.ts';
import { SKUS, skuById, rest, env } from '../_shared/store.ts';

const ok = (body: unknown = { received: true }) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, msg: string) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Purchase { id: string; user_id: string; sku: string; status: string }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'POST only');
  const raw = await req.text();
  const v = await verifyStripeSignature(raw, req.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET'));
  if (!v.ok) { console.warn('webhook: signature check failed:', v.reason); return fail(400, 'bad signature'); }

  let event: { id: string; type: string; livemode: boolean; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(raw); } catch { return fail(400, 'bad json'); }
  const o = event.data?.object ?? {};
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return await completed(o);
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

async function completed(s: Record<string, unknown>) {
  // a delayed payment method (a bank debit) completes the session unpaid and pays later, in async_payment_succeeded
  if (s.payment_status !== 'paid') return ok({ received: true, waiting: s.payment_status });
  const meta = (s.metadata ?? {}) as Record<string, string>;
  const user = String(s.client_reference_id ?? ''), item = skuById(meta.sku);
  if (!UUID.test(user) || !item) { console.error('webhook: session without a user or a known sku', s.id, meta.sku); return ok({ received: true, ignored: 'unknown user or sku' }); }

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
  if (row.data[0]?.status !== 'paid') return ok({ received: true, skipped: row.data[0]?.status ?? 'missing' });

  const now = new Date().toISOString();
  const up = await rest('POST', 'entitlements?on_conflict=user_id,entitlement',
    item.grants.map((g) => ({ user_id: user, entitlement: g, sku: item.sku, granted_at: now, revoked_at: null })),
    'resolution=merge-duplicates,return=minimal');
  if (!up.ok) throw new Error(`entitlements upsert ${up.status} ${JSON.stringify(up.data)}`);
  return ok({ received: true, granted: item.grants.length });
}

async function refunded(c: Record<string, unknown>) {
  if (c.refunded !== true) return ok({ received: true, ignored: 'partial refund' });     // only a full refund takes items back
  const pi = typeof c.payment_intent === 'string' ? c.payment_intent : '';
  if (!pi) return ok({ received: true, ignored: 'no payment intent' });
  const found = await rest<Purchase[]>('GET', `purchases?stripe_payment_intent=eq.${encodeURIComponent(pi)}&select=id,user_id,sku,status`);
  if (!found.ok) throw new Error(`purchase read ${found.status}`);
  const p = found.data[0];
  if (!p) return ok({ received: true, ignored: 'no purchase for this charge' });
  if (p.status !== 'refunded') {
    const r = await rest('PATCH', `purchases?id=eq.${p.id}`, { status: 'refunded', refunded_at: new Date().toISOString() }, 'return=minimal');
    if (!r.ok) throw new Error(`purchase update ${r.status}`);
  }
  await takeBack(p.user_id, skuById(p.sku)?.grants ?? []);
  return ok({ received: true, refunded: p.sku });
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
