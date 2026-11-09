// The broadcast pictures (PROJECT_OC_SPORTS_BAR.md, "The broadcast picture"): drawn in canvas, one picture per channel
// shared by every screen on it. The three channels are cells of one canvas texture (an atlas), so the twelve screens
// stay one draw call: Marigold (a tilted pitch, 22 dots that hold a shape and drift with the ball, the ball's run to
// goal on a chance), Canyon Gridiron (a field with yard lines, the snap and the runs) and the highlights. GOAL and
// TOUCHDOWN banners in the scoring team's colours; the score bug ("HBL 1–0 ARK · 14'"); a SIMULATED tag in the corner
// of every frame on every screen, and never the word for a broadcast that isn't one. Resolution and redraw rate by
// preset: Low 512 x 288 at 8 Hz, HD 1024 x 576 at 15 Hz, Ultra 1024 x 576 at 30 Hz.
import * as THREE from 'three';
import { Tv, Fixture, TvEvent, fromAbs, hhmm, DAY_NAMES } from './tv';
import { LEAGUES, Team, CHANNEL_NAMES } from './leagues';
import type { Quality } from '../mats';

const WIDE = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const SANS = '"Avenir Next", "Segoe UI", system-ui, Arial, sans-serif';
export const CELL: Record<Quality, { w: number; h: number; hz: number }> = { low: { w: 512, h: 288, hz: 8 }, high: { w: 1024, h: 576, hz: 15 }, ultra: { w: 1024, h: 576, hz: 30 } };
/** where each channel sits in the atlas (cell column, row): 1, 2 and 3, and the house card */
const CELLS: Record<1 | 2 | 3 | 4, [number, number]> = { 1: [0, 0], 2: [1, 0], 3: [0, 1], 4: [1, 1] };
const BANNER_MIN = 10 / 60;     // a banner shows for 10 s of sim time after a score

export class Broadcast {
  canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; texture: THREE.CanvasTexture;
  w = 512; h = 288; hz = 8; private lastDraw = -1e9; quality: Quality = 'low';
  reduced = false;
  /** every frame drawn on every channel: how many, how many lacked the SIMULATED tag, how many said the word */
  stats = { frames: 0, missingTag: 0, liveWord: 0, strings: 0 };
  private log: string[] = [];
  private last: Record<1 | 2, TvEvent | null> = { 1: null, 2: null };
  /** the events buffer the banner scan reuses (the schedule's own buffer is the sim's) */
  private evs: TvEvent[] = [];
  constructor(private tv: Tv, private houseCard: { title: string; line: string } = { title: '', line: 'Fictional leagues · simulated matches' }) {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false; this.texture.minFilter = THREE.LinearFilter; this.texture.magFilter = THREE.LinearFilter;
    this.setQuality('low');
  }
  setQuality(q: Quality) {
    const c = CELL[q]; this.quality = q; this.hz = c.hz;
    if (this.w === c.w && this.canvas.width === c.w * 2) return;
    this.w = c.w; this.h = c.h; this.canvas.width = c.w * 2; this.canvas.height = c.h * 2;
    // a new size needs a new texture on the GPU (three.js 0.160 doesn't resize an uploaded canvas texture)
    const old = this.texture; this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.generateMipmaps = false; this.texture.minFilter = THREE.LinearFilter; this.texture.magFilter = THREE.LinearFilter;
    old.dispose();
    this.lastDraw = -1e9;
  }
  /** the UV rectangle of a channel's cell (the canvas texture's v runs bottom up) */
  uv(ch: 1 | 2 | 3 | 4) { const [cx, cy] = CELLS[ch]; return { u0: cx / 2, u1: (cx + 1) / 2, v0: 1 - (cy + 1) / 2, v1: 1 - cy / 2 }; }
  /** redraw every channel if its interval (1 / hz of real time) has passed; a = the sim minute, now = real seconds */
  update(a: number, now: number, force = false) {
    if (!force && now - this.lastDraw < 1 / this.hz) return false;
    this.lastDraw = now;
    for (const e of this.tv.eventsBetween(a - BANNER_MIN, a, this.evs)) if (e.channel === 1 || e.channel === 2) if (e.kind === 'goal' || e.kind === 'td' || e.kind === 'fg') this.last[e.channel] = e;
    this.cell(1, () => this.sport(1, a, now));
    this.cell(2, () => this.sport(2, a, now));
    this.cell(3, () => this.highlights(a, now));
    this.cell(4, () => this.house());
    this.texture.needsUpdate = true;
    return true;
  }
  /** draw one cell, clipped, and count the frame for the honesty check */
  private cell(ch: 1 | 2 | 3 | 4, draw: () => void) {
    const g = this.g, [cx, cy] = CELLS[ch];
    this.log = [];
    g.save(); g.translate(cx * this.w, cy * this.h); g.beginPath(); g.rect(0, 0, this.w, this.h); g.clip();
    draw();
    this.tag();
    g.restore();
    this.stats.frames++; this.stats.strings += this.log.length;
    if (!this.log.includes('SIMULATED')) this.stats.missingTag++;
    if (this.log.some((s) => /\blive\b/i.test(s))) this.stats.liveWord++;
  }
  // ------------------------------------------------------------------------------------------------ drawing helpers
  private get s() { return this.w / 1024; }
  private font(px: number, wide = true, weight = 800) { this.g.font = `${weight} ${Math.round(px * this.s)}px ${wide ? WIDE : SANS}`; }
  private text(t: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
    const g = this.g; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x * this.s, y * this.s); this.log.push(t);
  }
  private rr(x: number, y: number, w: number, h: number, r: number, fill: string) {
    const g = this.g, s = this.s; x *= s; y *= s; w *= s; h *= s; r *= s;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fillStyle = fill; g.fill();
  }
  /** the SIMULATED corner tag, in every frame */
  private tag() { this.rr(800, 18, 206, 50, 12, 'rgba(10, 9, 22, 0.86)'); this.font(28, false, 800); this.text('SIMULATED', 903, 44, '#C3F23A', 'center'); }
  private crest(t: Team, x: number, y: number, r: number) {
    const g = this.g, s = this.s; x *= s; y *= s; r *= s;
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y - r * 0.7); g.lineTo(x + r * 0.8, y); g.quadraticCurveTo(x + r * 0.75, y + r * 0.75, x, y + r); g.quadraticCurveTo(x - r * 0.75, y + r * 0.75, x - r * 0.8, y); g.lineTo(x - r * 0.8, y - r * 0.7); g.closePath();
    g.fillStyle = t.colors[0]; g.fill(); g.lineWidth = Math.max(1, r * 0.12); g.strokeStyle = t.colors[1]; g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.8, y - r * 0.05); g.lineTo(x + r * 0.8, y - r * 0.05); g.stroke();
  }
  private bug(f: Fixture, a: number) {
    const sc = this.tv.scoreAt(f, a), clock = this.tv.clockLabel(f, a);
    this.rr(18, 18, 520, 56, 12, 'rgba(10, 9, 22, 0.88)');
    this.rr(26, 28, 14, 36, 4, f.home.colors[0]); this.rr(500, 28, 14, 36, 4, f.away.colors[0]);
    this.font(30); this.text(`${f.home.abbr} ${sc[0]}–${sc[1]} ${f.away.abbr} · ${clock}`, 270, 47, '#F1EFE7', 'center');
  }
  /** the perspective pitch or field: (px along its length 0..1, py across 0..1) to canvas pixels */
  private P(px: number, py: number): [number, number] {
    const top = 150, bot = 545, tw = 640, bw = 990, y = top + (bot - top) * py, hw = (tw + (bw - tw) * py) / 2;
    return [(512 + (px - 0.5) * 2 * hw) * this.s, y * this.s];
  }
  private poly(pts: [number, number][], fill: string | null, stroke?: string, lw = 3) {
    const g = this.g; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * this.s; g.stroke(); }
  }
  private line(a: [number, number], b: [number, number], stroke: string, lw = 3) { const g = this.g; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.strokeStyle = stroke; g.lineWidth = lw * this.s; g.stroke(); }
  private dot(px: number, py: number, r: number, fill: string, ring?: string) {
    const g = this.g, [x, y] = this.P(px, py), k = (0.75 + 0.35 * py) * this.s;
    g.beginPath(); g.arc(x, y, r * k, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    if (ring) { g.lineWidth = 2 * k; g.strokeStyle = ring; g.stroke(); }
  }
  private sky(top: string, bottom: string) { const g = this.g, gr = g.createLinearGradient(0, 0, 0, this.h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h); }
  private banner(e: TvEvent | null, a: number, f: Fixture | null, now: number) {
    if (!e || !f || e.fixture !== f.id || a - e.t > BANNER_MIN || a < e.t) return;
    const team = e.team === f.home.abbr ? f.home : f.away, word = e.kind === 'goal' ? 'GOAL' : e.kind === 'td' ? 'TOUCHDOWN' : 'FIELD GOAL';
    const age = (a - e.t) * 60, slide = this.reduced ? 0 : Math.max(0, 1 - age / 0.5) * -700;
    const pulse = this.reduced ? 1 : 1 + 0.04 * Math.sin(now * 8);
    const g = this.g; g.save(); g.translate(slide * this.s, 0);
    this.rr(112, 222, 800, 150, 18, team.colors[0]);
    this.rr(112, 348, 800, 24, 0, team.colors[1]);
    g.save(); g.translate(512 * this.s, 286 * this.s); g.scale(pulse, pulse); g.translate(-512 * this.s, -286 * this.s);
    this.font(word.length > 6 ? 84 : 112); this.text(word, 512, 286, team.colors[1], 'center');
    g.restore();
    this.font(26, false, 800); this.text(`${team.name} · ${e.label}`, 512, 360, team.colors[0], 'center');
    g.restore();
  }
  private card(title: string, f: Fixture, lines: string[]) {
    this.rr(160, 150, 704, 300, 22, 'rgba(10, 9, 22, 0.86)');
    this.font(40); this.text(title, 512, 200, '#C3F23A', 'center');
    this.crest(f.home, 280, 300, 52); this.crest(f.away, 744, 300, 52);
    this.font(30); this.text(f.home.abbr, 280, 380, '#F1EFE7', 'center'); this.text(f.away.abbr, 744, 380, '#F1EFE7', 'center');
    lines.forEach((l, i) => { this.font(i ? 24 : 64, i === 0, i ? 600 : 900); this.text(l, 512, 300 + i * 70, '#F1EFE7', 'center'); });
  }
  // ------------------------------------------------------------------------------------------------ the channels
  private sport(ch: 1 | 2, a: number, now: number) {
    const st = this.tv.onChannel(ch, a), lg = ch === 1 ? LEAGUES.marigold : LEAGUES.gridiron;
    this.sky('#10142a', '#1d2a1c');
    const f = st.fixture;
    if (ch === 1) this.pitch(f, a, now); else this.field(f, a, now);
    if (f && (st.phase === 'play' || st.phase === 'half')) {
      this.bug(f, a);
      if (st.phase === 'half') { const sc = this.tv.scoreAt(f, a); this.card(ch === 1 ? 'HALF-TIME' : 'HALF-TIME', f, [`${sc[0]}–${sc[1]}`, lg.name]); }
      this.banner(this.last[ch], a, f, now);
    } else if (f && st.phase === 'card') {
      this.card(ch === 1 ? 'FULL TIME' : 'FINAL', f, [`${f.final[0]}–${f.final[1]}`, `${f.home.name} v ${f.away.name}`]);
    } else if (st.next) {
      const n = st.next, same = fromAbs(n.ko).day === fromAbs(a).day;
      this.card('UP NEXT', n, ['v', `${same ? 'Kick-off' : DAY_NAMES[fromAbs(n.ko).day]} ${hhmm(n.ko)} · simulated`]);
    } else {
      this.rr(160, 180, 704, 220, 22, 'rgba(10, 9, 22, 0.86)'); this.font(44); this.text(lg.name.toUpperCase(), 512, 250, '#C3F23A', 'center');
      this.font(26, false, 600); this.text('Fictional league · simulated matches', 512, 320, '#F1EFE7', 'center');
    }
    this.font(22, false, 700); this.text(CHANNEL_NAMES[ch].toUpperCase(), 30, 548, 'rgba(241, 239, 231, 0.8)');
  }
  /** the Marigold pitch: stripes, lines, two shapes of 11 that drift with the ball, the ball's run on a chance */
  private pitch(f: Fixture | null, a: number, _now: number) {
    const P = this.P.bind(this);
    for (let k = 0; k < 10; k++) this.poly([P(k / 10, 0), P((k + 1) / 10, 0), P((k + 1) / 10, 1), P(k / 10, 1)], k % 2 ? '#2f7d36' : '#2a7131');
    const W = 'rgba(255,255,255,0.85)';
    this.poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], null, W); this.line(P(0.5, 0), P(0.5, 1), W);
    const circ: [number, number][] = []; for (let k = 0; k < 24; k++) { const t = (k / 24) * Math.PI * 2; circ.push(P(0.5 + 0.08 * Math.cos(t), 0.5 + 0.16 * Math.sin(t))); }
    this.poly(circ, null, W);
    for (const x0 of [0, 1]) { const d = x0 ? -1 : 1; this.poly([P(x0, 0.22), P(x0 + d * 0.16, 0.22), P(x0 + d * 0.16, 0.78), P(x0, 0.78)], null, W); this.poly([P(x0, 0.4), P(x0 - d * 0.015, 0.4), P(x0 - d * 0.015, 0.6), P(x0, 0.6)], '#e8e8e8'); }
    if (!f) return;
    const t = (a - f.ko) * 60, seed = f.ko % 97;
    // the ball: a smooth wander, and on a chance in the last 6 s a run to the attacking goal
    let bx = 0.5 + 0.3 * Math.sin(t * 0.21 + seed) + 0.08 * Math.sin(t * 0.83 + seed * 2), by = 0.5 + 0.28 * Math.sin(t * 0.17 + seed * 3) + 0.08 * Math.sin(t * 0.61);
    for (const e of f.events) {
      const dt = (a - e.t) * 60; if (e.kind !== 'goal' && e.kind !== 'bigChance') continue;
      if (dt > -6 && dt < 1.5) { const k = Math.min(1, (dt + 6) / 6), gx = e.team === f.home.abbr ? 1 : 0; bx = bx + (gx - bx) * k; by = by + (0.5 + (e.kind === 'goal' ? 0 : 0.12) - by) * k; }
    }
    const shape: [number, number][] = [[0.05, 0.5], [0.2, 0.18], [0.2, 0.39], [0.2, 0.61], [0.2, 0.82], [0.38, 0.14], [0.38, 0.38], [0.38, 0.62], [0.38, 0.86], [0.55, 0.4], [0.55, 0.6]];
    const draw = (team: Team, mirror: boolean, phase: number) => shape.forEach(([x, y], i) => {
      const px = (mirror ? 1 - x : x) + (bx - 0.5) * (i ? 0.38 : 0.06) + 0.012 * Math.sin(t * 0.9 + i + phase);
      const py = y + (by - 0.5) * (i ? 0.3 : 0.1) + 0.015 * Math.sin(t * 0.7 + i * 1.7 + phase);
      this.dot(Math.min(0.99, Math.max(0.01, px)), Math.min(0.98, Math.max(0.02, py)), 9, team.colors[0], team.colors[1]);
    });
    draw(f.home, false, 0); draw(f.away, true, 2);
    this.dot(bx, by, 6, '#ffffff', '#111111');
  }
  /** the gridiron field: end zones in the teams' colours, yard lines, the line of scrimmage, the snap and the runs */
  private field(f: Fixture | null, a: number, _now: number) {
    const P = this.P.bind(this);
    for (let k = 0; k < 12; k++) this.poly([P(k / 12, 0), P((k + 1) / 12, 0), P((k + 1) / 12, 1), P(k / 12, 1)], k === 0 ? (f ? f.home.colors[0] : '#2a5a2a') : k === 11 ? (f ? f.away.colors[0] : '#2a5a2a') : k % 2 ? '#2f7d36' : '#2b7432');
    const W = 'rgba(255,255,255,0.85)';
    this.poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], null, W);
    for (let k = 1; k <= 11; k++) this.line(P(k / 12, 0), P(k / 12, 1), W, k === 6 ? 4 : 2);
    for (let k = 1; k <= 5; k++) { const [x, y] = P(k / 12 + 1 / 24, 0.12); this.g.save(); this.font(20); this.text(String(k * 10 > 50 ? 100 - k * 10 : k * 10), x / this.s, y / this.s, 'rgba(255,255,255,0.7)', 'center'); this.g.restore(); }
    if (!f) return;
    const t = (a - f.ko) * 60, play = (t % 12) / 12, drive = 0.5 + 0.3 * Math.sin(t * 0.031 + f.ko);
    const los = Math.min(0.88, Math.max(0.12, drive + (play > 0.25 ? Math.min(1, (play - 0.25) / 0.5) * 0.06 : 0)));
    this.line(P(los, 0), P(los, 1), 'rgba(80, 160, 255, 0.9)', 3);
    for (let i = 0; i < 11; i++) {
      const y = 0.18 + (i / 10) * 0.64, run = play > 0.25 ? Math.min(1, (play - 0.25) / 0.5) : 0;
      const ox = los - 0.02 - (i === 5 ? 0.05 : 0) + run * (0.05 + 0.04 * Math.sin(i * 1.3)), oy = y + run * 0.06 * Math.sin(i * 2.1 + t * 0.1);
      const dx = los + 0.025 + (i % 3 === 0 ? 0.05 : 0) + run * (0.03 + 0.02 * Math.cos(i)), dy = y + run * 0.05 * Math.cos(i * 1.7);
      this.dot(ox, oy, 8, f.home.colors[0], f.home.colors[1]); this.dot(dx, dy, 8, f.away.colors[0], f.away.colors[1]);
    }
    this.dot(los - 0.03 + (play > 0.25 ? Math.min(1, (play - 0.25) / 0.5) * 0.08 : 0), 0.5, 5, '#7a4a22', '#f1efe7');
  }
  private highlights(a: number, now: number) {
    const h = this.tv.highlights(a);
    this.sky('#1a1636', '#0e0c20');
    this.rr(18, 18, 760, 56, 12, 'rgba(195, 242, 58, 0.16)'); this.font(30); this.text(h.title, 36, 47, '#F1EFE7');
    if (!h.items.length) { this.font(34, false, 700); this.text('No highlights yet · simulated', 512, 300, '#F1EFE7', 'center'); return; }
    const k = Math.floor(now / 8) % h.items.length, it = h.items[k], p = (now % 8) / 8;
    // the replay: a small pitch or field and the run to the goal line
    const box = (x: number, y: number, w: number, hh: number, c: string) => this.rr(x, y, w, hh, 10, c);
    box(40, 100, 600, 380, '#2a7131');
    const team = it.e.team === it.f.home.abbr ? it.f.home : it.f.away, toRight = team === it.f.home;
    const g = this.g, s = this.s;
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3 * s; g.strokeRect(60 * s, 120 * s, 560 * s, 340 * s); g.beginPath(); g.moveTo(340 * s, 120 * s); g.lineTo(340 * s, 460 * s); g.stroke();
    const bx = 340 + (toRight ? 1 : -1) * 270 * Math.min(1, p * 1.4), by = 290 + 60 * Math.sin(p * 5 + it.e.t);
    g.beginPath(); g.arc(bx * s, by * s, 9 * s, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc((bx - (toRight ? 1 : -1) * (30 + i * 26)) * s, (by + (i - 1.5) * 34) * s, 11 * s, 0, Math.PI * 2); g.fillStyle = team.colors[0]; g.fill(); g.lineWidth = 2 * s; g.strokeStyle = team.colors[1]; g.stroke(); }
    const word = it.e.kind === 'goal' ? 'GOAL' : it.e.kind === 'td' ? 'TOUCHDOWN' : 'FIELD GOAL';
    this.font(30); this.text(`${word} · ${team.name}`, 340, 512, '#F1EFE7', 'center');
    // the list
    h.items.slice(0, 5).forEach((x, i) => {
      const on = x === it; this.rr(664, 100 + i * 76, 340, 64, 10, on ? 'rgba(195, 242, 58, 0.22)' : 'rgba(241, 239, 231, 0.08)');
      this.font(22); this.text(`${x.f.home.abbr} ${x.e.score[0]}–${x.e.score[1]} ${x.f.away.abbr}`, 684, 122 + i * 76, '#F1EFE7');
      this.font(18, false, 600); this.text(`${x.e.label} · ${x.e.kind === 'goal' ? 'goal' : x.e.kind === 'td' ? 'touchdown' : 'field goal'}`, 684, 148 + i * 76, 'rgba(241, 239, 231, 0.85)');
    });
  }
  private house() {
    this.sky('#1E1B3A', '#141228');
    this.font(64); this.text(this.houseCard.title.toUpperCase(), 512, 260, '#F1EFE7', 'center');
    this.font(26, false, 700); this.text(this.houseCard.line, 512, 330, '#C3F23A', 'center');
  }
}
