// The navigation chevrons (U2): a path of sunset-orange chevrons on the road along the planned route, for the next 300 m
// (blue until the owner's 2026-10-21 reference pass: where the reference's route glows blue, ours glows the OC sunset).
// They lie on the lane the route needs (the exit lane as a diverge comes up, the side of a ramp that splits the way the
// route goes, the outside lane of a road you're joining), a few centimetres over the surface, and fade out with distance.
//
// How they're drawn: each chevron is a crisp core over a soft glow. The glow is added onto the road (additive, so
// it lights up at night and in tunnels); the core also covers what's under it a little, so the colour still reads on
// sunlit concrete, where a purely additive colour washes out toward white. One blend does both (premultiplied: src + dst * (1 -
// core)), with the fade on colour and coverage alike.
//
// Cheap by design: one InstancedMesh of flat quads, no shadows, no fog, no depth write. The legs of the route (which
// road, from where to where, on which lane) are worked out again only when the route or your road changes; each frame
// just lays the chevrons along them from where the car is. Each chevron sits at a fixed point of its road (every 4 m of
// arc length), so they stay put as you drive over them; only the stretch where the path moves over from your lane to
// the one the route needs is measured from where you are.

import * as THREE from 'three';
import { Path, Junction, LANE_W, ORIGIN, RoadPoint } from '../world/Path';
import { clamp, smoothstep } from '../util';

const SPACING = 4;                 // metres between chevrons
const AHEAD = 300;                 // how far ahead the path is drawn
const MAX = Math.ceil(AHEAD / SPACING) + 6;
const LIFT = 0.07;                 // over the surface (and offset in depth past the lane paint: see the material)
const LANE_AHEAD = 1600;           // a diverge this close: the path moves to the exit lane (the autopilot's distance too)
const W = 2.5, L = 2.0;            // the quad: across, along
const COLOR = new THREE.Color('#ff8418');      // the deeper twin of the UI's --nav (#ffa040), the OC sunset

type Side = 'L' | 'R';
export interface Sides { diverge: (p: Path, j: Junction) => Side; merge: (ramp: Path, j: Junction) => Side }
// a stretch of one road the route runs along, from s0 to s1. dIn: the lane offset it starts on (null: the lane nearest
// where the last leg ended); dOut: the lane it has to be on by its end (null: wherever it started); diverge: dOut is an
// exit lane, which matters only once the split is close. The car's own leg starts on the car's lane, worked out per frame.
interface Leg { path: Path; s0: number; s1: number; dIn: number | null; dOut: number | null; diverge: boolean }

export class RouteChevrons {
  readonly mesh: THREE.InstancedMesh;
  private legs: Leg[] = [];
  private onPath: Path | null = null;
  private onRoute: Junction[] | null = null;
  private onLen = -1;
  private onFirst: Junction | undefined;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private c = new THREE.Color();
  private pt: RoadPoint = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 };
  rebuilds = 0;                    // for tests: how often the legs were worked out

  constructor(private sides: Sides, anisotropy = 4) {
    // a flat quad, facing up, with v running forward (the chevron's point is at the top of the canvas)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, 0, -L / 2, W / 2, 0, -L / 2, -W / 2, 0, L / 2, W / 2, 0, L / 2], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    const mat = new THREE.MeshBasicMaterial({
      map: chevronTexture(anisotropy), color: COLOR, transparent: true, depthWrite: false, fog: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12,
    });
    // the texture holds the core in red and the glow in green; the instance colour (grey) holds the fade
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_fragment>', 'vec4 chev = texture2D( map, vMapUv );')
        .replace('#include <color_fragment>', 'float fade = vColor.r;\n\tdiffuseColor = vec4( diffuseColor.rgb * ( chev.r + chev.g * 0.5 ) * fade, chev.r * 0.85 * fade );');
    };
    mat.customProgramCacheKey = () => 'route-chevrons';
    this.mesh = new THREE.InstancedMesh(g, mat, MAX);
    this.mesh.name = 'route-chevrons';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;            // the instances move every frame; a bounding box would need recomputing
    this.mesh.renderOrder = 2;
    this.mesh.setColorAt(0, this.c.setScalar(1));   // creates the per-instance colour (the fade)
    this.mesh.visible = false;
  }

  // the legs of the route: your road up to the first hand-off, then each road the route takes, ending a little way onto
  // the destination (or 500 m past the first hand-off, which is as far as 300 m from the car can reach before the
  // route changes again). Called only when the route or your road changes.
  private rebuild(path: Path, route: Junction[]) {
    this.rebuilds++;
    this.legs = [];
    if (!route.length) return;
    let p = path, s = -Infinity, dIn: number | null = null, past = 0;
    for (let k = 0; k <= route.length && past < AHEAD + 200; k++) {
      const j = route[k];
      if (!j) { this.legs.push({ path: p, s0: s, s1: Math.min(p.len, Math.max(0, s) + 140), dIn, dOut: null, diverge: false }); break; }
      const q = j.to;
      let end = j.s, next = j.toS, dOut: number | null = null, dNext: number | null = null;
      if (j.kind === 'diverge') {
        // the data's ramps leave from the middle of the carriageway: stay on the exit lane until the ramp is further out
        const side = this.sides.diverge(p, j), lane = p.laneCenter(side === 'R' ? p.lanes - 1 : 0);
        dOut = lane;
        for (let t = j.toS; t < Math.min(q.len, j.toS + 400); t += 2) {
          const a = q.at(t, 0), pr = p.project(a.x, a.z, j.s + (t - j.toS));
          if (side === 'R' ? pr.d >= lane - 0.2 : pr.d <= lane + 0.2) { end = clamp(pr.s, 0, p.len); next = t; break; }
        }
      } else if (j.kind === 'merge') {
        // and they join it in the middle too: leave the ramp where it reaches the outside lane of the road it joins
        const side = this.sides.merge(p, j), lane = q.laneCenter(side === 'R' ? q.lanes - 1 : 0);
        dOut = p.laneCenter(side === 'R' ? p.lanes - 1 : 0);
        for (let t = j.s; t > Math.max(0, j.s - 400); t -= 2) {
          const a = p.at(t, 0), pr = q.project(a.x, a.z, j.toS - (j.s - t));
          if (side === 'R' ? pr.d >= lane - 0.2 : pr.d <= lane + 0.2) { end = t; next = clamp(pr.s, 0, q.len); break; }
        }
        dNext = lane;
      } else if (p.lanes > 1 && p.out.filter((o) => o.s >= p.len - 1).length > 1) {
        // a road that ends in a split (a two-lane ramp forking for both directions of a freeway): the side it goes
        dOut = p.laneCenter(this.sides.diverge(p, j) === 'R' ? p.lanes - 1 : 0);
      }
      this.legs.push({ path: p, s0: s, s1: end, dIn, dOut, diverge: dOut !== null && j.kind !== 'merge' });
      if (k > 0) past += end - Math.max(0, s);
      p = q; s = next; dIn = dNext;
    }
  }

  // lay the chevrons from where the car is; none with no route, or when `on` is false
  update(path: Path, carS: number, carD: number, route: Junction[], on: boolean) {
    if (path !== this.onPath || route !== this.onRoute || route.length !== this.onLen || route[0] !== this.onFirst) {
      this.onPath = path; this.onRoute = route; this.onLen = route.length; this.onFirst = route[0];
      this.rebuild(path, route);
    }
    if (!on || !this.legs.length) { this.mesh.visible = false; this.mesh.count = 0; return; }
    let n = 0, u = 0, carry = 0, lastD = carD;
    for (let k = 0; k < this.legs.length && u < AHEAD && n < MAX; k++) {
      const g = this.legs[k], p = g.path;
      // the lane nearest an offset, on this road
      const near = (d: number) => p.laneCenter(p.laneOf(clamp(d, p.edgeL, p.edgeR)));
      let a: number, dIn: number, b0: number, b1: number;
      if (k === 0) {
        // your own leg: from your lane, over to the lane the route needs
        if (carS > g.s1) { carry = carS - g.s1; lastD = g.dOut ?? near(carD); continue; }
        a = carS;
        dIn = near(carD);
      } else {
        a = Math.max(0, g.s0) + carry; carry = 0;
        dIn = p.lanes === 1 ? 0 : g.dIn ?? (!p.main && g.dOut !== null ? g.dOut : near(lastD));
      }
      // an exit lane only matters once the split is close: until then the path keeps to the lane it's on
      const dOut = p.lanes === 1 ? 0 : g.dOut === null || (g.diverge && g.s1 - a > LANE_AHEAD) ? dIn : g.dOut;
      const lanes = Math.max(1, Math.abs(dOut - dIn) / LANE_W);
      if (k === 0) { b1 = Math.min(18 + 42 * lanes, (g.s1 - a) * 0.85); b0 = Math.min(14, b1 * 0.35); }
      else { b0 = 10; b1 = 10 + 42 * lanes; }
      const len = g.s1 - a;
      lastD = dOut;
      if (len <= 0) continue;
      const dAt = (v: number) => dIn + (dOut - dIn) * smoothstep(b0, b1, v);
      for (let s = Math.ceil(a / SPACING) * SPACING; s <= g.s1 && n < MAX; s += SPACING) {
        const v = s - a, ahead = u + v;
        if (ahead > AHEAD) break;
        const fade = smoothstep(3, 14, ahead) * smoothstep(AHEAD, AHEAD * 0.5, ahead);
        if (fade <= 0.01) continue;
        const d = dAt(v), dd = dAt(v + 1) - d;
        const pt = p.sample(s, this.pt), ch = Math.cos(pt.h), sh = Math.sin(pt.h);
        this.p.set(pt.x - ch * d - ORIGIN.x, pt.y + LIFT, pt.z + sh * d - ORIGIN.z);
        this.q.setFromEuler(this.e.set(-Math.atan(pt.slope), pt.h - Math.atan(dd), 0));
        this.mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.one));
        this.mesh.setColorAt(n, this.c.setScalar(fade));
        n++;
      }
      u += len;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  }
}

// the chevron, painted once on black: its crisp core in the red channel, a soft glow around it in the green (data, not
// colour: the shader turns them into the route's colour and coverage), pointing up the canvas (forward on the road)
function chevronTexture(anisotropy: number) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  const stroke = (rgb: string, w: number, blur: number) => {
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = w;
    g.strokeStyle = `rgb(${rgb})`; g.shadowColor = `rgb(${rgb})`; g.shadowBlur = blur;
    g.beginPath(); g.moveTo(16, 102); g.lineTo(64, 36); g.lineTo(112, 102); g.stroke();
    g.restore();
  };
  stroke('0,120,0', 30, 20);       // the glow
  stroke('255,0,0', 15, 2);        // the core
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  return t;
}
