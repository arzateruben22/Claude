// What both Edge Functions share: the server's catalog (synced from the game by `npm run store:sync`), the rule for
// what may be sold, Supabase's REST API as the service role, and Stripe's API, all with fetch. No SDKs.
// Secrets come from the function's environment only (server/README.md lists them); none is ever sent to the page.
import catalogFile from './catalog.json' with { type: 'json' };
import { formEncode } from './form.ts';

export interface ServerSku {
  sku: string;
  name: string;
  kind: string;
  price_cents: number;
  currency: string;
  mode: 'payment' | 'subscription';
  interval?: 'month' | 'year';
  window?: { until: string };
  serial?: boolean;                 // the webhook numbers each sale (migration 0002's assign_serial)
  custom_amount?: { minimum_cents: number; preset_cents: number; maximum_cents: number };
  grants: string[];
  available: boolean;
  grants_ready: boolean;
  while_subscribed: string[];
}
export const SKUS: ServerSku[] = (catalogFile as { skus: ServerSku[] }).skus;
// the one founder window (src/store/founder.json, copied here by `npm run store:sync`): the founder items' windows
export const FOUNDER_UNTIL: string = (catalogFile as { founder_until: string }).founder_until;
export const skuById = (id: unknown) => (typeof id === 'string' ? SKUS.find((s) => s.sku === id) ?? null : null);

export const env = (k: string) => Deno.env.get(k) ?? '';
const stripeKey = () => env('STRIPE_SECRET_KEY');
// a live secret (sk_live_) or restricted (rk_live_) key means real money
export const stripeLive = () => /^(sk|rk)_live_/.test(stripeKey());

// May this sku be sold now? Available, inside its window, and, with live Stripe keys, every grant built and in the
// game ('ready' in cosmetics.json): CLAUDE.md's "nothing is sold before it exists in the game". With test keys
// (sk_test_), every available item can be bought, so the whole flow can be tried end to end.
export function sellable(s: ServerSku | null, now = Date.now()): { ok: true } | { ok: false; why: string } {
  if (!s) return { ok: false, why: 'That item is not in the store.' };
  if (!s.available) return { ok: false, why: 'Not on sale yet: it goes on sale once it is in the game.' };
  if (!inWindow(s, now)) return { ok: false, why: `${s.name} is no longer sold.` };
  if (stripeLive() && !s.grants_ready) return { ok: false, why: 'Not on sale yet: it goes on sale once it is in the game.' };
  return { ok: true };
}

// Inside the item's sales window at this moment? create-checkout asks with the time now; the webhook asks with the
// time Stripe created the Checkout Session, so a checkout started before the deadline and paid after it is honoured.
export const inWindow = (s: ServerSku, atMs: number) => !s.window || atMs <= Date.parse(s.window.until);

// ------------------------------------------------------------------------------------------- HTTP
const allowed = () => {
  const list = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length) return list;
  try { return [new URL(env('SITE_URL')).origin]; } catch { return []; }
};
export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const ok = allowed().includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed()[0] ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}
export const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

// ------------------------------------------------------------------------------------------- Supabase (service role)
// The function's own service-role key (Supabase sets SUPABASE_SERVICE_ROLE_KEY in every function; a newer secret
// key can be set as STORE_SERVICE_KEY instead). It bypasses row-level security, so it lives only here.
const sbUrl = () => env('SUPABASE_URL').replace(/\/+$/, '');
const serviceKey = () => env('STORE_SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
function sbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const k = serviceKey();
  const h: Record<string, string> = { apikey: k, 'Content-Type': 'application/json', ...extra };
  if (k.startsWith('eyJ')) h.Authorization = `Bearer ${k}`;          // a legacy JWT key also goes in Authorization
  return h;
}
export async function rest<T = unknown>(method: string, path: string, body?: unknown, prefer?: string): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(`${sbUrl()}/rest/v1/${path}`, { method, headers: sbHeaders(prefer ? { Prefer: prefer } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data: data as T };
}

// The signed-in player behind a request: Supabase Auth checks the access token (signature, expiry, not signed
// out) and answers with the user. Works with legacy and new API keys alike.
export async function userFrom(req: Request): Promise<{ id: string; email: string } | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '');
  if (!m) return null;
  const apikey = env('SUPABASE_ANON_KEY') || serviceKey();
  const r = await fetch(`${sbUrl()}/auth/v1/user`, { headers: { apikey, Authorization: `Bearer ${m[1]}` } });
  if (!r.ok) return null;
  const u = await r.json() as { id?: string; email?: string };
  return u.id ? { id: u.id, email: u.email ?? '' } : null;
}

// ------------------------------------------------------------------------------------------- Stripe
// idempotencyKey: Stripe performs a POST with the same key once, however often it is sent (a webhook retry)
export async function stripe<T = Record<string, unknown>>(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<{ ok: boolean; status: number; data: T & { error?: { message?: string } } }> {
  const qs = formEncode(params);
  const headers: Record<string, string> = { Authorization: `Bearer ${stripeKey()}` };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (env('STRIPE_API_VERSION')) headers['Stripe-Version'] = env('STRIPE_API_VERSION');
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const r = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && qs ? '?' + qs : ''}`, { method, headers, body: method === 'POST' ? qs : undefined });
  return { ok: r.ok, status: r.status, data: await r.json() };
}
