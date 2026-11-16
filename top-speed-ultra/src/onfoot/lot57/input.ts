// Controls (PROJECT_OC_ON_FOOT.md, "Controls" and "Running"): big thumbs, no controls screen.
//   Touch: a floating stick wherever the left thumb lands in the left 45% of the screen (a short push walks; push it
//          to its edge, or double-tap and hold where it floats, to run); drag anywhere on the right 55% to look; a
//          quick tap (under 220 ms, under 12 px) on the world walks you there.
//   Keyboard and mouse: WASD or arrows to walk; double-tap and hold W (or Up) to run, or hold Shift; drag to look,
//          click to go, E the action, Q the second action, V the view, C the car, Esc to pause.
//   Gamepad: left stick to walk (a full push runs; L3 toggles the run), right stick to look, A the action, X the
//          second, Y the view, B to stand or leave, Back the car, Start to pause.
// Running indoors is a speed walk; the player decides that (player.ts). The stick shows the run on itself: an accent
// glow on its ring and a small RUN tag (the .run class on #stick), set only when it changes.
import type { Stick } from './player';

export type Action = 'act' | 'act2' | 'view' | 'car' | 'carSkip' | 'pause' | 'stand';

/** standard-mapping buttons: A the action, B stand or leave, X the second action, Y the view, Back the car, Start pause */
const NO_PADS: (Gamepad | null)[] = [];
const PAD_ACTIONS: (Action | undefined)[] = ['act', 'stand', 'act2', 'view', undefined, undefined, undefined, undefined, 'car', 'pause'];

interface Touch { id: number; kind: 'stick' | 'look'; x0: number; y0: number; x: number; y: number; t0: number; moved: number;
  /** a double-tap and hold: runs (straight ahead until the thumb steers) until lifted or eased back toward the centre */
  run: boolean; peak: number; edge: boolean }

/** a second press within this long of the first, or of letting go (ms), is a double-tap: W held after it runs, as a
 *  stick held after it does (letting go and pressing again from a walk runs too) */
export const DOUBLE_TAP_MS = 300;
/** the stick's radius in pixels: the knob's travel */
const R = 56;
const FWD = ['w', 'ArrowUp'];

export class Input {
  stick: Stick = { x: 0, y: 0, run: false };
  lookDX = 0; lookDY = 0;
  taps: { x: number; y: number }[] = [];
  actions: Action[] = [];
  enabled = true;
  lastKind: 'touch' | 'mouse' | 'keys' | 'pad' | null = null;
  private keys = new Set<string>();
  private touches = new Map<number, Touch>();
  private padLook = { x: 0, y: 0 };
  private padPrev: boolean[] = [];
  private lookOut = { dyaw: 0, dpitch: 0 };
  private stickEl: HTMLElement; private knobEl: HTMLElement;
  private carHold: number | null = null;
  /** the keyboard's run: a double-tap of W or Up, held (cleared when both are up) */
  private keyRun = false; private fwdTap = -1e9; private fwdUp = -1e9;
  /** the last stick touch that ended (for the double-tap and hold): when, where it started and where it lifted */
  private stickTapT = -1e9; private stickTapX = 0; private stickTapY = 0; private stickUpX = 0; private stickUpY = 0;
  /** the gamepad's L3 toggle (off again when the left stick comes back to the centre) */
  private padRun = false;
  /** what the stick shows now (so the class is written only on a change) */
  private cueOn = false;
  /** how the run was asked for on the last poll: 'double' (a double-tap and hold), 'shift', 'edge' (a full push),
   *  'pad' (L3 or a full push on a gamepad) or '' (walking) */
  runBy: '' | 'double' | 'shift' | 'edge' | 'pad' = '';

  constructor(private el: HTMLElement, ui: { stick: HTMLElement; knob: HTMLElement; car: HTMLElement }) {
    this.stickEl = ui.stick; this.knobEl = ui.knob;
    el.addEventListener('pointerdown', this.down);
    addEventListener('pointermove', this.move);
    addEventListener('pointerup', this.up);
    addEventListener('pointercancel', this.up);
    addEventListener('keydown', this.key(true));
    addEventListener('keyup', this.key(false));
    addEventListener('blur', () => { this.keys.clear(); this.keyRun = false; this.touches.clear(); this.hideStick(); });
    // "Car": tap walks you back to your car; a long press skips the walk
    ui.car.addEventListener('pointerdown', () => { this.carHold = performance.now(); });
    ui.car.addEventListener('pointerup', () => { const held = this.carHold !== null && performance.now() - this.carHold > 550; this.carHold = null; this.actions.push(held ? 'carSkip' : 'car'); });
    ui.car.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.actions.push('car'); } });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled) return;
    const W = this.el.clientWidth, touchy = e.pointerType !== 'mouse';
    this.lastKind = touchy ? 'touch' : 'mouse';
    const kind: Touch['kind'] = touchy && e.clientX < W * 0.45 ? 'stick' : 'look';
    const now = performance.now();
    // a second touch where the stick floated, soon after a tap there: hold it to run
    const run = kind === 'stick' && now - this.stickTapT < DOUBLE_TAP_MS &&
      Math.min(Math.hypot(e.clientX - this.stickTapX, e.clientY - this.stickTapY), Math.hypot(e.clientX - this.stickUpX, e.clientY - this.stickUpY)) < 80;
    const t: Touch = { id: e.pointerId, kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: now, moved: 0, run, peak: 0, edge: false };
    this.touches.set(e.pointerId, t);
    if (run) { this.stickTapT = -1e9; this.showStick(t); }
    try { this.el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    e.preventDefault();
  };
  private move = (e: PointerEvent) => {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    t.moved = Math.max(t.moved, Math.hypot(t.x - t.x0, t.y - t.y0));
    if (t.kind === 'look') {
      const k = e.pointerType === 'mouse' ? 0.0042 : 0.0058;
      this.lookDX -= dx * k; this.lookDY -= dy * k;
    } else if (t.moved > 6) this.showStick(t);
  };
  private up = (e: PointerEvent) => {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    this.touches.delete(e.pointerId);
    const now = performance.now();
    if (now - t.t0 < 220 && t.moved < 12) {
      const r = this.el.getBoundingClientRect();
      this.taps.push({ x: t.x0 - r.left, y: t.y0 - r.top });
    }
    // any stick touch that lifts (a tap, or a walk let go) arms the double-tap; a lifted run doesn't
    if (t.kind === 'stick') { if (!t.run) { this.stickTapT = now; this.stickTapX = t.x0; this.stickTapY = t.y0; this.stickUpX = t.x; this.stickUpY = t.y; } this.hideStick(); }
  };
  private showStick(t: Touch) {
    const dx = t.x - t.x0, dy = t.y - t.y0, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    this.stickEl.style.display = 'block';
    this.stickEl.style.transform = `translate(${t.x0 - 64}px, ${t.y0 - 64}px)`;
    this.knobEl.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  private hideStick() { this.stickEl.style.display = 'none'; this.cue(false); }
  /** the run cue on the stick: the accent glow and the RUN tag (CSS: #stick.run), written only when it changes */
  private cue(on: boolean) { if (on === this.cueOn) return; this.cueOn = on; this.stickEl.classList.toggle('run', on); }
  /** the stick's run cue is showing */
  get cueShown() { return this.cueOn; }

  private key = (down: boolean) => (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) {
      this.lastKind = 'keys';
      if (!e.repeat) {
        // W or Up pressed again within DOUBLE_TAP_MS of the last press, with neither held: run while it's held
        if (k === 'w' || k === 'ArrowUp') {
          const now = performance.now(), held = this.keys.has('w') || this.keys.has('ArrowUp');
          if (!held && (now - this.fwdTap < DOUBLE_TAP_MS || now - this.fwdUp < DOUBLE_TAP_MS)) this.keyRun = true;
          this.fwdTap = now;
        }
        if (k === 'e') this.actions.push('act');
        else if (k === 'q') this.actions.push('act2');
        else if (k === 'v') this.actions.push('view');
        else if (k === 'c') this.actions.push('car');
        else if (k === 'Escape') this.actions.push('pause');
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k) && this.enabled) e.preventDefault();
      this.keys.add(k);
    } else { this.keys.delete(k); if (FWD.includes(k) && !this.keys.has('w') && !this.keys.has('ArrowUp')) { this.keyRun = false; this.fwdUp = performance.now(); } }
    if (k === 'Shift') { if (down) this.keys.add('Shift'); else this.keys.delete('Shift'); }
  };

  /** read everything for this frame: the stick (touch, keys or pad) and how far to look */
  poll(dt: number) {
    let x = 0, y = 0, run = false, by: Input['runBy'] = '', stickOn = false;
    for (const t of this.touches.values()) if (t.kind === 'stick' && (t.moved > 6 || t.run)) {
      const dx = t.x - t.x0, dy = t.y - t.y0, l = Math.hypot(dx, dy), k = Math.min(1, l / R);
      stickOn = true;
      t.peak = Math.max(t.peak, k);
      // a double-tap and hold runs at once, straight ahead until the thumb steers; easing the knob back toward the
      // centre after pushing it out (under 30 % from over 55 %) turns it into an ordinary stick (a walk)
      if (t.run && t.peak > 0.55 && k < 0.3) t.run = false;
      // the edge: a push past 92 % runs, until it eases back under 85 %
      t.edge = t.edge ? k > 0.85 : k > 0.92;
      if (t.run) { if (l > 8) { x = dx / l; y = -dy / l; } else { x = 0; y = 1; } run = true; by = 'double'; }
      else if (l > 1) { x = (dx / l) * k; y = (-dy / l) * k; if (t.edge) { run = true; by = 'edge'; } }
    }
    const K = this.keys;
    const kx = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
    const ky = (K.has('w') || K.has('ArrowUp') ? 1 : 0) - (K.has('s') || K.has('ArrowDown') ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky); x = (kx / l) * 0.75; y = (ky / l) * 0.75;
      run = K.has('Shift') || this.keyRun; by = this.keyRun ? 'double' : run ? 'shift' : '';
    }
    // gamepad
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : NO_PADS;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v: number) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
      const lx = dz(p.axes[0] ?? 0), ly = dz(p.axes[1] ?? 0), rx = dz(p.axes[2] ?? 0), ry = dz(p.axes[3] ?? 0);
      // L3 (button 10) toggles the run; it ends when the stick comes back to the centre. A full push runs too
      // (the player's own rule for a stick past 92 %)
      const l3 = !!p.buttons[10]?.pressed;
      if (l3 && !this.padPrev[10]) this.padRun = !this.padRun;
      if (lx || ly) {
        x = lx; y = -ly; this.lastKind = 'pad';
        if (this.padRun || Math.hypot(lx, ly) > 0.92) { run = true; by = 'pad'; }
      } else this.padRun = false;
      this.padLook.x = rx; this.padLook.y = ry;
      // button edges, compared in place against the last poll (no array per frame)
      const prev = this.padPrev, bs = p.buttons;
      for (let i = 0; i < bs.length; i++) {
        const down = !!bs[i]?.pressed;
        if (down && !prev[i]) { const a = PAD_ACTIONS[i]; if (a) this.actions.push(a); }
        prev[i] = down;
      }
      break;
    }
    if (!this.enabled) { x = 0; y = 0; run = false; by = ''; }
    this.stick.x = x; this.stick.y = y; this.stick.run = run; this.runBy = by;
    this.cue(stickOn && run && this.enabled);
    const lx = this.lookDX - this.padLook.x * 2.6 * dt, ly = this.lookDY - this.padLook.y * 1.8 * dt;
    this.lookDX = 0; this.lookDY = 0;
    this.lookOut.dyaw = this.enabled ? lx : 0; this.lookOut.dpitch = this.enabled ? ly : 0;
    return this.lookOut;
  }
}
