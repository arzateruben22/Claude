// The bar's controls (the module map's input.ts row): one of Lot 57's Input, unchanged, plus the bar's own listeners.
//   O overhead, Tab the needs panel, G the TV guide, 1 to 6 the radial menu's items, the wheel zooms the overhead view,
//   the gamepad's LB (button 4) opens the radial menu. E and Q still arrive as Lot 57's 'act' and 'act2'; in overhead
//   the page treats them as rotate by 45 degrees. In overhead the bar sets input.enabled = false (Lot 57's stick and
//   look stop) and handles pointers itself: one-finger pan, pinch zoom, two-finger twist, a quick tap.
import { Input } from '../../engine/input';
import type { Action } from '../../engine/input';

export type BarAction = Action | 'overhead' | 'needs' | 'guide' | 'radial' | 'menu1' | 'menu2' | 'menu3' | 'menu4' | 'menu5' | 'menu6' | 'rotL' | 'rotR';

interface Ptr { id: number; x: number; y: number; x0: number; y0: number; t0: number; moved: number }
export class BarInput {
  readonly input: Input;
  readonly extra: BarAction[] = [];
  /** the overhead view's gestures since the last poll: pan (pixels), zoom factor, twist (radians), taps */
  readonly over = { panX: 0, panY: 0, zoom: 1, twist: 0, taps: [] as { x: number; y: number }[] };
  overhead = false;
  private ptrs = new Map<number, Ptr>();
  private padLB = false;
  private lastPinch = 0; private lastAngle = 0;
  constructor(private el: HTMLElement, ui: { stick: HTMLElement; knob: HTMLElement; car: HTMLElement }) {
    this.input = new Input(el, ui);
    addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'o') this.extra.push('overhead');
      else if (k === 'Tab') { e.preventDefault(); this.extra.push('needs'); }
      else if (k === 'g') this.extra.push('guide');
      else if (k >= '1' && k <= '6') this.extra.push(('menu' + k) as BarAction);
    });
    el.addEventListener('wheel', (e) => { if (!this.overhead) return; e.preventDefault(); this.over.zoom *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      if (!this.overhead) return;
      this.ptrs.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: 0 });
      try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.lastPinch = Math.hypot(b.x - a.x, b.y - a.y); this.lastAngle = Math.atan2(b.y - a.y, b.x - a.x); }
      e.preventDefault();
    });
    addEventListener('pointermove', (e) => {
      const p = this.ptrs.get(e.pointerId); if (!p || !this.overhead) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved = Math.max(p.moved, Math.hypot(p.x - p.x0, p.y - p.y0));
      if (this.ptrs.size === 1) {
        // one finger pans; a mouse's right button rotates
        if (e.pointerType === 'mouse' && (e.buttons & 2)) this.over.twist -= dx * 0.006; else { this.over.panX += dx; this.over.panY += dy; }
      } else if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()], d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (this.lastPinch > 0) this.over.zoom *= this.lastPinch / Math.max(1, d);
        let da = ang - this.lastAngle; da = Math.atan2(Math.sin(da), Math.cos(da)); this.over.twist += da;
        this.lastPinch = d; this.lastAngle = ang;
      }
    });
    const up = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId); if (!p) return;
      this.ptrs.delete(e.pointerId);
      if (this.overhead && performance.now() - p.t0 < 220 && p.moved < 12 && this.ptrs.size === 0) { const r = this.el.getBoundingClientRect(); this.over.taps.push({ x: p.x0 - r.left, y: p.y0 - r.top }); }
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  /** switch the overhead handling on or off (Lot 57's stick and look stop in overhead) */
  setOverhead(on: boolean) { this.overhead = on; this.input.enabled = !on; if (!on) this.ptrs.clear(); }
  /** the gamepad's LB (button 4), read on the frame's poll */
  pollPad() {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const p of pads) { if (!p || !p.connected) continue; const down = !!p.buttons[4]?.pressed; if (down && !this.padLB) this.extra.push('radial'); this.padLB = down; break; }
  }
  /** what the frame reads: the gestures since the last call, in an object made once (the two tap lists swap, so the
   *  frame's list and the one the listeners fill are never the same array); the gestures start again from rest */
  private readonly taken = { panX: 0, panY: 0, zoom: 1, twist: 0, taps: [] as { x: number; y: number }[] };
  takeOver() {
    const o = this.over, t = this.taken, spare = t.taps;
    t.panX = o.panX; t.panY = o.panY; t.zoom = o.zoom; t.twist = o.twist; t.taps = o.taps;
    spare.length = 0; o.taps = spare;
    o.panX = 0; o.panY = 0; o.zoom = 1; o.twist = 0;
    return t;
  }
}
