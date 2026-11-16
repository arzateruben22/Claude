// Stoppage Time's own code-painted art (ours): the wordmark, the "+3" added-time board on the blade sign, the still
// "SIMULATED" test card the screens show in S1, and one atlas for the boards, the pictograms and the signs. Every
// string drawn here is plain and honest: nothing says the screens or the crowd are anything but simulated.
import * as THREE from 'three';
import { canvasTex, rand } from '../../engine/geom';
import { BAR_NAME, BAR_TAGLINE, PALETTE } from './brand';

const SANS = '"Avenir Next", "Segoe UI", system-ui, Arial, sans-serif';
const WIDE = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

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

/** the wordmark: wide extended capitals, chalk, with a lime halo (the halo is the emissive part at night) */
export function wordmarkTex() {
  return canvasTex(2048, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h * 0.5); g.scale(1.55, 1);       // stretched horizontally (Lot 57 squeezes its letters)
    g.font = `900 132px ${WIDE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = PALETTE.lime; g.shadowBlur = 26; g.fillStyle = PALETTE.chalk;
    g.fillText(BAR_NAME.toUpperCase(), 0, -6);
    g.shadowBlur = 0; g.fillText(BAR_NAME.toUpperCase(), 0, -6);
    g.restore();
    g.font = `700 34px ${SANS}`; g.textAlign = 'center'; g.fillStyle = PALETTE.lime;
    g.fillText(BAR_TAGLINE.toUpperCase().split('').join(' '), w / 2, h - 30);
  });
}

/** the blade sign's face: the "+3" board, or the closed notice */
export function bladeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = (n: number, closed: string | null) => {
    const g = c.getContext('2d')!;
    g.fillStyle = PALETTE.violet; g.fillRect(0, 0, 256, 512);
    rr(g, 16, 16, 224, 480, 28); g.fillStyle = '#121026'; g.fill(); g.lineWidth = 6; g.strokeStyle = PALETTE.lime; g.stroke();
    g.fillStyle = PALETTE.chalk; g.font = `900 30px ${WIDE}`; g.textAlign = 'center';
    g.save(); g.translate(128, 108); g.scale(1.2, 1); g.fillText('STOPPAGE', 0, 0); g.fillText('TIME', 0, 38); g.restore();
    if (closed) {
      g.fillStyle = PALETTE.chalk; g.font = `700 30px ${SANS}`;
      g.fillText('Closed', 128, 280); g.font = `600 24px ${SANS}`; g.fillText(closed, 128, 322);
    } else {
      rr(g, 40, 210, 176, 150, 18); g.fillStyle = '#0b0a18'; g.fill();
      dotText(g, `+${n}`, 58, 236, 12.4, PALETTE.lime, '#1d2a10');
    }
    g.fillStyle = PALETTE.coral; g.fillRect(40, 420, 176, 10);
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
const R = (x: number, y: number, w: number, h: number, S = 1024): UV => ({ u0: x / S, v0: 1 - (y + h) / S, u1: (x + w) / S, v1: 1 - y / S });
export const ATLAS = {
  chalkboard: R(0, 0, 512, 360), rules: R(512, 0, 512, 200), restroom: R(512, 200, 160, 160), exit: R(672, 200, 200, 90),
  dartboard: R(0, 360, 256, 256), kitchen: R(256, 360, 384, 200), scarves: R(0, 640, 1024, 120), menu: R(640, 360, 384, 260), plate: R(0, 780, 512, 120),
};
export function signsAtlas() {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#222'; g.fillRect(0, 0, 1024, 1024);
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
  });
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
