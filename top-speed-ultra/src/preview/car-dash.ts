// The cars' live instrument clusters (owner, 2026-11-11: "Make the digital dashboard have more information"), drawn in
// code on canvases, each car in its own style:
//   hyperDash(q)          the OC Hypercar's wide driver display (ice blue, angular): a rev arc whose redline lights with
//                         the wheel's red shift lights, the speed and gear, the handling profile, TCS and ABS, the tune
//                         and the Thrust tank, the next turn and the destination (Go To), the clock and temperature (sim),
//                         trip and top speed, the power in use and a small G-meter. One atlas with the centre screen (its
//                         drive mode and assists), the layout of car-gauges' hyper display
//   velaDash(q)           the Vela E's wide display (blue on black, soft): the same facts in its own layout; the battery
//                         and range it used to print are gone (the game doesn't simulate a battery)
//   rossiniDash(accent, q) the Rossinis' (GT, Corsa, Brio): the round tachometer keeps its printed face; its digital
//                         window becomes live (gear and speed, the clock), and the two small displays either side
//                         show the drive data (left: the profile, TCS, ABS, trip, top speed, a G-meter) and the
//                         navigation (right: the next turn and its distance, the destination and its distance, the
//                         temperature, sim). The tyre pressures, oil and water temperatures they used to print were invented: gone
// Every value shown is the game's own state (DashReadout): nothing the game doesn't simulate. What each display can
// show from the seat was measured (a ray from the eye to each part of each display, against the rim, spokes and hands):
// the hypercar's display is open in a window in its middle under the rim, its top corners and its far right; the
// Rossinis' side displays only on their inner thirds; the Vela's left of the rim and right of the right hand. The big
// figures and the facts that matter sit in those parts.
// Each painter redraws its canvas only when what it shows changes: update() quantises the readout into a fixed array
// and compares it with the last one drawn (no allocation when nothing changed); the cockpit looks at each at most 15
// times a second on High, 8 on phones, one display a frame in turn (so the Rossinis' three never redraw and upload on
// the same frame), and on phones the drawing is simpler (no gradients, no G-meter dot) and the Rossinis' canvases are
// half size (still more pixels than the displays cover on a phone's screen).
import * as THREE from 'three';
import { once, canvas } from './car-tex';
import { drawOcMark } from './oc-mark';

const FONT = 'Arial, Helvetica, sans-serif';
export type DashTurn = '' | 'left' | 'right' | 'ahead';
export interface DashReadout {
  mph: number; gear: string; rpm: number; rpmFrac: number; kw: number; kwMax: number; mode: string;
  profile: string; tcs: boolean; abs: boolean;
  // this run: distance (miles) and top speed (mph); the sky's clock and the simulated air temperature
  tripMi: number; topMph: number; clock: string; tempF: number;
  // the OC Hypercar's tune ('Unleashed', 'Race tune'; '' for the others) and its Thrust tank (0..1; live or not); with
  // THRUST live, Ground Lock's fans running and the hop's state as the HUD words it ('Hop ready', 'Hop: charging',
  // 'Hop: tank low', 'Airborne', or a refusal's reason for a moment)
  tune: string; tank: number; thrustLive: boolean; lock: boolean; hop: string;
  // Go To (the HUD's own figures): the next manoeuvre's way and distance (miles), where it leads, the destination's
  // name and its distance along the route (miles); '' with no route. road: the road you're on
  turn: DashTurn; nextMi: number; navTo: string; dest: string; destMi: number; road: string;
  // the body's acceleration in g: gx to the right, gy forward
  gx: number; gy: number;
  // the redline lit: the cockpit sets it with the wheel's red shift lights (the same test, the same flash)
  redline: boolean;
}
export function dashReadout(): DashReadout {
  return { mph: 0, gear: 'N', rpm: 0, rpmFrac: 0, kw: 0, kwMax: 1, mode: '', profile: 'sport', tcs: true, abs: true, tripMi: 0, topMph: 0, clock: '', tempF: 0,
    tune: '', tank: 0, thrustLive: false, lock: false, hop: '', turn: '', nextMi: 0, navTo: '', dest: '', destMi: 0, road: '', gx: 0, gy: 0, redline: false };
}
export interface DashPainter {
  tex: THREE.CanvasTexture;
  // how many times it has drawn, and the words it shows now (the suite reads these)
  draws: number; shown: Record<string, string>;
  // draw if what it shows changed; true when it drew
  update(r: DashReadout, low: boolean): boolean;
}

// ------------------------------------------------------------------------------------------------ helpers
const clamp01 = (v: number) => (v > 1 ? 1 : v > 0 ? v : 0);
const PROFILE: Record<string, string> = { arcade: 'ARCADE', sport: 'SPORT', sim: 'SIM', custom: 'CUSTOM' };
export const profileWord = (p: string) => PROFILE[p] ?? 'CUSTOM';
// a distance in miles as the HUD puts it: feet under a tenth of a mile, tenths under ten miles, whole miles beyond
export function miles(mi: number) { return mi < 0.1 ? `${Math.max(0, Math.round((mi * 5280) / 50) * 50)} ft` : mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`; }
const qMi = (mi: number) => (mi < 0.1 ? Math.round((mi * 5280) / 50) : 1000 + (mi < 10 ? Math.round(mi * 10) : 1000 + Math.round(mi)));
const gearWord = (g: string) => g || 'N';
// a line of text, shrunk to fit maxW (and cut with an ellipsis below minPx)
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, col: string, weight = 600, align: CanvasTextAlign = 'left', maxW = 0, minPx = 0) {
  g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.font = `${weight} ${px}px ${FONT}`;
  if (maxW > 0) {
    let w = g.measureText(s).width;
    if (w > maxW) {
      const fit = Math.floor((px * maxW) / w);
      if (fit >= (minPx || px * 0.7)) g.font = `${weight} ${fit}px ${FONT}`;
      else { g.font = `${weight} ${minPx || Math.round(px * 0.7)}px ${FONT}`; while (s.length > 2 && (w = g.measureText(s + '…').width) > maxW) s = s.slice(0, -1); s += '…'; }
    }
  }
  g.fillText(s, x, y);
}
// the next manoeuvre's arrow, in a box s across centred at (x, y): straight on, or a fork to the right or left
function turnArrow(g: CanvasRenderingContext2D, x: number, y: number, s: number, turn: DashTurn, col: string) {
  g.save(); g.translate(x, y); g.scale(s / 40, s / 40);
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  const head = (px: number, py: number, a: number) => {
    g.beginPath(); g.moveTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9); g.lineTo(px + Math.cos(a + 2.3) * 9, py + Math.sin(a + 2.3) * 9); g.lineTo(px + Math.cos(a - 2.3) * 9, py + Math.sin(a - 2.3) * 9); g.closePath(); g.fill();
  };
  if (turn === 'left' || turn === 'right') {
    const d = turn === 'right' ? 1 : -1;
    g.beginPath(); g.moveTo(-d * 7, 19); g.lineTo(-d * 7, 2); g.lineTo(d * 6, -9); g.stroke();
    head(d * 9, -12, Math.atan2(-1, d * 1.1));
    g.globalAlpha = 0.35; g.beginPath(); g.moveTo(-d * 7, 2); g.lineTo(-d * 7, -14); g.stroke(); g.globalAlpha = 1;
  } else { g.beginPath(); g.moveTo(0, 19); g.lineTo(0, -6); g.stroke(); head(0, -12, -Math.PI / 2); }
  g.restore();
}
// an assist's chip: lit when on; struck through in amber when off
function chip(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, on: boolean, acc: string, px: number, low: boolean) {
  g.lineWidth = Math.max(1.5, h * 0.08);
  g.beginPath(); g.roundRect(x, y, w, h, h * 0.22);
  if (on) { if (!low) { g.fillStyle = acc; g.globalAlpha = 0.22; g.fill(); g.globalAlpha = 1; } g.strokeStyle = acc; g.stroke(); }
  else { g.strokeStyle = '#ff9a5c'; g.stroke(); }
  text(g, label, x + w / 2, y + h / 2 + 1, px, on ? '#f2f6fa' : '#ff9a5c', 700, 'center');
  if (!on) { g.strokeStyle = '#ff9a5c'; g.beginPath(); g.moveTo(x + 3, y + h - 3); g.lineTo(x + w - 3, y + 3); g.stroke(); }
}
// a small G-meter: rings and a dot at the body's acceleration (1.5 g at the rim)
function gMeter(g: CanvasRenderingContext2D, x: number, y: number, r: number, gx: number, gy: number, ring: string, dot: string, low: boolean) {
  g.strokeStyle = ring; g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
  if (low) return;
  const k = r / 1.5, dx = Math.max(-1.5, Math.min(1.5, gx)) * k, dy = Math.max(-1.5, Math.min(1.5, gy)) * k;
  g.fillStyle = dot; g.beginPath(); g.arc(x + dx, y - dy, Math.max(2.5, r * 0.18), 0, Math.PI * 2); g.fill();
}
// change detection: the painter writes its quantised values into cur; changed() compares them with the last drawn
function watch(n: number) {
  const cur: (number | string)[] = new Array(n).fill(0), last: (number | string)[] = new Array(n).fill(NaN);
  return { cur, changed() { let c = false; for (let i = 0; i < n; i++) if (cur[i] !== last[i]) { last[i] = cur[i]; c = true; } return c; } };
}
function tex(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const navQ = (r: DashReadout) => (r.dest ? qMi(r.nextMi) : 0);
const ON = (b: boolean) => (b ? 1 : 0);

// ------------------------------------------------------------------------------------------------ the OC Hypercar
const HY = { ICE: '#5eb8ff', DEEP: '#1e6fd8', HOT: '#bfe8ff', TXT: '#e8f2ff', DIM: '#8fa6c0', OFF: '#17283f', RED: '#ff3b30', REDOFF: '#4a1418' };
// The cluster after the owner's interior reference (2026-11-23, interior.png: "the cockpit needs to match exactly to the
// reference image"), in our own design: the display's top half (1024 x 256, the screen under the cluster hood). As
// the reference lays it out: a thin rev arc across the top with its numerals (x1000 r/min, 0 to 9; the redline from
// 7,000, lit with the wheel's red shift lights), the speed big in the middle with the gear under it, a horizontal bar
// each side under a small icon (left the power in use under a thermometer with the simulated air temperature; right
// the Thrust tank under a tank icon: the game simulates no fuel, so the reference's fuel gauge is our Thrust tank), and
// in the corners, small, the rest of the readout the game shows (the clock, the profile and assists, the tune, Go
// To's next turn and destination, trip and top speed, Ground Lock and the hop). The OC mark over the arc.
const ARC = { x: 512, y: 236, r: 166, a0: Math.PI + 0.6, a1: Math.PI * 2 - 0.6, max: 9, red: 7 };
// the arc's angle at r/min (thousands); the revs as a fraction of the 8,000 r/min redline (SPEC.redline)
const arcAt = (k: number) => ARC.a0 + (ARC.a1 - ARC.a0) * Math.min(1, Math.max(0, k / ARC.max));
const BAR = { y: 108, h: 9, l0: 40, l1: 322, r0: 702, r1: 984 };
function thermo(g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.6;
  g.beginPath(); g.roundRect(-3.5, -11, 7, 15, 3.5); g.stroke(); g.beginPath(); g.arc(0, 7, 5.5, 0, Math.PI * 2); g.fill();
  g.fillRect(-1.2, -4, 2.4, 9); for (const t of [-7, -3]) g.fillRect(5, t, 4, 1.8);
  g.restore();
}
// a tank: our Thrust tank's mark (a capsule with a valve), where the reference prints a fuel pump
function tankIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  g.save(); g.translate(x, y); g.scale(s / 24, s / 24); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.6;
  g.beginPath(); g.roundRect(-6, -8, 12, 19, 6); g.stroke(); g.fillRect(-2.5, -12, 5, 4); g.fillRect(-6, 1, 12, 2.4);
  g.restore();
}
function hyperBase(g: CanvasRenderingContext2D, low: boolean) {
  const { ICE, DEEP, TXT, DIM, OFF, REDOFF } = HY;
  g.fillStyle = '#020407'; g.fillRect(0, 0, 1024, 512);
  if (!low) {
    const gr = g.createRadialGradient(512, 150, 20, 512, 150, 520); gr.addColorStop(0, 'rgba(24,60,110,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
  }
  g.lineJoin = 'round'; g.lineCap = 'butt';
  // a hairline inside the screen's edge, as the glass's own border
  g.strokeStyle = 'rgba(94,184,255,0.22)'; g.lineWidth = 2; g.beginPath(); g.roundRect(10, 8, 1004, 240, 26); g.stroke();
  // the OC mark small over the arc
  drawOcMark(g, 488, 16, 48, 16, DIM);
  // the arc's unlit track and its redline's dark red; ticks every 500 r/min, numerals every 1,000
  g.lineWidth = 5; g.strokeStyle = OFF; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, ARC.a0, arcAt(ARC.red)); g.stroke();
  g.strokeStyle = REDOFF; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(ARC.red), ARC.a1); g.stroke();
  for (let k = 0; k <= ARC.max * 2; k++) {
    const a = arcAt(k / 2), big = k % 2 === 0, r0 = ARC.r + 6, r1 = ARC.r + (big ? 16 : 11);
    g.strokeStyle = k / 2 >= ARC.red ? '#b3262a' : big ? ICE : DEEP; g.lineWidth = big ? 2.5 : 1.5;
    g.beginPath(); g.moveTo(ARC.x + Math.cos(a) * r0, ARC.y + Math.sin(a) * r0); g.lineTo(ARC.x + Math.cos(a) * r1, ARC.y + Math.sin(a) * r1); g.stroke();
    if (big) text(g, String(k / 2), ARC.x + Math.cos(a) * (ARC.r + 30), ARC.y + Math.sin(a) * (ARC.r + 30), 15, k / 2 >= ARC.red ? '#ff6a5c' : TXT, 600, 'center');
  }
  // MPH, and the two bars' tracks under their icons
  text(g, 'MPH', 512, 186, 14, DIM, 600, 'center');
  g.fillStyle = OFF; g.fillRect(BAR.l0, BAR.y, BAR.l1 - BAR.l0, BAR.h); g.fillRect(BAR.r0, BAR.y, BAR.r1 - BAR.r0, BAR.h);
  thermo(g, BAR.l0 + 10, BAR.y - 26, 24, ICE);
  tankIcon(g, BAR.r1 - 10, BAR.y - 26, 24, ICE);
}
function hyperLive(g: CanvasRenderingContext2D, r: DashReadout, low: boolean, shown: Record<string, string>) {
  const { ICE, HOT, TXT, DIM, RED } = HY;
  g.lineCap = 'butt';
  // the rev arc, lit to the revs (ice, hot from 6,000), its redline lit with the wheel's red shift lights
  const k = clamp01(r.rpmFrac) * 8;
  g.lineWidth = 7;
  if (k > 0.04) { g.strokeStyle = ICE; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, ARC.a0, arcAt(Math.min(k, 6))); g.stroke(); }
  if (k > 6) { g.strokeStyle = HOT; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(6), arcAt(Math.min(k, ARC.red))); g.stroke(); }
  if (r.redline) { g.strokeStyle = RED; g.lineWidth = 9; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(ARC.red), ARC.a1); g.stroke(); }
  else if (k > ARC.red) { g.strokeStyle = '#a32020'; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(ARC.red), arcAt(k)); g.stroke(); }
  // the speed, big and light, the gear under it in the ice (the reference's "0" over "N")
  const mph = String(Math.round(r.mph)), gear = gearWord(r.gear);
  text(g, mph, 512, 134, 104, '#f4f8ff', 300, 'center');
  text(g, gear, 512, 222, gear.length > 1 ? 26 : 38, HOT, 700, 'center');
  // left of the arc: the simulated air temperature by its thermometer and the power in use (its figure, its bar); the
  // profile and the assists, the tune, trip and top speed under it
  const pf = clamp01(r.kw / Math.max(1, r.kwMax));
  text(g, `${Math.round(r.tempF)}°F sim`, BAR.l0 + 26, BAR.y - 26, 17, TXT, 600, 'left', 150);
  text(g, `${Math.round(r.kw)} kW`, BAR.l1, BAR.y - 26, 18, TXT, 700, 'right', 110);
  if (pf > 0.005) { g.fillStyle = pf > 0.8 ? HOT : ICE; g.fillRect(BAR.l0, BAR.y, (BAR.l1 - BAR.l0) * pf, BAR.h); }
  const prof = profileWord(r.profile), tune = (r.tune || r.mode || '').toUpperCase();
  text(g, prof, BAR.l0, 145, 18, ICE, 800, 'left', 150);
  chip(g, BAR.l1 - 92, 133, 42, 22, 'TCS', r.tcs, ICE, 12, low); chip(g, BAR.l1 - 44, 133, 42, 22, 'ABS', r.abs, ICE, 12, low);
  if (tune) text(g, tune, BAR.l0, 176, 15, HOT, 800, 'left', BAR.l1 - BAR.l0);
  text(g, `TRIP ${r.tripMi.toFixed(1)} mi · TOP ${Math.round(r.topMph)} mph`, BAR.l0, 206, 14, DIM, 600, 'left', BAR.l1 - BAR.l0);
  if (r.clock) text(g, r.clock, BAR.l0, 40, 19, TXT, 600, 'left', 140);
  // right of the arc: the Thrust tank by its icon (with THRUST live: JUMP and the percentage, the hop's mark at 40 %),
  // Ground Lock's chip and the hop's state under it; without: JUMP OFF. Go To's next turn across the top, the
  // destination (or the road) at the foot
  const pct = Math.round(clamp01(r.tank) * 100), live = r.thrustLive;
  let hopWord = '';
  text(g, 'JUMP', BAR.r0, BAR.y - 26, 17, ICE, 800, 'left', 70);
  if (live) {
    const lowTank = pct < 25;
    text(g, `${pct}%`, BAR.r1 - 24, BAR.y - 26, 26, lowTank ? '#ffb347' : '#f4f8ff', 700, 'right', 100);
    if (pct > 0) { g.fillStyle = lowTank ? '#ffb347' : ICE; g.fillRect(BAR.r0, BAR.y, (BAR.r1 - BAR.r0) * (pct / 100), BAR.h); }
    g.fillStyle = '#f4f8ff'; g.fillRect(BAR.r0 + (BAR.r1 - BAR.r0) * 0.4 - 1.5, BAR.y - 4, 3, BAR.h + 8);
    g.lineWidth = 2.5; g.beginPath(); g.roundRect(BAR.r0, 128, BAR.r1 - BAR.r0, 26, 6);
    if (r.lock) { g.fillStyle = ICE; g.fill(); } else { g.strokeStyle = ICE; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1; }
    text(g, 'GROUND LOCK', (BAR.r0 + BAR.r1) / 2, 142, 16, r.lock ? '#03050a' : '#b4c8de', 800, 'center', BAR.r1 - BAR.r0 - 12);
    const hw = r.hop;
    hopWord = hw === 'Hop ready' ? 'HOP READY' : hw === 'Airborne' ? 'AIRBORNE' : hw === 'Hop: charging' ? 'HOP CHARGING' : hw === 'Hop: tank low' ? 'HOP: TANK LOW'
      : hw ? hw.replace(/^(Thrust Hop|No hop): /i, '').toUpperCase() : '';
    const hc = hw === 'Hop ready' ? HOT : hw === 'Airborne' ? '#f4f8ff' : '#ffb347';
    if (hopWord) text(g, hopWord, BAR.r1, 174, 18, hc, 800, 'right', BAR.r1 - BAR.r0, 12);
  } else text(g, 'OFF', BAR.r1 - 24, BAR.y - 26, 18, DIM, 700, 'right');
  let navLine = '';
  if (r.dest) {
    turnArrow(g, BAR.r0 + 14, 40, 28, r.turn, ICE);
    navLine = miles(r.nextMi); text(g, navLine, BAR.r0 + 36, 41, 20, TXT, 700, 'left', 120);
    text(g, r.dest, BAR.r0, 206, 16, TXT, 600, 'left', 190, 11);
    text(g, miles(r.destMi), BAR.r1, 206, 17, ICE, 700, 'right', 90);
  } else {
    text(g, 'NO ROUTE', BAR.r0, 40, 14, DIM, 600, 'left');
    if (r.road) text(g, r.road, BAR.r0, 206, 15, TXT, 600, 'left', BAR.r1 - BAR.r0, 11);
  }
  shown.mph = mph; shown.gear = gear; shown.profile = prof; shown.tcs = r.tcs ? 'on' : 'off'; shown.abs = r.abs ? 'on' : 'off'; shown.tune = tune;
  shown.thrust = live ? `${pct}%` : 'off'; shown.control = 'JUMP'; shown.lock = live ? (r.lock ? 'on' : 'idle') : ''; shown.hop = hopWord; shown.turn = r.dest ? r.turn : ''; shown.next = navLine; shown.dest = r.dest; shown.redline = r.redline ? 'lit' : 'dark';
  shown.clock = r.clock; shown.trip = r.tripMi.toFixed(1); shown.top = String(Math.round(r.topMph));
}
export function hyperDash(q: 'phone' | 'high'): DashPainter {
  return once('dash.hyper' + q, () => {
    const low = q === 'phone';
    const [base, bg] = canvas(1024, 512), [c, g] = canvas(1024, 512);
    hyperBase(bg, low);
    const t = tex(c), w = watch(24);
    const p: DashPainter = {
      tex: t, draws: 0, shown: {},
      update(r, lowNow) {
        const k = w.cur;
        k[0] = Math.round(r.mph); k[1] = r.gear; k[2] = Math.round(clamp01(r.rpmFrac) * (lowNow ? 20 : 40)); k[3] = ON(r.redline); k[4] = r.profile; k[5] = ON(r.tcs); k[6] = ON(r.abs);
        k[7] = r.tune || r.mode; k[8] = Math.round(clamp01(r.tank) * 100); k[9] = ON(r.thrustLive); k[10] = r.dest ? r.turn : ''; k[11] = navQ(r); k[12] = r.dest; k[13] = r.dest ? qMi(r.destMi) : 0;
        k[14] = r.dest ? '' : r.road; k[15] = r.clock; k[16] = Math.round(r.tempF); k[17] = Math.round(r.tripMi * 10); k[18] = Math.round(r.topMph);
        k[19] = Math.round(r.kw / 15); k[20] = lowNow ? 0 : Math.round(r.gx * 10); k[21] = lowNow ? 0 : Math.round(r.gy * 10);
        k[22] = r.thrustLive ? ON(r.lock) : 0; k[23] = r.thrustLive ? r.hop : '';
        if (!w.changed()) return false;
        g.drawImage(base, 0, 0); hyperLive(g, r, lowNow, p.shown); t.needsUpdate = true; p.draws++;
        return true;
      },
    };
    p.update(Object.assign(dashReadout(), { mph: 132, gear: '6', kw: 186, kwMax: 1500, rpm: 6200, rpmFrac: 0.62, mode: 'UNLEASHED', tune: 'Unleashed', tank: 1, thrustLive: true, hop: 'Hop ready' }), low);
    return p;
  });
}

// ------------------------------------------------------------------------------------------------ the Vela E
const VE = { BLUE: '#4fb3ff', GREEN: '#2bd17e', TXT: '#e8ecef', DIM: '#8f98a3', OFF: '#1d2733', RED: '#ff3b30', REDOFF: '#3a1416' };
const VARC = { x: 650, y: 150, r: 96, a0: Math.PI + 0.3, a1: Math.PI * 2 - 0.3, red: 0.88 };
const varcAt = (f: number) => VARC.a0 + (VARC.a1 - VARC.a0) * f;
function velaBase(g: CanvasRenderingContext2D, low: boolean) {
  const { TXT, DIM, OFF, REDOFF } = VE;
  g.fillStyle = '#04060a'; g.fillRect(0, 0, 1024, 512);
  if (!low) { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(50,80,120,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 256); }
  g.lineCap = 'round';
  g.strokeStyle = OFF; g.lineWidth = 10; g.beginPath(); g.arc(VARC.x, VARC.y, VARC.r, VARC.a0, varcAt(VARC.red)); g.stroke();
  g.strokeStyle = REDOFF; g.beginPath(); g.arc(VARC.x, VARC.y, VARC.r, varcAt(VARC.red), VARC.a1); g.stroke();
  text(g, 'MPH', 650, 190, 22, DIM, 500, 'center');
  g.fillStyle = OFF; g.fillRect(780, 189, 220, 6);
  g.fillStyle = '#4b5561'; g.fillRect(40, 248, 944, 2);
  // the centre touchscreen (716..1024 x 256..512): a plain street map (no route drawn on it); its bottom strip is live
  const x0 = 716, y0 = 256;
  g.save(); g.beginPath(); g.rect(x0, y0, 308, 256); g.clip();
  g.fillStyle = '#0a0e13'; g.fillRect(x0, y0, 308, 256);
  g.strokeStyle = '#18202a'; g.lineWidth = 8; for (let i = -2; i < 7; i++) { g.beginPath(); g.moveTo(x0 + i * 60, y0 + 256); g.lineTo(x0 + i * 60 + 160, y0); g.stroke(); }
  g.strokeStyle = '#2a323c'; g.lineWidth = 20; g.beginPath(); g.moveTo(x0 + 90, y0 + 270); g.bezierCurveTo(x0 + 140, y0 + 170, x0 + 190, y0 + 90, x0 + 320, y0 - 10); g.stroke();
  g.restore();
  text(g, 'VELA', 28, 24, 18, TXT, 700, 'left');
}
function velaLive(g: CanvasRenderingContext2D, r: DashReadout, low: boolean, shown: Record<string, string>) {
  const { BLUE, GREEN, TXT, DIM, RED } = VE;
  // the rev arc over the speed, its redline lit with the revs at the same point as the sport wheels' red lights
  const f = clamp01(r.rpmFrac);
  g.lineCap = 'round'; g.lineWidth = 10;
  if (f > 0.01) { g.strokeStyle = BLUE; g.beginPath(); g.arc(VARC.x, VARC.y, VARC.r, VARC.a0, varcAt(Math.min(f, VARC.red))); g.stroke(); }
  if (r.redline) { g.strokeStyle = RED; g.beginPath(); g.arc(VARC.x, VARC.y, VARC.r, varcAt(VARC.red), VARC.a1); g.stroke(); }
  const mph = String(Math.round(r.mph)), gear = gearWord(r.gear);
  text(g, mph, 650, 132, 104, '#f2f5f8', 300, 'center');
  // P R N D, the one in use lit (the game has no park: P stays dark); the gear's number beside D
  const sel = gear === 'R' ? 'R' : gear === 'N' ? 'N' : 'D';
  ['P', 'R', 'N', 'D'].forEach((L, i) => text(g, L, 600 + i * 30, 226, 24, L === sel ? BLUE : '#4b5561', 700, 'center'));
  if (sel === 'D') text(g, gear, 708, 228, 16, DIM, 600, 'left');
  // left of the rim (the part a phone in portrait shows, with the speed: the display runs off the right of its frame):
  // the next turn and the destination (or the road), the clock and temperature, and on the right of that the profile,
  // TCS and ABS, trip and top speed
  const prof = profileWord(r.profile);
  let navLine = '';
  if (r.dest) {
    turnArrow(g, 42, 124, 30, r.turn, BLUE);
    navLine = miles(r.nextMi); text(g, navLine, 64, 125, 26, TXT, 700, 'left', 120);
    text(g, r.dest, 28, 158, 21, TXT, 600, 'left', 172, 14);
    text(g, miles(r.destMi), 28, 188, 22, BLUE, 700, 'left', 172);
  } else {
    text(g, 'NO ROUTE', 28, 124, 18, DIM, 600, 'left');
    if (r.road) text(g, r.road, 28, 156, 22, TXT, 600, 'left', 172, 14);
  }
  if (r.clock) text(g, r.clock, 28, 222, 19, TXT, 600, 'left', 100);
  text(g, `${Math.round(r.tempF)}°F sim`, 118, 222, 17, DIM, 600, 'left', 82);
  text(g, prof, 326, 124, 24, BLUE, 800, 'right', 120);
  chip(g, 208, 144, 56, 24, 'TCS', r.tcs, BLUE, 14, low); chip(g, 270, 144, 56, 24, 'ABS', r.abs, BLUE, 14, low);
  text(g, `TRIP ${r.tripMi.toFixed(1)} mi`, 326, 190, 18, TXT, 600, 'right', 120);
  text(g, `TOP ${Math.round(r.topMph)} mph`, 326, 222, 17, DIM, 600, 'right', 120);
  // right of the speed (beyond a phone's portrait frame; a landscape screen shows it): the power in use
  const pf = clamp01(r.kw / Math.max(1, r.kwMax));
  text(g, 'POWER', 782, 150, 18, DIM, 600, 'left');
  text(g, `${Math.round(r.kw)} kW`, 1000, 150, 26, TXT, 600, 'right');
  if (pf > 0.005) { g.fillStyle = GREEN; g.fillRect(780, 189, 220 * pf, 6); }
  // the centre screen's bottom strip
  g.fillStyle = 'rgba(8,11,15,0.92)'; g.fillRect(716, 462, 308, 50);
  text(g, `${Math.round(r.tempF)}°F sim`, 732, 488, 22, TXT, 600, 'left');
  if (r.clock) text(g, r.clock, 1012, 488, 22, DIM, 600, 'right');
  shown.mph = mph; shown.gear = gear; shown.profile = prof; shown.tcs = r.tcs ? 'on' : 'off'; shown.abs = r.abs ? 'on' : 'off';
  shown.turn = r.dest ? r.turn : ''; shown.next = navLine; shown.dest = r.dest; shown.redline = r.redline ? 'lit' : 'dark'; shown.clock = r.clock;
  shown.trip = r.tripMi.toFixed(1); shown.top = String(Math.round(r.topMph));
}
export function velaDash(q: 'phone' | 'high'): DashPainter {
  return once('dash.vela' + q, () => {
    const low = q === 'phone';
    const [base, bg] = canvas(1024, 512), [c, g] = canvas(1024, 512);
    velaBase(bg, low);
    const t = tex(c), w = watch(18);
    const p: DashPainter = {
      tex: t, draws: 0, shown: {},
      update(r, lowNow) {
        const k = w.cur;
        k[0] = Math.round(r.mph); k[1] = r.gear; k[2] = Math.round(clamp01(r.rpmFrac) * (lowNow ? 20 : 40)); k[3] = ON(r.redline); k[4] = r.profile; k[5] = ON(r.tcs); k[6] = ON(r.abs);
        k[7] = r.dest ? r.turn : ''; k[8] = navQ(r); k[9] = r.dest; k[10] = r.dest ? qMi(r.destMi) : 0; k[11] = r.dest ? '' : r.road;
        k[12] = r.clock; k[13] = Math.round(r.tempF); k[14] = Math.round(r.tripMi * 10); k[15] = Math.round(r.topMph); k[16] = Math.round(r.kw / 10); k[17] = 0;
        if (!w.changed()) return false;
        g.drawImage(base, 0, 0); velaLive(g, r, lowNow, p.shown); t.needsUpdate = true; p.draws++;
        return true;
      },
    };
    p.update(Object.assign(dashReadout(), { mph: 68, gear: '4', kw: 186, kwMax: 400, rpmFrac: 0.5 }), low);
    return p;
  });
}

// ------------------------------------------------------------------------------------------------ the Rossinis
// What the seat camera sees of the Rossinis' cluster at phone size (390 x 844, DPR 3; the review of 2026-11-12): the
// tach's digital window whole; of the left side display only x 380..470, y 80..300 of its 512 x 320 (the rim's lower
// edge covers its top, the left hand's fingers and thumb its left, the tach's bezel the last 40 px), of the right one
// x 42..155, y 80..285 (the rim above, the right hand's fingers and thumb beyond, the dash's lower panel under its left
// corner). So each fact sits there, right-aligned on the left and left-aligned on the right, as big as the width allows,
// and the small labels are as few as reading needs: TRIP and TOP stay (a number alone could be anything), their units
// go in the label. The clock moves into the tach window's free strip under the speed, which nothing covers.
// The tachometer's digital window (live gear and speed, the clock), 256 x 224 (128 x 112 on phones, drawn at half
// scale: the window is under 100 device pixels across there), laid over the printed window: a dark rounded glass
// (transparent outside its corners)
export interface RossiniDash { window: DashPainter; left: DashPainter; right: DashPainter }
const RO = { TXT: '#eef1f4', DIM: '#9aa3ad', FAINT: '#2a313a', BG: '#05070a' };
// a name on one line if it fits at px (shrunk to 0.82 px at most), else on two split at the space nearest its middle
function name2(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, col: string, maxW: number, lh: number) {
  g.font = `600 ${px}px ${FONT}`;
  const sp = s.indexOf(' ');
  if (g.measureText(s).width <= maxW / 0.82 || sp < 0) { text(g, s, x, y + lh / 2, px, col, 600, 'left', maxW, Math.round(px * 0.6)); return; }
  let best = sp;
  for (let k = sp; k >= 0; k = s.indexOf(' ', k + 1)) if (Math.abs(k - s.length / 2) < Math.abs(best - s.length / 2)) best = k;
  text(g, s.slice(0, best), x, y, px, col, 600, 'left', maxW, Math.round(px * 0.6));
  text(g, s.slice(best + 1), x, y + lh, px, col, 600, 'left', maxW, Math.round(px * 0.6));
}
export function rossiniDash(accent: string, q: 'phone' | 'high'): RossiniDash {
  return once('dash.rossini' + accent + q, () => {
    const low0 = q === 'phone', k0 = low0 ? 0.5 : 1;
    // ---- the window
    const [wc, wg] = canvas(256 * k0, 224 * k0), wt = tex(wc), ww = watch(3);
    const win: DashPainter = {
      tex: wt, draws: 0, shown: {},
      update(r) {
        ww.cur[0] = Math.round(r.mph); ww.cur[1] = r.gear; ww.cur[2] = r.clock;
        if (!ww.changed()) return false;
        const g = wg, mph = String(Math.round(r.mph)), gear = gearWord(r.gear);
        g.setTransform(k0, 0, 0, k0, 0, 0);
        g.clearRect(0, 0, 256, 224);
        g.fillStyle = '#040506'; g.beginPath(); g.roundRect(4, 4, 248, 216, 22); g.fill();
        g.strokeStyle = '#3a3e44'; g.lineWidth = 5; g.stroke();
        text(g, gear, 70, 90, gear.length > 1 ? 64 : 116, accent, 700, 'center');
        text(g, mph, 180, 80, mph.length > 2 ? 56 : 68, RO.TXT, 600, 'center');
        text(g, 'MPH', 180, 130, 22, RO.DIM, 600, 'center');
        g.fillStyle = accent; g.fillRect(24, 156, 208, 3);
        // the game's clock (the sky's time of day)
        const clk = r.clock;
        if (clk) text(g, clk, 128, 188, 36, RO.TXT, 700, 'center', 220);
        wt.needsUpdate = true; win.draws++; win.shown.mph = mph; win.shown.gear = gear; win.shown.clock = clk;
        return true;
      },
    };
    // ---- the side displays, 512 x 320 each (256 x 160 on phones, drawn at half scale). The outer part of each (hidden
    // by the hands from the seat, seen from other angles) carries the G-meter and the next manoeuvre's road
    const side = (draw: (g: CanvasRenderingContext2D, r: DashReadout, low: boolean, shown: Record<string, string>) => void, fill: (r: DashReadout, k: (number | string)[], low: boolean) => void, n: number): DashPainter => {
      const [c, g] = canvas(512 * k0, 320 * k0), t = tex(c), w = watch(n);
      const p: DashPainter = {
        tex: t, draws: 0, shown: {},
        update(r, low) {
          fill(r, w.cur, low);
          if (!w.changed()) return false;
          g.setTransform(k0, 0, 0, k0, 0, 0);
          g.fillStyle = RO.BG; g.fillRect(0, 0, 512, 320);
          if (!low) { const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, 'rgba(40,60,90,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 320); }
          draw(g, r, low, p.shown); t.needsUpdate = true; p.draws++;
          return true;
        },
      };
      return p;
    };
    const left = side((g, r, low, shown) => {
      // the seen part (x 380..470, y 80..300), right-aligned: the profile, TCS and ABS, the trip and the top speed
      const prof = profileWord(r.profile);
      text(g, prof, 470, 100, 32, accent, 800, 'right', 90);
      chip(g, 380, 122, 44, 30, 'TCS', r.tcs, accent, 18, low); chip(g, 426, 122, 44, 30, 'ABS', r.abs, accent, 18, low);
      text(g, 'TRIP mi', 470, 178, 22, RO.DIM, 700, 'right', 90);
      text(g, r.tripMi.toFixed(1), 470, 208, 40, RO.TXT, 700, 'right', 90);
      text(g, 'TOP mph', 470, 246, 22, RO.DIM, 700, 'right', 90);
      text(g, String(Math.round(r.topMph)), 470, 276, 40, RO.TXT, 700, 'right', 90);
      // outer (left) part: the G-meter
      text(g, 'G', 24, 40, 22, RO.DIM, 600, 'left');
      gMeter(g, 140, 190, 78, r.gx, r.gy, RO.FAINT, accent, low);
      shown.profile = prof; shown.tcs = r.tcs ? 'on' : 'off'; shown.abs = r.abs ? 'on' : 'off'; shown.trip = r.tripMi.toFixed(1); shown.top = String(Math.round(r.topMph));
    }, (r, k, low) => { k[0] = r.profile; k[1] = ON(r.tcs); k[2] = ON(r.abs); k[3] = Math.round(r.tripMi * 10); k[4] = Math.round(r.topMph); k[5] = low ? 0 : Math.round(r.gx * 10); k[6] = low ? 0 : Math.round(r.gy * 10); }, 7);
    const right = side((g, r, _low, shown) => {
      // the seen part (x 42..155, y 80..285), left-aligned: the next turn's arrow and distance, the destination and its
      // distance (with no route, NO ROUTE and the road you're on), and the simulated temperature, labelled so
      let navLine = '';
      if (r.dest) {
        turnArrow(g, 62, 100, 40, r.turn, accent);
        navLine = miles(r.nextMi);
        const sp = navLine.indexOf(' ');
        // the figure big, its unit beside it smaller
        g.font = `700 40px ${FONT}`;
        const fw = Math.min(g.measureText(navLine.slice(0, sp)).width, 80);
        text(g, navLine.slice(0, sp), 44, 142, 40, RO.TXT, 700, 'left', 80);
        text(g, navLine.slice(sp + 1), 49 + fw, 148, 22, RO.DIM, 700, 'left', 112 - fw);
        name2(g, r.dest, 44, 168, 23, RO.TXT, 112, 24);
        text(g, miles(r.destMi), 44, 224, 32, accent, 700, 'left', 112);
        // outer part: where the next manoeuvre leads
        if (r.navTo) text(g, r.navTo, 250, 128, 24, RO.DIM, 600, 'left', 240, 16);
      } else {
        text(g, 'NO ROUTE', 44, 104, 24, RO.DIM, 700, 'left', 112);
        if (r.road) name2(g, r.road, 44, 136, 28, RO.TXT, 112, 32);
      }
      text(g, `${Math.round(r.tempF)}°F sim`, 44, 258, 26, RO.DIM, 700, 'left', 112);
      shown.turn = r.dest ? r.turn : ''; shown.next = navLine; shown.dest = r.dest; shown.temp = `${Math.round(r.tempF)}`;
    }, (r, k) => { k[0] = r.dest ? r.turn : ''; k[1] = navQ(r); k[2] = r.dest; k[3] = r.dest ? qMi(r.destMi) : 0; k[4] = r.dest ? r.navTo : r.road; k[5] = Math.round(r.tempF); }, 6);
    const d0 = Object.assign(dashReadout(), { mph: 64, gear: '6' });
    win.update(d0, low0); left.update(d0, low0); right.update(d0, low0);
    return { window: win, left, right };
  });
}

// ------------------------------------------------------------------------------------------------ the OC Hypercar's console
// The portrait screen on the hypercar's carbon centre spine (after the owner's interior reference of 2026-11-23: a car
// seen from above between bar graphs, a line graph under it), our own design and the game's own data only: the car
// from above with its Thrust tank and Ground Lock (THRUST live) or its tune, the revs and the power in use as bar
// graphs either side of it, and a line graph of the speed over the last minute; the clock, the profile and the assists
// across the top, Go To's next turn at the foot. The canvas also carries the three climate knobs' faces (fan,
// temperature, seat: icons only, no climate is simulated) in a strip under the screen, so the knobs cost no draw call
// of their own.
//   hyperConsole(q)  512 x 896 on High (the screen 512 x 768, the knobs' strip 3 x 128 under it), half on phones
export const CONSOLE_SPLIT = 768 / 896;   // the screen's share of the canvas's height (v from 1 - split to 1)
export function hyperConsole(q: 'phone' | 'high'): DashPainter {
  return once('dash.hyperConsole2' + q, () => {
    const low = q === 'phone', k = low ? 0.5 : 1, W = 512 * k, H = 896 * k;
    const [c, g] = canvas(W, H);
    const t = tex(c), w = watch(14);
    const { ICE, DEEP, HOT, TXT, DIM, OFF } = HY;
    const trace: number[] = []; let lastT = -1e9, lastTrip = -1;
    // the knobs' faces, drawn once: a dark disc, a fine ice ring (the knob's own ring is geometry), an icon
    const knobs = () => {
      for (let i = 0; i < 3; i++) {
        const cx = 85 + i * 171, cy = 832, r = 56;
        g.fillStyle = '#05070b'; g.fillRect(cx - 85, 768, 171, 128);
        g.fillStyle = '#0b0f16'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = ICE; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r - 6, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#e8f2ff'; g.fillStyle = '#e8f2ff'; g.lineWidth = 4; g.lineCap = 'round';
        if (i === 0) { for (let b = 0; b < 4; b++) { g.save(); g.translate(cx, cy); g.rotate(b * Math.PI / 2 + 0.4); g.beginPath(); g.ellipse(0, -14, 7, 14, 0.3, 0, Math.PI * 2); g.fill(); g.restore(); } }
        else if (i === 1) { g.beginPath(); g.roundRect(cx - 6, cy - 26, 12, 34, 6); g.stroke(); g.beginPath(); g.arc(cx, cy + 16, 10, 0, Math.PI * 2); g.fill(); }
        else { g.beginPath(); g.moveTo(cx - 16, cy + 22); g.lineTo(cx + 12, cy + 22); g.lineTo(cx + 2, cy - 4); g.lineTo(cx - 6, cy - 26); g.stroke();
          for (const d of [-8, 2, 12]) { g.beginPath(); g.moveTo(cx + d + 10, cy - 24); g.quadraticCurveTo(cx + d + 16, cy - 14, cx + d + 10, cy - 4); g.stroke(); } }
      }
    };
    // the car from above, centred at (x, y), l long: the canopy teardrop between the sidepods, the wing, the wheels
    const car = (x: number, y: number, l: number, col: string) => {
      g.save(); g.translate(x, y); g.scale(l / 200, l / 200); g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(0, -100); g.bezierCurveTo(34, -98, 50, -70, 48, -40); g.bezierCurveTo(40, -14, 40, 18, 52, 44); g.bezierCurveTo(54, 74, 40, 96, 0, 98);
      g.bezierCurveTo(-40, 96, -54, 74, -52, 44); g.bezierCurveTo(-40, 18, -40, -14, -48, -40); g.bezierCurveTo(-50, -70, -34, -98, 0, -100); g.stroke();
      g.beginPath(); g.ellipse(0, -6, 17, 42, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-50, 86); g.lineTo(50, 86); g.stroke();
      g.fillStyle = col; for (const [wx, wy] of [[-50, -58], [50, -58], [-54, 58], [54, 58]]) g.fillRect(wx - 5, wy - 16, 10, 32);
      g.restore();
    };
    const p: DashPainter = {
      tex: t, draws: 0, shown: {},
      update(r, lowNow) {
        // the speed's trace, a sample a second while the car covers ground, the last 60 (paused, or stopped, it holds: a
        // display redrawn while nothing in the game moves would cost a redraw and an upload for nothing)
        const now = performance.now();
        if (now - lastT >= 1000 && r.tripMi !== lastTrip) { lastT = now; lastTrip = r.tripMi; trace.push(r.mph); if (trace.length > 60) trace.shift(); }
        const cur = w.cur;
        cur[0] = Math.round(clamp01(r.rpmFrac) * 12); cur[1] = Math.round(clamp01(r.kw / Math.max(1, r.kwMax)) * 12); cur[2] = Math.round(clamp01(r.tank) * 50); cur[3] = ON(r.thrustLive); cur[4] = ON(r.lock);
        cur[5] = r.tune || r.mode; cur[6] = r.profile; cur[7] = ON(r.tcs); cur[8] = ON(r.abs); cur[9] = r.clock; cur[10] = trace.length ? trace.length * 1000 + Math.round(trace[trace.length - 1]) : 0;
        cur[11] = r.dest ? r.turn : ''; cur[12] = navQ(r); cur[13] = r.dest;
        if (!w.changed()) return false;
        g.save(); g.scale(k, k);
        if (!p.draws) knobs();
        g.fillStyle = '#02050a'; g.fillRect(0, 0, 512, 768);
        if (!lowNow) { const gr = g.createLinearGradient(0, 0, 0, 768); gr.addColorStop(0, 'rgba(30,80,150,0.20)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,80,150,0.14)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 768); }
        g.strokeStyle = DEEP; g.lineWidth = 3; g.beginPath(); g.roundRect(12, 12, 488, 744, 22); g.stroke();
        // the top row: the OC mark, the clock; the profile and the assists
        drawOcMark(g, 34, 30, 66, 22, TXT);
        if (r.clock) text(g, r.clock, 478, 42, 24, TXT, 600, 'right', 200);
        const prof = profileWord(r.profile);
        text(g, prof, 34, 86, 20, ICE, 800, 'left', 140);
        chip(g, 330, 72, 66, 28, 'TCS', r.tcs, ICE, 15, lowNow); chip(g, 408, 72, 70, 28, 'ABS', r.abs, ICE, 15, lowNow);
        g.fillStyle = OFF; g.fillRect(34, 114, 444, 2);
        // the car from above, between the revs (left) and the power (right) as segmented bars
        car(256, 290, 270, ICE);
        const bars = (x: number, f: number, label: string, hot: string) => {
          text(g, label, x + 22, 142, 14, DIM, 700, 'center');
          for (let s = 0; s < 12; s++) { const y = 418 - s * 22; g.fillStyle = s < Math.round(f * 12) ? (s >= 9 ? hot : ICE) : OFF; g.fillRect(x, y, 44, 14); }
        };
        bars(40, clamp01(r.rpmFrac), 'REV', HOT);
        bars(428, clamp01(r.kw / Math.max(1, r.kwMax)), 'kW', HOT);
        // under the car: THRUST live, the tank and Ground Lock; or the tune
        const tune = (r.tune || r.mode || '').toUpperCase(), pct = Math.round(clamp01(r.tank) * 100);
        if (r.thrustLive) {
          text(g, `THRUST ${pct}%`, 256, 462, 24, pct < 25 ? '#ffb347' : TXT, 700, 'center', 300);
          text(g, r.lock ? 'GROUND LOCK ON' : 'GROUND LOCK IDLE', 256, 494, 16, r.lock ? HOT : DIM, 800, 'center', 300);
        } else text(g, tune || 'SPORT', 256, 470, 26, ICE, 700, 'center', 300);
        g.fillStyle = OFF; g.fillRect(34, 520, 444, 2);
        // the speed over the last minute: a line graph
        const gx0 = 44, gx1 = 468, gy0 = 680, gy1 = 560, top = Math.max(100, ...trace) * 1.1;
        text(g, 'SPEED · 60 s', gx0, 544, 15, DIM, 700, 'left');
        if (trace.length) text(g, `${Math.round(trace[trace.length - 1])} mph`, gx1, 544, 17, TXT, 700, 'right');
        g.strokeStyle = OFF; g.lineWidth = 1.5; for (let i = 0; i <= 3; i++) { const y = gy0 - (gy0 - gy1) * i / 3; g.beginPath(); g.moveTo(gx0, y); g.lineTo(gx1, y); g.stroke(); }
        if (trace.length > 1) {
          g.strokeStyle = HOT; g.lineWidth = 3; g.beginPath();
          trace.forEach((v, i) => { const x = gx1 - (gx1 - gx0) * (trace.length - 1 - i) / 59, y = gy0 - (gy0 - gy1) * v / top; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
          g.stroke();
        }
        // Go To at the foot
        let nav = '';
        if (r.dest) { turnArrow(g, 60, 724, 36, r.turn, ICE); nav = miles(r.nextMi); text(g, `${nav} · ${r.dest}`, 92, 726, 20, TXT, 600, 'left', 386, 13); }
        else text(g, 'NO ROUTE', 44, 726, 18, DIM, 600, 'left');
        g.restore();
        t.needsUpdate = true; p.draws++;
        p.shown.thrust = r.thrustLive ? `${pct}%` : 'off'; p.shown.tune = tune; p.shown.next = nav; p.shown.dest = r.dest; p.shown.mph = trace.length ? String(Math.round(trace[trace.length - 1])) : '';
        return true;
      },
    };
    p.update(Object.assign(dashReadout(), { tune: 'Unleashed', tank: 1, thrustLive: true, rpmFrac: 0.55, kw: 600, kwMax: 1500 }), low);
    return p;
  });
}
