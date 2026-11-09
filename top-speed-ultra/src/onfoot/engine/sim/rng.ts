// Seeded randomness for the life-sim layer (PROJECT_OC_SPORTS_BAR.md, "The Sims-like systems"): every schedule, match,
// start and pick is drawn from a seed, so the same clock and the same seeds give the same room, the same fixtures and
// the same scores twice. Nothing here reads the device's clock or any outside source.

/** a 32-bit hash of a list of integers (or strings), order-sensitive */
export function hash32(...parts: (number | string)[]): number {
  let h = 0x811c9dc5 | 0;
  for (const p of parts) {
    if (typeof p === 'string') { for (let i = 0; i < p.length; i++) { h ^= p.charCodeAt(i); h = Math.imul(h, 0x01000193); } h ^= 0xff; h = Math.imul(h, 0x01000193); continue; }
    let v = Math.floor(p) | 0;
    for (let k = 0; k < 4; k++) { h ^= v & 0xff; h = Math.imul(h, 0x01000193); v >>>= 8; }
  }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}

/** a small fast generator (mulberry32): () => [0, 1) */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rnd = () => number;
export const range = (r: Rnd, a: number, b: number) => a + (b - a) * r();
export const pickOf = <T>(r: Rnd, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
/** a standard normal draw (Box-Muller) */
export function gauss(r: Rnd) { let u = 0; while (u <= 1e-12) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
/** an exponential draw with the given rate */
export const expo = (r: Rnd, rate: number) => -Math.log(1 - r() * 0.999999) / rate;
