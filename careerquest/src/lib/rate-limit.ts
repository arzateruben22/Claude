import "server-only";

/**
 * In-memory sliding-window rate limiter. Suitable for a single Node process (local/dev or a
 * single container). For multi-instance deployments swap the store for Redis; the API is the same.
 */
type Bucket = { hits: number[]; };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > windowMs * 2) {
    for (const [k, b] of buckets) {
      b.hits = b.hits.filter((t) => now - t < windowMs);
      if (b.hits.length === 0) buckets.delete(k);
    }
    lastSweep = now;
  }
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export async function clientKey(prefix: string): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local").split(",")[0]!.trim();
    return `${prefix}:${ip}`;
  } catch {
    return `${prefix}:local`;
  }
}
