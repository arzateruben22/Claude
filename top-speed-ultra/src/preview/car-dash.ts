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
//                         window becomes live (gear and speed, the clock and temperature, sim), and the two small
//                         displays either side show the drive data (left: the profile, TCS, ABS, trip, top speed, a
//                         G-meter) and the navigation (right: the next turn and its distance, the destination and its
//                         distance). The tyre pressures, oil and water temperatures they used to print were invented: gone
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
  // the OC Hypercar's tune ('Unleashed', 'Race tune'; '' for the others) and its Thrust tank (0..1; live or not)
  tune: string; tank: number; thrustLive: boolean;
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
    tune: '', tank: 0, thrustLive: false, turn: '', nextMi: 0, navTo: '', dest: '', destMi: 0, road: '', gx: 0, gy: 0, redline: false };
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
const hexPath = (g: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, cut: number) => { g.beginPath(); g.moveTo(cx - hw + cut, cy - hh); g.lineTo(cx + hw - cut, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx + hw - cut, cy + hh); g.lineTo(cx - hw + cut, cy + hh); g.lineTo(cx - hw, cy); g.closePath(); };
// the rev arc over the speed: centre, radius, the angles it runs between (canvas angles, over the top), the redline
const ARC = { x: 512, y: 200, r: 105, a0: Math.PI + 0.42, a1: Math.PI * 2 - 0.42, red: 0.88 };
const arcAt = (f: number) => ARC.a0 + (ARC.a1 - ARC.a0) * f;
function hyperBase(g: CanvasRenderingContext2D, low: boolean) {
  const { ICE, DEEP, TXT, DIM, OFF, REDOFF } = HY;
  g.fillStyle = '#03050a'; g.fillRect(0, 0, 1024, 512);
  if (!low) { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(20,50,100,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 256); }
  g.lineJoin = 'miter'; g.lineCap = 'butt';
  // the frame: a wide hexagon in the deep blue, an inner echo in the ice
  g.strokeStyle = DEEP; g.lineWidth = 4; hexPath(g, 512, 128, 486, 116, 70); g.stroke();
  g.strokeStyle = ICE; g.lineWidth = 1.5; hexPath(g, 512, 128, 474, 106, 66); g.stroke();
  // faint grid lines through the dark, as a display's substrate
  if (!low) { g.strokeStyle = 'rgba(94,184,255,0.07)'; g.lineWidth = 1; for (let x = 140; x < 900; x += 40) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 226); g.stroke(); } }
  // the OC mark small at the top
  drawOcMark(g, 476, 20, 72, 24, TXT);
  // the rev arc's unlit track, its tick every tenth and the redline's dark red
  g.lineWidth = 9; g.strokeStyle = OFF; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, ARC.a0, arcAt(ARC.red)); g.stroke();
  g.strokeStyle = REDOFF; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(ARC.red), ARC.a1); g.stroke();
  g.lineWidth = 2; g.strokeStyle = DEEP;
  for (let k = 0; k <= 10; k++) { const a = arcAt(k / 10); g.beginPath(); g.moveTo(ARC.x + Math.cos(a) * (ARC.r + 7), ARC.y + Math.sin(a) * (ARC.r + 7)); g.lineTo(ARC.x + Math.cos(a) * (ARC.r + 13), ARC.y + Math.sin(a) * (ARC.r + 13)); g.stroke(); }
  // MPH, the gear's box, the power bar's track, the G-meter's rings
  text(g, 'MPH', 512, 182, 17, DIM, 500, 'center');
  g.strokeStyle = ICE; g.lineWidth = 2; g.beginPath(); g.roundRect(492, 196, 40, 38, 5); g.stroke();
  g.fillStyle = OFF; g.fillRect(400, 241, 224, 5);
  // the centre screen (716..1024 x 256..512): an angular frame, the OC mark; the mode and the assists are live
  const x0 = 716, y0 = 256;
  g.save(); g.beginPath(); g.rect(x0, y0, 308, 256); g.clip();
  g.fillStyle = '#05080f'; g.fillRect(x0, y0, 308, 256);
  g.strokeStyle = DEEP; g.lineWidth = 3; hexPath(g, x0 + 154, y0 + 128, 140, 110, 30); g.stroke();
  g.strokeStyle = ICE; g.lineWidth = 1.5; hexPath(g, x0 + 154, y0 + 128, 130, 100, 28); g.stroke();
  drawOcMark(g, x0 + 124, y0 + 44, 60, 22, TXT);
  g.fillStyle = HY.HOT; g.fillRect(x0 + 60, y0 + 178, 188, 2);
  g.restore();
}
function hyperLive(g: CanvasRenderingContext2D, r: DashReadout, low: boolean, shown: Record<string, string>) {
  const { ICE, DEEP, HOT, TXT, DIM, RED } = HY;
  g.lineCap = 'butt';
  // the rev arc: lit to the revs (ice, hot from three quarters), the redline lit with the wheel's red shift lights
  const f = clamp01(r.rpmFrac);
  g.lineWidth = 9;
  if (f > 0.005) { g.strokeStyle = ICE; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, ARC.a0, arcAt(Math.min(f, 0.76))); g.stroke(); }
  if (f > 0.76) { g.strokeStyle = HOT; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(0.76), arcAt(Math.min(f, ARC.red))); g.stroke(); }
  if (r.redline) { g.strokeStyle = RED; g.lineWidth = 11; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(ARC.red), ARC.a1); g.stroke(); }
  else if (f > ARC.red) { g.strokeStyle = '#a32020'; g.beginPath(); g.arc(ARC.x, ARC.y, ARC.r, arcAt(ARC.red), arcAt(f)); g.stroke(); }
  // the speed, big and light, and the gear in its box
  const mph = String(Math.round(r.mph)), gear = gearWord(r.gear);
  text(g, mph, 512, 138, 82, '#f4f8ff', 300, 'center');
  text(g, gear, 512, 216, gear.length > 1 ? 18 : 26, TXT, 700, 'center');
  // left of the arc: the profile, TCS and ABS, the tune, the Thrust tank (right-aligned toward the speed)
  const prof = profileWord(r.profile), tune = (r.tune || r.mode || '').toUpperCase();
  text(g, prof, 404, 106, 20, ICE, 800, 'right', 92);
  chip(g, 318, 124, 40, 20, 'TCS', r.tcs, ICE, 12, low); chip(g, 364, 124, 40, 20, 'ABS', r.abs, ICE, 12, low);
  if (tune) text(g, tune, 404, 164, 14, HOT, 800, 'right', 92);
  const pct = Math.round(clamp01(r.tank) * 100);
  text(g, 'THRUST', 314, 190, 11, DIM, 600, 'left');
  text(g, r.thrustLive ? `${pct}%` : 'OFF', 404, 190, 15, r.thrustLive ? TXT : DIM, 700, 'right');
  g.fillStyle = HY.OFF; g.fillRect(314, 204, 90, 6);
  if (r.thrustLive && pct > 0) { g.fillStyle = pct < 25 ? '#ffb347' : ICE; g.fillRect(314, 204, 90 * (pct / 100), 6); }
  // right of the arc: the next turn and its distance, the destination and its distance (or the road you're on)
  let navLine = '';
  if (r.dest) {
    turnArrow(g, 634, 106, 24, r.turn, ICE);
    navLine = miles(r.nextMi); text(g, navLine, 650, 107, 18, TXT, 700, 'left', 66);
    text(g, r.dest, 620, 140, 15, TXT, 600, 'left', 96, 11);
    text(g, miles(r.destMi), 620, 164, 17, ICE, 700, 'left', 96);
  } else {
    text(g, 'NO ROUTE', 620, 106, 12, DIM, 600, 'left');
    if (r.road) text(g, r.road, 620, 132, 15, TXT, 600, 'left', 96, 11);
  }
  // under the speed: the power in use (the bar and the figure) and the G-meter
  const pf = clamp01(r.kw / Math.max(1, r.kwMax));
  if (pf > 0.005) { g.fillStyle = pf > 0.8 ? HOT : ICE; g.fillRect(400, 241, 224 * pf, 5); }
  text(g, `${Math.round(r.kw)} kW`, 484, 216, 15, TXT, 600, 'right');
  gMeter(g, 566, 215, 17, r.gx, r.gy, DEEP, HOT, low);
  // the top corners, inside the frame's lines (the outer at y 12, the inner at 22) and clear of the housing's edge on
  // the left (the review of 2026-11-12: at y 17 the clock sat on the lines and the temperature's first digit under the
  // edge): the clock and temperature (both simulated: labelled so), the trip and the top speed this run
  if (r.clock) text(g, r.clock, 150, 36, 17, TXT, 600, 'left', 96);
  text(g, `${Math.round(r.tempF)}°F sim`, 150, 56, 15, DIM, 600, 'left', 70);
  text(g, `TRIP ${r.tripMi.toFixed(1)} mi`, 900, 36, 15, TXT, 600, 'right', 110);
  text(g, `TOP ${Math.round(r.topMph)} mph`, 900, 56, 15, DIM, 600, 'right', 96);
  // the centre screen: the tune and the assists, each lit when on
  text(g, tune || 'SPORT', 716 + 154, 256 + 116, 28, ICE, 700, 'center', 240);
  text(g, 'ABS', 716 + 124, 256 + 150, 18, r.abs ? TXT : '#ff9a5c', 600, 'center');
  text(g, 'TCS', 716 + 184, 256 + 150, 18, r.tcs ? TXT : '#ff9a5c', 600, 'center');
  shown.mph = mph; shown.gear = gear; shown.profile = prof; shown.tcs = r.tcs ? 'on' : 'off'; shown.abs = r.abs ? 'on' : 'off'; shown.tune = tune;
  shown.thrust = r.thrustLive ? `${pct}%` : 'off'; shown.turn = r.dest ? r.turn : ''; shown.next = navLine; shown.dest = r.dest; shown.redline = r.redline ? 'lit' : 'dark';
  shown.clock = r.clock; shown.trip = r.tripMi.toFixed(1); shown.top = String(Math.round(r.topMph));
}
export function hyperDash(q: 'phone' | 'high'): DashPainter {
  return once('dash.hyper' + q, () => {
    const low = q === 'phone';
    const [base, bg] = canvas(1024, 512), [c, g] = canvas(1024, 512);
    hyperBase(bg, low);
    const t = tex(c), w = watch(22);
    const p: DashPainter = {
      tex: t, draws: 0, shown: {},
      update(r, lowNow) {
        const k = w.cur;
        k[0] = Math.round(r.mph); k[1] = r.gear; k[2] = Math.round(clamp01(r.rpmFrac) * (lowNow ? 20 : 40)); k[3] = ON(r.redline); k[4] = r.profile; k[5] = ON(r.tcs); k[6] = ON(r.abs);
        k[7] = r.tune || r.mode; k[8] = Math.round(clamp01(r.tank) * 50); k[9] = ON(r.thrustLive); k[10] = r.dest ? r.turn : ''; k[11] = navQ(r); k[12] = r.dest; k[13] = r.dest ? qMi(r.destMi) : 0;
        k[14] = r.dest ? '' : r.road; k[15] = r.clock; k[16] = Math.round(r.tempF); k[17] = Math.round(r.tripMi * 10); k[18] = Math.round(r.topMph);
        k[19] = Math.round(r.kw / 15); k[20] = lowNow ? 0 : Math.round(r.gx * 10); k[21] = lowNow ? 0 : Math.round(r.gy * 10);
        if (!w.changed()) return false;
        g.drawImage(base, 0, 0); hyperLive(g, r, lowNow, p.shown); t.needsUpdate = true; p.draws++;
        return true;
      },
    };
    p.update(Object.assign(dashReadout(), { mph: 132, gear: '6', kw: 186, kwMax: 1500, rpm: 6200, rpmFrac: 0.62, mode: 'UNLEASHED', tune: 'Unleashed', tank: 1, thrustLive: true }), low);
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
// tach's digital window whole; of the left side display only x 365..470 of its 512 (the left hand's fingers and thumb
// cover the rest, the tach's bezel the last 40 px), of the right one x 42..175 above y 260 (the right hand's fingers and
// thumb beyond, the tach's round bezel below). So each fact sits there, right-aligned on the left and left-aligned on
// the right, as big as the width allows, and the small labels are as few as reading needs: TRIP and TOP stay (a
// number alone could be anything), their units go in the label. The clock and the simulated temperature move into the
// tach window's free strip under the speed, which nothing covers.
// The tachometer's digital window (live gear and speed, the clock and temperature), 256 x 224 (128 x 112 on phones,
// drawn at half scale: the window is about 100 device pixels across there), laid over the printed window: a dark
// rounded glass (transparent outside its corners)
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
    const [wc, wg] = canvas(256 * k0, 224 * k0), wt = tex(wc), ww = watch(4);
    const win: DashPainter = {
      tex: wt, draws: 0, shown: {},
      update(r) {
        ww.cur[0] = Math.round(r.mph); ww.cur[1] = r.gear; ww.cur[2] = r.clock; ww.cur[3] = Math.round(r.tempF);
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
        // the clock and the simulated temperature, labelled so
        const clk = r.clock, tmp = `${Math.round(r.tempF)}°F sim`;
        if (clk) { text(g, clk, 22, 186, 30, RO.TXT, 700, 'left', 112); text(g, tmp, 236, 186, 26, RO.DIM, 700, 'right', 98); }
        else text(g, tmp, 128, 186, 28, RO.DIM, 700, 'center', 200);
        wt.needsUpdate = true; win.draws++; win.shown.mph = mph; win.shown.gear = gear; win.shown.clock = clk; win.shown.temp = tmp;
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
      // the seen part (x 365..470), right-aligned: the profile, TCS and ABS, the trip and the top speed this run
      const prof = profileWord(r.profile);
      text(g, prof, 470, 40, 36, accent, 800, 'right', 104);
      chip(g, 366, 72, 50, 32, 'TCS', r.tcs, accent, 20, low); chip(g, 420, 72, 50, 32, 'ABS', r.abs, accent, 20, low);
      text(g, 'TRIP mi', 470, 132, 24, RO.DIM, 700, 'right', 104);
      text(g, r.tripMi.toFixed(1), 470, 170, 48, RO.TXT, 700, 'right', 104);
      text(g, 'TOP mph', 470, 214, 24, RO.DIM, 700, 'right', 104);
      text(g, String(Math.round(r.topMph)), 470, 252, 48, RO.TXT, 700, 'right', 104);
      // outer (left) part: the G-meter
      text(g, 'G', 24, 40, 22, RO.DIM, 600, 'left');
      gMeter(g, 140, 190, 78, r.gx, r.gy, RO.FAINT, accent, low);
      shown.profile = prof; shown.tcs = r.tcs ? 'on' : 'off'; shown.abs = r.abs ? 'on' : 'off'; shown.trip = r.tripMi.toFixed(1); shown.top = String(Math.round(r.topMph));
    }, (r, k, low) => { k[0] = r.profile; k[1] = ON(r.tcs); k[2] = ON(r.abs); k[3] = Math.round(r.tripMi * 10); k[4] = Math.round(r.topMph); k[5] = low ? 0 : Math.round(r.gx * 10); k[6] = low ? 0 : Math.round(r.gy * 10); }, 7);
    const right = side((g, r, _low, shown) => {
      // the seen part (x 42..175, above y 260), left-aligned: the next turn's arrow and distance, the destination (on
      // two lines when it needs them) and its distance; with no route, NO ROUTE and the road you're on
      let navLine = '';
      if (r.dest) {
        turnArrow(g, 70, 40, 56, r.turn, accent);
        navLine = miles(r.nextMi);
        const sp = navLine.indexOf(' ');
        // the figure big, its unit beside it smaller
        g.font = `700 48px ${FONT}`;
        const fw = Math.min(g.measureText(navLine.slice(0, sp)).width, 92);
        text(g, navLine.slice(0, sp), 44, 104, 48, RO.TXT, 700, 'left', 92);
        text(g, navLine.slice(sp + 1), 50 + fw, 110, 26, RO.DIM, 700, 'left', 128 - fw);
        name2(g, r.dest, 44, 148, 28, RO.TXT, 128, 30);
        text(g, miles(r.destMi), 44, 220, 38, accent, 700, 'left', 128);
        // outer part: where the next manoeuvre leads
        if (r.navTo) text(g, r.navTo, 250, 128, 24, RO.DIM, 600, 'left', 240, 16);
      } else {
        text(g, 'NO ROUTE', 44, 60, 26, RO.DIM, 700, 'left', 128);
        if (r.road) name2(g, r.road, 44, 104, 30, RO.TXT, 128, 34);
      }
      shown.turn = r.dest ? r.turn : ''; shown.next = navLine; shown.dest = r.dest;
    }, (r, k) => { k[0] = r.dest ? r.turn : ''; k[1] = navQ(r); k[2] = r.dest; k[3] = r.dest ? qMi(r.destMi) : 0; k[4] = r.dest ? r.navTo : r.road; }, 5);
    const d0 = Object.assign(dashReadout(), { mph: 64, gear: '6' });
    win.update(d0, low0); left.update(d0, low0); right.update(d0, low0);
    return { window: win, left, right };
  });
}
