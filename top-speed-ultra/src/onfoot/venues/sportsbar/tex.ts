// Vega & Vinnie's own code-painted art (ours; the bar was Stoppage Time until 2026-11-16): the script wordmark, the
// blade sign, the pylon, the wings mural (our own wording), the strip's tenant bands, the lot's signs, the still
// "SIMULATED" test card the screens show in S1, and one atlas for the boards, the pictograms and the signs. Every
// string drawn here is plain and honest: nothing says the screens or the crowd are anything but simulated.
import * as THREE from 'three';
import { canvasTex, rand } from '../../engine/geom';
import { BAR_NAME, BAR_LINE, BAR_PYLON_LINE, PALETTE } from './brand';

const SANS = '"Avenir Next", "Segoe UI", system-ui, Arial, sans-serif';
const WIDE = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
/** the script: a system script face where the device has one, else an italic serif (no web font is loaded) */
const SCRIPT = '"Snell Roundhand", "Segoe Script", "Brush Script MT", "URW Chancery L", Georgia, "DejaVu Serif", "Liberation Serif", serif';
const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", "Liberation Serif", serif';
const NAVY = '#1f2a44';

/** a rounded rectangle path */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/** "+n" in dot-matrix LED digits (5 x 7 dots each), lime on dark */
const DOTS: Record<string, string[]> = {
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
};
export function dotText(g: CanvasRenderingContext2D, text: string, x: number, y: number, dot: number, on: string, off: string) {
  let cx = x;
  for (const ch of text) {
    const rows = DOTS[ch]; if (!rows) { cx += dot * 3; continue; }
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
      g.fillStyle = rows[j][i] === '1' ? on : off;
      g.beginPath(); g.arc(cx + i * dot + dot / 2, y + j * dot + dot / 2, dot * 0.38, 0, Math.PI * 2); g.fill();
    }
    cx += dot * 6;
  }
}

/** the wordmark on the black facade (the owner's front photo): "Vega & Vinnie's" in cream script and "SPORTS BAR &
 *  CANTINA" in cream serif capitals under it, on a clear ground (a warm halo is the emissive part at night). The
 *  canvas is 2048 x 448, drawn over a 9.4 m x 2.05 m quad */
export function wordmarkTex() {
  return canvasTex(2048, 448, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.save(); g.translate(w / 2, h * 0.56); g.transform(1, 0, -0.12, 1, 0, 0);
    g.font = `italic 400 236px ${SCRIPT}`;
    g.shadowColor = 'rgba(255,214,150,0.9)'; g.shadowBlur = 22; g.fillStyle = PALETTE.cream;
    g.fillText(BAR_NAME, 0, 0); g.shadowBlur = 0; g.fillText(BAR_NAME, 0, 0);
    g.restore();
    g.font = `500 112px ${SERIF}`; g.fillStyle = PALETTE.cream;
    g.save(); g.translate(w / 2, h - 34); g.scale(1.06, 1);
    g.shadowColor = 'rgba(255,214,150,0.8)'; g.shadowBlur = 14; g.fillText(BAR_LINE.toUpperCase(), 0, 0); g.shadowBlur = 0; g.fillText(BAR_LINE.toUpperCase(), 0, 0);
    g.restore();
  });
}

/** the blade sign's face: black, the script name in cream, OPEN or the closed notice under it. `draw(n, closed)` keeps
 *  the page's old call (n was Stoppage Time's added-time count, unused now) */
export function bladeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = (_n: number, closed: string | null) => {
    const g = c.getContext('2d')!;
    g.fillStyle = PALETTE.facade; g.fillRect(0, 0, 256, 512);
    rr(g, 14, 14, 228, 484, 22); g.lineWidth = 5; g.strokeStyle = PALETTE.cream; g.stroke();
    g.fillStyle = PALETTE.cream; g.textAlign = 'center';
    g.font = `italic 400 64px ${SCRIPT}`; g.fillText('Vega &', 128, 120); g.fillText('Vinnie’s', 128, 200);
    g.font = `500 22px ${SERIF}`; g.fillText('SPORTS BAR', 128, 250); g.fillText('& CANTINA', 128, 278);
    if (closed) { g.font = `700 30px ${SANS}`; g.fillText('Closed', 128, 370); g.font = `600 22px ${SANS}`; g.fillText(closed, 128, 408); }
    else { rr(g, 52, 330, 152, 70, 10); g.fillStyle = '#b8322a'; g.fill(); g.fillStyle = PALETTE.cream; g.font = `700 40px ${SERIF}`; g.fillText('OPEN', 128, 380); }
    tex.needsUpdate = true;
  };
  draw(3, null);
  return { tex, draw };
}

/** the still test card every screen shows in S1: our colour bars, the glyph and a SIMULATED tag in the corner */
export function testCardTex(w = 1024, h = 576) {
  return canvasTex(w, h, (g) => {
    const bars = [PALETTE.chalk, PALETTE.lime, '#3fd0c0', '#4fbf4a', PALETTE.coral, '#e0405a', '#3a4fd8', PALETTE.violet];
    bars.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / bars.length, 0, w / bars.length + 1, h * 0.62); });
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#101010' : '#e8e8e8'; g.fillRect((i * w) / 16, h * 0.62, w / 16 + 1, h * 0.08); }
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#000'); grd.addColorStop(1, '#fff');
    g.fillStyle = grd; g.fillRect(0, h * 0.7, w, h * 0.3);
    // the glyph in the middle: the "+3" added-time board
    rr(g, w * 0.32, h * 0.16, w * 0.36, h * 0.42, 26); g.fillStyle = 'rgba(14,12,32,0.94)'; g.fill(); g.lineWidth = 6; g.strokeStyle = PALETTE.lime; g.stroke();
    dotText(g, '+3', w * 0.32 + 52, h * 0.16 + 30, w * 0.0225, PALETTE.lime, '#203010');
    g.fillStyle = PALETTE.chalk; g.font = `800 ${Math.round(h * 0.06)}px ${WIDE}`; g.textAlign = 'center';
    g.fillText(BAR_NAME.toUpperCase(), w / 2, h * 0.84);
    g.font = `600 ${Math.round(h * 0.04)}px ${SANS}`; g.fillText('Fictional leagues · simulated matches', w / 2, h * 0.92);
    // the SIMULATED corner tag, in every frame
    rr(g, w - 248, 18, 230, 48, 10); g.fillStyle = 'rgba(10,10,20,0.85)'; g.fill();
    g.fillStyle = PALETTE.lime; g.font = `800 28px ${SANS}`; g.textAlign = 'center'; g.fillText('SIMULATED', w - 133, 52);
  });
}

/** where each piece sits in the atlas (UV rects, v up) */
export interface UV { u0: number; v0: number; u1: number; v1: number }
const R = (x: number, y: number, w: number, h: number, S = 1024, T = 2048): UV => ({ u0: x / S, v0: 1 - (y + h) / T, u1: (x + w) / S, v1: 1 - y / T });
export const ATLAS = {
  chalkboard: R(0, 0, 512, 360), rules: R(512, 0, 512, 200), restroom: R(512, 200, 160, 160), exit: R(672, 200, 200, 90),
  dartboard: R(0, 360, 256, 256), kitchen: R(256, 360, 384, 200), scarves: R(0, 640, 1024, 120), menu: R(640, 360, 384, 260), plate: R(0, 780, 512, 120),
  // the outside (the owner's 13 photos; our own art and wording): the lower half of the atlas
  mural: R(0, 1024, 1024, 224), shield: R(0, 1408, 384, 400), openBoard: R(384, 1408, 384, 96), menuPanel: R(384, 1504, 384, 304),
  wines: R(768, 1408, 128, 288), aframe: R(896, 1408, 128, 192), ada: R(896, 1600, 128, 128), adaStall: R(768, 1696, 128, 112),
  tenants: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => R((k % 4) * 256, 1808 + Math.floor(k / 4) * 56, 256, 56)),
  parking: R(0, 1920, 160, 128), access: R(160, 1920, 192, 72), backflow: R(352, 1920, 96, 48), hvac: R(448, 1920, 128, 96), stucco: R(576, 1920, 448, 128),
};
/** the strip's other tenants: generic trades in our own plain words, no real business's name or mark */
export const TENANTS = ['NUTRITION & WELLNESS', 'DRY CLEANERS', 'TAX & NOTARY', 'PHONE REPAIR', 'NAIL STUDIO', 'BARBER', 'DENTAL OFFICE', 'INSURANCE'];
export function signsAtlas() {
  return canvasTex(1024, 2048, (g) => {
    g.fillStyle = '#222'; g.fillRect(0, 0, 1024, 2048);
    // the chalkboard: "On the screens tonight" (S2a writes the fictional fixtures)
    g.fillStyle = '#20262a'; g.fillRect(0, 0, 512, 360); g.strokeStyle = '#7a5a3a'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 346);
    g.fillStyle = PALETTE.chalk; g.textAlign = 'center'; g.font = `700 34px ${SANS}`; g.fillText('ON THE SCREENS', 256, 64); g.fillText('TONIGHT', 256, 104);
    g.fillStyle = PALETTE.lime; g.fillRect(150, 122, 212, 4);
    g.fillStyle = PALETTE.chalk; g.font = `500 26px ${SANS}`;
    ['Fictional leagues', 'simulated matches', 'Big screen · patio · bar', 'Ask for the TV guide'].forEach((t, i) => g.fillText(t, 256, 176 + i * 42));
    // the house rules
    g.fillStyle = PALETTE.violet; g.fillRect(512, 0, 512, 200);
    g.fillStyle = PALETTE.chalk; g.font = `800 30px ${WIDE}`; g.fillText('HOUSE RULES', 768, 58);
    g.font = `600 30px ${SANS}`; g.fillStyle = PALETTE.lime; g.fillText('Be kind · Drink water', 768, 118); g.fillText('Get home safe', 768, 160);
    // our own restroom pictogram (a plain person in a circle)
    g.fillStyle = '#2a2740'; g.fillRect(512, 200, 160, 160);
    g.fillStyle = PALETTE.chalk; g.beginPath(); g.arc(592, 240, 15, 0, Math.PI * 2); g.fill();
    g.fillRect(578, 260, 28, 46); g.fillRect(580, 304, 9, 36); g.fillRect(595, 304, 9, 36);
    g.font = `600 18px ${SANS}`; g.fillText('Restroom', 592, 352);
    // the exit sign
    g.fillStyle = '#0a2a12'; g.fillRect(672, 200, 200, 90); g.fillStyle = '#4dff7a'; g.font = `800 48px ${SANS}`; g.fillText('EXIT', 772, 262);
    // a dartboard face: the standard generic segment layout, no maker's marks. S2b: drawn at the standard radii (the
    // 0.46 m panel is 256 px, 556.5 px a metre: bull 6.35 mm, outer bull 15.9, treble 99 to 107, double 162 to 170,
    // the numbers' ring outside), so the face is the board engine/sim/darts.ts scores
    const cx = 128, cy = 488, PX = 256 / 0.46, ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    const rr = (m: number) => m * PX;
    g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, 127, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 20; i++) {
      const a0 = ((i - 0.5) / 20) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 0.5) / 20) * Math.PI * 2 - Math.PI / 2;
      const ring = (r0: number, r1: number, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, rr(r1), a0, a1); g.arc(cx, cy, rr(r0), a1, a0, true); g.closePath(); g.fill(); };
      ring(0.0159, 0.17, i % 2 ? '#e8dcc0' : '#151515');
      ring(0.099, 0.107, i % 2 ? '#2c7a3a' : '#b0262a'); ring(0.162, 0.17, i % 2 ? '#2c7a3a' : '#b0262a');
      // the wire between the beds, and the number outside the double ring
      g.strokeStyle = '#9a9a9a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(cx + Math.cos(a0) * rr(0.0159), cy + Math.sin(a0) * rr(0.0159)); g.lineTo(cx + Math.cos(a0) * rr(0.17), cy + Math.sin(a0) * rr(0.17)); g.stroke();
      const am = (i / 20) * Math.PI * 2 - Math.PI / 2;
      g.save(); g.translate(cx + Math.cos(am) * rr(0.192), cy + Math.sin(am) * rr(0.192)); g.rotate(am + Math.PI / 2);
      g.fillStyle = '#f1efe7'; g.font = `700 15px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(ORDER[i]), 0, 0); g.restore();
    }
    g.fillStyle = '#2c7a3a'; g.beginPath(); g.arc(cx, cy, rr(0.0159), 0, Math.PI * 2); g.fill(); g.fillStyle = '#b0262a'; g.beginPath(); g.arc(cx, cy, rr(0.00635), 0, Math.PI * 2); g.fill();
    g.textBaseline = 'alphabetic';
    // the kitchen seen through the pass: warm, steel, a ticket rail
    const kg = g.createLinearGradient(0, 360, 0, 560); kg.addColorStop(0, '#ffe3b0'); kg.addColorStop(1, '#a8743a');
    g.fillStyle = kg; g.fillRect(256, 360, 384, 200);
    g.fillStyle = '#9aa0a6'; g.fillRect(256, 470, 384, 14); g.fillStyle = '#6a6e72'; for (let x = 280; x < 620; x += 70) g.fillRect(x, 400, 46, 60);
    g.fillStyle = '#f4f0e6'; for (let x = 270; x < 630; x += 34) g.fillRect(x, 368, 22, 28);
    // the scarves wall: fictional colours, two per scarf, no names
    const cols = [[PALETTE.coral, PALETTE.chalk], ['#2a6fdb', '#f2c230'], ['#1f8a5a', '#f1efe7'], ['#7a2d8f', '#c3f23a'], ['#d13a2f', '#1b1b1b'], ['#f08c1a', '#22305e'], ['#2bb3c0', '#f1efe7'], ['#9a6b43', '#c3f23a']];
    for (let i = 0; i < 16; i++) { const [a, b] = cols[i % cols.length], x = i * 64; for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? a : b; g.fillRect(x + 6, 640 + k * 15, 52, 15); } }
    // the menu board (S2a fills the items)
    g.fillStyle = '#1b1932'; g.fillRect(640, 360, 384, 260); g.fillStyle = PALETTE.chalk; g.font = `800 30px ${WIDE}`; g.fillText('MENU', 832, 410);
    g.font = `500 22px ${SANS}`; ['Wings · Fries · Tacos', 'Nachos · Sliders', 'Sodas · Aguas frescas', 'Coffee · Zero-proof beer'].forEach((t, i) => g.fillText(t, 832, 460 + i * 36));
    // a nameplate: the bar's name in small type
    g.fillStyle = PALETTE.violet; g.fillRect(0, 780, 512, 120); g.fillStyle = PALETTE.lime; g.font = `900 52px ${WIDE}`; g.fillText(BAR_NAME.toUpperCase(), 256, 858);
    outsideArt(g);
  });
}

/** the outside's art in the atlas's lower half (y 1024 to 2048) */
function outsideArt(g: CanvasRenderingContext2D) {
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // the wings mural on the black wall: two spread white wings feathered in red, and our own words between them (the
  // owner's photo shows a real team's mark and slogan there: never reproduced; ours names no team)
  g.fillStyle = '#2c2a2b'; g.fillRect(0, 1024, 1024, 384);
  // (drawn on a 1024 x 384 design, squeezed to the 224 px band the 6.4 m x 1.4 m panel shows)
  g.save(); g.translate(0, 1024); g.scale(1, 224 / 384); g.translate(0, -1024);
  const wing = (dir: 1 | -1) => {
    const cx = 512, cy = 1290;
    for (let row = 0; row < 4; row++) {
      const n = 9 - row, len0 = 330 - row * 62;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), ang = (-0.95 + t * 1.25) - row * 0.05, len = len0 * (0.72 + 0.28 * Math.sin(t * Math.PI));
        const x0 = cx + dir * (40 + row * 28 + t * 40), y0 = cy - 40 + row * 14 - t * 30;
        const x1 = x0 + dir * Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len * 0.75;
        g.save(); g.translate(x0, y0); g.rotate(Math.atan2(y1 - y0, x1 - x0));
        g.beginPath(); g.ellipse(len / 2, 0, len / 2, 13 - row * 1.5, 0, 0, Math.PI * 2);
        g.fillStyle = row === 3 ? '#f2ece4' : '#fbf8f2'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c8343a'; g.stroke();
        g.restore();
      }
    }
  };
  wing(-1); wing(1);
  g.restore();
  g.fillStyle = '#fbf8f2'; g.font = `italic 600 40px ${SCRIPT}`; g.fillText('Take Flight', 512, 1062);
  g.font = `italic 400 22px ${SCRIPT}`; g.fillStyle = '#d9d2c4'; g.fillText('— V & V', 900, 1236);
  g.fillStyle = '#26301f'; g.fillRect(0, 1248, 1024, 160);
  // the pylon's shield: cream, a dark frame, the name in navy script and SPORTS CANTINA under a rule
  g.fillStyle = '#2b2a2c'; g.fillRect(0, 1408, 384, 400);
  g.beginPath(); g.moveTo(24, 1440); g.quadraticCurveTo(110, 1418, 192, 1436); g.quadraticCurveTo(274, 1418, 360, 1440); g.lineTo(360, 1690);
  g.quadraticCurveTo(300, 1730, 192, 1790); g.quadraticCurveTo(84, 1730, 24, 1690); g.closePath();
  g.fillStyle = PALETTE.cream; g.fill(); g.lineWidth = 8; g.strokeStyle = '#1b1a1c'; g.stroke();
  g.fillStyle = NAVY; g.font = `italic 700 70px ${SCRIPT}`; g.fillText('Vega &', 192, 1545); g.fillText('Vinnie’s', 192, 1622);
  g.fillStyle = '#b0612a'; g.fillRect(96, 1640, 192, 6);
  g.fillStyle = NAVY; g.font = `700 30px ${SERIF}`; g.fillText(BAR_PYLON_LINE.toUpperCase(), 192, 1690);
  // the "<- OPEN" board
  g.fillStyle = PALETTE.cream; g.fillRect(384, 1408, 384, 96); g.lineWidth = 6; g.strokeStyle = '#1b1a1c'; g.strokeRect(387, 1411, 378, 90);
  g.fillStyle = NAVY; g.font = `700 60px ${SERIF}`; g.fillText('← OPEN', 576, 1478);
  // the dark panel under them: the menu list (the owner's older pylon photo's list, on the current pylon's blank panel)
  g.fillStyle = '#1e1e21'; g.fillRect(384, 1504, 384, 304);
  g.fillStyle = PALETTE.cream; g.font = `700 32px ${SERIF}`; g.fillText(BAR_PYLON_LINE.toUpperCase(), 576, 1552);
  g.fillRect(420, 1566, 312, 3);
  g.font = `600 26px ${SERIF}`;
  // (the owner's older pylon says LIVE SPORTS: our screens are simulated, so no "live" on a canvas)
  [['COLD BEER', 'KITCHEN'], ['BIG SCREENS', 'HAPPY HOUR'], ['POOL · DARTS', 'PATIO']].forEach(([a, b], i) => {
    g.fillStyle = PALETTE.cream; g.fillText(a, 486, 1618 + i * 64); g.fillStyle = b === 'HAPPY HOUR' ? '#e0574a' : PALETTE.cream; g.fillText(b, 670, 1618 + i * 64);
  });
  // "WINES COLD BEER" stacked, cream on the hedge wall's dark plaque
  g.fillStyle = '#26301f'; g.fillRect(768, 1408, 128, 288); g.fillStyle = PALETTE.cream; g.font = `600 34px ${SERIF}`;
  ['WINES', 'COLD', 'BEER'].forEach((t, i) => g.fillText(t, 832, 1490 + i * 70));
  // the chalkboard A-frame: a wood frame, a beer mug and crossed forks in chalk
  g.fillStyle = '#b88a4a'; g.fillRect(896, 1408, 128, 192); g.fillStyle = '#1f2322'; g.fillRect(906, 1418, 108, 172);
  g.fillStyle = '#e8b030'; g.fillRect(934, 1452, 40, 52); g.fillStyle = '#f4f0e4'; g.beginPath(); g.ellipse(954, 1450, 24, 10, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f4f0e4'; g.lineWidth = 4; g.strokeRect(934, 1452, 40, 52); g.beginPath(); g.arc(978, 1476, 10, -1.2, 1.2); g.stroke();
  g.beginPath(); g.moveTo(926, 1530); g.lineTo(994, 1574); g.moveTo(994, 1530); g.lineTo(926, 1574); g.stroke();
  // the accessible-entrance sign (blue, a plain seated figure of our own drawing)
  g.fillStyle = '#1f4fa3'; g.fillRect(896, 1600, 128, 128); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(900, 1604, 120, 120);
  g.fillStyle = '#fff'; g.font = `700 15px ${SANS}`; g.fillText('ACCESSIBLE', 960, 1628); g.fillText('ENTRANCE', 960, 1646);
  g.beginPath(); g.arc(960, 1662, 6, 0, 7); g.fill(); g.fillRect(956, 1670, 7, 20); g.fillRect(956, 1688, 22, 6);
  g.lineWidth = 4; g.beginPath(); g.arc(958, 1700, 14, 0.3, 3.6); g.stroke();
  // the accessible stall's painted symbol (the same figure, white on blue, for the asphalt)
  g.fillStyle = '#2a62c8'; g.fillRect(768, 1696, 128, 112); g.fillStyle = '#fff'; g.beginPath(); g.arc(828, 1718, 9, 0, 7); g.fill();
  g.fillRect(822, 1730, 10, 30); g.fillRect(822, 1756, 32, 9); g.lineWidth = 6; g.strokeStyle = '#fff'; g.beginPath(); g.arc(826, 1772, 20, 0.3, 3.6); g.stroke();
  // the tenant bands: dark plaques with plain white words
  TENANTS.forEach((t, k) => { const x = (k % 4) * 256, y = 1808 + Math.floor(k / 4) * 56; g.fillStyle = '#2c2c2e'; g.fillRect(x, y, 256, 56); g.fillStyle = '#f2f2f2'; g.font = `700 ${t.length > 14 ? 22 : 26}px ${SANS}`; g.fillText(t, x + 128, y + 37); });
  // the lot's signs: PARKING FOR CUSTOMERS ONLY / VIOLATORS WILL BE TOWED, and the blue ACCESS arrow
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 1920, 160, 128); g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(4, 1924, 152, 120);
  g.fillStyle = '#1a1a1a'; g.font = `700 17px ${SANS}`; ['PARKING FOR', 'CUSTOMERS', 'ONLY', 'VIOLATORS WILL', 'BE TOWED'].forEach((t, i) => g.fillText(t, 80, 1950 + i * 21));
  g.fillStyle = '#1f4fa3'; g.fillRect(160, 1920, 192, 72); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(164, 1924, 184, 64);
  g.fillStyle = '#fff'; g.font = `700 26px ${SANS}`; g.fillText('ACCESS →', 256, 1966);
  // a backflow preventer's yellow tag, the HVAC units' grille
  g.fillStyle = '#e2c23a'; g.fillRect(352, 1920, 96, 48);
  g.fillStyle = '#b9bcbd'; g.fillRect(448, 1920, 128, 96); g.fillStyle = '#8d9091'; for (let y = 1926; y < 2012; y += 8) g.fillRect(452, y, 120, 3);
  // tan stucco with a faint trowel texture (the strip's walls)
  g.fillStyle = '#c7a77a'; g.fillRect(576, 1920, 448, 128);
  for (let i = 0; i < 900; i++) { const x = 576 + ((i * 97) % 448), y = 1920 + ((i * 53) % 128); g.fillStyle = i % 2 ? 'rgba(255,240,215,0.12)' : 'rgba(90,70,40,0.1)'; g.fillRect(x, y, 6, 3); }
}

/** the bar's polished concrete floor (S4's second repair; it shared Lot 57's polishedTex): the same pale slab and 4 m
 *  score lines, with the mottling and the flecks much fainter and finer. At Low the toon look posterizes the albedo
 *  and Lot 57's dark brown flecks grew into blotches that read as dirt on the floor (the art review) */
export function barFloorTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#aaa59d'; g.fillRect(0, 0, w, h);
    const r = rand(91);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '96,90,84' : '255,250,240'},${r() * 0.025})`; g.beginPath(); g.ellipse(r() * w, r() * h, 30 + r() * 120, 20 + r() * 80, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 3000; i++) { const a = r(); g.fillStyle = a < 0.5 ? `rgba(120,112,104,${0.05 + r() * 0.07})` : `rgba(235,230,220,${0.05 + r() * 0.08})`; const s = 0.6 + r() * 0.8; g.fillRect(r() * w, r() * h, s, s); }
    g.fillStyle = 'rgba(40,36,32,0.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  }, { repeat: true });
}

/** the bar's concrete (the walks, the patio, the planters and the facade; S4's second repair, it shared Lot 57's
 *  concreteTex): the same colour and 1 m score joints with a much finer, fainter grain. At Low the toon look's
 *  posterize grew Lot 57's dark grain into brown blotches on the planters and the paving (the art review) */
export function barConcreteTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h);
    const r = rand(7);
    for (let i = 0; i < 9000; i++) { const a = r() * 0.05, light = r() < 0.4; g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(40,36,32,${a})`; const s = 0.8 + r() * 1.2; g.fillRect(r() * w, r() * h, s, s); }
    g.strokeStyle = 'rgba(70,64,58,0.5)'; g.lineWidth = 3;
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); }
  }, { repeat: true });
}
