// The frame-time governor (SMOOTH, owner 2026-11-16: "how do we make the fps stay high and keep gameplay smooth with
// high graphics setting chosen"). It replaces the old resolution-only step: Settings' "Adaptive quality" is its switch.
//
// It aims at 60 fps (16.7 ms a frame), or a steady 30 where the device can't hold 60 (the graphics check said so, or
// the whole ladder is down and frames still miss). Over a rolling window of frames, with hysteresis:
// - a step DOWN after STEP.downS of frames more than 10 % over the budget;
// - a step UP after STEP.upS holding the target with 25 % headroom (the frame's own work under 75 % of the budget: a
//   display locked to 60 Hz shows every frame at 16.7 ms however light it is, so the interval alone can't show room);
// - one step at a time, a settle after each (the window starts afresh), hitches (a world rebuild, a tab switch) ignored;
// - a step up that has to come back down within STEP.bounceS counts as a bounce, and each bounce makes the next step up
//   wait 4x longer (4 s, 16 s, 64 s). Bounces are forgotten only once a step up has HELD for STEP.quietS (the clock
//   that forgets them stops while a retry is waiting, so the long waits are real). A rung that bounces twice is
//   blocked: no step back up through it for STEP.blockS (doubling each time it bounces again), or until a new ladder
//   (the preset, the mode or the world changes). So a scene that is light on the CPU but heavy on the graphics chip
//   settles after at most two bounces instead of popping an effect on and off every minute or two.
// - a display or browser that caps the frame rate (iOS Low Power Mode, a battery saver, a throttled iframe, a 50 Hz
//   screen) is not load: when the window's frames sit steady at 30, 40 or 50 fps, the frame's own work is under half
//   the interval and this device has never shown faster frames, the governor judges against the cap (no steps down,
//   no 30 <-> 60 cycling). Until a GPU timer feeds `gpuMs`, a graphics chip that holds the game at exactly 30 from
//   every frame it has drawn (the menu, a pause and a venue count: record()) looks the same as a 30 Hz cap; it then
//   keeps a steady 30, as the brief's fallback does.
//
// The ladder is the game's (Game.govRungs, from the preset): costliest first and smallest visible loss first: ambient
// occlusion off, the shadow map down one size, MSAA off, bloom off, draw distance -20 %, scenery density -25 %, traffic
// one density step, then the render scale in 5 % steps down to the floor (settings.ts GOV_FLOOR). Up is the reverse.
//
// tick() runs once a frame and allocates nothing (typed arrays and numbers only); the strings it makes are the last
// action's text, made only when it acts. The hooks the SMOOTH CORE lane fills: tick's `gpuMs` (a GPU timer query's
// time, when there is one, counts toward the headroom), and each rung's cost level, which Game.applyGov sets on the
// effect it names (an effect can take more levels than on/off: Game.govLevels says how many each has).

export type RungId = 'ao' | 'shadow' | 'msaa' | 'bloom' | 'draw' | 'props' | 'traffic' | 'scale';
export interface Rung { id: RungId; text: string; up: string }   // what the step down does ("AO off"), and the step back up ("AO on")

export const T60 = 1000 / 60, T30 = 1000 / 30;
export const STEP = {
  over: 1.1,          // a window mean more than 10 % over the budget is a miss (18.3 ms at 60)
  hold: 1.04,         // holding the target: the window mean within 4 % of it
  headroom: 0.75,     // 25 % headroom: the frame's work under 75 % of the budget (12.5 ms at 60)
  downS: 1,           // seconds of misses before a step down
  upS: 4,             // seconds of headroom before a step up (times 4 per bounce)
  settleS: 0.5,       // after an action, frames aren't judged for this long (a new pass compiles, buffers resize)
  bounceS: 10,        // a step down this soon after a step up is a bounce
  quietS: 120,        // bounces are forgotten once a step up has held this long (not while a retry waits)
  blockS: 1200,       // a rung that bounced twice: no step back up through it for this long (doubling after that)
  capLight: 0.5,      // a cap, not load: the frame's work under this share of the interval
  capTol: 0.04,       // ... and the window's mean within 4 % of a cap's interval, its frames within 1.5 ms (or 6 %)
  hitchMs: 250,       // a frame longer than this is a hitch (a rebuild, a tab coming back), not load
  to30S: 3,           // at the bottom of the ladder, this long still missing 60: aim at a steady 30
  back60S: 20,        // at 30 with the ladder all the way up and headroom this long: try 60 again (doubles each time)
};
const WIN = 30;       // frames in the rolling window (half a second at 60)
export const RING = 240;   // frames kept for the overlay's graph and 1 % low (4 s at 60)
const MAXR = 64;      // rungs a ladder may have (the per-rung bounce counts)
// the frame intervals displays and browsers cap at (30, 40 and 50 fps), and the one `ms` sits at (within STEP.capTol),
// or 0. The graphics check uses it too (a check whose every round sits at a cap says nothing about the device)
const CAPS = [1000 / 30, 1000 / 40, 1000 / 50];
export function capPeriod(ms: number): number {
  for (const c of CAPS) if (Math.abs(ms - c) <= c * STEP.capTol) return c;
  return 0;
}

export class FrameGovernor {
  rungs: Rung[] = [];
  level = 0;                         // rungs applied, from the top of the ladder
  target = T60;                      // the frame budget, ms
  lock30 = false;                    // the graphics check found this device can't hold 60 at any preset
  // what it did last, for the overlay ("AO off: frame 22 ms"), when (clock seconds), and how many actions so far
  last = ''; lastAt = -1; actions = 0;
  clock = 0;                         // seconds the governor has run (not paused, not hidden)
  bounces = 0;
  capMs = 0;                         // a display/browser cap the frames sit at (ms), or 0: judged against it, not stepped for
  private minMean = 1e9;             // the fastest mean this device has shown, judged or not (a cap: it never went faster)
  private rec = new Float32Array(10); private ri = 0; private rn = 0; private rsum = 0;   // record()'s last 10 frames
  private rb = new Uint8Array(MAXR);           // bounces per rung
  private blockUntil = new Float64Array(MAXR); // a rung's step up is blocked until this clock time
  private upHeld = false; private heldT = 0;   // the last step up still stands, and for how long
  // every frame's interval and work, ms, for the overlay (a ring: `head` is the next slot, `filled` how many are real)
  readonly ring = new Float32Array(RING);
  readonly workRing = new Float32Array(RING);
  head = 0; filled = 0;
  // the rolling window
  private win = new Float32Array(WIN); private wwin = new Float32Array(WIN);
  private wi = 0; private wn = 0; private sum = 0; private wsum = 0;
  private overT = 0; private underT = 0; private settle = 0; private sinceUp = 1e9;
  private back60 = STEP.back60S; private tried60 = false;
  // the window's means at the last decision, for the overlay
  mean = 0; workMean = 0;

  private apply: (level: number) => void;
  constructor(apply: (level: number) => void) { this.apply = apply; }

  // a new ladder (the preset changed): back to the top of it, at 60 unless the check locked 30
  reset(rungs: Rung[], level = 0) {
    this.rungs = rungs; this.level = Math.min(level, rungs.length);
    this.target = this.lock30 ? T30 : T60;
    this.bounces = 0; this.back60 = STEP.back60S; this.sinceUp = 1e9; this.tried60 = false;
    this.upHeld = false; this.heldT = 0; this.rb.fill(0); this.blockUntil.fill(0); this.capMs = 0;
    this.restart();
  }
  // forget what this display has shown (a test feeding made-up frames from a clean slate)
  forgetDisplay() { this.minMean = 1e9; this.capMs = 0; this.ri = 0; this.rn = 0; this.rsum = 0; }
  // a rung's step up is blocked (it bounced twice): the overlay and tests read it
  blocked(i: number) { return i >= 0 && i < MAXR && this.clock < this.blockUntil[i]; }
  // the window starts afresh (after an action, a rebuild, a pause): nothing is judged until it fills again
  restart(settle = STEP.settleS) {
    this.wi = 0; this.wn = 0; this.sum = 0; this.wsum = 0; this.overT = 0; this.underT = 0; this.settle = settle;
  }

  // the frame's budget the window is judged against (16.7 or 33.3 ms)
  get fps() { return this.capMs > this.target ? Math.round(1000 / this.capMs) : this.target === T30 ? 30 : 60; }

  // every drawn frame, governor on or off (the overlay's graph, fps and 1 % low): its interval and work, ms
  record(intervalMs: number, workMs: number) {
    const r = this.head;
    this.ring[r] = intervalMs; this.workRing[r] = workMs;
    this.head = (r + 1) % RING; if (this.filled < RING) this.filled++;
    // the fastest 10 frames in a row anywhere (the menu, a pause, a venue): evidence the display isn't capped
    if (!(intervalMs > 0) || intervalMs > STEP.hitchMs) return;
    if (this.rn === 10) this.rsum -= this.rec[this.ri]; else this.rn++;
    this.rec[this.ri] = intervalMs; this.rsum += intervalMs; this.ri = (this.ri + 1) % 10;
    if (this.rn === 10 && this.rsum / 10 < this.minMean) this.minMean = this.rsum / 10;
  }

  // one frame: its interval (rAF to rAF) and its own work (the frame function's time), ms. Returns -1 after a step
  // down, 1 after a step up, 2 after a change of target, 0 otherwise. `gpuMs` (-1: none) is the hook for a GPU timer
  // query. Time here is the frames' own (their intervals), so a test can feed it frames faster than real time.
  private slowRun = 0;
  tick(intervalMs: number, workMs: number, gpuMs = -1): number {
    if (!(intervalMs > 0)) return 0;
    // one or two frames over STEP.hitchMs are a hitch (a rebuild, a tab coming back): skipped. More in a row are load
    if (intervalMs > STEP.hitchMs) { if (++this.slowRun <= 2) return 0; intervalMs = Math.min(intervalMs, 1000); } else this.slowRun = 0;
    const dt = Math.min(0.5, intervalMs / 1000);
    this.clock += dt; this.sinceUp += dt;
    // bounces are forgotten only after a step up has held (a retry waiting doesn't count)
    if (this.upHeld) { this.heldT += dt; if (this.heldT > STEP.quietS && this.bounces) { this.bounces = 0; this.rb.fill(0); } }
    const w = gpuMs >= 0 ? Math.max(workMs, gpuMs) : workMs;
    // the window
    if (this.wn === WIN) { this.sum -= this.win[this.wi]; this.wsum -= this.wwin[this.wi]; } else this.wn++;
    this.win[this.wi] = intervalMs; this.wwin[this.wi] = w; this.sum += intervalMs; this.wsum += w;
    this.wi = (this.wi + 1) % WIN;
    if (this.settle > 0) { this.settle -= dt; if (this.settle > 0) return 0; this.wn = 0; this.wi = 0; this.sum = 0; this.wsum = 0; return 0; }
    if (this.wn < WIN) return 0;
    const mean = this.sum / WIN, wmean = this.wsum / WIN;
    this.mean = mean; this.workMean = wmean;
    const light = wmean < mean * STEP.capLight;
    // a cap: judged at the 60 target only (at 30 the game paces its own frames), steady frames at a cap's interval,
    // light work, and never faster on this device; it lifts when the frames get faster or the work heavy
    if (this.target === T60) {
      if (this.capMs) { if (mean < this.capMs * 0.85 || !light) this.capMs = 0; }
      else if (light) {
        const c = capPeriod(mean);
        if (c && this.minMean > c * 0.8) {
          let lo = 1e9, hi = 0;
          for (let i = 0; i < WIN; i++) { const v = this.win[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
          if (hi - lo <= Math.max(1.5, c * 0.06)) { this.capMs = c; this.overT = 0; }
        }
      }
    } else this.capMs = 0;
    if (mean < this.minMean) this.minMean = mean;
    const T = Math.max(this.target, this.capMs);
    if (mean > T * STEP.over) { this.overT += dt; this.underT = 0; }
    else { this.overT = 0; if (mean <= T * STEP.hold && wmean <= T * STEP.headroom) this.underT += dt; else this.underT = 0; }
    if (this.overT >= STEP.downS) {
      // a try at 60 from the top of the ladder (back60) that misses with light work: back to a steady 30 at once,
      // without walking the ladder (the frames were 30 either way; nothing the player sees changes)
      if (this.tried60 && this.target === T60 && this.level === 0 && light) {
        this.tried60 = false; this.target = T30; this.back60 = Math.min(600, this.back60 * 2);
        this.act('30 fps target', mean);
        return 2;
      }
      this.tried60 = false;
      if (this.level < this.rungs.length) {
        const i = this.level, rung = this.rungs[i];
        this.level++;
        if (this.upHeld && this.sinceUp < STEP.bounceS) {
          this.bounces++;
          if (i < MAXR && ++this.rb[i] >= 2) this.blockUntil[i] = this.clock + STEP.blockS * Math.pow(2, Math.min(4, this.rb[i] - 2));
        }
        this.upHeld = false;
        this.act(rung.text, mean);
        return -1;
      }
      if (this.target === T60 && this.overT >= STEP.to30S) {
        this.target = T30; this.act('30 fps target', mean);
        return 2;
      }
      return 0;
    }
    const need = STEP.upS * Math.pow(4, Math.min(3, this.bounces));
    if (this.underT >= need && this.level > 0 && !this.blocked(this.level - 1)) {
      this.level--;
      this.sinceUp = 0; this.upHeld = true; this.heldT = 0;
      this.act(this.rungs[this.level].up, mean);
      return 1;
    }
    if (this.target === T30 && !this.lock30 && this.level === 0 && this.underT >= this.back60) {
      this.target = T60; this.sinceUp = 0; this.back60 = Math.min(600, this.back60 * 2); this.tried60 = true;
      this.act('60 fps target', mean);
      return 2;
    }
    return 0;
  }

  private act(text: string, mean: number) {
    this.apply(this.level);
    this.last = `${text}: frame ${Math.round(mean)} ms`; this.lastAt = this.clock; this.actions++;
    this.restart();
  }

  // 1 % low over the ring, as fps: the 99th percentile frame interval. For the overlay, a few times a second (it
  // sorts a copy into `scratch`, made once)
  private scratch = new Float32Array(RING);
  low1(): number {
    const n = this.filled; if (n < 10) return 0;
    for (let i = 0; i < n; i++) this.scratch[i] = this.ring[i];
    const s = this.scratch.subarray(0, n); s.sort();
    const p99 = s[Math.min(n - 1, Math.floor(n * 0.99))];
    return p99 > 0 ? 1000 / p99 : 0;
  }
  // the mean fps over the ring's last `k` frames
  fpsOver(k = 60): number {
    const n = Math.min(k, this.filled); if (!n) return 0;
    let s = 0; for (let i = 1; i <= n; i++) s += this.ring[(this.head - i + RING) % RING];
    return s > 0 ? (1000 * n) / s : 0;
  }
}
