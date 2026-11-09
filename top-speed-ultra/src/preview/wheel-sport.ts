// The premium sport steering wheel's own parts (owner, 2026-11-09: "looks all fresh ... with the button widgets
// attached"). Our own design in the modern sport-wheel family, no real maker's shapes, names or layouts. cockpit.ts
// builds the wheel and calls these for what is new:
//   sportRimAt(a)   the rim's centreline with a flatter bottom (a D): the same as spec.ts rimAt wherever the rim is
//                   above y = -0.74 R, which is every degree from -47.7 to 227.7, so wherever the hands hold it
//                   (GRIP 32 and 148 degrees, +-16 under each hand) the path is spec.ts's exactly
//   addSportSpokes  slim gloss-black spokes with brushed edges, the twin lower legs, a "button widget" set on each
//                   lower leg (a knurled rotary ring round a round colour display, a toggle beside it) and the chin
//                   at the flat bottom
//   addThumbPads    a gloss-black touch pad with faint icons on each upper spoke (every car's wheel)
//   wheelDials      the two displays, drawn in code (canvas, as car-gauges.ts): the left one the handling profile,
//                   the right one the drive state (the OC Hypercar: the Thrust tank and its tune; the others the
//                   gear and TCS). Redrawn only when what they show changes.
// Wheel frame (cockpit.ts wheelMount): x right, y up, z toward the driver, the hub's face at z = -0.002.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Kit, latheGeo, roundRect } from './car-kit';
import { RIM_R } from './spec';
import { canvas, canvasTex, once } from './car-tex';

type Quality = 'phone' | 'high';
const FONT = 'Arial, Helvetica, sans-serif';

// ------------------------------------------------------------------------------------------------ the rim
// spec.ts rimAt flattens below fb by 0.16; the sport rim flattens the same stretch by 0.05 (a 2 mm sag across the
// bottom instead of 7 mm): only where y < fb, which is the bottom carbon section alone (it runs 225.8 to 314.2
// degrees, the corners at 227.7 and 312.3), so the grips and the joins are spec.ts's path to the micrometre
export function sportRimAt(a: number, out = new THREE.Vector3()) {
  let x = Math.cos(a) * RIM_R, y = Math.sin(a) * RIM_R;
  const fb = -RIM_R * 0.74, ft = RIM_R * 0.93;
  if (y < fb) { y = fb + (y - fb) * 0.05; x *= 1.04; }
  if (y > ft) y = ft + (y - ft) * 0.45;
  return out.set(x, y, 0);
}

// ------------------------------------------------------------------------------------------------ materials
// the rotary rings' knurl: a fine diamond cross-hatch round the ring (u runs round it, 24 repeats)
export function knurlMat(q: Quality) {
  return once('m.swKnurl' + q, () => {
    const n = q === 'high' ? 64 : 32, [c, g] = canvas(n, n);
    g.fillStyle = '#d4d8dd'; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#4a4e55'; g.lineWidth = n / 10;
    for (const d of [-1, 1]) for (let k = -n; k <= 2 * n; k += n / 2) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + d * n, n); g.stroke(); }
    const t = canvasTex(c, true, true);
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, metalness: 1, roughness: 0.34, envMapIntensity: 1.1, name: 'knurl' });
  });
}
// the thumb pads: one atlas, the left pad's face on the left half, the right pad's on the right (each half 3:2, the
// pad's own shape near enough: 45 x 29 mm)
export function padMat(q: Quality) {
  return once('m.swPad' + q, () => {
    const h = q === 'high' ? 128 : 64, w = h * 3, [c, g] = canvas(w, h), s = h / 128;
    g.fillStyle = '#08090b'; g.fillRect(0, 0, w, h);
    const icon = 'rgba(176,184,196,0.78)', faint = 'rgba(120,128,140,0.55)';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const half of [0, 1]) {
      g.save(); g.translate(half * 1.5 * h + 0.25 * h, 0); g.scale(s, s);
      // a soft sheen across the top of the pad
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-32, 0, 192, 128);
      g.strokeStyle = faint; g.lineWidth = 2.5; g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = icon; g.fillStyle = icon; g.lineWidth = 4;
      if (!half) {
        // left: the menu pad, four chevrons round a centre dot
        for (let k = 0; k < 4; k++) {
          g.save(); g.translate(64, 64); g.rotate((k * Math.PI) / 2); g.beginPath(); g.moveTo(-7, -42); g.lineTo(0, -49); g.lineTo(7, -42); g.stroke(); g.restore();
        }
        g.beginPath(); g.arc(64, 64, 6, 0, Math.PI * 2); g.fill();
      } else {
        // right: the audio pad, plus over minus and a three-bar level between
        g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 30); g.moveTo(56, 22); g.lineTo(72, 22); g.stroke();
        g.beginPath(); g.moveTo(56, 106); g.lineTo(72, 106); g.stroke();
        for (let k = 0; k < 3; k++) g.fillRect(52 + k * 10, 72 - (k + 1) * 8, 5, (k + 1) * 8);
      }
      g.restore();
    }
    const t = canvasTex(c, true);
    return new THREE.MeshPhysicalMaterial({ map: t, emissive: 0x2a3038, emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04, name: 'pad' });
  });
}

// ------------------------------------------------------------------------------------------------ the dials
export type DialKind = 'hyper' | 'std';
export interface WheelDials {
  left: THREE.MeshStandardMaterial; right: THREE.MeshStandardMaterial;
  // what each shows now and how many times each has been drawn (the suite reads these)
  shown: { left: string; right: string; draws: number };
  // draw what changed; values the same as last time draw nothing
  set(profile: string, gear: string, tcs: boolean, tank: number, tune: string): void;
}
const PROFILE_TEXT: Record<string, string> = { arcade: 'ARCADE', sport: 'SPORT', sim: 'SIM', custom: 'CUSTOM' };
// the two displays for one kind of car and accent colour (cached: the garage's cockpit shares the game's)
export function wheelDials(kind: DialKind, accent: number, q: Quality): WheelDials {
  return once('swDials' + kind + accent + q, () => {
    const high = q === 'high', n = high ? 128 : 64, R = n / 2, acc = '#' + accent.toString(16).padStart(6, '0');
    const mk = () => {
      const [c, g] = canvas(n, n), t = canvasTex(c, true);
      const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.95, roughness: 0.14, name: 'dial-display' });
      return { g, t, m };
    };
    const L = mk(), Rt = mk();
    // the face: a dark glass disc with a ring in the car's accent (the phone build: the ring alone)
    const face = (g: CanvasRenderingContext2D) => {
      g.clearRect(0, 0, n, n);
      g.fillStyle = '#04060a'; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
      if (high) {
        const gr = g.createRadialGradient(R * 0.8, R * 0.6, 0, R, R, R); gr.addColorStop(0, 'rgba(60,80,110,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, n, n);
      }
      g.strokeStyle = acc; g.lineWidth = n * 0.045; g.beginPath(); g.arc(R, R, R * 0.9, 0, Math.PI * 2); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
    };
    // a line of text centred at height y, shrunk to fit maxW (fractions of the face)
    const text = (g: CanvasRenderingContext2D, s: string, y: number, px: number, col: string, weight = 700, maxW = 0.74) => {
      g.fillStyle = col; g.font = `${weight} ${Math.round(px)}px ${FONT}`;
      const w = g.measureText(s).width, max = n * maxW; if (w > max) g.font = `${weight} ${Math.round((px * max) / w)}px ${FONT}`;
      g.fillText(s, R, y);
    };
    const drawLeft = (profile: string) => {
      const g = L.g; face(g);
      const word = PROFILE_TEXT[profile] ?? 'CUSTOM';
      if (high) {
        text(g, 'MODE', n * 0.3, n * 0.11, '#8f9aa8', 600);
        text(g, word, n * 0.52, n * 0.2, '#f2f5f8');
        // three positions, Arcade / Sport / Sim, the active one lit
        ['arcade', 'sport', 'sim'].forEach((p, k) => { g.fillStyle = p === profile ? acc : '#2a313b'; g.beginPath(); g.arc(R + (k - 1) * n * 0.12, n * 0.72, n * 0.035, 0, Math.PI * 2); g.fill(); });
      } else text(g, word, R, n * 0.24, '#f2f5f8');
      L.t.needsUpdate = true;
      return word;
    };
    const drawRight = (gear: string, tcs: boolean, pct: number, tune: string) => {
      const g = Rt.g; face(g);
      if (kind === 'hyper') {
        // the Thrust tank: a 270-degree arc filled to the tank, the percentage, and the tune under it
        const a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5 * (pct / 100);
        g.lineCap = 'round'; g.lineWidth = n * (high ? 0.07 : 0.09);
        g.strokeStyle = '#132238'; g.beginPath(); g.arc(R, R, R * 0.68, a0, a0 + Math.PI * 1.5); g.stroke();
        if (pct > 0) { g.strokeStyle = pct < 25 ? '#ffb347' : acc; g.beginPath(); g.arc(R, R, R * 0.68, a0, a1); g.stroke(); }
        text(g, String(pct), high ? n * 0.47 : R, n * (high ? 0.26 : 0.3), '#f2f5f8');
        if (high) { text(g, 'THRUST', n * 0.29, n * 0.085, '#8fa6c0', 600); text(g, tune, n * 0.8, n * 0.1, acc, 700, 0.44); }
        return `${pct}|${tune}`;
      }
      // the others: the gear big, the traction control's state under it
      if (high) text(g, 'GEAR', n * 0.27, n * 0.1, '#8f9aa8', 600);
      text(g, gear, high ? n * 0.5 : R, n * (high ? 0.36 : 0.46), '#f2f5f8');
      if (high) text(g, tcs ? 'TCS ON' : 'TCS OFF', n * 0.74, n * 0.1, tcs ? acc : '#ff7a5c');
      return `${gear}|${tcs ? 'TCS ON' : 'TCS OFF'}`;
    };
    const last = { profile: '', gear: '', tcs: true, pct: -1, tune: '' };
    const d: WheelDials = {
      left: L.m, right: Rt.m, shown: { left: '', right: '', draws: 0 },
      set(profile, gear, tcs, tank, tune) {
        if (profile !== last.profile) { last.profile = profile; d.shown.left = drawLeft(profile); d.shown.draws++; }
        // the tank in 2 % steps; the hypercar's dial ignores the gear, the others ignore the tank
        const pct = kind === 'hyper' ? Math.round(Math.max(0, Math.min(1, tank)) * 50) * 2 : 0;
        const tn = tune.indexOf('UNLEASH') >= 0 ? 'UNLEASHED' : 'RACE';
        const changed = kind === 'hyper' ? pct !== last.pct || tn !== last.tune : gear !== last.gear || tcs !== last.tcs || d.shown.right === '';
        if (changed) { last.gear = gear; last.tcs = tcs; last.pct = pct; last.tune = tn; Rt.t.needsUpdate = true; d.shown.right = drawRight(gear, tcs, pct, tn); d.shown.draws++; }
      },
    };
    d.set('sport', 'N', true, 1, 'UNLEASHED');
    return d;
  });
}

// ------------------------------------------------------------------------------------------------ the parts
// a rounded box from a to b in the wheel's plane (a leg): width w, depth d, centred at z
function leg(a: [number, number], b: [number, number], w: number, d: number, z: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const g = new RoundedBoxGeometry(w, len, d, 2, Math.min(w, d) * 0.45);
  g.rotateZ(Math.atan2(dy, dx) - Math.PI / 2); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
  return g;
}
// one rotary widget: a gloss boss, the knurled ring (side), its brushed top face, the display in the middle
function rotary(wk: Kit, x: number, y: number, key: string, segs: number) {
  const rO = 0.015, rI = 0.0112, top = 0.0062;
  const boss = new THREE.CylinderGeometry(0.0182, 0.0188, 0.006, segs); boss.rotateX(Math.PI / 2); boss.translate(x, y, -0.004); wk.add('gloss', boss, null, 0.05);
  const side = latheGeo([[rO, -0.001], [rO, top - 0.0008], [rO - 0.0008, top]], segs, 'z', { uRepeat: 24, vScale: 0.004 });
  side.translate(x, y, 0); wk.add('swKnurl', side);
  const cap = latheGeo([[rO - 0.0008, top], [rI + 0.0006, top], [rI, top - 0.0006], [rI, top - 0.0022]], segs, 'z', { uRepeat: 1, vScale: 0.02 });
  cap.translate(x, y, 0); wk.add('alu', cap);
  const disp = new THREE.CircleGeometry(rI, segs); disp.translate(x, y, top - 0.0022); wk.add(key, disp);
}
// slim spokes, the twin lower legs with a widget set each, the chin at the flat bottom
export function addSportSpokes(wk: Kit, o: { high: boolean }) {
  const segs = o.high ? 40 : 20;
  for (const sd of [-1, 1]) {
    // the upper spoke: gloss black with a brushed edge above and below
    const sp = new RoundedBoxGeometry(0.084, 0.032, 0.014, 2, 0.006); sp.translate(sd * 0.122, -0.006, -0.010); wk.add('gloss', sp, null, 0.05);
    for (const ey of [0.0102, -0.0222]) { const e = new RoundedBoxGeometry(0.074, 0.0034, 0.006, 1, 0.0014); e.translate(sd * 0.126, ey, -0.0075); wk.add('alu', e, null, 0.02); }
    // the lower leg, from under the hub down into the flat bottom's corner
    wk.add('gloss', leg([sd * 0.03, -0.05], [sd * 0.076, -0.132], 0.02, 0.012, -0.011), null, 0.05);
    const edge = leg([sd * 0.036, -0.06], [sd * 0.073, -0.124], 0.0032, 0.004, -0.0045); wk.add('alu', edge, null, 0.02);
    // the widget plate: a gloss plate on the leg carrying the rotary (inboard) and the toggle (outboard)
    const plate = new RoundedBoxGeometry(0.06, 0.042, 0.009, 2, 0.0042); plate.translate(sd * 0.07, -0.088, -0.0085); wk.add('gloss', plate, null, 0.05);
    rotary(wk, sd * 0.062, -0.088, sd < 0 ? 'swDialL' : 'swDialR', segs);
    const tb = new RoundedBoxGeometry(0.011, 0.02, 0.004, 1, 0.0018); tb.translate(sd * 0.0905, -0.088, -0.003); wk.add('anod', tb, null, 0.02);
    const tl = new RoundedBoxGeometry(0.0052, 0.011, 0.005, 1, 0.002); tl.rotateX(-0.45); tl.translate(sd * 0.0905, -0.084, 0.0015); wk.add('alu', tl, null, 0.02);
  }
  // the chin: where the legs meet the flat bottom, a gloss bridge with a brushed bar across its face
  const chin = new RoundedBoxGeometry(0.17, 0.016, 0.012, 2, 0.005); chin.translate(0, -0.123, -0.011); wk.add('gloss', chin, null, 0.05);
  const bar = new RoundedBoxGeometry(0.05, 0.0034, 0.005, 1, 0.0014); bar.translate(0, -0.123, -0.0045); wk.add('alu', bar, null, 0.02);
}
// a thumb pad on each upper spoke: a gloss base and the pad's face (the atlas's left or right half)
export function addThumbPads(wk: Kit, x: number, y: number, z: number) {
  for (const sd of [-1, 1]) {
    const base = new RoundedBoxGeometry(0.05, 0.034, 0.006, 2, 0.0038); base.translate(sd * x, y, z - 0.003); wk.add('gloss', base, null, 0.05);
    const face = new THREE.ShapeGeometry(roundRect(0.045, 0.029, 0.0075), 4);
    const p = face.attributes.position, uv = face.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (0.5 + p.getX(i) / 0.045) / 2 + (sd > 0 ? 0.5 : 0), 0.5 + p.getY(i) / 0.029);
    }
    face.translate(sd * x, y, z + 0.0002); wk.add('swPad', face);
  }
}
