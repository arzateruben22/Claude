// Every texture on the page is painted in code at load: surfaces (asphalt, concrete, pavers, the Shed's tilt-up
// panels, turf), our own sign and the trucks' livery, the chalkboard menu, the local leaderboard screen, the reader
// board under the sign, and small sprites. Lot 57, Two Lane Tacos and Night Shift Noodles are ours (fictional).
import * as THREE from 'three';
import { canvasTex, rand } from './geom';

export const PAL = { teal: '#12333A', cream: '#F3E6C4', red: '#C8462F', patina: '#4F7F6A', brick: '#8E4A36' };
const CONDENSED = '"Oswald", "Bebas Neue", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

/** condensed capitals whatever fonts the device has: draw, then squeeze horizontally to fit */
function condensed(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, weight = 800, align: 'left' | 'center' = 'center') {
  g.save();
  g.font = `${weight} ${px}px ${CONDENSED}`;
  const w = g.measureText(text).width, k = Math.min(0.78, maxW / Math.max(1, w));
  g.translate(x, y); g.scale(k, 1);
  g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillText(text, 0, 0);
  g.restore();
}
function grain(g: CanvasRenderingContext2D, w: number, h: number, n: number, seed: number, alpha: number, light = false) {
  const r = rand(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * alpha;
    g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    const s = 1 + r() * 2.2;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

// ------------------------------------------------------------------ surfaces (512 px, repeating)
export const asphaltTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4a4a4b'; g.fillRect(0, 0, w, h);
  grain(g, w, h, 26000, 3, 0.35); grain(g, w, h, 9000, 4, 0.12, true);
  const r = rand(5);
  for (let i = 0; i < 6; i++) {            // a few sealed cracks
    g.strokeStyle = 'rgba(15,15,16,0.55)'; g.lineWidth = 1.5 + r() * 2; g.beginPath();
    let x = r() * w, y = r() * h; g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 80; y += (r() - 0.5) * 80; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(20,20,22,${0.08 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, 7); g.fill(); }
}, { repeat: true });

export const concreteTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h);
  grain(g, w, h, 16000, 7, 0.12); grain(g, w, h, 6000, 8, 0.1, true);
  // joints every quarter (the batch maps 4 m to one repeat: a 1 m score)
  g.strokeStyle = 'rgba(70,64,58,0.55)'; g.lineWidth = 3;
  for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); }
}, { repeat: true });

export const paverTex = () => canvasTex(512, 512, (g, w, h) => {
  // 0.5 m x 0.25 m running-bond pavers, warm grey and buff (the batch maps 4 m to one repeat)
  // (sand-set concrete pavers in a warm buff blend: low contrast, so the yard reads as a floor, not a chessboard)
  g.fillStyle = '#7a6e60'; g.fillRect(0, 0, w, h);
  const r = rand(11), cw = w / 8, ch = h / 16;
  for (let row = 0; row < 16; row++) for (let col = -1; col < 8; col++) {
    const x = col * cw + (row % 2) * cw / 2, y = row * ch, v = r();
    const c = v < 0.45 ? [158, 140, 118] : v < 0.8 ? [146, 128, 108] : v < 0.94 ? [168, 148, 122] : [132, 112, 96];
    const k = 0.95 + r() * 0.08;
    g.fillStyle = `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`;
    g.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
    // a soft bevel: lighter top edge, darker bottom edge
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 1.5, y + 1.5, cw - 3, 2);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + 1.5, y + ch - 3.5, cw - 3, 2);
  }
  grain(g, w, h, 12000, 12, 0.1);
  // wear: a few darker scuffs and drink rings (it's a busy yard)
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(40,30,22,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 40, 6 + r() * 24, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(50,36,24,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.arc(r() * w, r() * h, 5 + r() * 3, 0, 7); g.stroke(); }
}, { repeat: true });

export const tiltupTex = () => canvasTex(512, 512, (g, w, h) => {
  // painted tilt-up concrete: soft mottling and roller marks, one panel joint per repeat (the Shed maps 6.5 m to a
  // repeat: one panel), a faint weep stain under each joint. White, so the vertex colour paints it.
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  const r = rand(21);
  for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.beginPath(); g.ellipse(r() * w, r() * h, 30 + r() * 90, 20 + r() * 60, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, 0, 6 + r() * 14, h); }
  grain(g, w, h, 9000, 22, 0.07);
  g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(0, 0, 5, h);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(5, 0, 2, h);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.07)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.02)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(7, 0, 30, h);
}, { repeat: true });

/** wood boards with grain (white-ish, tinted by vertex colour): 6 boards per repeat */
export const woodTex = () => canvasTex(512, 512, (g, w, h) => {
  const r = rand(61), n = 6, bh = h / n;
  for (let b = 0; b < n; b++) {
    const k = 0.84 + r() * 0.16;
    g.fillStyle = `rgb(${236 * k | 0},${226 * k | 0},${212 * k | 0})`; g.fillRect(0, b * bh, w, bh);
    for (let i = 0; i < 46; i++) {
      const y = b * bh + r() * bh, a = 0.04 + r() * 0.1;
      g.strokeStyle = `rgba(70,40,20,${a})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * (1 + r() * 2));
      g.stroke();
    }
    for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(60,32,16,0.18)'; g.beginPath(); g.ellipse(r() * w, b * bh + bh / 2, 6 + r() * 6, 3, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(25,14,8,0.55)'; g.fillRect(0, b * bh, w, 3);
    const end = r() * w; g.fillRect(end, b * bh, 2, bh);
  }
}, { repeat: true });

/** running-bond brick (the frontage planter wall): 2 m per repeat, 10 bricks across, 26 courses */
export const brickTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#b9ab98'; g.fillRect(0, 0, w, h);
  const r = rand(71), rows = 26, cols = 10, bw = w / cols, bh = h / rows;
  for (let row = 0; row < rows; row++) for (let c = -1; c < cols; c++) {
    const x = c * bw + (row % 2) * bw / 2, y = row * bh, v = r();
    const base = v < 0.6 ? [142, 74, 54] : v < 0.85 ? [124, 62, 46] : [158, 88, 64];
    const k = 0.86 + r() * 0.2;
    g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
    g.fillRect(x + 2, y + 2, bw - 4, bh - 3);
  }
  grain(g, w, h, 14000, 72, 0.16);
}, { repeat: true });

/**
 * A glass roll-up door (the Shed's four onto the yard): aluminium rails and stiles over 4 x 5 panes. The panes are
 * part-transparent (alpha), so the lit interior shows through at night.
 */
export const rollDoorTex = () => canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(52,70,74,0.42)'; g.fillRect(0, 0, w, h);
  const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.06)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(176,180,182,1)';
  for (let k = 0; k <= 5; k++) g.fillRect(0, Math.min(h - 6, k * (h / 5) - 3), w, 6);
  for (let k = 0; k <= 4; k++) g.fillRect(Math.min(w - 5, k * (w / 4) - 2), 0, 5, h);
  g.fillStyle = 'rgba(120,124,126,1)'; g.fillRect(0, h - 10, w, 10);
});

/** a soft round blob (contact shadows under props on presets without shadow maps) */
export const blobTex = () => canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
}, { srgb: false });

export const turfTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4f7d33'; g.fillRect(0, 0, w, h);
  const r = rand(31);
  for (let i = 0; i < 30000; i++) {
    const x = r() * w, y = r() * h, l = 2 + r() * 5, k = r();
    g.strokeStyle = k < 0.5 ? 'rgba(40,70,25,0.45)' : k < 0.85 ? 'rgba(110,150,70,0.4)' : 'rgba(150,170,90,0.35)';
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - l); g.stroke();
  }
  // faint mowing stripes
  for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'; g.fillRect(0, k * h / 4, w, h / 4); }
}, { repeat: true });

export const dirtTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#9a8466'; g.fillRect(0, 0, w, h);
  grain(g, w, h, 9000, 41, 0.25); grain(g, w, h, 3000, 42, 0.15, true);
}, { repeat: true });

/** a soft round glow for the bulbs and lamps (additive points) */
export const glowTex = () => canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,210,0.65)'); gr.addColorStop(0.5, 'rgba(255,200,140,0.12)'); gr.addColorStop(1, 'rgba(255,180,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

/** black steel pickets with two rails (alpha-tested), 2 m per repeat */
export const picketTex = () => canvasTex(256, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 8, w, 7); g.fillRect(0, h - 22, w, 7);
  for (let k = 0; k < 16; k++) g.fillRect(k * (w / 16) + 6, 4, 4, h - 8);
}, { repeat: true });

/** chain-link mesh (alpha-tested), 1 m per repeat */
export const chainTex = () => canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 2;
  for (let k = -8; k < 16; k++) { g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + h, h); g.stroke(); g.beginPath(); g.moveTo(k * 16 + h, 0); g.lineTo(k * 16, h); g.stroke(); }
}, { repeat: true });

// ------------------------------------------------------------------ the labels atlas (1024 x 1024)
export interface UVRect { u0: number; v0: number; u1: number; v1: number }
const rectUV = (x: number, y: number, w: number, h: number): UVRect => ({ u0: x / 1024, u1: (x + w) / 1024, v0: 1 - (y + h) / 1024, v1: 1 - y / 1024 });
export const ATLAS = {
  sign: rectUV(0, 0, 512, 352),
  chalk: rectUV(512, 0, 512, 320),
  board: rectUV(0, 352, 512, 288),
  truck1: rectUV(512, 352, 512, 250),
  truck2: rectUV(512, 602, 512, 250),
  menu1: rectUV(0, 640, 256, 340),
  menu2: rectUV(256, 640, 256, 340),
  wall: rectUV(512, 852, 512, 160),
};

/** the venue sign's glyph: three lane lines converging on a single bulb */
function glyph(g: CanvasRenderingContext2D, cx: number, top: number, h: number, w: number) {
  const by = top + h * 0.16;
  g.save();
  g.strokeStyle = PAL.cream; g.lineCap = 'round'; g.lineWidth = w * 0.07;
  for (const k of [-1, 0, 1]) {
    g.setLineDash(k === 0 ? [h * 0.12, h * 0.08] : []);
    g.beginPath(); g.moveTo(cx + k * w * 0.5, top + h); g.lineTo(cx + k * w * 0.06, by + h * 0.14); g.stroke();
  }
  g.setLineDash([]);
  const halo = g.createRadialGradient(cx, by, 0, cx, by, w * 0.3);
  halo.addColorStop(0, 'rgba(255,236,190,0.95)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(cx, by, w * 0.3, 0, 7); g.fill();
  g.fillStyle = '#FFF4DA'; g.beginPath(); g.arc(cx, by, w * 0.1, 0, 7); g.fill();
  g.restore();
}

export interface BoardRow { name: string; value: string }

export function labelsAtlas(board: { title: string; rows: BoardRow[]; empty: string }) {
  return canvasTex(1024, 1024, (g) => {
    // --- the sign cabinet (both faces use it): cream on teal, red on a cream band
    g.fillStyle = PAL.teal; g.fillRect(0, 0, 512, 352);
    g.strokeStyle = PAL.cream; g.lineWidth = 6; g.strokeRect(10, 10, 492, 332);
    glyph(g, 92, 46, 196, 104);
    g.fillStyle = PAL.cream; condensed(g, 'LOT 57', 318, 236, 330, 230, 800);
    g.fillStyle = PAL.cream; g.fillRect(24, 268, 464, 56);
    g.fillStyle = PAL.red; condensed(g, 'TAPROOM · YARD · TRUCKS', 256, 312, 430, 46, 800);

    // --- the chalkboard menu behind the bar (our own items)
    g.fillStyle = '#1d2321'; g.fillRect(512, 0, 512, 320);
    g.save(); g.translate(512, 0);
    const rc = rand(77);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${rc() * 0.03})`; g.fillRect(rc() * 512, rc() * 320, 2, 2); }
    g.strokeStyle = '#6b4a2e'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 306);
    g.fillStyle = PAL.cream; condensed(g, 'LOT 57 · ON TAP', 256, 58, 440, 44, 700);
    g.font = `500 21px ${SANS}`; g.textAlign = 'left';
    // house styles under our own name only (no invented brand names that could belong to someone else)
    const left = [['House Lager', '4.6%'], ['House Amber', '5.4%'], ['House Hazy IPA', '6.8%'], ['House Stout', '6.1%']];
    const right = [['Zero-proof hazy', '0.0%'], ['Orangewood Fizz', 'soda'], ['Cucumber-lime agua', 'fresca'], ['Horchata cold brew', 'coffee']];
    left.forEach(([n, v], i) => { g.fillStyle = PAL.cream; g.fillText(n, 30, 112 + i * 44); g.fillStyle = '#d9b77a'; g.fillText(v, 196, 112 + i * 44); });
    right.forEach(([n, v], i) => { g.fillStyle = '#cfe6d8'; g.fillText(n, 262, 112 + i * 44); g.fillStyle = '#9fc7b0'; g.fillText(v, 446, 112 + i * 44); });
    g.fillStyle = '#d98d78'; g.font = `600 18px ${SANS}`; g.textAlign = 'center';
    g.fillText('Driving tonight? Everything on the right is alcohol-free.', 256, 296);
    g.restore();

    // --- the screen: the game's own local leaderboard, labelled as the game does
    g.fillStyle = '#0b1416'; g.fillRect(0, 352, 512, 288);
    g.fillStyle = PAL.cream; g.font = `700 26px ${SANS}`; g.textAlign = 'left'; g.fillText(board.title, 24, 396);
    g.fillStyle = '#7fb3a0'; g.font = `500 18px ${SANS}`; g.fillText('Local leaderboard · this device only', 24, 424);
    g.strokeStyle = 'rgba(243,230,196,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 440); g.lineTo(488, 440); g.stroke();
    g.font = `500 22px ${SANS}`;
    if (!board.rows.length) { g.fillStyle = 'rgba(243,230,196,0.7)'; g.fillText(board.empty, 24, 486); }
    board.rows.slice(0, 6).forEach((r, i) => {
      g.fillStyle = i === 0 ? '#f0c27a' : PAL.cream; g.textAlign = 'left'; g.fillText(`${i + 1}. ${r.name}`, 24, 476 + i * 30);
      g.textAlign = 'right'; g.fillText(r.value, 488, 476 + i * 30);
    });

    // --- truck 1: Two Lane Tacos (signal red, cream lettering, two lane lines)
    g.fillStyle = PAL.red; g.fillRect(512, 352, 512, 250);
    g.fillStyle = PAL.cream; g.fillRect(512, 352 + 196, 512, 10);
    g.setLineDash([26, 16]); g.strokeStyle = PAL.cream; g.lineWidth = 7;
    for (const y of [352 + 34, 352 + 172]) { g.beginPath(); g.moveTo(520, y); g.lineTo(1016, y); g.stroke(); }
    g.setLineDash([]);
    g.fillStyle = PAL.cream; condensed(g, 'TWO LANE TACOS', 768, 352 + 128, 460, 92, 800);
    g.fillStyle = '#2a0f0a'; g.font = `600 20px ${SANS}`; g.textAlign = 'center'; g.fillText('birria · asada · al pastor · aguas frescas', 768, 352 + 236);

    // --- truck 2: Night Shift Noodles (night teal, cream lettering, a crescent)
    g.fillStyle = PAL.teal; g.fillRect(512, 602, 512, 250);
    g.fillStyle = PAL.cream; g.beginPath(); g.arc(578, 602 + 92, 40, 0, 7); g.fill();
    g.fillStyle = PAL.teal; g.beginPath(); g.arc(596, 602 + 80, 36, 0, 7); g.fill();
    g.fillStyle = PAL.cream; condensed(g, 'NIGHT SHIFT', 800, 602 + 98, 360, 84, 800);
    condensed(g, 'NOODLES', 800, 602 + 178, 360, 74, 700);
    g.fillStyle = '#e8b45a'; g.font = `600 20px ${SANS}`; g.textAlign = 'center'; g.fillText('garlic noodles · dumplings · late', 768, 602 + 230);

    // --- the trucks' window menus
    const menu = (x: number, title: string, items: string[], bg: string, fg: string) => {
      g.fillStyle = bg; g.fillRect(x, 640, 256, 340);
      g.fillStyle = fg; condensed(g, title, x + 128, 690, 220, 40, 800);
      g.font = `500 19px ${SANS}`; g.textAlign = 'left';
      items.forEach((it, i) => g.fillText(it, x + 18, 740 + i * 36));
    };
    menu(0, 'TWO LANE TACOS', ['Birria tacos (3)', 'Asada tacos (3)', 'Quesabirria', 'Elote cup', 'Agua fresca', 'Horchata'], '#f1e3c2', '#5a1d12');
    menu(256, 'NIGHT SHIFT', ['Garlic noodles', 'Chili crisp noodles', 'Pork dumplings (6)', 'Veg dumplings (6)', 'Yuzu soda', 'Iced jasmine tea'], '#11282d', PAL.cream);

    // --- a painted wall sign for the Shed's north face
    g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(512, 852, 512, 160);
    g.fillStyle = PAL.cream; condensed(g, 'LOT 57', 640, 852 + 128, 220, 132, 800);
    g.fillStyle = PAL.cream; g.font = `700 26px ${SANS}`; g.textAlign = 'left'; g.fillText('TAPROOM & YARD', 760, 852 + 86);
    g.font = `500 20px ${SANS}`; g.fillText('a few minutes off the 57', 760, 852 + 118);
  });
}

/** the reader board under the sign: open hours, or "Closed · opens 11:00" */
export function readerTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = (top: string, bottom: string, open: boolean) => {
    const g = c.getContext('2d')!;
    g.fillStyle = '#0d1a1d'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = PAL.cream; g.lineWidth = 4; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = open ? PAL.cream : '#e7a08e'; condensed(g, top, 256, 64, 470, 50, 800);
    g.fillStyle = 'rgba(243,230,196,0.85)'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.fillText(bottom, 256, 104);
    t.needsUpdate = true;
  };
  return { tex: t, draw };
}

// ------------------------------------------------------------------ the Shed's inside
/** the exposed roof deck seen from inside: corrugated steel painted dark, ribs every 0.15 m (2 m per repeat; white,
 *  so the vertex colour paints it) */
export const deckTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  const rib = w / 13;
  for (let k = 0; k < 13; k++) {
    const x = k * rib, gr = g.createLinearGradient(x, 0, x + rib, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.30)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.02)');
    gr.addColorStop(0.62, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = gr; g.fillRect(x, 0, rib, h);
  }
  grain(g, w, h, 5000, 81, 0.06);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 3, w, 3);       // a deck sheet's end lap every 2 m
}, { repeat: true });

/** a polished concrete floor: grey with soft trowel clouds and exposed fines, one saw cut per 4.5 m repeat */
export const polishedTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#a9a39a'; g.fillRect(0, 0, w, h);
  const r = rand(91);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,54,48' : '255,250,240'},${r() * 0.05})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 110, 14 + r() * 70, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 2600; i++) { const a = r(); g.fillStyle = a < 0.6 ? `rgba(70,62,54,${0.12 + r() * 0.2})` : `rgba(235,228,215,${0.1 + r() * 0.2})`; const s = 0.8 + r() * 1.6; g.fillRect(r() * w, r() * h, s, s); }
  g.fillStyle = 'rgba(40,36,32,0.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
}, { repeat: true });

/**
 * Our mural on the Shed's yard wall (7.2 m x 6 m): a SoCal dusk over a freeway, lane lines converging on the venue's
 * single bulb, palms, and LOT 57. Painted on concrete (grain and a little wear). Ours entirely.
 */
export const muralTex = () => canvasTex(600, 500, (g, w, h) => {
  const hz = h * 0.6;
  // sky bands: night teal at the top to a hot horizon (flat, poster-like bands, as a painted wall would have them)
  const bands = ['#12333A', '#1d4a4f', '#4F7F6A', '#c9a067', '#e8a056', '#d9683f', '#C8462F'];
  bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i * hz) / bands.length, w, hz / bands.length + 1); });
  // the sun: a cream disc cut by horizontal stripes, sitting on the horizon
  g.save(); g.beginPath(); g.arc(w / 2, hz, w * 0.24, Math.PI, 0); g.clip();
  g.fillStyle = PAL.cream; g.fillRect(0, 0, w, hz);
  g.fillStyle = '#d9683f';
  for (let k = 0; k < 6; k++) { const y = hz - 14 - k * 22, t = 3 + k * 1.6; g.fillRect(0, y, w, t); }
  g.restore();
  // hills and the ground
  g.fillStyle = '#2a2a3a'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= w; x += 20) g.lineTo(x, hz - 18 - Math.sin(x * 0.012) * 14 - Math.sin(x * 0.031 + 1) * 6); g.lineTo(w, hz); g.fill();
  g.fillStyle = '#12333A'; g.fillRect(0, hz, w, h - hz);
  // the freeway: four lane lines converging on the bulb at the horizon
  g.strokeStyle = PAL.cream; g.lineCap = 'butt';
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const dashed = Math.abs(k) < 1;
    g.lineWidth = 7; g.setLineDash(dashed ? [26, 22] : []);
    g.beginPath(); g.moveTo(w / 2 + k * w * 0.38, h); g.lineTo(w / 2 + k * 6, hz + 4); g.stroke();
  }
  g.setLineDash([]);
  const halo = g.createRadialGradient(w / 2, hz, 0, w / 2, hz, 60); halo.addColorStop(0, 'rgba(255,244,218,1)'); halo.addColorStop(1, 'rgba(255,244,218,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(w / 2, hz, 60, 0, 7); g.fill();
  // palms in silhouette
  const palm = (x: number, base: number, ht: number, lean: number) => {
    g.strokeStyle = '#0c2328'; g.fillStyle = '#0c2328'; g.lineWidth = ht * 0.035;
    const tx = x + lean, ty = base - ht;
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * 0.2, base - ht * 0.5, tx, ty); g.stroke();
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2 + 0.3, L = ht * (0.32 + 0.06 * Math.sin(f * 2.3));
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.28;
      g.lineWidth = ht * 0.022; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty - L * 0.18, ex, ey); g.stroke();
    }
  };
  palm(70, h * 0.98, h * 0.78, 18); palm(132, h * 0.98, h * 0.55, -10); palm(520, h * 0.98, h * 0.7, -22); palm(470, h * 0.98, h * 0.42, 8);
  // our name, stencil-painted across the top
  g.fillStyle = PAL.cream; condensed(g, 'LOT 57', w / 2, 96, 360, 112, 800);
  g.font = `700 22px ${SANS}`; g.textAlign = 'center'; g.fillStyle = PAL.cream; g.fillText('TAPROOM · YARD · TRUCKS', w / 2, 128);
  // paint on concrete: grain, a few chips, the panel joint showing through
  grain(g, w, h, 18000, 93, 0.12); grain(g, w, h, 5000, 94, 0.08, true);
  const r = rand(95);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(200,190,175,${0.2 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 3); }
});
