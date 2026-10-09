// Runs the whole thing: renderer, scene, the 120 Hz simulation, the real Orange County freeway network, cameras,
// modes, sound, navigation, and the numbers the HUD shows.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { Settings, QUALITY, DENSITY, Mode, STARTS, loadBest, saveBest } from './settings';
import { Input, Controls } from './input';
import { configureTextures } from './textures';
import { Network, Hit } from './world/Network';
import { Path, Junction, ORIGIN } from './world/Path';
import { Roads } from './world/Roads';
import { Terrain } from './world/Terrain';
import { CarPhysics, SPEC } from './vehicle/Physics';
import { PlayerCar } from './vehicle/PlayerCar';
import { Traffic, PlayerView } from './traffic/Traffic';
import { Environment } from './env/Environment';
import { AudioEngine } from './audio/AudioEngine';
import { clamp, damp, lerp, MPH } from './util';
import { Leaderboard, Run, recordRun } from './records';

export type CamMode = 'cockpit' | 'hood' | 'chase' | 'free';
const CAMS: CamMode[] = ['cockpit', 'hood', 'chase', 'free'];
const CAM_LABEL: Record<CamMode, string> = { cockpit: "Driver's seat", hood: 'Hood', chase: 'Chase', free: 'Free look' };
const DT = 1 / 120;
const FAST = 100 / MPH;            // 100 mph: where Speed Survival starts counting
export const CORNER_PX = [112, 150, 196];

export interface Hud {
  speed: number; gear: string; rpm: number; rpmFrac: number; distance: number; score: number; combo: number;
  timeLeft: number; fps: number; mode: Mode; auto: boolean; cam: string; checkpoint: number; countdown: number; best: number; overtakes: number;
  road: string; next: string; nextDist: number; wrongWay: boolean; streak: number; bestStreak: number; nearMisses: number; top: number;
}
export interface Result {
  mode: Mode; score: number; distance: number; overtakes: number; top: number; reason: string; best: number; newBest: boolean; time: number;
  nearMisses: number; bestStreak: number; collisions: number; board: Leaderboard;
}
export interface GameEvents {
  hud: (h: Hud) => void;
  toast: (text: string, kind?: 'good' | 'bad' | 'info') => void;
  over: (r: Result) => void;
  pause: (on: boolean) => void;
  loading: (on: boolean, text?: string) => void;
  context: (lost: boolean) => void;
  hudToggle: (show: boolean) => void;
  corner: (mode: Settings['corner']) => void;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly skyCam = new THREE.PerspectiveCamera(50, 1, 5, 2500);
  readonly input: Input;
  readonly audio = new AudioEngine();
  private env: Environment;
  net!: Network;
  private roads!: Roads;
  private terrain!: Terrain;
  private traffic!: Traffic;
  private car: PlayerCar;
  readonly phys = new CarPhysics();
  path!: Path;                       // the road you're on
  private lastMain: Path | null = null;
  route: Junction[] = [];            // hand-offs still to make, for the navigator and the autopilot
  routeTarget: Path | null = null;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private gtao: GTAOPass | null = null;
  private settings: Settings;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private paused = false;
  private attract = true;
  private mode: Mode = 'free';
  private cam: CamMode = 'cockpit';
  private camBlend = 1;
  private camFrom = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  private chasePos = new THREE.Vector3();
  private chaseFwd = new THREE.Vector3(0, 0, 1);
  private head = new THREE.Vector3();
  private shake = 0;
  private renderScale = 1;
  private frameAvg = 16;
  private scaleT = 0;
  private fpsN = 0; private fpsT = 0; private fps = 60;
  private hudT = 0;
  private hudOn = true;
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapT = 0;
  // run state
  private distance = 0; private score = 0; private combo = 1; private comboT = 0; private overtakes = 0;
  private timeLeft = 60; private nextCheckpoint = 2000; private countdown = 0; private top = 0; private over = false;
  private streak = 0; private bestStreak = 0; private nearMisses = 0; private collisions = 0; private wrongWay = false;
  private scrape = 0;
  private ctxLost = false;
  private steps = 0;
  private cands: Hit[] = [];
  frames = 0;
  switches = 0;                      // how many times you've moved from one road to another (for tests)
  visited = new Set<string>();       // freeways driven this session (for tests and the profile)

  constructor(private host: HTMLElement, settings: Settings, private ev: GameEvents) {
    this.settings = settings;
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.setAttribute('aria-label', 'The view from the driver\'s seat on an Orange County freeway');
    host.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    configureTextures(QUALITY[settings.quality].texture, this.renderer.capabilities.getMaxAnisotropy());
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
    this.scene.add(this.camera);
    this.env = new Environment(this.scene, this.renderer);
    this.car = new PlayerCar();
    this.scene.add(this.car.root);
    this.input = new Input(canvas);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ctxLost = true; this.setPaused(true); this.ev.context(true); });
    canvas.addEventListener('webglcontextrestored', () => { this.ctxLost = false; this.composer = null; this.applyQuality(); this.ev.context(false); });
    addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // ----------------------------------------------------------------------------------------- set up
  async init() {
    this.ev.loading(true, 'Loading Orange County');
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonts are optional */ }
    this.net = await Network.load();
    this.buildWorld();
    this.applyQuality();
    this.onResize();
    this.input.attach();
    this.startAttract();
    await this.prebuild('Building the freeway');
    this.ev.loading(false);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private buildWorld() {
    if (this.roads) { this.roads.clear(); this.scene.remove(this.roads.group); }
    if (this.terrain) { this.terrain.clear(); this.scene.remove(this.terrain.group); }
    const q = QUALITY[this.settings.quality];
    this.roads = new Roads(this.net, q); this.scene.add(this.roads.group);
    this.terrain = new Terrain(this.net, q); this.scene.add(this.terrain.group);
    if (!this.traffic) { this.traffic = new Traffic(this.net); this.scene.add(this.traffic.group); }
    this.traffic.viewAhead = q.drawDistance * 0.95;
    this.applyDensity();
  }
  private applyDensity() {
    const d = DENSITY[this.settings.density];
    this.traffic.level = { perKmLane: d.perKmLane, bold: d.bold };
  }

  // build everything in view before showing it (yielding now and then so the page stays alive)
  private async prebuild(text: string) {
    this.ev.loading(true, text);
    const p = this.phys, h = p.psi;
    for (let i = 0; i < 600; i++) {
      const a = this.roads.update(p.x, p.z, Math.sin(h), Math.cos(h), 6), b = this.terrain.update(p.x, p.z, 3);
      if (a === 0 && b === 0) break;
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
  }

  findMain(label: string) { return this.net.mains.find((m) => m.label === label) ?? this.net.mains[0]; }

  private placeCar(path: Path, s: number, lane: number, speed: number) {
    this.path = path;
    if (path.main) { this.lastMain = path; this.visited.add(path.label); }
    this.phys.placeAt(path, s, path.laneCenter(clamp(lane, 0, path.lanes - 1)), speed);
    this.phys.auto = this.settings.transmission === 'auto' || this.attract;
    this.phys.handling = this.settings.handling;
    this.car.teleport(this.phys);
    this.recentre();
  }
  private recentre() {
    const dx = Math.round(this.phys.x - ORIGIN.x), dz = Math.round(this.phys.z - ORIGIN.z);
    if (Math.abs(dx) < 1 && Math.abs(dz) < 1) return;
    ORIGIN.x += dx; ORIGIN.z += dz;
    this.roads?.rebase(); this.terrain?.rebase(this.phys.x, this.phys.z);
    this.camera.position.x -= dx; this.camera.position.z -= dz;
    this.chasePos.x -= dx; this.chasePos.z -= dz;
    this.camFrom.p.x -= dx; this.camFrom.p.z -= dz;
    this.car.update(0, 1, this.phys, false, this.time);
  }

  private startAttract() {
    this.attract = true; this.over = false; this.mode = 'free';
    const m = this.findMain('I-405 North');
    this.placeCar(m, m.len * 0.12, 1, 28);
    this.apLane = 1;
    this.setRoute(null);
    this.traffic.reseed(405);
    this.traffic.fill(this.view());
    this.cam = 'cockpit'; this.camBlend = 1;
    this.audio.silence();
  }

  async start(mode: Mode, startLabel = this.settings.start) {
    this.audio.start();
    this.audio.vol = { master: this.settings.master, engine: this.settings.engine, ambient: this.settings.ambient };
    this.audio.applyVolumes();
    this.mode = mode; this.attract = false; this.over = false;
    // the time trial always starts in the same place with the same traffic, so times compare
    const st = mode === 'time' ? STARTS[0] : STARTS.find((x) => x.label === startLabel) ?? STARTS[0];
    const m = this.findMain(st.label);
    this.placeCar(m, m.len * st.at, Math.min(1, m.lanes - 1), mode === 'survival' ? 30 : 0);
    this.setRoute(null);
    this.traffic.reseed(mode === 'time' ? 405 : 1000 + Math.floor(Math.random() * 1e6));
    this.traffic.fill(this.view());
    this.distance = 0; this.score = 0; this.combo = 1; this.comboT = 0; this.overtakes = 0; this.top = 0;
    this.streak = 0; this.bestStreak = 0; this.nearMisses = 0; this.collisions = 0;
    this.timeLeft = 60; this.nextCheckpoint = 2000; this.countdown = mode === 'time' ? 3 : 0;
    this.input.recenter();
    await this.prebuild('Merging onto ' + m.label);
    this.setPaused(false);
    this.ev.loading(false);
    this.last = performance.now();
    this.ev.toast(`${m.label} · ${mode === 'survival' ? 'stay over 100 mph' : mode === 'time' ? 'Time Trial' : 'Free Drive'}`, 'info');
  }

  quitToMenu() { this.setPaused(false); this.startAttract(); }
  restart() { void this.start(this.mode); }

  setPaused(on: boolean) {
    if (this.attract && on) return;
    if (this.paused === on) return;
    this.paused = on;
    if (on) { this.audio.suspend(); this.input.clear(); } else { this.audio.resume(); this.last = performance.now(); }
    this.ev.pause(on);
  }
  get isPaused() { return this.paused; }

  updateSettings(s: Settings) {
    const q = this.settings.quality !== s.quality, d = this.settings.density !== s.density;
    this.settings = s;
    this.phys.handling = s.handling;
    if (!this.attract) this.phys.auto = s.transmission === 'auto';
    this.audio.vol = { master: s.master, engine: s.engine, ambient: s.ambient }; this.audio.applyVolumes();
    if (d && this.traffic) this.applyDensity();
    if (q) { configureTextures(QUALITY[s.quality].texture, this.renderer.capabilities.getMaxAnisotropy()); this.applyQuality(true); }
    this.onResize();
  }

  // navigation: head for a freeway (by label), or clear it
  navigateTo(label: string | null) {
    if (!label) { this.setRoute(null); return true; }
    const target = this.net.mains.find((m) => m.label === label);
    if (!target) return false;
    if (target === this.path) { this.setRoute(null); this.ev.toast(`You're on ${label}`, 'info'); return true; }
    const r = this.net.route(this.path, Math.max(0, this.phys.s), target);
    if (!r) { this.ev.toast(`No way to ${label} from here`, 'bad'); return false; }
    this.route = r; this.routeTarget = target;
    return true;
  }
  private setRoute(target: Path | null) { this.route = []; this.routeTarget = target; }
  get mainsLabels() { return this.net.mains.map((m) => m.label); }

  // ----------------------------------------------------------------------------------------- graphics quality
  private applyQuality(rebuild = false) {
    const q = QUALITY[this.settings.quality];
    this.renderScale = q.renderScale;
    this.renderer.shadowMap.enabled = q.shadows > 0;
    const far = q.drawDistance * 1.15;
    this.camera.far = far; this.camera.updateProjectionMatrix();
    this.env.setQuality(q.shadows, far);
    if (this.traffic) this.traffic.viewAhead = q.drawDistance * 0.95;
    if (rebuild && this.net) {
      this.buildWorld();
      const p = this.phys;
      for (let i = 0; i < 200 && this.roads.update(p.x, p.z, Math.sin(p.psi), Math.cos(p.psi), 6) + this.terrain.update(p.x, p.z, 3) > 0; i++) { /* rebuild what's in view */ }
    }
    this.composer?.dispose(); this.composer = null; this.bloom = null; this.gtao = null;
    if (q.post) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q.msaa });
      const c = new EffectComposer(this.renderer, rt);
      c.addPass(new RenderPass(this.scene, this.camera));
      if (q.ao) { this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y); this.gtao.blendIntensity = 0.75; c.addPass(this.gtao); }
      if (q.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.45, 0.92); c.addPass(this.bloom); }
      c.addPass(new OutputPass());
      this.composer = c;
    }
    this.onResize();
  }

  private onResize = () => {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    const q = QUALITY[this.settings.quality];
    const pr = clamp((window.devicePixelRatio || 1) * this.renderScale, 0.5, q.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(pr); this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  private onVisibility = () => { if (document.hidden && !this.attract) this.setPaused(true); };

  // ----------------------------------------------------------------------------------------- input actions
  private actions() {
    for (const a of this.input.takeActions()) {
      if (a === 'pause') { if (!this.attract && !this.over) this.setPaused(!this.paused); continue; }
      if (this.paused || this.attract) continue;
      if (a === 'camera') this.setCam(CAMS[(CAMS.indexOf(this.cam) + 1) % CAMS.length]);
      if (a === 'reset') this.resetCar();
      if (a === 'hud') { this.hudOn = !this.hudOn; this.ev.hudToggle(this.hudOn); }
      if (a === 'corner') this.cycleCorner();
      if (a === 'transmission') { this.phys.auto = !this.phys.auto; this.ev.toast(this.phys.auto ? 'Automatic' : 'Manual: − / + to shift', 'info'); }
      if (a === 'shiftUp' || a === 'shiftDown') {
        if (this.phys.auto) { this.phys.auto = false; this.ev.toast('Manual: − / + to shift', 'info'); }
        const dir = a === 'shiftUp' ? 1 : -1;
        if (this.phys.shift(dir)) { this.car.cockpit.flickPaddle(dir); this.audio.shift(); }
      }
    }
  }
  cycleCorner() {
    const order: Settings['corner'][] = ['map', 'sky', 'off'];
    const next = order[(order.indexOf(this.settings.corner) + 1) % order.length];
    this.settings = { ...this.settings, corner: next };
    this.ev.corner(next);
  }
  setCam(c: CamMode) {
    if (c === this.cam) return;
    this.camFrom.p.copy(this.camera.position); this.camFrom.q.copy(this.camera.quaternion);
    this.camBlend = 0; this.cam = c;
    this.input.freeLook = c === 'free';
    if (c === 'chase') this.chasePos.copy(this.camera.position);
    this.ev.toast(CAM_LABEL[c], 'info');
  }
  cycleCam() { this.setCam(CAMS[(CAMS.indexOf(this.cam) + 1) % CAMS.length]); }
  pushAction(a: Parameters<Input['push']>[0]) { this.input.push(a); }
  setMapCanvas(c: HTMLCanvasElement | null) { this.mapCanvas = c; }

  private resetCar() {
    const p = this.path, s = clamp(this.phys.s + 5, 2, p.len - 2), lane = p.laneOf(clamp(this.phys.d, p.edgeL, p.edgeR));
    const at = p.at(s, p.laneCenter(lane));
    this.traffic.clearAround(at.x, at.z);
    this.placeCar(p, s, lane, 0);
    this.ev.toast('Back on the road', 'info');
  }

  private view(): PlayerView {
    const p = this.phys, path = this.path, h = path.heading(clamp(p.s, 0, path.len));
    let rel = p.psi - h; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const sf = Math.sin(p.psi), cf = Math.cos(p.psi);
    return {
      path, s: p.s, d: p.d, v: p.vx * Math.cos(rel) + p.vy * Math.sin(rel), vd: -p.vx * Math.sin(rel) - p.vy * Math.cos(rel), rel,
      len: SPEC.halfL * 2, wid: SPEC.halfW * 2, x: p.x, z: p.z, y: p.y, psi: p.psi, wx: sf * p.vx + cf * p.vy, wz: cf * p.vx - sf * p.vy,
    };
  }

  // ----------------------------------------------------------------------------------------- which road you're on
  private trackPath() {
    const p = this.phys, cur = this.path;
    const onCur = p.s >= -0.5 && p.s <= cur.len + 0.5 && p.d >= cur.paveL - 0.8 && p.d <= cur.paveR + 0.8;
    const inLanes = onCur && p.d >= cur.edgeL - 0.3 && p.d <= cur.edgeR + 0.3;
    if (inLanes && (this.steps & 3) !== 0) return;
    const hits = this.net.surfaces(p.x, p.z, p.y, 0.8, this.cands);
    const score = (h: Hit) => {
      const path = h.path;
      let rel = p.psi - path.heading(clamp(h.s, 0, path.len)); rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const lanes = h.d >= path.edgeL - 0.3 && h.d <= path.edgeR + 0.3 ? 2 : 0;
      return lanes + Math.cos(rel) * 2 + (path === cur ? 1.2 : 0) + (this.route[0]?.to === path ? 0.8 : 0);
    };
    let best: Hit | null = null, bestScore = -1e9;
    for (const h of hits) { const sc = score(h); if (sc > bestScore) { best = h; bestScore = sc; } }
    if (!best || best.path === cur) return;
    this.enterPath(best.path, best.s, best.d);
  }
  private enterPath(path: Path, s: number, d: number) {
    this.path = path; this.phys.s = s; this.phys.d = d;
    this.switches++;
    if (this.route.length && this.route[0].to === path) this.route.shift();
    else if (this.route.length && !this.route.some((j) => j.to === path) && this.routeTarget && path !== this.routeTarget) {
      // off the planned route: plan again from here
      const r = this.net.route(path, Math.max(0, s), this.routeTarget);
      this.route = r ?? [];
      if (!this.attract) this.ev.toast('Rerouting', 'info');
    }
    if (this.routeTarget === path) { this.route = []; this.routeTarget = null; if (!this.attract) this.ev.toast(`You made it: ${path.label}`, 'good'); }
    if (path.main) {
      this.visited.add(path.label);
      if (path !== this.lastMain && !this.attract) this.ev.toast(path.label + (path.name ? ' · ' + path.name : ''), 'info');
      this.lastMain = path;
    }
  }

  // the end of the road: turn around (a freeway that just stops) or rejoin from the street (an off-ramp)
  private rejoin() {
    const p = this.phys, cur = this.path;
    if (cur.main) {
      const other = this.net.mains.find((m) => m.route === cur.route && m !== cur)!;
      const pr = other.project(p.x, p.z, other.len - p.s);
      const s = clamp(pr.s + 25, 5, other.len - 5);
      this.placeCar(other, s, 1, Math.min(Math.abs(p.vx), 25));
      this.ev.toast(`End of the freeway. Turned around: ${other.label}`, 'info');
      return;
    }
    // an on-ramp starting near here (from the same street), preferably back the way you were going
    let best: Path | null = null, bestScore = 1e9;
    for (const q of this.net.paths) {
      if (q.main || q.prev || q.inc.length) continue;
      const dist = Math.hypot(q.xs[0] - p.x, q.zs[0] - p.z);
      if (dist > 700) continue;
      const lead = this.net.leadsTo(q);
      if (!lead) continue;
      const sc = dist + (this.lastMain && lead === this.lastMain.label ? 0 : 400);
      if (sc < bestScore) { bestScore = sc; best = q; }
    }
    if (best) {
      this.placeCar(best, 4, 0, 12);
      this.ev.toast(`Back on: ${this.net.leadsTo(best)}`, 'info');
      return;
    }
    const m = this.lastMain ?? this.net.mains[0], pr = m.project(p.x, p.z, p.s);
    this.placeCar(m, clamp(pr.s, 5, m.len - 5), 1, 15);
    this.ev.toast(`Back on ${m.label}`, 'info');
  }

  // ----------------------------------------------------------------------------------------- autopilot
  // the menu's demo driver and the test driver: picks the clearest lane, checks the mirror, brakes by closing speed,
  // slows for curves, and follows the route through interchanges (pure pursuit on whichever road it's taking)
  private apLane = 1;
  private autopilot(c: Controls, cruise = 31) {
    const p = this.phys, path = this.path, v = Math.max(3, p.vx);
    const lanes = path.lanes;
    const ahead = (l: number) => {
      let g = 1e9, sp = 0;
      for (const t of this.traffic.cars) {
        if (t.path !== path || Math.abs(t.d - path.laneCenter(l)) > 2.3 || t.s < p.s - 2) continue;
        const d = t.s - p.s - this.traffic.classes[t.cls].len / 2 - SPEC.halfL; if (d < g) { g = d; sp = t.v; }
      }
      return { g, v: sp };
    };
    const clear = (l: number) => this.traffic.cars.every((t) => t.path !== path || Math.abs(t.d - path.laneCenter(l)) > 2.6 || t.s < p.s - 25 || t.s > p.s + 30);
    // where the route wants you
    const next = this.route[0];
    let want = -1;
    const side = next ? this.sideOf(path, next) : 'R';
    if (next && next.kind === 'diverge' && next.s - p.s < 1600) want = side === 'R' ? lanes - 1 : 0;
    this.apLane = clamp(this.apLane, 0, lanes - 1);
    const cur = this.apLane, here = ahead(cur);
    const settled = Math.abs(p.d - path.laneCenter(cur)) < 0.6;
    if (want >= 0 && settled && want !== cur) { const step = cur + Math.sign(want - cur); if (clear(step)) this.apLane = step; }
    else if (settled && want < 0 && here.g < Math.max(90, p.vx * 3)) {
      let best = cur, bestG = here.g + 40;
      for (const l of [cur - 1, cur + 1]) { if (l < 0 || l >= lanes) continue; const a2 = ahead(l); if (a2.g > bestG && clear(l)) { best = l; bestG = a2.g; } }
      this.apLane = best;
    }
    // pure pursuit: a point `look` metres ahead on the road we mean to be on (carrying on into the route's next road)
    const look = clamp(6 + v * 0.75, 9, 70);
    const aim = (q: Path, s: number, off: number) => {
      let ts = s + look, tq = q;
      if (ts > tq.len) {
        const on = this.route.find((j) => j.to !== tq && j.s >= tq.len - 1 && tq.out.includes(j)) ?? null;
        const nq = on ? on.to : tq.next;
        if (nq) { ts = (on ? on.toS : 0) + (ts - tq.len); tq = nq; off = tq.main ? off : 0; }
      }
      return tq.at(clamp(ts, 0, tq.len), tq === q ? off : (tq.main ? tq.laneCenter(Math.min(1, tq.lanes - 1)) : 0));
    };
    let tgt = aim(path, p.s, path.laneCenter(this.apLane));
    let follow = path, fs = p.s;
    if (next) {
      const dist = next.s - p.s, q = next.to;
      const qs = q.project(p.x, p.z, Math.max(0, next.toS + (p.s - next.s))).s;
      if (next.kind === 'diverge' && dist < 160 && dist > -700) {
        // OSM ramps leave from the middle of the carriageway: only steer for the ramp once it's further out than our lane
        const r = aim(q, qs, 0), pr = path.project(r.x, r.z, p.s + look);
        const lane = path.laneCenter(side === 'R' ? lanes - 1 : 0);
        if (side === 'R' ? pr.d > lane - 0.3 : pr.d < lane + 0.3) { tgt = r; follow = q; fs = qs; }
      } else if (next.kind === 'merge' && dist < 120 + v * 2) {
        // joining a freeway: line up with its outside lane on the side we're coming in from
        const into = this.sideOfMerge(path, next);
        tgt = aim(q, qs, q.laneCenter(into === 'R' ? q.lanes - 1 : 0)); follow = q; fs = qs;
      } else if (next.kind === 'continue' && dist < look) { follow = q; fs = qs; tgt = aim(q, qs, q.main ? q.laneCenter(Math.min(1, q.lanes - 1)) : 0); }
    }
    const dx = tgt.x - p.x, dz = tgt.z - p.z;
    const fwd = dx * Math.sin(p.psi) + dz * Math.cos(p.psi), left = dx * Math.cos(p.psi) - dz * Math.sin(p.psi);
    const alpha = Math.atan2(left, Math.max(0.1, fwd)), Ld = Math.hypot(dx, dz);
    // pure pursuit's arc, plus yaw-rate damping so lane changes at speed don't wag
    const kappa = (2 * Math.sin(alpha)) / Math.max(1, Ld), Lw = SPEC.a + SPEC.b;
    const deltaLeft = Math.atan(Lw * kappa) + 0.55 * (kappa * v - p.r) * (Lw / v);
    c.steer = clamp(-deltaLeft / this.phys.maxDelta(), -1, 1);
    // speed: traffic ahead, and the sharpest curve in the next stretch
    let kmax = 0;
    for (let s2 = 0; s2 < 40 + v * 3; s2 += 6) {
      let q = follow, ss = fs + s2;
      if (ss > q.len && q.next) { ss -= q.len; q = q.next; }
      kmax = Math.max(kmax, Math.abs(q.sample(clamp(ss, 0, q.len)).k));
    }
    const target = Math.min(cruise, Math.sqrt(7.5 / Math.max(kmax, 1e-5)));
    const lead = ahead(this.apLane), closing = Math.max(0, p.vx - lead.v);
    const safe = 10 + p.vx * 0.5 + (closing * closing) / 14;
    const tooFast = p.vx > target + 1.5;
    c.throttle = p.vx < target && lead.g > safe ? 0.85 : 0.04;
    c.brake = lead.g < safe * 0.75 ? clamp((safe * 0.75 - lead.g) / 15 + 0.2, 0.2, 1) : tooFast ? clamp((p.vx - target) / 12, 0.1, 0.7) : 0;
    c.handbrake = false;
  }
  // which side of the freeway a ramp comes in on (seen from the freeway)
  private sideOfMerge(ramp: Path, j: Junction): 'L' | 'R' {
    const m = j.to, h = m.heading(clamp(j.toS, 0, m.len)), a = m.at(clamp(j.toS, 0, m.len), 0);
    const b = ramp.at(Math.max(0, ramp.len - 120), 0);
    return (b.x - a.x) * -Math.cos(h) + (b.z - a.z) * Math.sin(h) >= 0 ? 'R' : 'L';
  }
  private sideOf(path: Path, j: Junction): 'L' | 'R' {
    const a = path.at(clamp(j.s, 0, path.len), 0), h = path.heading(clamp(j.s, 0, path.len));
    const b = j.to.at(Math.min(j.to.len, j.toS + 200), 0);
    return (b.x - a.x) * -Math.cos(h) + (b.z - a.z) * Math.sin(h) >= 0 ? 'R' : 'L';
  }

  // ----------------------------------------------------------------------------------------- the loop
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    this.frames++;
    if (this.ctxLost) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    this.fpsN++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsT); this.fpsN = 0; this.fpsT = 0; }
    this.adapt(dt);
    this.actions();
    if (!this.paused) {
      this.input.update(dt, Math.abs(this.phys.vx));
      if (this.attract) this.autopilot(this.input.c);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= DT && steps < 12) { this.simulate(DT); this.acc -= DT; steps++; }
      if (steps === 12) this.acc = 0;
      this.time += dt;
    }
    const alpha = this.paused ? 1 : this.acc / DT;
    this.stream(1);
    this.car.update(dt, alpha, this.phys, this.input.c.brake > 0.05 && this.phys.gear > 0, this.time);
    this.car.cockpit.update(dt, {
      delta: this.phys.delta, rpm: this.phys.rpm, gear: this.phys.gear, auto: this.phys.auto, limiter: this.phys.limiter,
      speed: Math.abs(this.phys.vx), throttle: this.input.c.throttle, brake: this.input.c.brake, distance: this.distance,
      mode: this.settings.handling < 0.5 ? 'Sport' : 'Race', time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }, this.time);
    this.traffic.render(alpha, this.time);
    this.updateCamera(dt);
    this.env.follow(this.car.root.position, this.camera, this.time);
    this.car.cockpit.setDriverVisible(this.cam !== 'cockpit' && this.cam !== 'free');
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.renderCorner(dt);
    if (!this.attract) {
      this.audio.update(dt, { rpm: this.phys.rpm, throttle: this.phys.throttleOut, speed: Math.abs(this.phys.vx), slip: Math.max(this.phys.slipR, this.phys.slipF) + (this.input.c.handbrake ? 0.2 : 0), limiter: this.phys.limiter, scrape: this.scrape, cockpit: this.cam === 'cockpit' || this.cam === 'free' });
      this.scrape = Math.max(0, this.scrape - dt * 3);
    }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.sendHud(); }
  };

  private stream(budget: number) {
    const p = this.phys, h = p.psi;
    this.roads.update(p.x, p.z, Math.sin(h), Math.cos(h), budget);
    this.terrain.update(p.x, p.z, budget);
    if (Math.abs(p.x - ORIGIN.x) > 1500 || Math.abs(p.z - ORIGIN.z) > 1500) this.recentre();
  }

  private simulate(dt: number) {
    const p = this.phys;
    this.steps++;
    if (this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      p.step(dt, { ...this.input.c, brake: 1, handbrake: true }, this.path, this.net);
      if (Math.ceil(this.countdown) !== before) this.ev.toast(this.countdown > 0 ? String(Math.ceil(this.countdown)) : 'GO', 'info');
      this.car.snapshot(p);
      return;
    }
    const c = this.input.c;
    p.step(dt, this.over ? { ...c, throttle: 0, brake: 0.3 } : c, this.path, this.net);
    this.trackPath();
    if (!this.path.next && p.s > this.path.len - 30 && p.vx > 0.5) this.rejoin();
    this.car.snapshot(p);
    const playing = !this.attract && !this.over;
    // walls
    for (const im of p.impacts) {
      if (im.speed > 1.2) { this.scrape = Math.min(1, this.scrape + im.speed * 0.08); this.shake = Math.max(this.shake, Math.min(1, im.speed / 14)); }
      if (im.speed > 3) this.streak = 0;
      if (im.speed > 6) { this.audio.thump(im.speed); this.combo = 1; if (playing) this.collisions++; }
      if (this.mode === 'survival' && playing && im.speed > 17) this.endRun('Hit the wall');
    }
    p.impacts.length = 0;
    // traffic
    const view = this.view();
    const passes = this.traffic.step(dt, view, this.time);
    for (const contact of this.traffic.collide(view)) {
      p.x += contact.nx * contact.depth; p.z += contact.nz * contact.depth;
      if (contact.speed <= 0) continue;
      const cl = this.traffic.classes[contact.car.cls];
      const J = (1.2 * contact.speed) / (1 / SPEC.mass + 1 / cl.mass);
      const dvp = J / SPEC.mass, dvc = J / cl.mass;
      const ch = contact.car.h, along = -(contact.nx * Math.sin(ch) + contact.nz * Math.cos(ch));
      const lever = clamp((contact.car.x - p.x) * Math.sin(p.psi) + (contact.car.z - p.z) * Math.cos(p.psi), -2.2, 2.2);
      const side = contact.nx * -Math.cos(p.psi) + contact.nz * Math.sin(p.psi);
      p.push(contact.nx * dvp, contact.nz * dvp, clamp(-lever * side * dvp * 0.22, -1.6, 1.6));
      this.traffic.bump(contact.car, dvc * along, this.time);       // pushed along -n: that much faster (or slower) along its lane
      this.shake = Math.max(this.shake, Math.min(1, contact.speed / 12));
      this.combo = 1; this.comboT = 0; this.streak = 0;
      if (contact.speed > 2 && playing) this.collisions++;
      if (contact.speed > 3) this.audio.crash(contact.speed); else this.audio.thump(contact.speed * 3);
      if (this.mode === 'survival' && playing && contact.speed > 7) this.endRun(`Crashed into ${cl.id === 'suv' ? 'an SUV' : cl.id === 'semi' ? 'a big rig' : 'a ' + (cl.id === 'truck' ? 'box truck' : cl.id === 'sports' ? 'sports car' : cl.id)}`);
    }
    // wrong way?
    let rel = p.psi - this.path.heading(clamp(p.s, 0, this.path.len)); rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.wrongWay = Math.abs(rel) > 1.75 && Math.abs(p.vx) > 4;
    // passes: whooshes, and points for clean passes and near misses (once per car, only past moving cars)
    for (const ps of passes) {
      if (!this.attract) this.audio.passBy(ps.rel, Math.max(0.5, ps.gap), this.traffic.classes[ps.car.cls].len > 7);
      if (this.mode !== 'survival' || !playing || !ps.clean || ps.rel < 3 || ps.car.v < 10 || this.wrongWay || ps.car.touched === -1) continue;
      ps.car.touched = -1;                         // counted: a car only scores once
      this.overtakes++;
      this.comboT = 4;
      if (ps.close) this.nearMisses++;
      const pts = Math.round((ps.close ? 250 : 100) * this.combo);
      this.score += pts;
      this.ev.toast(ps.close ? `Near miss +${pts}` : `Clean pass +${pts}`, 'good');
      this.combo = Math.min(8, this.combo + (ps.close ? 1 : 0.5));
    }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 1; }
    // distance, the streak and the clocks
    const fwd = Math.max(0, view.v) * dt;
    if (!this.attract && !this.wrongWay) this.distance += fwd;
    this.top = Math.max(this.top, Math.abs(p.vx));
    if (playing) {
      if (this.mode === 'survival') {
        if (p.vx > FAST && !this.wrongWay) { this.streak += dt; this.bestStreak = Math.max(this.bestStreak, this.streak); }
        else this.streak = 0;
        const band = p.vx > FAST ? 1 + (p.vx - FAST) / 22 : 0.2;
        this.score += fwd * 0.1 * band * (1 + Math.min(this.streak, 60) / 30);
      }
      if (this.mode === 'time') {
        this.timeLeft -= dt;
        if (this.distance >= this.nextCheckpoint) { this.nextCheckpoint += 2000; this.timeLeft += 25; this.ev.toast('Checkpoint +25 s', 'good'); }
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.endRun('Out of time'); }
      }
    }
  }

  private endRun(reason: string) {
    this.over = true;
    const score = this.mode === 'time' ? Math.round(this.distance) : Math.round(this.score);
    const best = loadBest(this.mode), newBest = score > best;
    if (newBest) saveBest(this.mode, score);
    const run: Run = { mode: this.mode, score, distance: Math.round(this.distance), top: Math.round(this.top * MPH), streak: Math.round(this.bestStreak * 10) / 10, nearMisses: this.nearMisses, overtakes: this.overtakes, collisions: this.collisions, when: Date.now(), road: this.lastMain?.label ?? '' };
    const board = recordRun(run);
    setTimeout(() => this.ev.over({ mode: this.mode, score, distance: this.distance, overtakes: this.overtakes, top: this.top, reason, best: Math.max(best, score), newBest, time: this.time, nearMisses: this.nearMisses, bestStreak: this.bestStreak, collisions: this.collisions, board }), 1200);
  }

  // Free Drive has no ending of its own: this one files the drive (distance, top speed) and shows the summary
  endFreeDrive() { if (!this.attract && !this.over && this.mode === 'free') { this.setPaused(false); this.score = Math.round(this.distance); this.endRun('Parked'); } }

  // ----------------------------------------------------------------------------------------- cameras
  private tmpQ = new THREE.Quaternion(); private tmpE = new THREE.Euler(0, 0, 0, 'YXZ'); private tmpV = new THREE.Vector3(); private wantP = new THREE.Vector3(); private wantQ = new THREE.Quaternion();
  private updateCamera(dt: number) {
    const c = this.input.c, p = this.phys, portrait = this.camera.aspect < 0.95;
    const speedK = clamp(Math.abs(p.vx) / 90, 0, 1);
    let fov = 60;
    this.car.root.updateMatrixWorld(true);
    const lookBack = c.lookBack && !this.attract;
    if (lookBack) {
      this.car.rear.getWorldPosition(this.wantP); this.car.rear.getWorldQuaternion(this.wantQ);
      this.tmpQ.setFromEuler(this.tmpE.set(-0.08, 0, 0)); this.wantQ.multiply(this.tmpQ);
      fov = 62;
    } else if (this.cam === 'cockpit' || this.cam === 'free') {
      this.head.x = damp(this.head.x, clamp(p.ay * 0.0032, -0.04, 0.04), 6, dt);
      this.head.z = damp(this.head.z, clamp(p.ax * 0.0028, -0.035, 0.03), 6, dt);
      this.car.eye.getWorldPosition(this.wantP);
      this.car.body.getWorldQuaternion(this.wantQ);
      this.tmpV.set(this.head.x, 0, this.head.z).applyQuaternion(this.wantQ); this.wantP.add(this.tmpV);
      const basePitch = portrait ? -0.27 : -0.085;
      const sway = this.attract ? Math.sin(this.time * 0.25) * 0.18 : 0;
      this.tmpQ.setFromEuler(this.tmpE.set(basePitch + c.lookPitch, c.lookYaw + sway, 0));
      this.wantQ.multiply(this.tmpQ);
      fov = (portrait ? 96 : 58) + (this.cam === 'free' ? 8 : 0) + this.settings.fov + speedK * 4;
    } else if (this.cam === 'hood') {
      this.car.hood.getWorldPosition(this.wantP); this.car.root.getWorldQuaternion(this.wantQ);
      this.tmpQ.setFromEuler(this.tmpE.set(-0.04 + c.lookPitch, c.lookYaw, 0)); this.wantQ.multiply(this.tmpQ);
      fov = (portrait ? 92 : 62) + this.settings.fov + speedK * 5;
    } else {
      const root = this.car.root.position, psi = p.psi;
      const fwd = this.tmpV.set(Math.sin(psi), 0, Math.cos(psi));
      this.chaseFwd.lerp(fwd, 1 - Math.exp(-dt * 4)).normalize();
      const back = (portrait ? 8.2 : 6.6) + speedK * 1.4, up = (portrait ? 2.9 : 2.25) - speedK * 0.25;
      this.wantP.copy(root).addScaledVector(this.chaseFwd, -back); this.wantP.y = root.y + up;
      this.chasePos.y += (this.wantP.y - this.chasePos.y) * (1 - Math.exp(-dt * 8));
      this.chasePos.x = this.wantP.x; this.chasePos.z = this.wantP.z;
      this.wantP.copy(this.chasePos);
      const look = root.clone().addScaledVector(this.chaseFwd, 3.5); look.y += 0.9;
      const m = new THREE.Matrix4().lookAt(this.wantP, look, new THREE.Vector3(0, 1, 0));
      this.wantQ.setFromRotationMatrix(m);
      this.tmpQ.setFromEuler(this.tmpE.set(c.lookPitch * 0.5, c.lookYaw, 0)); this.wantQ.multiply(this.tmpQ);
      fov = (portrait ? 80 : 60) + this.settings.fov * 0.5 + speedK * 6;
    }
    if (this.shake > 0) {
      this.wantP.x += (Math.random() - 0.5) * this.shake * 0.06; this.wantP.y += (Math.random() - 0.5) * this.shake * 0.05;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    if (this.camBlend < 1) {
      this.camBlend = Math.min(1, this.camBlend + dt / 0.5);
      const t = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);
      this.camera.position.lerpVectors(this.camFrom.p, this.wantP, t);
      this.camera.quaternion.slerpQuaternions(this.camFrom.q, this.wantQ, t);
    } else { this.camera.position.copy(this.wantP); this.camera.quaternion.copy(this.wantQ); }
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 6)); this.camera.updateProjectionMatrix(); }
    this.camera.near = this.cam === 'chase' && !lookBack ? 0.15 : 0.05;
  }

  // ----------------------------------------------------------------------------------------- the corner window
  cornerRect() {
    // where the UI actually put the window (safe areas move it on notched phones)
    const el = document.querySelector('.corner') as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect(), h = this.host.getBoundingClientRect();
      return { x: r.left - h.left + 1, y: r.top - h.top + 1, size: Math.min(r.width, r.height) - 2 };
    }
    const size = CORNER_PX[this.settings.cornerSize] ?? CORNER_PX[1];
    return { x: (this.host.clientWidth || innerWidth) - size - 12, y: 64, size };
  }
  private renderCorner(dt: number) {
    const mode = this.settings.corner;
    if (this.attract || mode === 'off') return;
    if (mode === 'sky') {
      // a live camera 150 m up, heading-up, looking down just ahead of the car
      const r = this.cornerRect(), pr = this.renderer.getPixelRatio(), H = this.host.clientHeight || innerHeight;
      const p = this.car.root.position;
      const fx = Math.sin(this.phys.psi), fz = Math.cos(this.phys.psi);
      this.skyCam.position.set(p.x + fx * 40, p.y + 150, p.z + fz * 40);
      this.skyCam.up.set(fx, 0, fz);
      this.skyCam.lookAt(p.x + fx * 40, p.y, p.z + fz * 40);
      this.skyCam.aspect = 1; this.skyCam.updateProjectionMatrix();
      const x = Math.round(r.x * pr), y = Math.round((H - r.y - r.size) * pr), s = Math.round(r.size * pr);
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(x, y, s, s); this.renderer.setViewport(x, y, s, s);
      const fog = this.scene.fog; this.scene.fog = null;
      this.car.cockpit.setDriverVisible(true);
      this.renderer.render(this.scene, this.skyCam);
      this.scene.fog = fog;
      this.renderer.setScissorTest(false);
      const size = this.renderer.getSize(new THREE.Vector2());
      this.renderer.setViewport(0, 0, size.x, size.y);
      return;
    }
    this.mapT -= dt;
    if (this.mapT > 0 || !this.mapCanvas) return;
    this.mapT = 0.1;
    this.drawMap(this.mapCanvas);
  }

  // a heading-up road map: every freeway within a few kilometres, the route, you
  private drawMap(cv: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), size = this.cornerRect().size;
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); }
    const g = cv.getContext('2d'); if (!g) return;
    const W = cv.width, R = 2600, k = (W / 2) / R;
    const p = this.phys, ch = Math.cos(p.psi), sh = Math.sin(p.psi);
    const tx = (x: number, z: number): [number, number] => {
      const dx = x - p.x, dz = z - p.z;
      const right = dx * -ch + dz * sh, fwd = dx * sh + dz * ch;
      return [W / 2 + right * k, W * 0.62 - fwd * k];
    };
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(14,16,20,0.78)'; g.fillRect(0, 0, W, W);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const routePaths = new Set<Path>([this.path, ...this.route.map((j) => j.to)]);
    const draw = (path: Path, color: string, width: number, step: number) => {
      if (path.maxX < p.x - R || path.minX > p.x + R || path.maxZ < p.z - R || path.minZ > p.z + R) return;
      g.strokeStyle = color; g.lineWidth = width * dpr; g.beginPath();
      let pen = false;
      for (let i = 0; i < path.n; i += step) {
        const x = path.xs[i], z = path.zs[i];
        if (Math.abs(x - p.x) > R * 1.5 || Math.abs(z - p.z) > R * 1.5) { pen = false; continue; }
        const [a, b] = tx(x, z);
        if (pen) g.lineTo(a, b); else { g.moveTo(a, b); pen = true; }
      }
      g.stroke();
    };
    for (const q of this.net.paths) if (!q.main && Math.abs(q.xs[0] - p.x) < 900 && Math.abs(q.zs[0] - p.z) < 900) draw(q, 'rgba(160,170,180,0.45)', 1, 3);
    for (const q of this.net.mains) draw(q, 'rgba(225,228,232,0.85)', 2.2, 10);
    for (const q of routePaths) draw(q, '#f5c518', 3, q.main ? 6 : 2);
    g.font = `${Math.round(9 * dpr)}px "Saira Semi Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const done = new Set<string>();
    for (const q of this.net.mains) {
      const key = q.route!;
      if (done.has(key) || q.maxX < p.x - R || q.minX > p.x + R || q.maxZ < p.z - R || q.minZ > p.z + R) continue;
      let bi = -1, bd = 1e18;
      for (let i = 0; i < q.n; i += 25) { const dd = (q.xs[i] - p.x) ** 2 + (q.zs[i] - p.z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
      if (bi < 0 || bd > (R * 0.8) ** 2) continue;
      const i2 = Math.min(q.n - 1, bi + 250), [mx, my] = tx(q.xs[i2], q.zs[i2]);
      if (mx < 12 || my < 10 || mx > W - 12 || my > W - 10) continue;
      done.add(key);
      const inter = q.route!.startsWith('I-');
      g.fillStyle = inter ? '#1d4f9c' : '#f4f4ee';
      g.fillRect(mx - 11 * dpr, my - 6 * dpr, 22 * dpr, 12 * dpr);
      g.fillStyle = inter ? '#fff' : '#111';
      g.fillText(q.route!.replace(/^(I|SR)-/, ''), mx, my + 0.5);
    }
    g.fillStyle = '#d0141e'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr;
    const cy = W * 0.62;
    g.beginPath(); g.moveTo(W / 2, cy - 7 * dpr); g.lineTo(W / 2 + 5 * dpr, cy + 5 * dpr); g.lineTo(W / 2, cy + 2 * dpr); g.lineTo(W / 2 - 5 * dpr, cy + 5 * dpr); g.closePath(); g.fill(); g.stroke();
  }

  // ----------------------------------------------------------------------------------------- resolution that follows the frame rate
  private adapt(dt: number) {
    this.frameAvg = this.frameAvg * 0.95 + dt * 1000 * 0.05;
    if (!this.settings.adaptive || this.paused) return;
    this.scaleT += dt;
    if (this.scaleT < 1.2) return;
    this.scaleT = 0;
    const q = QUALITY[this.settings.quality];
    let next = this.renderScale;
    if (this.frameAvg > 20) next = Math.max(0.5, this.renderScale - 0.08);
    else if (this.frameAvg < 14.5) next = Math.min(q.renderScale, this.renderScale + 0.05);
    if (Math.abs(next - this.renderScale) > 0.001) { this.renderScale = next; this.onResize(); }
  }

  // what's next on the route, and how far
  private nextManoeuvre(): [string, number] {
    const j = this.route[0];
    if (!j) return ['', 0];
    const side = j.kind === 'diverge' ? (this.sideOf(this.path, j) === 'R' ? 'Keep right' : 'Keep left') : 'Continue';
    const to = j.to.main ? j.to.label : this.net.leadsTo(j.to) || 'the ramp';
    return [`${side}: ${to}`, Math.max(0, j.s - this.phys.s)];
  }

  private sendHud() {
    const p = this.phys;
    const [next, nextDist] = this.nextManoeuvre();
    this.ev.hud({
      speed: Math.round(Math.abs(p.vx) * MPH), gear: p.gear < 0 ? 'R' : String(p.gear), rpm: Math.round(p.rpm), rpmFrac: clamp(p.rpm / SPEC.redline, 0, 1),
      distance: this.distance, score: Math.round(this.score), combo: this.combo, timeLeft: this.timeLeft, fps: this.fps, mode: this.mode,
      auto: p.auto, cam: CAM_LABEL[this.cam], checkpoint: Math.max(0, this.nextCheckpoint - this.distance), countdown: this.countdown,
      best: loadBest(this.mode), overtakes: this.overtakes,
      road: this.path.main ? this.path.label : (this.path.label ? 'To ' + this.path.label : 'Ramp'),
      next, nextDist, wrongWay: this.wrongWay, streak: this.streak, bestStreak: this.bestStreak, nearMisses: this.nearMisses, top: Math.round(this.top * MPH),
    });
  }

  get inAttract() { return this.attract; }
  // testing aids: run the simulation ahead with fixed controls (or the autopilot), without waiting for frames
  fastForward(seconds: number, c: Partial<Controls> = {}, cruise = 0) {
    Object.assign(this.input.c, c);
    for (let t = 0; t < seconds; t += DT) {
      if (cruise > 0) this.autopilot(this.input.c, cruise);
      this.simulate(DT);
      if (this.steps % 24 === 0) this.stream(1);
    }
  }
  get stats() {
    return { roads: this.roads.count, tiles: this.terrain.count, traffic: this.traffic.cars.length, path: this.path.label, main: this.path.main, id: this.path.id, s: this.phys.s, d: this.phys.d, v: this.phys.vx,
      x: this.phys.x, z: this.phys.z, y: this.phys.y, scale: this.renderScale, calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, switches: this.switches,
      visited: [...this.visited], route: this.route.map((j) => j.to.label), score: this.score, streak: this.streak, wrongWay: this.wrongWay };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    this.renderer.dispose();
  }
}
