import "server-only";

/**
 * In-memory sliding-window rate limiter. Suitable for a single Node process (local/dev or a
 * single container). For multi-instance deployments swap the store for Redis; the API is the same.
 * Memory is bounded: at most MAX_BUCKETS keys are tracked (oldest evicted first).
 */
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
let lastSweep = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) {
      b.hits = b.hits.filter((t) => now - t < windowMs);
      if (b.hits.length === 0) buckets.delete(k);
    }
    lastSweep = now;
  }
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  // Re-insert to keep Map order = least recently used first.
  buckets.delete(key);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  while (buckets.size > MAX_BUCKETS) {
    const first = buckets.keys().next().value;
    if (first === undefined) break;
    buckets.delete(first);
  }
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP. Forwarding headers are client-controlled, so they are only honoured when
 * the app is deployed behind a trusted reverse proxy (TRUST_PROXY=true). In that case the address
 * appended by the proxy (the right-most X-Forwarded-For entry, adjustable with TRUST_PROXY_HOPS)
 * is used. Otherwise all requests share one "direct" bucket, which per-account limits complement.
 */
export function clientIpFromHeaders(h: Headers): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;
  const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS ?? "1") || 1);
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const ip = parts[parts.length - hops];
    if (ip) return ip.slice(0, 64);
  }
  return h.get("x-real-ip")?.trim().slice(0, 64) ?? null;
}

export async function clientKey(prefix: string): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return `${prefix}:${clientIpFromHeaders(h) ?? "direct"}`;
  } catch {
    return `${prefix}:direct`;
  }
}
