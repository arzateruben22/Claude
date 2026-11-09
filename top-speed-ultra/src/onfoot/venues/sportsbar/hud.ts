// The bar's HUD on top of Lot 57's (the module map's hud.ts row). Lot 57's Hud binds the element ids sportsbar.html
// carries (L17; P1b added the caption, the reply chips, the order and holding chip and the order sheet), so its toasts,
// hint, pause sheet, quality and clock controls, action buttons, crowd chip and order sheet work unchanged. BarHud
// adds the three-way view control (Lot 57's segView already passes a button's data-v, so data-v="overhead" arrives as
// onView('overhead')), the Ultra lock (an entitlement flag only: no price and no purchase path), and S2a's life-sim
// layer: the needs strip with the mood face, the needs panel, the action queue's icons, the TV chip and guide card
// with "Pick a side", the radial menu, the Cheer button, the tired prompt and the text size. Every need is shown with
// a word and a number, never by colour alone.
import { Hud } from '../../engine/hud';
import type { BarView } from './views';
import { SHOWN, ShownNeed, band, needWord, NEED_LABEL, MoodLabel } from '../../engine/sim/needs';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const ICONS: Record<string, string> = {
  hunger: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M17 3c-2 1-3 4-3 7h3v11"/>',
  thirst: '<path d="M6 4h12l-1.6 16H7.6zM7 9h10"/>',
  fun: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  social: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M13.5 20c.3-2.5 1.6-4 3-4s2.7 1.5 3 4"/>',
  energy: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  drink: '<path d="M6 4h12l-1.6 16H7.6zM7 9h10"/>',
  food: '<path d="M3 11h18l-2 8H5zM7 11l1-4M12 11V6M17 11l-1-4"/>',
  watch: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',
  dance: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  water: '<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z"/>',
  sit: '<path d="M6 21V11h12v10M6 15h12M8 11V4h8v7"/>',
  cheer: '<path d="M5 11l-2-7M19 11l2-7M8 21l4-9 4 9M12 12V8"/><circle cx="12" cy="5" r="2"/>',
  game: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
};
export const svgIcon = (k: string, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] ?? ICONS.sit}</svg>`;
const BAND_HEX = { good: '#6cc24a', fair: '#e8b931', low: '#ff6b4a' };
/** the mood face: a disc whose mouth follows the label */
export function moodFace(label: MoodLabel) {
  const mouth = { Elated: 'M7 13.5q5 6 10 0', Happy: 'M7.5 14q4.5 3.5 9 0', Fine: 'M8 15q4 1.5 8 0', Meh: 'M8 15.5h8', Low: 'M8 16.5q4-3 8 0' }[label];
  const fill = { Elated: '#C3F23A', Happy: '#9be06a', Fine: '#e8d48a', Meh: '#e8a868', Low: '#ff8a6a' }[label];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="${fill}" stroke="#141228" stroke-width="1.2"/><circle cx="8.6" cy="10" r="1.3" fill="#141228"/><circle cx="15.4" cy="10" r="1.3" fill="#141228"/><path d="${mouth}" fill="none" stroke="#141228" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

export interface RadialItem { label: string; key: string }
export interface GuideData { note: string; groups: { title: string; empty?: string; rows: { kickoff: string; home: string; away: string; homeCrest: string; awayCrest: string; score: string; state: string; featured: boolean }[] }[]; sides: { abbr: string; name: string; crest: string }[]; team: string | null }

export class BarHud {
  readonly hud: Hud;
  onNeeds: () => void = () => {};
  onGuide: () => void = () => {};
  onCancel: (id: number) => void = () => {};
  onRadial: (key: string) => void = () => {};
  onRadialClose: () => void = () => {};
  onCheer: () => void = () => {};
  onSide: (team: string | null) => void = () => {};
  onLeave: () => void = () => {};
  onText: (size: 0 | 1 | 2) => void = () => {};
  onSheet: (open: boolean) => void = () => {};
  radialOpen = false; radialItems: RadialItem[] = [];
  private needsEl = $('needs'); private rings: Record<string, { el: HTMLElement; arc: SVGCircleElement; word: HTMLElement }> = {};
  private moodEl: HTMLElement; private lastNeeds = ''; private lastQueue = ''; private lastTv = '';
  constructor(hud: Hud) {
    this.hud = hud;
    // the needs strip: five rings with icons, then the mood face and the emotion
    this.needsEl.innerHTML = SHOWN.map((k) => `<span class="ring" data-k="${k}"><svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12" fill="rgba(10,9,22,0.6)" stroke="rgba(241,239,231,0.22)" stroke-width="3"/><circle class="arc" cx="14" cy="14" r="12" fill="none" stroke="#6cc24a" stroke-width="3" stroke-linecap="round" transform="rotate(-90 14 14)" stroke-dasharray="75.4" stroke-dashoffset="0"/></svg>${svgIcon(k)}<b></b></span>`).join('') + '<span id="mood"></span>';
    for (const el of this.needsEl.querySelectorAll<HTMLElement>('.ring')) this.rings[el.dataset.k!] = { el, arc: el.querySelector('.arc') as SVGCircleElement, word: el.querySelector('b')! };
    this.moodEl = $('mood');
    // S2b's repair: the toasts sit under the top centre column (the needs, the place and the crowd chip) and the screens
    // chip, never over the "Simulated crowd" chip: their lowest bottom edge is measured whenever either changes size
    // or the window does (sportsbar.html's #toast reads --tcb), never per frame
    const tc = $('tc'), tv = $('tvchip'), hudEl = $('hud');
    const mark = () => { const a = tc.getBoundingClientRect(), b = tv.getBoundingClientRect(); if (a.height > 0) hudEl.style.setProperty('--tcb', `${Math.round(Math.max(a.bottom, b.height > 0 ? b.bottom : 0))}px`); };
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(mark); ro.observe(tc); ro.observe(tv); }
    addEventListener('resize', mark);
    this.needsEl.addEventListener('click', () => this.onNeeds());
    $('tvchip').addEventListener('click', () => this.onGuide());
    $('cheer').addEventListener('click', () => this.onCheer());
    $('queue').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.id) this.onCancel(Number(b.dataset.id)); });
    $('radial').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.key) this.onRadial(b.dataset.key); });
    $('sides').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b) this.onSide(b.dataset.team || null); });
    $('tiredLeave').addEventListener('click', () => { this.sheet('tired', false); this.onLeave(); });
    $('segText').addEventListener('click', (e) => { const t = (e.target as HTMLElement).dataset.t; if (t !== undefined) this.onText(Number(t) as 0 | 1 | 2); });
    for (const id of ['needsSheet', 'guide', 'tired']) {
      const el = $(id);
      el.querySelector('[data-close]')?.addEventListener('click', () => this.sheet(id, false));
      el.addEventListener('click', (e) => { if (e.target === el) this.sheet(id, false); });
    }
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      for (const id of ['needsSheet', 'guide', 'tired']) if ($(id).classList.contains('on')) { e.stopPropagation(); this.sheet(id, false); return; }
      if (this.radialOpen) { e.stopPropagation(); this.closeRadial(); this.onRadialClose(); }
    }, true);
  }
  // ------------------------------------------------------------------------------------------------ S1's controls
  /** Lot 57's setView for the person views; the bar sets the label and the three buttons itself for overhead */
  setView(v: BarView) {
    if (v !== 'overhead') this.hud.setView(v);
    $('viewLabel').textContent = v === 'first' ? '3rd' : v === 'third' ? 'Top' : '1st';
    $('viewBtn').setAttribute('aria-label', v === 'first' ? 'Switch to third person' : v === 'third' ? 'Switch to the overhead view' : 'Switch to first person');
    for (const b of $('segView').querySelectorAll('button')) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === v));
  }
  /** the Ultra button: unlocked by the shared entitlement (S4 reads RS2's), owner mode or the test build */
  setUltra(unlocked: boolean) {
    const b = $('segQ').querySelector('[data-q="ultra"]') as HTMLButtonElement | null;
    if (!b) return;
    b.textContent = unlocked ? 'Ultra' : 'Ultra · locked';
    if (unlocked) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
    b.dataset.locked = unlocked ? '' : '1';
  }
  /** a sheet painted over the paused game while a slow switch builds behind it */
  busy(text: string | null) {
    const el = $('busy');
    if (text) { el.textContent = text; el.classList.add('on'); } else el.classList.remove('on');
  }
  // ------------------------------------------------------------------------------------------------ S2a
  sheet(id: string, on: boolean) {
    this.hud.sheet(id, on);
    // Lot 57's sheet() focuses the first button, which can scroll a tall panel to its foot: start it at the top
    if (on) { const p = $(id).querySelector('.panel') as HTMLElement | null; if (p) p.scrollTop = 0; }
    this.onSheet(this.anySheet());
  }
  anySheet() { return ['needsSheet', 'guide', 'tired', 'order', 'pause', 'about'].some((id) => $(id).classList.contains('on')); }
  isOpen(id: string) { return $(id).classList.contains('on'); }
  /** the strip: each ring's fill and colour band, the low word under a ring under 30, the mood face and the emotion */
  setNeeds(n: Record<ShownNeed, number>, mood: { value: number; label: MoodLabel; emotion: string }) {
    const key = SHOWN.map((k) => Math.round(n[k])).join(',') + mood.label + mood.emotion;
    if (key === this.lastNeeds) return; this.lastNeeds = key;
    let anyLow = false;
    for (const k of SHOWN) {
      const r = this.rings[k], v = Math.max(0, Math.min(100, n[k])), b = band(v);
      r.arc.setAttribute('stroke-dashoffset', String((75.4 * (1 - v / 100)).toFixed(1)));
      r.arc.setAttribute('stroke', BAND_HEX[b]);
      r.el.classList.toggle('low', b === 'low'); if (b === 'low') { anyLow = true; r.word.textContent = needWord(k, v); }
    }
    this.needsEl.classList.toggle('lowRow', anyLow);
    this.needsEl.setAttribute('aria-label', 'Your needs: ' + SHOWN.map((k) => `${NEED_LABEL[k]} ${Math.round(n[k])}, ${needWord(k, n[k])}`).join('; ') + `. Mood ${mood.label}, ${mood.emotion}. Open the panel (Tab).`);
    this.moodEl.innerHTML = moodFace(mood.label) + `<span>${esc(mood.emotion === 'Fine' ? mood.label : mood.emotion)}</span>`;
  }
  /** the needs panel's content (labelled bars with the word and the number, the moodlets, the tokens, tonight's three) */
  fillNeeds(d: { needs: Record<ShownNeed, number>; mood: { value: number; label: string; emotion: string }; moodlets: { label: string; value: number; left: number | null }[]; tokens: number; tokenNote: string; three: { text: string; done: boolean }[]; save: string }) {
    $('needRows').innerHTML = SHOWN.map((k) => { const v = d.needs[k], b = band(v); return `<div class="needrow">${svgIcon(k, '')}<span>${NEED_LABEL[k]}</span><span class="bar"><i class="${b}" style="width:${Math.round(v)}%"></i></span><span class="word">${needWord(k, v)}</span><span class="num">${Math.round(v)}</span></div>`; }).join('');
    $('moodLine').innerHTML = `<b>Mood ${Math.round(d.mood.value)} · ${esc(d.mood.label)}</b> · feeling ${esc(d.mood.emotion.toLowerCase())}`;
    $('moodlets').innerHTML = d.moodlets.length ? d.moodlets.map((m) => `<li><span>${esc(m.label)}</span><span>${m.value > 0 ? '+' : ''}${m.value.toFixed(0)}${m.left !== null ? ` · ${Math.ceil(m.left)} min` : ''}</span></li>`).join('') : '<li><span>Nothing in particular</span><span></span></li>';
    $('tokenLine').textContent = `${d.tokens} house tokens`;
    $('tokenNote').textContent = d.tokenNote;
    const three = d.three.map((g) => `<li class="${g.done ? 'done' : ''}">${esc(g.text)}${g.done ? ' · done' : ''}</li>`).join('');
    $('threeList').innerHTML = three; $('saveNote').textContent = d.save;
    $('pauseTokens').textContent = `${d.tokens} house tokens`; $('pauseTokenNote').textContent = d.tokenNote; $('pauseThree').innerHTML = three; $('pauseSave').textContent = d.save;
  }
  /** the queue's icons (up to 3, 40 px; tap one to cancel it) */
  setQueue(items: { id: number; icon: string; label: string; now: boolean }[]) {
    const key = items.map((i) => `${i.id}${i.now ? '*' : ''}`).join(',');
    if (key === this.lastQueue) return; this.lastQueue = key;
    $('queue').innerHTML = items.map((i, k) => `<button data-id="${i.id}" class="${i.now ? 'now' : ''}" aria-label="${esc(i.label)}: tap to cancel">${svgIcon(i.icon, '')}<i aria-hidden="true">${k + 1}</i></button>`).join('');
  }
  setTv(text: string) { if (text === this.lastTv) return; this.lastTv = text; $('tvText').textContent = text; }
  fillGuide(d: GuideData) {
    $('guideNote').textContent = d.note;
    $('guideList').innerHTML = d.groups.map((g) => `<h3>${esc(g.title)}</h3>` + (g.rows.length ? g.rows.map((r) => `<div class="fx${r.featured ? ' feat' : ''}"><span class="t">${r.kickoff}</span>${r.homeCrest}<span>${esc(r.home)} v ${esc(r.away)}${r.featured ? ' · featured' : ''}<br><small>${esc(r.state)}</small></span>${r.awayCrest}<span class="s">${esc(r.score)}</span></div>`).join('') : `<p class="small">${esc(g.empty ?? 'No fixtures today.')}</p>`)).join('');
    $('sides').innerHTML = d.sides.map((s) => `<button data-team="${s.abbr}" aria-pressed="${d.team === s.abbr}">${s.crest}${esc(s.name)}</button>`).join('') + `<button data-team="" aria-pressed="${d.team === null}">No side</button>`;
  }
  /** the radial menu round a point: up to 6 pills, clamped on screen and kept below the needs strip (so a menu opened
   *  high up, on the big screen, never covers it) and above the map credit; keys 1 to 6 pick */
  radial(x: number, y: number, title: string, items: RadialItem[]) {
    const el = $('radial'), portrait = innerHeight > innerWidth, n = items.length;
    const strip = $('needs').getBoundingClientRect(), credit = $('credit').getBoundingClientRect();
    const top = (strip.height ? strip.bottom : 0) + 6, bottom = credit.height ? Math.min(innerHeight, credit.top) - 6 : innerHeight - 8, HALF = 34;
    // the ring's radius: the usual, or less on a screen too short for it between the strip and the credit
    const R = Math.max(56, Math.min(portrait ? 80 : 92, (bottom - top) / 2 - HALF));
    const cx = Math.max(R + 60, Math.min(innerWidth - R - 60, x)), cy = Math.max(top + R + HALF, Math.min(bottom - R - HALF, y));
    this.radialItems = items; this.radialOpen = true;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    el.innerHTML = `<span class="hub" style="left:${cx}px;top:${cy}px"></span><span class="title" style="left:${cx}px;top:${cy + (n > 1 ? 0 : -44)}px">${esc(title)}</span>` + items.map((it, i) => {
      const a = -Math.PI / 2 + (n > 1 ? (i / n) * Math.PI * 2 : 0), px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      return `<button role="menuitem" data-key="${esc(it.key)}" style="left:${px.toFixed(0)}px;top:${py.toFixed(0)}px">${esc(it.label)}${coarse ? '' : `<kbd>${i + 1}</kbd>`}</button>`;
    }).join('');
    el.classList.add('on');
    // measured: a pill that wraps to three lines is taller than the estimate; the whole ring moves down to clear the strip
    let hi = Infinity; for (const b of el.querySelectorAll('button')) hi = Math.min(hi, b.getBoundingClientRect().top);
    if (hi < top) for (const c of el.children) { const e2 = c as HTMLElement; e2.style.top = `${parseFloat(e2.style.top) + (top - hi)}px`; }
    (el.querySelector('button') as HTMLElement | null)?.focus();
  }
  closeRadial() { this.radialOpen = false; this.radialItems = []; const el = $('radial'); el.classList.remove('on'); el.innerHTML = ''; }
  /** the big Cheer button takes the action button's place for 8 s after a moment */
  cheer(on: boolean) { $('cheer').classList.toggle('on', on); if (on) { this.hud.act.classList.remove('on'); this.hud.act2.classList.remove('on'); } }
  get cheering() { return $('cheer').classList.contains('on'); }
  setText(size: 0 | 1 | 2) {
    document.documentElement.classList.remove('t0', 't1', 't2'); document.documentElement.classList.add('t' + size);
    for (const b of $('segText').querySelectorAll('button')) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.t === String(size)));
  }
}
