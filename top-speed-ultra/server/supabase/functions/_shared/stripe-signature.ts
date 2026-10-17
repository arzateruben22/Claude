// Stripe webhook signature check with Web Crypto only (no SDK, no imports), so it runs the same in Deno (the
// Supabase Edge Runtime) and in Node (the regression suite tests it against known vectors).
//
// Stripe signs each webhook delivery and sends:  Stripe-Signature: t=<unix seconds>,v1=<hex>[,v1=<hex>][,v0=...]
// The signed payload is `${t}.${raw body}`, the signature is HMAC-SHA256 of it keyed with the endpoint's signing
// secret (the whole "whsec_..." string as UTF-8), in lowercase hex. Several v1 entries can appear while a secret is
// being rolled; any one matching is enough. v0 entries are test-mode legacy and ignored. Stripe's own libraries
// allow a 300 s timestamp tolerance by default, which stops a captured delivery being replayed later.
// (From Stripe's webhook documentation as known on 2026-10-16; docs.stripe.com could not be opened from the build
// machine, so check docs.stripe.com/webhooks#verify-manually at launch.)

const enc = new TextEncoder();

export async function hmacSha256Hex(key: string | Uint8Array, message: string | Uint8Array): Promise<string> {
  const k = typeof key === 'string' ? enc.encode(key) : key;
  const m = typeof message === 'string' ? enc.encode(message) : message;
  const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, m));
  let hex = '';
  for (const b of sig) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export function parseSignatureHeader(header: string): { t: number; v1: string[] } | null {
  let t = NaN;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = Number(v);
    else if (k === 'v1' && /^[0-9a-f]{64}$/i.test(v)) v1.push(v.toLowerCase());
  }
  return Number.isFinite(t) && v1.length ? { t, v1 } : null;
}

// compares every character, so the time taken doesn't say how much of a guess was right
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Verified = { ok: true; timestamp: number } | { ok: false; reason: string };

export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, opts: { toleranceSec?: number; nowSec?: number } = {}): Promise<Verified> {
  if (!secret) return { ok: false, reason: 'no signing secret configured' };
  if (!header) return { ok: false, reason: 'no Stripe-Signature header' };
  const p = parseSignatureHeader(header);
  if (!p) return { ok: false, reason: 'malformed Stripe-Signature header' };
  const tolerance = opts.toleranceSec ?? 300, now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (tolerance > 0 && Math.abs(now - p.t) > tolerance) return { ok: false, reason: 'timestamp outside the tolerance' };
  const expected = await hmacSha256Hex(secret, `${p.t}.${rawBody}`);
  let match = false;
  for (const s of p.v1) if (timingSafeEqualHex(s, expected)) match = true;
  return match ? { ok: true, timestamp: p.t } : { ok: false, reason: 'no matching v1 signature' };
}
