// Running on foot, the parts both venues' pages share (PROJECT_OC_ON_FOOT.md, "Running"): the one-time hint chip
// that teaches it, the first-person FOV that eases out a little as you run, and the walk cycle's cadence.
//   The hint: after about 1.5 s of walking under your own control without ever running, a chip says how to run, in
//   the words for what you hold ('Double-tap and hold W to run' on a computer, 'Double-tap and hold to run' on a
//   touch screen, 'Push the left stick all the way to run' on a gamepad). It shows once per device (localStorage
//   'oc.onfoot.runHint'), for 5 s; running before it shows counts as learned, so it never shows. ?runhint=1 shows it
//   regardless (the frames), ?runhint=0 never.
//   The FOV: +5 degrees at a full run in first person, eased with the speed itself (which the player already eases);
//   none with reduced motion, none in third person.
//   The gait: the people builder has one walk cycle (people/anim.ts 'walk'; no run or jog clip, and the cadence and
//   stride aren't reachable through Person), so the page plays it faster with the speed, continuously: the same
//   clip, never a switch, so nothing pops. The NPC "Jogger" plays the same walk.
import * as THREE from 'three';
import type { Player } from './player';
import type { Input } from './input';

const KEY = 'oc.onfoot.runHint';
/** the first-person FOV's widening at a full run (degrees) */
export const RUN_FOV = 5;

/** the walk cycle's time scale at this speed (the builder's walk is tuned for 1.25 m/s); continuous in the speed */
export const gaitScale = (speed: number) => Math.max(0.6, Math.min(2.2, speed / 1.25));

/** the first-person FOV for this frame: the base, widened by up to RUN_FOV as the run builds */
export const runFov = (base: number, player: Player, firstPerson: boolean, reduced: boolean) =>
  base + (firstPerson && !reduced ? RUN_FOV * player.runAmount : 0);

export class RunHint {
  /** shown once on this device already (or learned by running) */
  done: boolean;
  private walkT = 0; private showT = 0; private force: boolean | null;
  constructor(private el: HTMLElement | null, private coarse: boolean, q: URLSearchParams) {
    this.force = q.get('runhint') === '1' ? true : q.get('runhint') === '0' ? false : null;
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch { /* a convenience */ }
    this.done = this.force === false || (seen && this.force !== true);
  }
  /** the words for what you hold */
  text(kind: Input['lastKind']) {
    if (kind === 'pad') return 'Push the left stick all the way to run';
    if (kind === 'touch' || (kind === null && this.coarse)) return 'Double-tap and hold to run';
    return 'Double-tap and hold W to run';
  }
  get shown() { return !!this.el && this.el.classList.contains('on'); }
  get label() { return this.el?.textContent ?? ''; }
  /** show it now, in the words for `kind` (the hooks and ?runhint=1), or take it off */
  show(on: boolean, kind: Input['lastKind'] = null) {
    if (!this.el) return;
    if (on) { this.el.textContent = this.text(kind); this.showT = 5; this.mark(); }
    else this.showT = 0;
    this.el.classList.toggle('on', on);
  }
  private mark() { this.done = true; try { localStorage.setItem(KEY, '1'); } catch { /* a convenience */ } }
  /** once a frame: `blocked` while the first-visit hint, a sheet or the pause menu is up */
  update(dt: number, player: Player, input: Input, blocked: boolean) {
    if (this.showT > 0) {
      this.showT -= dt;
      if (player.runWanted) this.showT = Math.min(this.showT, 0.6);      // they've got it: let it go soon
      if (this.showT <= 0) this.el?.classList.remove('on');
      return;
    }
    if (this.done) return;
    if (player.runWanted) { this.mark(); return; }
    const walking = !player.path && !player.seat && player.speed > 0.6;
    this.walkT = walking ? this.walkT + dt : Math.max(0, this.walkT - dt * 0.5);
    if ((this.walkT > 1.5 || this.force) && !blocked) this.show(true, input.lastKind);
  }
}

/** what the run's test hooks need from a page (both venues' pages hand theirs over) */
export interface RunCtx {
  player: Player; input: Input; hint: RunHint;
  camera: { fov: number };
  step: (stick: { x: number; y: number; run: boolean }) => void;
  /** advance your avatar's animation by dt as a frame does (its anim chosen from the speed) */
  avatar: (dt: number) => void;
  person: () => { group: THREE.Object3D } | null;
  /** the page's last gait: the clip played and the time scale */
  gait: { anim: string; k: number };
  /** what holds the hint back on this page now (the first-visit hint, a sheet, the pause menu, the overhead view) */
  blocked: () => boolean;
  STEP: number;
}

/** the run's test hooks (window.__onfoot.run*, both venues): unrendered, through the live input */
export function runHooks(c: RunCtx) {
  const { player: P, input: I, hint: H } = c;
  const state = () => ({
    want: P.runWanted, by: I.runBy, cue: I.cueShown, speed: +P.speed.toFixed(3), target: +P.wantSpeed.toFixed(3), indoors: P.indoors,
    amount: +P.runAmount.toFixed(3), fov: +c.camera.fov.toFixed(2), view: P.view, stick: { x: +I.stick.x.toFixed(3), y: +I.stick.y.toFixed(3), run: I.stick.run },
    hint: { shown: H.shown, label: H.label, done: H.done }, stickClass: (document.getElementById('stick')?.className ?? ''),
  });
  /** step the body `seconds` on the live input (polled every step, as a frame polls it); speeds every 0.05 s */
  const live = (seconds: number, hint = false) => {
    const n = Math.round(seconds / c.STEP), speeds: number[] = [];
    for (let i = 0; i < n; i++) { I.poll(0); c.step(I.stick); if (hint) H.update(c.STEP, P, I, c.blocked()); if (i % 3 === 2) speeds.push(+P.speed.toFixed(3)); }
    return speeds;
  };
  return {
    run: state,
    /** poll the input once (as a frame does) and read the run state */
    runPoll() { I.poll(0); return state(); },
    /** step `seconds` on the live input; with `hint`, the one-time hint's clock runs too (as a frame runs it) */
    runWalk(seconds: number, hint = false) { const speeds = live(seconds, hint); return { speeds, end: state() }; },
    /**
     * The gait over `seconds` on the live input, your avatar animated every step: per step the speed, the clip, its
     * time scale, and how far the body's bones moved since the last step (the largest, in the avatar's own frame, cm).
     * A pop (a clip switch, a reset) shows as a step that moves far more than the steps around it.
     */
    runGait(seconds: number) {
      const p = c.person(); if (!p) return null;
      const bones: THREE.Object3D[] = []; p.group.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o); });
      const at = (o: THREE.Object3D) => p.group.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
      p.group.updateMatrixWorld(true);
      let prev = bones.map(at);
      const n = Math.round(seconds / c.STEP), rows: { t: number; speed: number; anim: string; k: number; moveCm: number }[] = [];
      for (let i = 0; i < n; i++) {
        I.poll(0); c.step(I.stick); c.avatar(c.STEP);
        p.group.updateMatrixWorld(true);
        const now = bones.map(at);
        let m = 0; for (let b = 0; b < now.length; b++) m = Math.max(m, now[b].distanceTo(prev[b]));
        prev = now;
        rows.push({ t: +((i + 1) * c.STEP).toFixed(3), speed: +P.speed.toFixed(3), anim: c.gait.anim, k: +c.gait.k.toFixed(3), moveCm: +(m * 100).toFixed(2) });
      }
      return { bones: bones.length, rows };
    },
    /** run straight on (the stick's run) for `seconds` with someone held `gap` metres away: the fastest you went */
    runNear(gap: number, seconds = 1.5) {
      const keepG = P.crowdGap, keepS = P.soft; P.crowdGap = () => gap; P.soft = [];
      let top = 0; const n = Math.round(seconds / c.STEP);
      try { for (let i = 0; i < n; i++) { c.step({ x: 0, y: 1, run: true }); top = Math.max(top, P.speed); } }
      finally { P.crowdGap = keepG; P.soft = keepS; }
      return { gap, top: +top.toFixed(3), end: +P.speed.toFixed(3) };
    },
    /** put you at the start of a clear straight lane (indoors or out), facing along it, standing still */
    runLane(indoors: boolean, len = 9, near?: [number, number]) {
      const l = P.findLane(indoors, len, near?.[0], near?.[1]); if (!l) return null;
      P.seat = null; P.path = null; P.place(l.x, l.z); P.vx = P.vz = 0; P.yaw = l.yaw; P.heading = l.yaw; P.pitch = -0.05;
      return { lx: +P.x.toFixed(3), lz: +P.z.toFixed(3), yaw: +l.yaw.toFixed(3), indoors: P.indoors };
    },
    /** the one-time hint: show it now in the words for `kind`, or take it off; or forget it was seen */
    runHint(on?: boolean, kind: Input['lastKind'] = null, forget = false) {
      if (forget) { try { localStorage.removeItem(KEY); } catch { /* fine */ } H.done = false; }
      if (on !== undefined) H.show(on, kind);
      return { shown: H.shown, label: H.label, done: H.done };
    },
  };
}
