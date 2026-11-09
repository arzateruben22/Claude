// The background builds on a time budget (PROJECT_OC_SPORTS_BAR.md, "People are slow to build"). Pure bookkeeping, no
// three.js: the caller hands it the next job in its order and it decides whether a build may start now.
//   - At most one build per frame.
//   - A build may start only when the wall-clock time since the last build ended is at least twice the last build's
//     own duration. Builds then take at most a third of the time at any frame rate, and no build waits for a fast frame.
//   - The check and the build are at the same point in the frame: once a frame, at the top of the crowd's update and
//     before the render, the scheduler checks the gap and, if it's met and there's work, starts the build at once.
// Every frame's check is logged (its time, the gap needed, the time since the last build ended, whether the queue had
// work) with the build in it, if any, and every build (who, level, quality, reason, start, duration, frame); the load
// and each change of graphics mark the frame they happen on. S3a's marks are taken from this log (tests/sportsbar-s3a.mjs).

export type BuildReason = 'fill' | 'tap' | 'switch';
export interface BuildJob { who: number; level: 1 | 2; quality: 'phone' | 'high'; reason: BuildReason; run: () => void }
export interface BuildRec { i: number; who: number; level: 1 | 2; quality: 'phone' | 'high'; reason: BuildReason; start: number; dur: number; frame: number; sync: boolean }
export interface FrameRec { f: number; start: number; len: number; build: number; t: number; need: number; since: number; queued: boolean; mark: '' | 'load' | 'switch' }

const KEEP_FRAMES = 6000, KEEP_BUILDS = 3000;

export class BuildScheduler {
  /** the frames' log: a ring of KEEP_FRAMES records reused in place (no allocation a frame); `frames` lists them in order */
  private ring: FrameRec[] = []; private head = 0; private count = 0;
  builds: BuildRec[] = [];
  private lastEnd = -Infinity; private lastDur = 0; private f = 0; private nextMark: FrameRec['mark'] = 'load';
  /** the logged frames, oldest first (a copy, for the reports and the tests) */
  get frames(): FrameRec[] { const out: FrameRec[] = []; const s = (this.head - this.count + KEEP_FRAMES) % KEEP_FRAMES; for (let i = 0; i < this.count; i++) out.push(this.ring[(s + i) % KEEP_FRAMES]); return out; }
  /** a change of graphics happens now: the next frame is marked, and the gap starts afresh from the rebuilds behind the
   *  switch sheet (their own time is behind the sheet, not the scheduler's) */
  markSwitch() { this.nextMark = 'switch'; }
  /** once a frame, at the top of the update: close the last frame's length, check the gap, start a build if it's met
   *  and `next()` has one. Returns the build's record, or null */
  frame(now: number, next: () => BuildJob | null, hasWork: boolean): BuildRec | null {
    const prev = this.count ? this.ring[(this.head - 1 + KEEP_FRAMES) % KEEP_FRAMES] : null;
    if (prev && prev.len < 0) prev.len = now - prev.start;
    const need = 2 * this.lastDur, since = now - this.lastEnd;
    let rec = this.ring[this.head];
    if (!rec) { rec = { f: 0, start: 0, len: -1, build: -1, t: 0, need: 0, since: 0, queued: false, mark: '' }; this.ring[this.head] = rec; }
    rec.f = this.f++; rec.start = now; rec.len = -1; rec.build = -1; rec.t = now; rec.need = need; rec.since = Number.isFinite(since) ? since : 1e9; rec.queued = hasWork; rec.mark = this.nextMark;
    this.head = (this.head + 1) % KEEP_FRAMES; if (this.count < KEEP_FRAMES) this.count++;
    this.nextMark = '';
    if (!hasWork || since < need) return null;
    const job = next(); if (!job) return null;
    const b = this.run(job, rec.f, false);
    rec.build = b.i;
    return b;
  }
  /** a build run now, outside the time budget (buildAll, the switch sheet, the loading screen) or inside it */
  run(job: BuildJob, frame: number, sync: boolean): BuildRec {
    const t0 = performance.now();
    job.run();
    const dur = performance.now() - t0;
    const b: BuildRec = { i: this.builds.length ? this.builds[this.builds.length - 1].i + 1 : 0, who: job.who, level: job.level, quality: job.quality, reason: job.reason, start: t0, dur, frame, sync };
    this.builds.push(b); if (this.builds.length > KEEP_BUILDS) this.builds.shift();
    if (!sync) { this.lastEnd = t0 + dur; this.lastDur = dur; }
    return b;
  }
  /** builds done behind a sheet or a loading screen restart the gap from their end, so the first background build after
   *  them waits as it would after any build */
  after(t: number, dur: number) { this.lastEnd = t; this.lastDur = dur; }
  get frameNo() { return this.f; }
  report(sinceFrame = 0) {
    return { frames: this.frames.filter((r) => r.f >= sinceFrame).map((r) => ({ f: r.f, start: +r.start.toFixed(1), len: +r.len.toFixed(1), build: r.build, need: +r.need.toFixed(1), since: +Math.min(r.since, 1e9).toFixed(1), queued: r.queued, mark: r.mark })),
      builds: this.builds.filter((b) => b.frame < 0 || b.frame >= sinceFrame).map((b) => ({ ...b, start: +b.start.toFixed(1), dur: +b.dur.toFixed(1) })) };
  }
}
