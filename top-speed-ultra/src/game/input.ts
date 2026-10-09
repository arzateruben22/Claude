// Keyboard, gamepad, mouse and touch, folded into one smooth analog input.
// Keys give targets; the game eases throttle, brake and steering toward them so a tap is a nudge and a hold is full lock.

import { clamp } from './util';

export type Action =
  | 'shiftUp' | 'shiftDown' | 'camera' | 'reset' | 'pause' | 'transmission' | 'hud' | 'corner' | 'ability';

export interface Controls {
  throttle: number;   // 0..1, smoothed
  brake: number;      // 0..1, smoothed
  steer: number;      // -1 (left) .. 1 (right), smoothed and speed-limited by the car
  handbrake: boolean;
  lookBack: boolean;
  lookYaw: number;    // radians, from mouse or right stick
  lookPitch: number;
  analog: boolean;    // last input came from a stick or touch (skip key smoothing)
}

const KEYS: Record<string, string> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'handbrake', KeyV: 'back',
};
const ACTIONS: Record<string, Action> = {
  KeyE: 'shiftUp', KeyQ: 'shiftDown', KeyC: 'camera', KeyR: 'reset', KeyP: 'pause', Escape: 'pause', KeyM: 'transmission', KeyH: 'hud', KeyN: 'corner', KeyF: 'ability',
};

export class Input {
  readonly c: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, lookBack: false, lookYaw: 0, lookPitch: 0, analog: false };
  private held = new Set<string>();
  private queue: Action[] = [];
  private drag: { id: number; x: number; y: number } | null = null;
  private lookTarget = { yaw: 0, pitch: 0 };
  private idleLook = 0;
  freeLook = false;                     // free-look camera: the view stays where you leave it
  // touch inputs written by the on-screen controls
  readonly touch = { steer: 0, gas: false, brake: false, active: false };
  private padPrev: boolean[] = [];
  private keyBound = false;

  constructor(private el: HTMLElement) {}

  attach() {
    if (this.keyBound) return;
    this.keyBound = true;
    addEventListener('keydown', this.onKey);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.clear);
    this.el.addEventListener('pointerdown', this.onDown);
    addEventListener('pointermove', this.onMove);
    addEventListener('pointerup', this.onUp);
    addEventListener('pointercancel', this.onUp);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  detach() {
    removeEventListener('keydown', this.onKey);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.clear);
    this.el.removeEventListener('pointerdown', this.onDown);
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerup', this.onUp);
    removeEventListener('pointercancel', this.onUp);
    this.keyBound = false;
  }

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const k = KEYS[e.code];
    if (k) { this.held.add(k); this.c.analog = false; e.preventDefault(); }
    const a = ACTIONS[e.code];
    if (a && !e.repeat) { this.queue.push(a); e.preventDefault(); }
  };
  private onKeyUp = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (k) this.held.delete(k); };
  clear = () => { this.held.clear(); this.drag = null; this.touch.gas = this.touch.brake = false; this.touch.steer = 0; };

  // mouse look: drag anywhere on the view; let go and it eases back to centre
  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;          // touch has its own controls
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  private onMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    this.lookTarget.yaw = clamp(this.lookTarget.yaw - dx * 0.005, -1.9, 1.9);
    this.lookTarget.pitch = clamp(this.lookTarget.pitch - dy * 0.004, -0.9, 0.5);
    this.idleLook = 0;
  };
  private onUp = (e: PointerEvent) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
  recenter() { this.lookTarget.yaw = 0; this.lookTarget.pitch = 0; }

  takeActions(): Action[] { const a = this.queue; this.queue = []; return a; }
  push(a: Action) { this.queue.push(a); }

  // dt in seconds; speed in m/s (steering slows down as speed rises)
  update(dt: number, speed: number) {
    const c = this.c;
    let thrT = this.held.has('up') ? 1 : 0, brkT = this.held.has('down') ? 1 : 0;
    let steerT = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let hb = this.held.has('handbrake');
    let analogSteer: number | null = null, analogThr: number | null = null, analogBrk: number | null = null;

    // gamepad (standard mapping)
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, dz = 0.12;
      const sx = Math.abs(ax) < dz ? 0 : (ax - Math.sign(ax) * dz) / (1 - dz);
      const rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
      if (Math.abs(sx) > 0 || rt > 0.02 || lt > 0.02) { analogSteer = sx * Math.abs(sx); analogThr = rt; analogBrk = lt; c.analog = true; }
      const btn = (i: number) => !!(p.buttons[i] && p.buttons[i].pressed);
      const edge = (i: number, a: Action) => { const now = btn(i); if (now && !this.padPrev[i]) this.queue.push(a); this.padPrev[i] = now; };
      edge(5, 'shiftUp'); edge(4, 'shiftDown'); edge(3, 'camera'); edge(1, 'reset'); edge(9, 'pause'); edge(8, 'hud');
      if (btn(2) || btn(0)) hb = true;
      const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
      if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) { this.lookTarget.yaw = -rx * 1.6; this.lookTarget.pitch = -ry * 0.6; this.idleLook = 0; }
      else if (!this.drag && Math.abs(this.lookTarget.yaw) > 0 && !this.freeLook && c.analog) { this.lookTarget.yaw = 0; this.lookTarget.pitch = 0; }
      if (btn(10) || btn(11)) this.recenter();
      break;
    }
    // touch
    if (this.touch.active) {
      if (this.touch.gas || this.touch.brake || this.touch.steer !== 0) c.analog = true;
      if (this.touch.steer !== 0) analogSteer = this.touch.steer;
      if (this.touch.gas) thrT = 1;
      if (this.touch.brake) brkT = 1;
    }

    // ease toward the targets
    const sp = clamp(speed / 70, 0, 1);
    if (analogThr !== null) c.throttle = Math.max(analogThr, thrT);
    else c.throttle = approach(c.throttle, thrT, thrT > c.throttle ? 3.2 : 6, dt);
    if (analogBrk !== null) c.brake = Math.max(analogBrk, brkT);
    else c.brake = approach(c.brake, brkT, brkT > c.brake ? 4.5 : 7, dt);
    if (analogSteer !== null && steerT === 0) c.steer = approach(c.steer, analogSteer, 8, dt);
    else {
      const toward = steerT !== 0 && Math.sign(steerT) === Math.sign(c.steer || steerT);
      const rate = steerT === 0 ? 3.2 + sp * 1.5 : toward ? 2.4 - sp * 1.2 : 5;   // slower to turn in at speed, quick to centre
      steerT *= 1 - sp * 0.35;                                                    // and you can't ask for full lock at 150 mph
      c.steer = approach(c.steer, steerT, rate, dt);
    }
    c.handbrake = hb;
    c.lookBack = this.held.has('back');

    // look: hold drag to look around; after you let go it eases back to centre (unless free-look)
    if (!this.drag) {
      this.idleLook += dt;
      if (!this.freeLook && this.idleLook > 0.35) { this.lookTarget.yaw *= Math.exp(-dt * 3.5); this.lookTarget.pitch *= Math.exp(-dt * 3.5); }
    }
    c.lookYaw += (this.lookTarget.yaw - c.lookYaw) * (1 - Math.exp(-dt * 12));
    c.lookPitch += (this.lookTarget.pitch - c.lookPitch) * (1 - Math.exp(-dt * 12));
  }
}

function approach(v: number, target: number, rate: number, dt: number) {
  const step = rate * dt;
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}
