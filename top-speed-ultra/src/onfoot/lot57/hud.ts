// The on-foot HUD: "Car" top left, the place and the simulated-crowd chip at the top, the view switch and pause top
// right, one action button bottom right (and a second only when two make sense), the six-second hint on the first
// visit, toasts, and the map credit, always on screen. Every string here is plain and honest: the crowd chip says
// "Simulated crowd", nothing claims to be live.
import type { CrowdLevel } from './clock';
import type { View } from './player';
import type { Counter, ItemId } from './items';

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
  onView: (v?: View) => void = () => {};
  onPause: (open: boolean) => void = () => {};
  onQuality: (q: 'low' | 'high' | 'ultra') => void = () => {};
  onClock: (c: { live: true } | { live: false; day: number; hour: number }) => void = () => {};
  onMotion: (reduced: boolean) => void = () => {};
  /** P1b: a reply chip, an item on the order sheet, the sheet closed without ordering */
  onReply: (i: 0 | 1) => void = () => {};
  onOrderPick: (id: ItemId) => void = () => {};
  onOrderClose: () => void = () => {};
  paused = false;
  orderOpen = false;
  private capEl = $('caption'); private capT = 0;
  private chipsEl = $('chips');
  private status2 = $('status2'); private status2Text = $('status2Text'); private statusP = -1;
  private orderItems: ItemId[] = [];

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
    $('segView').addEventListener('click', (e) => { const v = (e.target as HTMLElement).dataset.v as View | undefined; if (v) this.onView(v); });
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
    // the order sheet: an item button orders it; "Not now", the backdrop or Escape closes it; 1 to 5 on a keyboard
    const order = $('order');
    $('menuItems').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.item) this.onOrderPick(b.dataset.item as ItemId); });
    order.querySelector('[data-close]')!.addEventListener('click', () => this.onOrderClose());
    order.addEventListener('click', (e) => { if (e.target === order) this.onOrderClose(); });
    // reply chips (1 and 2 on a keyboard)
    this.chipsEl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.r) this.onReply(Number(b.dataset.r) as 0 | 1); });
    addEventListener('keydown', (e) => {
      if (this.orderOpen) {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); this.onOrderClose(); return; }
        const k = Number(e.key); if (k >= 1 && k <= this.orderItems.length) { e.preventDefault(); this.onOrderPick(this.orderItems[k - 1]); }
        return;
      }
      if (this.chipsEl.classList.contains('on') && !this.paused && (e.key === '1' || e.key === '2')) { e.preventDefault(); this.onReply(e.key === '1' ? 0 : 1); }
    }, true);
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
  /** a caption: who's speaking and what they say (null clears it) */
  caption(who: string | null, text: string, seconds = 3) {
    if (!who) { this.capEl.classList.remove('on'); this.capT = 0; return; }
    this.capEl.innerHTML = '';
    const b = document.createElement('b'); b.textContent = who; this.capEl.append(b, document.createTextNode(text));
    this.capEl.classList.add('on'); this.capT = seconds;
  }
  get captionText() { return this.capEl.classList.contains('on') ? this.capEl.textContent ?? '' : ''; }
  /** the two reply chips (null hides them) */
  replies(r: [string, string] | null) {
    this.chipsEl.classList.toggle('on', !!r);
    if (!r) return;
    r.forEach((t, i) => { const b = $<HTMLButtonElement>('reply' + i); b.innerHTML = ''; const k = document.createElement('small'); k.textContent = coarseHint() ? 'Reply' : `Reply · ${i + 1}`; b.append(k, document.createTextNode(t)); b.setAttribute('aria-label', 'Reply: ' + t); });
  }
  get repliesShown() { return this.chipsEl.classList.contains('on'); }
  openOrder(c: Counter, staff: string) {
    this.orderOpen = true; this.orderItems = c.items.map((i) => i.id);
    $('orderTitle').textContent = c.title;
    const who = $('orderWho'); who.innerHTML = ''; const b = document.createElement('b'); b.textContent = staff + ': '; who.append(b, document.createTextNode(c.hello));
    const box = $('menuItems'); box.innerHTML = '';
    c.items.forEach((it, i) => {
      const btn = document.createElement('button'); btn.dataset.item = it.id;
      const kb = document.createElement('kbd'); kb.textContent = String(i + 1); kb.setAttribute('aria-hidden', 'true');
      const sm = document.createElement('small'); sm.textContent = it.note;
      btn.append(kb, document.createTextNode(it.name), sm);
      btn.setAttribute('aria-label', `${it.name}. ${it.note}. Free.`);
      box.append(btn);
    });
    this.sheet('order', true);
  }
  closeOrder() { if (!this.orderOpen) return; this.orderOpen = false; this.sheet('order', false); }
  /** the order and holding chip, bottom left: making (with progress 0..1), ready to pick up, or what you hold */
  status(text: string | null, kind: 'making' | 'ready' | 'hold' = 'making', frac = 0) {
    const el = this.status2; el.classList.toggle('on', !!text);
    if (!text) return;
    el.classList.toggle('ready', kind === 'ready'); el.classList.toggle('hold', kind === 'hold');
    const p = Math.max(0, Math.min(1, frac));
    if (p !== this.statusP) { this.statusP = p; el.style.setProperty('--p', String(p)); }
    const t = this.status2Text; if (t.textContent !== text) t.textContent = text;
  }
  get statusText() { return this.status2.classList.contains('on') ? this.status2Text.textContent ?? '' : ''; }
  toast(text: string, seconds = 3) {
    if (text === this.lastToast && this.toastT > 0.5) { this.toastT = seconds; return; }
    this.lastToast = text; this.toastEl.textContent = text; this.toastEl.classList.add('on'); this.toastT = seconds;
  }
  /** take a toast off the screen now, if it's one that says `what` (the venue's open or closed, after the clock moved) */
  clearToast(what: RegExp) {
    if (!this.toastEl.classList.contains('on') || !what.test(this.toastEl.textContent ?? '')) return false;
    this.toastT = 0; this.toastEl.classList.remove('on'); this.lastToast = '';
    return true;
  }
  hint(show: boolean) { this.hintEl.style.opacity = show ? '1' : '0'; this.hintEl.style.display = show ? '' : 'none'; }
  get hintVisible() { return this.hintEl.style.display !== 'none'; }
  fadeHint() { this.hintEl.style.opacity = '0'; setTimeout(() => { this.hintEl.style.display = 'none'; }, document.body.classList.contains('rm') ? 0 : 650); }
  tick(dt: number) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) { this.toastEl.classList.remove('on'); this.lastToast = ''; } }
    if (this.capT > 0) { this.capT -= dt; if (this.capT <= 0) this.capEl.classList.remove('on'); }
  }
  get toastText() { return this.toastEl.classList.contains('on') ? this.toastEl.textContent ?? '' : ''; }
}

const coarseHint = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

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
