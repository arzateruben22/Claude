// The on-foot HUD: "Car" top left, the place and the simulated-crowd chip at the top, the view switch and pause top
// right, one action button bottom right (and a second only when two make sense), the six-second hint on the first
// visit, toasts, and the map credit, always on screen. Every string here is plain and honest: the crowd chip says
// "Simulated crowd", nothing claims to be live.
import type { CrowdLevel } from './clock';
import type { View } from './player';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  root = $('hud');
  act = $<HTMLButtonElement>('act'); act2 = $<HTMLButtonElement>('act2');
  car = $<HTMLButtonElement>('car');
  stick = $('stick'); knob = $('knob');
  private toastEl = $('toast'); private toastT = 0;
  private hintEl = $('hint');
  private lastToast = '';
  onAct: (which: 1 | 2) => void = () => {};
  onView: () => void = () => {};
  onPause: (open: boolean) => void = () => {};
  onQuality: (q: 'low' | 'high' | 'ultra') => void = () => {};
  onClock: (c: { live: true } | { live: false; day: number; hour: number }) => void = () => {};
  onMotion: (reduced: boolean) => void = () => {};
  paused = false;

  constructor() {
    this.act.addEventListener('click', () => this.onAct(1));
    this.act2.addEventListener('click', () => this.onAct(2));
    $('viewBtn').addEventListener('click', () => this.onView());
    $('menu').addEventListener('click', () => this.pause(true));
    $('crowd').addEventListener('click', () => this.sheet('about', true));
    for (const s of ['about', 'pause']) {
      const el = $(s);
      el.querySelector('[data-close]')!.addEventListener('click', () => (s === 'pause' ? this.pause(false) : this.sheet(s, false)));
      el.addEventListener('click', (e) => { if (e.target === el) (s === 'pause' ? this.pause(false) : this.sheet(s, false)); });
    }
    $('segView').addEventListener('click', (e) => { const v = (e.target as HTMLElement).dataset.v; if (v) { this.onView(); } });
    $('segQ').addEventListener('click', (e) => { const q = (e.target as HTMLElement).dataset.q as 'low' | 'high' | 'ultra' | undefined; if (q) this.onQuality(q); });
    $('segClock').addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).dataset.c; if (!c) return;
      if (c === 'live') this.onClock({ live: true }); else this.onClock({ live: false, day: Number($<HTMLSelectElement>('day').value), hour: Number($<HTMLInputElement>('hour').value) });
    });
    const setClock = () => this.onClock({ live: false, day: Number($<HTMLSelectElement>('day').value), hour: Number($<HTMLInputElement>('hour').value) });
    $('day').addEventListener('change', setClock);
    $('hour').addEventListener('input', setClock);
    $('segMotion').addEventListener('click', (e) => { const m = (e.target as HTMLElement).dataset.m; if (m) this.onMotion(m === 'reduced'); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && (this.paused || $('about').classList.contains('on'))) { e.stopPropagation(); if (this.paused) this.pause(false); else this.sheet('about', false); } }, true);
  }

  show() { this.root.hidden = false; }
  sheet(id: string, on: boolean) {
    const el = $(id); el.classList.toggle('on', on);
    if (on) (el.querySelector('button') as HTMLElement | null)?.focus(); else $('view').focus();
  }
  pause(on: boolean) { this.paused = on; this.sheet('pause', on); this.onPause(on); }

  setPlace(clock: string, hours: string) { $('clock').textContent = clock; $('hours').textContent = hours; }
  setCrowd(level: CrowdLevel) { $('crowdText').textContent = level === 'Closed' ? 'Simulated crowd · Closed' : `Simulated crowd · ${level}`; }
  setView(v: View) {
    $('viewLabel').textContent = v === 'first' ? '3rd' : '1st';
    $('viewBtn').setAttribute('aria-label', v === 'first' ? 'Switch to third person' : 'Switch to first person');
    for (const b of $('segView').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
  }
  setQuality(q: string) { for (const b of $('segQ').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.q === q)); }
  setClockMode(live: boolean, day: number, hour: number) {
    for (const b of $('segClock').querySelectorAll('button')) b.setAttribute('aria-pressed', String((b.dataset.c === 'live') === live));
    $<HTMLSelectElement>('day').value = String(day);
    $<HTMLInputElement>('hour').value = String(Math.round(hour * 4) / 4);
    const h = Math.floor(hour), m = Math.round((hour - h) * 60);
    $('hourOut').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  setMotion(reduced: boolean) {
    document.body.classList.toggle('rm', reduced);
    for (const b of $('segMotion').querySelectorAll('button')) b.setAttribute('aria-pressed', String((b.dataset.m === 'reduced') === reduced));
  }
  setActions(a: string | null, b: string | null) {
    this.act.classList.toggle('on', !!a); if (a && this.act.textContent !== a) { this.act.textContent = a; this.act.setAttribute('aria-label', a); }
    this.act2.classList.toggle('on', !!b); if (b && this.act2.textContent !== b) { this.act2.textContent = b; this.act2.setAttribute('aria-label', b); }
  }
  toast(text: string, seconds = 3) {
    if (text === this.lastToast && this.toastT > 0.5) { this.toastT = seconds; return; }
    this.lastToast = text; this.toastEl.textContent = text; this.toastEl.classList.add('on'); this.toastT = seconds;
  }
  hint(show: boolean) { this.hintEl.style.opacity = show ? '1' : '0'; this.hintEl.style.display = show ? '' : 'none'; }
  get hintVisible() { return this.hintEl.style.display !== 'none'; }
  fadeHint() { this.hintEl.style.opacity = '0'; setTimeout(() => { this.hintEl.style.display = 'none'; }, document.body.classList.contains('rm') ? 0 : 650); }
  tick(dt: number) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) { this.toastEl.classList.remove('on'); this.lastToast = ''; } }
  }
  get toastText() { return this.toastEl.classList.contains('on') ? this.toastEl.textContent ?? '' : ''; }
}

export function loading(frac: number, text: string) {
  const bar = document.querySelector('#bar i') as HTMLElement | null, st = document.getElementById('status');
  if (bar) bar.style.width = `${Math.round(frac * 100)}%`;
  if (st) st.textContent = text;
}
export function doneLoading(reduced: boolean) {
  const el = document.getElementById('loading'); if (!el) return;
  if (reduced) { el.remove(); return; }
  el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 550);
}
