// The premium sport steering wheel's own parts (owner, 2026-11-09: "looks all fresh ... with the button widgets
// attached"). Our own design in the modern sport-wheel family, no real maker's shapes, names or layouts. cockpit.ts
// builds the wheel and calls these for what is new:
//   sportRimAt(a)   the rim's centreline with a flatter bottom (a D): the same as spec.ts rimAt wherever the rim is
//                   above y = -0.74 R, which is every degree from -47.7 to 227.7, so wherever the hands hold it
//                   (GRIP 32 and 148 degrees, +-16 under each hand) the path is spec.ts's exactly
//   addSportHub     a slim sculpted hub: a gloss-black six-sided surround (wide at the top, narrow at the chin, our
//                   own shape) round a Nappa centre pad edged in brushed metal; cockpit.ts puts the car's badge on it
//   addSportSpokes  sculpted gloss-black upper spokes (52 mm at the hub, the old wheel's height, so the dash and the
//                   paddles behind stay hidden as before) with brushed edges; under each a widget pod carrying a
//                   knurled rotary ring (32 mm across) round a 25 mm round colour display and a toggle; the twin lower legs and the
//                   chin at the flat bottom. The pods sit beside the hub's lower half, clear of the phone HUD's Clear
//                   Path, Thrust buttons and Thrust panel in the seat view (the review of 2026-11-10)
//   addThumbPads    a gloss-black touch pad with bright icons and a brushed bezel on each upper spoke (every car's)
//   paddleTip       the bright brushed-aluminium pull face at the end of each (brushed) shift paddle
//   wheelDials      the two displays, drawn in code (canvas, as car-gauges.ts): the left one the handling profile,
//                   the right one the drive state (the OC Hypercar: the Thrust tank and its tune; the others the
//                   gear and TCS). Redrawn only when what they show changes. 256 px on high, 128 px on phones (the
//                   bold word or figure alone)
// Wheel frame (cockpit.ts wheelMount): x right, y up, z toward the driver, the hub's face at z = -0.001.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Kit, latheGeo, roundRect, roundPoly, extrude } from './car-kit';
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
// pad's own shape near enough: 45 x 29 mm). Bright icons on gloss black, lit a little at night (128 px on phones too:
// the icons must read at phone size)
export function padMat(q: Quality) {
  return once('m.swPad2' + q, () => {
    const h = q === 'high' ? 160 : 128, w = h * 3, [c, g] = canvas(w, h), s = h / 128;
    g.fillStyle = '#0a0b0e'; g.fillRect(0, 0, w, h);
    const icon = 'rgba(236,241,248,0.96)', faint = 'rgba(170,180,194,0.75)';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const half of [0, 1]) {
      g.save(); g.translate(half * 1.5 * h + 0.25 * h, 0); g.scale(s, s);
      // a soft sheen across the top of the pad
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-32, 0, 192, 128);
      g.strokeStyle = faint; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 36, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = icon; g.fillStyle = icon; g.lineWidth = 7;
      if (!half) {
        // left: the menu pad, four chevrons round a centre dot
        for (let k = 0; k < 4; k++) {
          g.save(); g.translate(64, 64); g.rotate((k * Math.PI) / 2); g.beginPath(); g.moveTo(-10, -44); g.lineTo(0, -54); g.lineTo(10, -44); g.stroke(); g.restore();
        }
        g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
      } else {
        // right: the audio pad, plus over minus and a three-bar level between
        g.beginPath(); g.moveTo(64, 8); g.lineTo(64, 32); g.moveTo(52, 20); g.lineTo(76, 20); g.stroke();
        g.beginPath(); g.moveTo(52, 110); g.lineTo(76, 110); g.stroke();
        for (let k = 0; k < 3; k++) g.fillRect(47 + k * 13, 80 - (k + 1) * 11, 8, (k + 1) * 11);
      }
      g.restore();
    }
    const t = canvasTex(c, true);
    return new THREE.MeshPhysicalMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.32, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04, name: 'pad' });
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
    const high = q === 'high', n = high ? 256 : 128, R = n / 2, acc = '#' + accent.toString(16).padStart(6, '0');
    const mk = () => {
      const [c, g] = canvas(n, n), t = canvasTex(c, true);
      const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.3, roughness: 0.14, name: 'dial-display' });
      return { g, t, m };
    };
    const L = mk(), Rt = mk();
    // the face: a black glass disc with a ring in the car's accent (the phone build: the ring alone)
    const face = (g: CanvasRenderingContext2D) => {
      g.clearRect(0, 0, n, n);
      g.fillStyle = '#000000'; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
      if (high) {
        const gr = g.createRadialGradient(R * 0.8, R * 0.6, 0, R, R, R); gr.addColorStop(0, 'rgba(60,80,110,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, n, n);
      }
      g.strokeStyle = acc; g.lineWidth = n * (high ? 0.045 : 0.05); g.beginPath(); g.arc(R, R, R * 0.9, 0, Math.PI * 2); g.stroke();
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
        text(g, 'MODE', n * 0.29, n * 0.11, '#a9b3c0', 600);
        text(g, word, n * 0.52, n * 0.24, '#ffffff', 800, 0.78);
        // three positions, Arcade / Sport / Sim, the active one lit
        ['arcade', 'sport', 'sim'].forEach((p, k) => { g.fillStyle = p === profile ? acc : '#2a313b'; g.beginPath(); g.arc(R + (k - 1) * n * 0.12, n * 0.72, n * 0.035, 0, Math.PI * 2); g.fill(); });
      } else text(g, word, R + n * 0.02, n * 0.34, '#ffffff', 800, 0.8);
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
        // (the label sits inside the arc's top, clear of it: the arc's inner edge is 0.3 n from the centre)
        text(g, String(pct), high ? n * 0.54 : R + n * 0.02, n * (high ? 0.25 : 0.38), '#ffffff', 800);
        if (high) { text(g, 'THRUST', n * 0.335, n * 0.072, '#a9bdd4', 600, 0.34); text(g, tune, n * 0.82, n * 0.095, acc, 800, 0.42); }
        return `${pct}|${tune}`;
      }
      // the others: the gear big, the traction control's state under it
      if (high) text(g, 'GEAR', n * 0.27, n * 0.1, '#a9b3c0', 600);
      text(g, gear, high ? n * 0.5 : R + n * 0.02, n * (high ? 0.38 : 0.56), '#ffffff', 800);
      if (high) text(g, tcs ? 'TCS ON' : 'TCS OFF', n * 0.75, n * 0.1, tcs ? acc : '#ff7a5c', 800);
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
// one rotary widget: a gloss boss, the knurled ring (side), its brushed top face, the display in the middle (the ring
// 32 mm across, the display 25 mm)
function rotary(wk: Kit, x: number, y: number, key: string, segs: number) {
  const rO = 0.016, rI = 0.0125, top = 0.0062;
  const boss = new THREE.CylinderGeometry(0.0192, 0.0198, 0.006, segs); boss.rotateX(Math.PI / 2); boss.translate(x, y, -0.004); wk.add('gloss', boss, null, 0.05);
  const side = latheGeo([[rO, -0.001], [rO, top - 0.0008], [rO - 0.0008, top]], segs, 'z', { uRepeat: 24, vScale: 0.004 });
  side.translate(x, y, 0); wk.add('swKnurl', side);
  const cap = latheGeo([[rO - 0.0008, top], [rI + 0.0006, top], [rI, top - 0.0006], [rI, top - 0.0022]], segs, 'z', { uRepeat: 1, vScale: 0.02 });
  cap.translate(x, y, 0); wk.add('alu', cap);
  const disp = new THREE.CircleGeometry(rI, segs); disp.translate(x, y, top - 0.0022); wk.add(key, disp);
}
// the widget pods' centres (the rotary's; the toggle sits inboard of it) and the hub's outline (x right, y up)
export const POD: [number, number] = [0.108, -0.054];
const HUB: [number, number][] = [[-0.044, -0.047], [0.044, -0.047], [0.077, -0.004], [0.066, 0.043], [-0.066, 0.043], [-0.077, -0.004]];
// the slim sculpted hub: the gloss-black surround, the Nappa centre pad a hair proud, a brushed edge between them
export function addSportHub(wk: Kit, o: { high: boolean }) {
  const cs = o.high ? 8 : 4, sc = (k: number) => HUB.map(([x, y]) => [x * k, y * k + 0.002 * (1 - k)] as [number, number]);
  const sur = extrude(roundPoly(HUB, 0.016), 0.03, 0.005, cs); sur.translate(0, 0, -0.034); wk.add('gloss', sur, null, 0.05);
  const pad = extrude(roundPoly(sc(0.84), 0.012), 0.005, 0.0018, cs); pad.translate(0, 0, -0.0062); wk.add('wheelNappa', pad);
  const edge = roundPoly(sc(0.89), 0.0138); edge.holes.push(roundPoly(sc(0.85), 0.012));
  const e = new THREE.ShapeGeometry(edge, cs); e.translate(0, 0, -0.0036); wk.add('alu', e, null, 0.02);
}
// The premium centre (owner, 2026-10-27: "make the center part of the steering wheel more stylish"; 2026-11-11: "make
// the center of the steering wheel more aesthetic looking"), our own design. Over the gloss surround of addSportHub:
//   'hubBezel'   a machined bezel: a brushed-metal frame following the hub's six-sided outline, chamfered on both edges
//   'hubCover'   the sculpted cover inside it: a pillowed pad (its edge rolls 2.4 mm down to the bezel) in the car's
//                trim (cockpit.ts: the GT soft-touch Nappa, the Corsa and the Hypercar Alcantara)
//   'hubStitch'  a single row of stitching round the cover, 5 mm in from its edge, in the trim's thread
//   'hubCarbon'  a gloss-carbon chevron inlay across the cover's lower part, its V pointing at the badge
//   'hubAccent'  a thin line along the chevron's top edges and a ring round the badge, in the car's accent (GT
//                cognac, Corsa yellow, Hypercar ice blue)
//   the medallion: a raised machined cup ('hubBezel') round a recessed badge disc ('badgeHub': the R, or the OC mark)
//                with a fine chrome bead
// The Brio and the Vela E get addSimpleCentre: the medallion and the accent ring on their own Nappa hubs, the Brio a
// brushed bar either side of it, the Vela a brushed ring round it. Phone builds: fewer curve and bevel segments.
const ribbon = (pts: THREE.Vector2[], z: number, w: number) => {
  // a closed strip of stitching along pts (counter-clockwise), the thread's dashes along u (32 mm a repeat, as the rim's)
  const n = pts.length, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let len = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, nx = ty / tl, ny = -tx / tl;
    if (i) len += p.distanceTo(pts[i - 1]);
    pos.push(p.x - nx * w / 2, p.y - ny * w / 2, z, p.x + nx * w / 2, p.y + ny * w / 2, z);
    uv.push(len / 0.032, 0, len / 0.032, 1);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};
const shell = (shape: THREE.Shape, depth: number, bt: number, bs: number, bseg: number, cs: number) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: bseg, curveSegments: cs });
// a thin straight bar from a to b in the wheel's plane (w wide, d deep, its face at z)
function bar(a: [number, number], b: [number, number], w: number, d: number, z: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], g = new THREE.BoxGeometry(Math.hypot(dx, dy), w, d);
  g.rotateZ(Math.atan2(dy, dx)); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z - d / 2);
  return g;
}
// the medallion at (0, y), its cup's top at z: a raised machined cup, the accent ring, the badge disc and a chrome bead
function medallion(wk: Kit, y: number, z: number, segs: number, r = 1) {
  const cup = latheGeo([[0.0298 * r, z - 0.0024], [0.0296 * r, z - 0.0004], [0.0285 * r, z], [0.0268 * r, z], [0.0258 * r, z - 0.0012]], segs, 'z', { uRepeat: 1, vScale: 0.02 });
  cup.translate(0, y, 0); wk.add('hubBezel', cup);
  const ring = new THREE.RingGeometry(0.0236 * r, 0.0259 * r, segs, 1); ring.translate(0, y, z - 0.0011); wk.add('hubAccent', ring, null, 0.02);
  const badge = new THREE.CircleGeometry(0.0222 * r, segs); badge.translate(0, y, z - 0.0012); wk.add('badgeHub', badge);
  const bead = new THREE.TorusGeometry(0.0229 * r, 0.0007, segs > 30 ? 6 : 4, segs); bead.translate(0, y, z - 0.0011); wk.add('chrome', bead, null, 0.02);
}
export function addSportCentre(wk: Kit, o: { high: boolean }) {
  const cs = o.high ? 8 : 4, segs = o.high ? 48 : 24, sc = (k: number) => HUB.map(([x, y]) => [x * k, y * k + 0.002 * (1 - k)] as [number, number]);
  // the bezel: a brushed frame from 86 % to 93 % of the outline, 3.2 mm tall with chamfered edges, its face at -1.3 mm
  const bz = roundPoly(sc(0.93), 0.0145); bz.holes.push(roundPoly(sc(0.86), 0.0125));
  const bg = shell(bz, 0.0018, 0.0007, 0.0004, o.high ? 2 : 1, cs); bg.translate(0, 0, -0.0038); wk.add('hubBezel', bg);
  // the cover: pillowed, its flat face at +0.6 mm, the edge rolling down under the bezel
  const cv = shell(roundPoly(sc(0.83), 0.0115), 0.0012, 0.0028, 0.0024, o.high ? 3 : 1, cs); cv.translate(0, 0, -0.0034); wk.add('hubCover', cv);
  // the stitching round it
  wk.add('hubStitch', ribbon(roundPoly(sc(0.785), 0.0105).getPoints(cs), 0.00075, 0.0013));
  // the carbon chevron and its accent line
  const chev: [number, number][] = [[-0.033, -0.03475], [0.033, -0.03475], [0.0474, -0.016], [0, -0.0262], [-0.0474, -0.016]];
  const ch = shell(roundPoly(chev, 0.003), 0.0004, 0.0002, 0.0002, 1, cs); ch.translate(0, 0, 0.0008); wk.add('hubCarbon', ch);
  for (const sd of [-1, 1]) wk.add('hubAccent', bar([sd * 0.0462, -0.0153], [sd * 0.0012, -0.0252], 0.0011, 0.0005, 0.0017), null, 0.02);
  // the medallion, at the hub's centre (y 4 mm), its cup 2.2 mm proud of the cover
  medallion(wk, 0.004, 0.0028, segs);
}
export function addSimpleCentre(wk: Kit, o: { high: boolean; kind: 'brio' | 'vela' }) {
  const segs = o.high ? 48 : 24;
  // the hub's face is at z -2 mm and its centre 4 mm below the wheel's (cockpit.ts): the medallion there, its cup
  // standing 1.6 mm proud
  const y = -0.004;
  medallion(wk, y, -0.0004, segs);
  if (o.kind === 'brio') {
    // a brushed bar either side of the medallion, across the airbag cover
    for (const sd of [-1, 1]) { const b = new RoundedBoxGeometry(0.03, 0.0034, 0.0016, 1, 0.0007); b.translate(sd * 0.0495, y, -0.0016); wk.add('hubInsert', b, null, 0.02); }
  } else {
    // a brushed ring round it, 12 mm out
    const r = latheGeo([[0.0415, -0.0024], [0.0415, -0.0012], [0.0405, -0.0008], [0.0385, -0.0008], [0.0378, -0.0016]], segs, 'z', { uRepeat: 1, vScale: 0.02 });
    r.translate(0, y, 0); wk.add('hubInsert', r);
  }
}
// sculpted upper spokes (52 mm tall at the hub, 34 mm at the rim) with brushed edges, a widget pod under each with
// its rotary and toggle, the twin lower legs from the pods down into the flat bottom's corners, and the chin
export function addSportSpokes(wk: Kit, o: { high: boolean }) {
  const segs = o.high ? 40 : 20, cs = o.high ? 6 : 3;
  for (const sd of [-1, 1]) {
    const S = (pts: [number, number][]) => pts.map(([x, y]) => [sd * x, y] as [number, number]);
    // the upper spoke: from inside the hub's flank to inside the rim
    const sp = extrude(roundPoly(S([[0.058, -0.032], [0.168, -0.022], [0.168, 0.012], [0.058, 0.02]]), 0.006), 0.014, 0.003, cs);
    sp.translate(0, 0, -0.018); wk.add('gloss', sp, null, 0.05);
    // its brushed edges, along the top and the bottom, a hair proud of its face
    wk.add('alu', leg([sd * 0.08, 0.0172], [sd * 0.158, 0.0098], 0.0026, 0.002, -0.0034), null, 0.02);
    wk.add('alu', leg([sd * 0.08, -0.0293], [sd * 0.152, -0.0206], 0.0026, 0.002, -0.0034), null, 0.02);
    // the widget pod: a gloss plate joined to the spoke's underside, the rotary outboard and the toggle inboard
    const [px, py] = POD;
    const plate = extrude(roundPoly(S([[0.07, -0.078], [0.134, -0.074], [0.134, -0.03], [0.07, -0.034]]), 0.012), 0.012, 0.003, cs);
    plate.translate(0, 0, -0.016); wk.add('gloss', plate, null, 0.05);
    rotary(wk, sd * px, py, sd < 0 ? 'swDialL' : 'swDialR', segs);
    const tb = new RoundedBoxGeometry(0.011, 0.02, 0.004, 1, 0.0018); tb.translate(sd * 0.0795, py, -0.003); wk.add('anod', tb, null, 0.02);
    const tl = new RoundedBoxGeometry(0.0052, 0.011, 0.005, 1, 0.002); tl.rotateX(-0.45); tl.translate(sd * 0.0795, py + 0.004, 0.0015); wk.add('alu', tl, null, 0.02);
    // the lower leg, from under the pod down into the flat bottom's corner, with a brushed line down its face
    wk.add('gloss', leg([sd * 0.088, -0.07], [sd * 0.074, -0.126], 0.018, 0.012, -0.011), null, 0.05);
    wk.add('alu', leg([sd * 0.087, -0.082], [sd * 0.076, -0.12], 0.0028, 0.003, -0.0046), null, 0.02);
  }
  // the chin: where the legs meet the flat bottom, a gloss bridge with a brushed bar across its face
  const chin = new RoundedBoxGeometry(0.17, 0.016, 0.012, 2, 0.005); chin.translate(0, -0.123, -0.011); wk.add('gloss', chin, null, 0.05);
  const bar = new RoundedBoxGeometry(0.05, 0.0034, 0.005, 1, 0.0014); bar.translate(0, -0.123, -0.0045); wk.add('alu', bar, null, 0.02);
}
// a thumb pad on each upper spoke: a gloss base, the pad's face (the atlas's left or right half) and a brushed bezel
export function addThumbPads(wk: Kit, x: number, y: number, z: number) {
  for (const sd of [-1, 1]) {
    const base = new RoundedBoxGeometry(0.052, 0.036, 0.006, 2, 0.0038); base.translate(sd * x, y, z - 0.003); wk.add('gloss', base, null, 0.05);
    const face = new THREE.ShapeGeometry(roundRect(0.045, 0.029, 0.0075), 4);
    const p = face.attributes.position, uv = face.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (0.5 + p.getX(i) / 0.045) / 2 + (sd > 0 ? 0.5 : 0), 0.5 + p.getY(i) / 0.029);
    }
    face.translate(sd * x, y, z + 0.0002); wk.add('swPad', face);
    const bz = roundRect(0.0492, 0.0332, 0.0094); bz.holes.push(roundRect(0.0456, 0.0296, 0.0076));
    const b = new THREE.ShapeGeometry(bz, 4); b.translate(sd * x, y, z + 0.0005); wk.add('alu', b, null, 0.02);
  }
}
// the brushed-aluminium pull face at the outer end of a shift paddle (in the paddle's own frame, right-hand side:
// cockpit.ts mirrors x for the left one), on its face toward the driver
export function paddleTip(sd: number) {
  const g = extrude(roundPoly([[0.096, -0.032], [0.129, -0.024], [0.136, 0.008], [0.122, 0.036], [0.096, 0.042]].map(([x, y]) => [sd * x, y] as [number, number]), 0.006), 0.0016, 0, 6);
  g.translate(0, 0, 0.0058);
  return g;
}
