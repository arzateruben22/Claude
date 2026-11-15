// S4: the venue's sound events (PROJECT_OC_SPORTS_BAR.md, "Audio (all made in code)"). The modules where a sound
// happens emit it here: the crowd's reactions (crowd.ts), the games' clicks, cushions, pots, darts and pucks
// (games.ts). The page's audio (audio.ts) drains the ring once a frame and plays each as a code-made one-shot. A fixed
// ring of 64 events, filled in place: no allocation, and with no audio running it simply wraps.
export type SfxKind = 'click' | 'cushion' | 'pot' | 'thunk' | 'slide' | 'clack' | 'cheer' | 'groan' | 'clap' | 'clink' | 'bell' | 'chime' | 'spark' | 'tick';
export interface SfxEvent { kind: SfxKind; x: number; z: number; k: number; delay: number }
const N = 64;
const ring: SfxEvent[] = Array.from({ length: N }, () => ({ kind: 'tick' as SfxKind, x: 0, z: 0, k: 0, delay: 0 }));
let head = 0, tail = 0;
/** a sound at (x, z) local metres (NaN for the interface's own, unplaced), at level k, after delay seconds */
export function sfx(kind: SfxKind, x: number, z: number, k = 1, delay = 0) {
  const e = ring[head % N]; e.kind = kind; e.x = x; e.z = z; e.k = k; e.delay = delay;
  head++; if (head - tail > N) tail = head - N;
}
/** every event since the last drain, oldest first */
export function drainSfx(fn: (e: SfxEvent) => void) { while (tail < head) { fn(ring[tail % N]); tail++; } }
