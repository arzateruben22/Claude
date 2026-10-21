// The streets and buildings round Lot 57, from src/data/anaheim/slice.json: OpenStreetMap through Overture Maps
// (ODbL), building heights partly from USGS lidar. Street centrelines, sidewalks, crosswalks, building footprints and
// heights, parking areas and land use come from the data; road widths, markings, lamps and trees are our defaults
// where the data has none (PROJECT_OC_ON_FOOT.md, "The street world around it"). No names are drawn. The real
// footprints and lot features inside our site (coords.ts SITE) are dropped and replaced by our own layout.
import sliceJson from '../../data/anaheim/slice.json';
import { ORIGIN, SITE, EDGE } from './coords';
import { Batch, Kit, P2, offsetLine, along, polyLen, pointInPoly, rand } from './geom';
import { Collider, poly, seg as segC, circ } from './collide';
import type { Mats } from './mats';

interface Seg { c: number | string; s?: number; n?: number; p: number[]; ow?: number; w?: number; br?: unknown }
interface Bld { p: number[]; hl?: number[][]; h?: number; mh?: number; c?: number }
interface Area { c: number; p?: number[]; l?: number[]; hl?: number[][] }
interface Slice {
  attribution: string;
  dict: { seg: string[]; sub: string[]; name: string[]; bcls: string[]; lu: string[]; infra: string[] };
  seg: Seg[]; bld: Bld[]; landuse: Area[]; infra: Area[]; infra_pts: number[];
}
const S = sliceJson as unknown as Slice;
export const DATA_ATTRIBUTION = S.attribution;

/** decimetre delta-coded points to local metres */
export function decode(p: number[]): P2[] {
  const out: P2[] = []; let x = 0, z = 0;
  for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; out.push([x / 10 - ORIGIN.x, z / 10 - ORIGIN.z]); }
  return out;
}
const inBox = (pts: P2[], b: { x0: number; x1: number; z0: number; z1: number }) => pts.some(([x, z]) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
const inSite = (x: number, z: number) => x > SITE.x0 && x < SITE.x1 && z > SITE.z0 && z < SITE.z1;
/** most of a polyline's length lies inside our site */
function mostlyInSite(pts: P2[]) {
  let a = 0, b = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const mx = (pts[i][0] + pts[i - 1][0]) / 2, mz = (pts[i][1] + pts[i - 1][1]) / 2;
    if (inSite(mx, mz)) a += l; else b += l;
  }
  return a > b;
}
/** a colour from 0..1 channels as an sRGB hex for the batch */
const rgbHex = (r: number, g: number, b: number) => (Math.round(Math.min(1, r) * 255) << 16) | (Math.round(Math.min(1, g) * 255) << 8) | Math.round(Math.min(1, b) * 255);
const centroid = (r: P2[]): P2 => { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return [x / r.length, z / r.length]; };

const VIEW = { x0: -620, x1: 740, z0: -720, z1: 260 };       // what's drawn (the stadium, the 57, the business park)
const NEAR = { x0: -420, x1: 330, z0: -130, z1: 200 };       // what gets markings and colliders

export interface StreetWorld {
  colliders: Collider[];
  roads: { pts: P2[]; w: number }[];     // carriageways (kerbs are soft walls except at crosswalks)
  blockRing: P2[];                       // the block inside the Dupont loop, to its kerbs (walkable)
  sidewalks: P2[][];                     // mapped sidewalks (raised, walkable in the corridor)
  crosswalks: P2[][];                    // mapped crosswalks (walkable in the corridor)
  lamps: { x: number; z: number; y: number }[];
  palms: { x: number; z: number; h: number }[];
  counts: Record<string, number>;
}

const ROAD_W = (cls: string, sub: string, ow: boolean): number => {
  if (cls === 'primary') return ow ? 12 : 24;
  if (cls === 'secondary') return ow ? 11.5 : 30;
  if (cls === 'tertiary') return 14;
  if (cls === 'residential' || cls === 'unclassified' || cls === 'living_street') return 11;
  if (cls === 'service') return sub === 'parking_aisle' ? 7 : sub === 'driveway' ? 6 : sub === 'alley' ? 5 : 6;
  return 0;
};

export function buildStreets(kit: Kit, mats: Mats): StreetWorld {
  const D = S.dict;
  const road = kit.get('roads', mats.asphalt, { uv: 6, ao: false }), walk = kit.get('sidewalks', mats.concrete, { uv: 4 });
  const mark = kit.get('markings', mats.marking, { ao: false }), grassB = kit.get('landuse-grass', mats.grass, { uv: 8, ao: false }), dirtB = kit.get('landuse-dirt', mats.dirt, { uv: 8, ao: false });
  const wallsB = kit.get('buildings', mats.facade, { uv: 7.2, cast: true }), roofB = kit.get('roofs', mats.roof, { uv: 8 }), steelB = kit.get('street-steel', mats.steel, { cast: true }), chainB = kit.get('construction-fence', mats.chain, { uv: 2, glow: false });
  const colliders: Collider[] = [], sidewalks: P2[][] = [], crosswalks: P2[][] = [];
  const counts: Record<string, number> = { roads: 0, sidewalks: 0, crosswalks: 0, buildings: 0, buildingsDropped: 0, parking: 0, landuse: 0 };
  const roadLines: { pts: P2[]; w: number }[] = [];
  let loop: P2[] | null = null;

  // ------------------------------------------------------------------ streets, sidewalks, crosswalks
  for (const s of S.seg) {
    const cls = typeof s.c === 'number' ? D.seg[s.c] : String(s.c);
    if (cls.startsWith('rail') || cls === 'steps' || cls === 'unknown') continue;
    const sub = s.s !== undefined ? D.sub[s.s] : '', name = s.n !== undefined ? D.name[s.n] : '';
    const pts = decode(s.p);
    if (!inBox(pts, VIEW)) continue;
    if (name === 'South Dupont Drive' && cls === 'unclassified' && polyLen(pts) > 400) loop = pts;
    if ((cls === 'service' || cls === 'footway' || cls === 'path' || cls === 'cycleway') && mostlyInSite(pts)) { counts.dropped = (counts.dropped ?? 0) + 1; continue; }
    if (cls === 'motorway') {
      // the CA-57 on its bridge over Orangewood, about 670 m east (plain concrete, no signs)
      if (!pts.some(([x]) => x > 560 && x < 760)) continue;
      const w = s.ow ? 12.5 : 25;
      walk.slab(pts, w, 6.6, 7.6, 0xb8b4ac, 0x9c978e);
      for (const q of along(pts, 28)) steelB.cyl(q.x, 0, q.z, 0.9, 0.9, 6.6, 8, 0xa7a299);
      continue;
    }
    const W = ROAD_W(cls, sub, s.ow === 1);
    if (W > 0) {
      road.ribbon(pts, W, 0.02, 0xffffff); roadLines.push({ pts, w: W }); counts.roads++;
      if (inBox(pts, NEAR)) roadMarkings(mark, pts, cls, W, s.ow === 1);
      continue;
    }
    if (cls === 'footway' && sub === 'sidewalk') {
      walk.slab(pts, 2.0, 0, 0.15, 0xffffff, 0xd9d4ca); sidewalks.push(pts); counts.sidewalks++;
      continue;
    }
    if (cls === 'footway' && sub === 'crosswalk') {
      crosswalks.push(pts); counts.crosswalks++;
      continue;
    }
    if (cls === 'footway' || cls === 'path' || cls === 'cycleway' || cls === 'pedestrian') walk.ribbon(pts, 1.8, 0.02, 0xe8e4dc);
  }

  // ------------------------------------------------------------------ crosswalk ladders: stripes on the carriageway only;
  // where a mapped crossing runs over a parkway strip or a median, a plain concrete walk instead of paint on dirt
  const onCarriageway = (x: number, z: number) => roadLines.some(({ pts, w }) => distToLine(x, z, pts) < w / 2 - 0.4);
  for (const cw of crosswalks) if (inBox(cw, NEAR)) crosswalkStripes(mark, walk, cw, onCarriageway);

  // ------------------------------------------------------------------ the block inside the Dupont loop
  const blockRing: P2[] = [];
  if (loop) {
    // the loop runs from Orangewood south down the west leg and back up the east leg: its inside is on the left
    const inner = offsetLine(loop, 5.6);
    const kerbZ = -55.2;                  // Orangewood's south kerb in front of the block (the sidewalk's road edge)
    let a = 0; while (a < inner.length - 1 && inner[a][1] < kerbZ) a++;
    let b = inner.length - 1; while (b > 0 && inner[b][1] < kerbZ) b--;
    const lerpZ = (p: P2, q: P2): P2 => { const t = (kerbZ - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, kerbZ]; };
    blockRing.push(a > 0 ? lerpZ(inner[a - 1], inner[a]) : [inner[0][0], kerbZ]);
    for (let i = a; i <= b; i++) blockRing.push(inner[i]);
    blockRing.push(b < inner.length - 1 ? lerpZ(inner[b], inner[b + 1]) : [inner[inner.length - 1][0], kerbZ]);
  }

  // ------------------------------------------------------------------ buildings (the real ones in our site dropped)
  const bc = [0xd8d2c4, 0xc9c2b4, 0xcbbd9e, 0xb4b8b6, 0xc7b393, 0xdedad2];
  // low business-park buildings as tilt-up flex space (painted panels, storefront glass, roll-up doors), not stucco
  const tiltB = kit.get('buildings-tilt', mats.tilt, { uv: 7.5, cast: true }), glassB = kit.get('buildings-glass', mats.bldGlass, { uv: 4 });
  const tiltTone = [0xe0dbd0, 0xd3ccbd, 0xc8c3b8, 0xd9d0bc, 0xbfc4c4, 0xcbbfa8, 0xe6e2da];
  const r = rand(57);
  const footprints: P2[][] = [];
  S.bld.forEach((b) => {
    const ring = decode(b.p);
    if (!inBox(ring, VIEW)) return;
    const [cx, cz] = centroid(ring);
    if (inSite(cx, cz)) { counts.buildingsDropped++; return; }
    const cls = b.c !== undefined ? D.bcls[b.c] : '';
    const holes = (b.hl ?? []).map(decode);
    const h = b.h ?? (cls === 'stadium' ? 22 : cls === 'office' ? 14 : cls === 'apartments' ? 14 : cls === 'hotel' ? 24 : cls === 'roof' ? 4.5 : cls === 'parking' ? 4.5 : cls === 'house' ? 6 : 7.5);
    const mh = b.mh ?? 0;
    const tone = cls === 'stadium' ? 0xa19f99 : bc[Math.floor(r() * bc.length)];
    const lowRise = h <= 13 && !['stadium', 'house', 'apartments', 'hotel', 'residential', 'terrace', 'church', 'cathedral', 'hospital', 'university', 'roof', 'parking'].includes(cls);
    if (lowRise) {
      const tone = tiltTone[Math.floor(r() * tiltTone.length)], band = r() < 0.5 ? 0x5d6b70 : 0x8a7f6c;
      tiltB.walls(ring, mh, h, tone);
      tiltB.walls(ring, h - 0.55, h - 0.35, band);                              // a painted reveal band near the top
      for (const hole of holes) tiltB.walls(hole, mh, h, tone, true);
      roofB.cap(ring, h, r() < 0.5 ? 0x9b978f : 0xc2c0ba, holes);
      tiltB.walls(ring, h, h + 0.5, tone);
      // storefront glass and roll-up doors along the longer walls
      let area = 0; for (let i = 0; i < ring.length; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]; area += x0 * z1 - x1 * z0; }
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az);
        if (L < 8) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, nx = (area > 0 ? uz : -uz) * 0.04, nz = (area > 0 ? -ux : ux) * 0.04;
        const P = (t: number, y: number) => [ax + ux * t + nx, y, az + uz * t + nz];
        const kind = r();
        for (let t = 2; t + 3.2 < L - 1.5; t += 4.2) {
          if (kind < 0.55) {                       // storefront: glass with a dark frame line
            const y0 = 0.15, y1 = Math.min(h - 1.2, 3.1), g = 0.55 + r() * 0.25;
            const c = rgbHex(g * 0.2, g * 0.26, g * 0.3);
            glassB.quad(P(t, y0), P(t + 3.2, y0), P(t + 3.2, y1), P(t, y1), c); glassB.quad(P(t + 3.2, y0), P(t, y0), P(t, y1), P(t + 3.2, y1), c);
          } else if (kind < 0.8 && r() < 0.5) {    // a roll-up loading door
            const y1 = Math.min(h - 1.0, 4.2);
            tiltB.quad(P(t, 0), P(t + 3.6, 0), P(t + 3.6, y1), P(t, y1), 0x8d9093); tiltB.quad(P(t + 3.6, 0), P(t, 0), P(t, y1), P(t + 3.6, y1), 0x8d9093);
          }
        }
      }
      footprints.push(ring);
      counts.buildings++;
      if (inBox(ring, NEAR)) colliders.push(poly(ring, 'building', true));
      return;
    }
    if (cls === 'roof') {
      // a canopy on posts: a thin slab, posts at the corners
      roofB.cap(ring, h, 0xb9b6ae); roofB.cap(ring, h - 0.35, 0x8d8a83, [], true);
      wallsB.walls(ring, h - 0.35, h, tone);
    } else {
      wallsB.walls(ring, mh, h, tone);
      for (const hole of holes) wallsB.walls(hole, mh, h, tone, true);
      roofB.cap(ring, h, cls === 'stadium' ? 0x8e8c86 : r() < 0.5 ? 0x8a867f : 0xbdbcb6, holes);
      // a parapet line
      wallsB.walls(ring, h, h + 0.6, tone);
    }
    footprints.push(ring);
    counts.buildings++;
    if (inBox(ring, NEAR) && cls !== 'roof') colliders.push(poly(ring, 'building', true));
  });

  // ------------------------------------------------------------------ parking areas, land use, fences
  for (const a of S.infra) {
    const cls = D.infra[a.c];
    if (cls !== 'transit:parking' || !a.p) continue;
    const ring = decode(a.p);
    if (!inBox(ring, VIEW)) continue;
    const [cx, cz] = centroid(ring);
    if (inSite(cx, cz)) continue;
    road.cap(ring, 0.02, 0xffffff, (a.hl ?? []).map(decode)); counts.parking++;
  }
  for (const a of S.landuse) {
    const cls = D.lu[a.c];
    if (!a.p) continue;
    const ring = decode(a.p);
    if (!inBox(ring, VIEW)) continue;
    if (['grass', 'park', 'pitch', 'meadow', 'garden', 'dog_park', 'playground'].includes(cls)) { grassB.cap(ring, 0.008, 0xffffff); counts.landuse++; }
    else if (['greenfield', 'construction', 'brownfield'].includes(cls)) { dirtB.cap(ring, 0.01, 0xffffff); counts.landuse++; }
  }
  // the construction site north of Orangewood (west of Dupont): a chain-link fence 2.4 m behind the north sidewalk
  for (const sw of sidewalks) {
    const piece = sw.filter(([x, z]) => z < -86 && z > -95 && x > -355 && x < -85);
    if (piece.length < 2) continue;
    const f = piece.map(([x, z]): P2 => [x, z - 2.4]);
    for (let i = 1; i < f.length; i++) {
      chainB.quad([f[i - 1][0], 0, f[i - 1][1]], [f[i][0], 0, f[i][1]], [f[i][0], 1.9, f[i][1]], [f[i - 1][0], 1.9, f[i - 1][1]], 0xffffff);
      colliders.push(segC(f[i - 1][0], f[i - 1][1], f[i][0], f[i][1], 0.08, 'fence', false));
    }
    for (const q of along(f, 3)) steelB.cyl(q.x, 0, q.z, 0.03, 0.03, 1.95, 5, 0x8c9096, false);
  }

  // ------------------------------------------------------------------ the stadium's light towers (plain, ours)
  const ip = S.infra_pts;
  for (let i = 0; i < ip.length; i += 3) {
    if (D.infra[ip[i]] !== 'tower:lighting') continue;
    const x = ip[i + 1] / 10 - ORIGIN.x, z = ip[i + 2] / 10 - ORIGIN.z;
    if (x < VIEW.x0 || x > VIEW.x1 || z < VIEW.z0 || z > VIEW.z1) continue;
    steelB.cyl(x, 0, z, 0.7, 0.45, 38, 8, 0x8f9399);
    steelB.box(x, 39.2, z, 5.5, 2.6, 0.5, 0x5f6368);
  }

  // ------------------------------------------------------------------ our own street lamps and palms along Orangewood
  const lamps: { x: number; z: number; y: number }[] = [];
  const lampPoles = kit.get('lamp-poles', mats.steel, { cast: true }), heads = kit.get('lamp-heads', mats.lampHead, { glow: false });
  const onRoad = (x: number, z: number, pad: number) => roadLines.some(({ pts, w }) => distToLine(x, z, pts) < w / 2 + pad);
  const inBuilding = (x: number, z: number) => footprints.some((f) => pointInPoly(x, z, f));
  const palms: { x: number; z: number; h: number }[] = [];
  for (const sw of sidewalks) {
    if (!sw.some(([x, z]) => z > -100 && z < -45 && x > EDGE.x0 - 30 && x < EDGE.x1 + 30)) continue;
    const south = sw.reduce((a, [, z]) => a + z, 0) / sw.length > -69;
    const toRoad = south ? -1 : 1;
    for (const q of along(sw, 37, 12)) {
      if (q.z < -100 || q.z > -45 || inSite(q.x, q.z)) continue;
      // the road side of the sidewalk (its left or right, whichever points at Orangewood's centre)
      const nx = q.dz, nz = -q.dx, side = Math.sign(nz) === Math.sign(toRoad) ? 1 : -1;
      const lx = q.x + nx * side * 0.75, lz = q.z + nz * side * 0.75;
      lampPoles.cyl(lx, 0.15, lz, 0.09, 0.14, 8.6, 7, 0x6d7177);
      const ax = lx + nx * side * 2.2, az = lz + nz * side * 2.2;
      lampPoles.tube([lx, 8.6, lz], [ax, 8.9, az], 0.055, 5, 0x6d7177);
      heads.box(ax, 8.85, az, 0.7, 0.16, 0.34, 0xffffff, Math.atan2(-(nz * side), nx * side));
      lamps.push({ x: ax, z: az, y: 8.72 });
      kit.light({ x: ax, y: 8.6, z: az, i: 60, ch: 1, reach: 30, down: 1.6 });
      colliders.push(circ(lx, lz, 0.16, 'pole', false));
    }
    for (const q of along(sw, 21, 5)) {
      if (q.z < -100 || q.z > -45 || inSite(q.x, q.z) || q.x < EDGE.x0 - 20 || q.x > EDGE.x1 + 20) continue;
      const nx = q.dz, nz = -q.dx, side = Math.sign(nz) === Math.sign(toRoad) ? -1 : 1;   // the property side
      const px = q.x + nx * side * 3.1, pz = q.z + nz * side * 3.1;
      if (onRoad(px, pz, 1.0) || inBuilding(px, pz)) continue;
      palms.push({ x: px, z: pz, h: 13 + (Math.abs(Math.sin(px * 12.9898 + pz * 78.233)) * 9) });
    }
  }

  counts.lamps = lamps.length;
  return { colliders, roads: roadLines, blockRing, sidewalks, crosswalks, lamps, palms, counts };
}

function distToLine(x: number, z: number, pts: P2[]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

const WHITE = 0xf4f2ea, YELLOW = 0xe8b923;
function line(b: Batch, pts: P2[], off: number, w: number, hex: number, dash?: [number, number]) {
  const o = offsetLine(pts, off);
  if (!dash) { b.ribbon(o, w, 0.035, hex); return; }
  const total = polyLen(o);
  for (let t = 0; t < total; t += dash[0] + dash[1]) {
    const piece = sliceLine(o, t, Math.min(total, t + dash[0]));
    if (piece.length >= 2) b.ribbon(piece, w, 0.035, hex);
  }
}
function sliceLine(pts: P2[], a: number, b: number): P2[] {
  const out: P2[] = []; let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], l = Math.hypot(x1 - x0, z1 - z0);
    if (s + l >= a && s <= b) {
      const ta = Math.max(0, (a - s) / l), tb = Math.min(1, (b - s) / l);
      if (!out.length) out.push([x0 + (x1 - x0) * ta, z0 + (z1 - z0) * ta]);
      out.push([x0 + (x1 - x0) * tb, z0 + (z1 - z0) * tb]);
    }
    s += l;
  }
  return out;
}
function roadMarkings(b: Batch, pts: P2[], cls: string, W: number, ow: boolean) {
  if (polyLen(pts) < 8) return;
  if (cls === 'secondary' || cls === 'primary') {
    if (ow) { line(b, pts, W / 2 - 0.5, 0.12, YELLOW); line(b, pts, -(W / 2 - 0.5), 0.12, WHITE); line(b, pts, 0, 0.12, WHITE, [3, 9]); return; }
    line(b, pts, 0.15, 0.11, YELLOW); line(b, pts, -0.15, 0.11, YELLOW);
    for (const s of [1, -1]) { line(b, pts, s * 3.8, 0.12, WHITE, [3, 9]); line(b, pts, s * 7.6, 0.12, WHITE, [3, 9]); line(b, pts, s * 11.2, 0.14, WHITE); }
    return;
  }
  if (cls === 'residential' || cls === 'unclassified' || cls === 'tertiary') { line(b, pts, 0.12, 0.1, YELLOW); line(b, pts, -0.12, 0.1, YELLOW); }
}
function crosswalkStripes(b: Batch, walk: Batch, pts: P2[], onRoad: (x: number, z: number) => boolean) {
  // continental stripes: 0.6 m bars every 1.2 m along the crossing, 3 m long (parallel to the traffic)
  for (const q of along(pts, 1.2, 0.6)) {
    const nx = -q.dz, nz = q.dx;
    if (!onRoad(q.x, q.z)) {
      // off the carriageway: a 3 m concrete walk across the strip (the kerb ramp's run-out)
      const A = [q.x - q.dx * 0.62 + nx * 1.5, 0.04, q.z - q.dz * 0.62 + nz * 1.5], B = [q.x + q.dx * 0.62 + nx * 1.5, 0.04, q.z + q.dz * 0.62 + nz * 1.5];
      const C = [q.x + q.dx * 0.62 - nx * 1.5, 0.04, q.z + q.dz * 0.62 - nz * 1.5], D = [q.x - q.dx * 0.62 - nx * 1.5, 0.04, q.z - q.dz * 0.62 - nz * 1.5];
      walk.quad(A, B, C, D, 0xe2ddd3); walk.quad(A, D, C, B, 0xe2ddd3);
      continue;
    }
    const a = [q.x - q.dx * 0.3 + nx * 1.5, 0.036, q.z - q.dz * 0.3 + nz * 1.5], c = [q.x + q.dx * 0.3 - nx * 1.5, 0.036, q.z + q.dz * 0.3 - nz * 1.5];
    const b1 = [q.x + q.dx * 0.3 + nx * 1.5, 0.036, q.z + q.dz * 0.3 + nz * 1.5], d = [q.x - q.dx * 0.3 - nx * 1.5, 0.036, q.z - q.dz * 0.3 - nz * 1.5];
    b.quad(a, b1, c, d, WHITE);
  }
}
