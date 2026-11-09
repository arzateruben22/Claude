// S4: Stoppage Time's sound, all made in code (PROJECT_OC_SPORTS_BAR.md, "Audio (all made in code)"). Nothing is
// recorded, downloaded or streamed, and no voice says a word.
//   The room     the murmur: filtered noise through three moving formant bands, four voices placed at the four
//                nearest live guests (where the talking groups are), its level by the head count inside
//   The screens  a wordless "commentary" bed from the big screen: a buzzy voice through two formant bands, gated into
//                syllables with a moving pitch; it rises with the match's moments
//   Reactions    a frame's cheers summed into one swell of shaped noise with granular claps, its level by how many
//                reacted; a groan as a low formant swell
//   The games    pool clicks by modal synthesis (2 to 4 kHz partials, 30 ms), cushion thuds, the pocket's drop; the
//                dart's thunk (low-passed noise and a cork resonance); the puck's slide (a noise sweep) and its clack
//   The bar      a glass clink (inharmonic partials) when your drink arrives, the pass bell when your food does
//   Music        the jukebox plays the game's own code-composed KFWY 96.9 (src/game/audio/Radio.ts) through a speaker
//                filter, while open; louder on dance nights
//   Outside      the I-5's hum (low-passed pink noise) from the nearest point of its carriageways, rising on the patio
//   Interface    a chime for a moodlet, the rising spark for tokens earned
// Space: a code-made impulse response (0.8 s of decaying, low-passed noise) inside; the patio is drier. Voices: at most
// 12 at Low, 24 at HD and 32 at Ultra (the beds count; at the cap a sound takes a lower one's slot, the crowd's swell
// first), HRTF panning at HD and Ultra, equal-power at Low. Mix: four
// sliders in the pause sheet (the room, the screens, the music, effects), kept on this device.
// Not built (written up in the handoff): the fryer and the ice scoop, the substation's transformer hum, car doors in
// the lot, the "ooh" and the menus' ticks.
import * as THREE from 'three';
import { Radio } from '../../../game/audio/Radio';
import type { Quality } from '../../engine/mats';
import type { Frame } from '../../engine/frame';
import type { BarLife } from './life';
import { drainSfx, type SfxEvent, type SfxKind } from './sfx';
import { SCREENS, JUKEBOX } from './layout';

export type Bus = 'room' | 'screens' | 'music' | 'effects';
const BUSES: Bus[] = ['room', 'screens', 'music', 'effects'];
const MIX_KEY = 'sportsbar.mix';
export const VOICE_CAP: Record<Quality, number> = { low: 12, hd: 24, ultra: 32 };
/** the beds always running once the sound is on: four murmur voices, the broadcast, the jukebox and the freeway */
const BEDS = 7;
/** at the cap a sound takes the slot of a lower one (the oldest of the lowest), never the other way round: the
 *  room's swell first, then what you did (your order, a moodlet, tokens), then the games' knocks, then single clicks */
const PRIO: Record<SfxKind, number> = { cheer: 3, groan: 3, clink: 2, bell: 2, chime: 2, spark: 2, pot: 1, thunk: 1, slide: 1, clack: 0, click: 0, cushion: 0, clap: 0, tick: 0 };
interface Voice { kind: SfxKind; prio: number; g: GainNode; out: AudioNode; done: boolean }

export interface AudioCtxHooks {
  life: BarLife; F: Frame; camera: THREE.Camera;
  quality: () => Quality; indoor: (x: number, z: number) => boolean; open: () => boolean; night: () => number;
  dance: () => boolean; freeway: { pts: [number, number][] }[];
}
interface Murmur { src: AudioBufferSourceNode; f: BiquadFilterNode[]; g: GainNode; p: PannerNode; x: number; z: number }

export class BarAudio {
  ctx: AudioContext | null = null;
  private h: AudioCtxHooks | null = null;
  private master!: GainNode;
  private bus = {} as Record<Bus, GainNode>;
  private wet!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private pink!: AudioBuffer;
  private murmur: Murmur[] = [];
  private bc!: { osc: OscillatorNode; f1: BiquadFilterNode; f2: BiquadFilterNode; gate: GainNode; level: GainNode; p: PannerNode; next: number };
  private juke!: { gain: GainNode; p: PannerNode; radio: Radio; on: boolean };
  private hum!: { gain: GainNode; p: PannerNode };
  private panners: PannerNode[] = [];
  private analysers = {} as Record<Bus | 'master', AnalyserNode>;
  private buf = new Float32Array(1024);
  mix: Record<Bus, number> = { room: 0.8, screens: 0.7, music: 0.6, effects: 0.8 };
  /** one-shots playing now, and how many each kind played or were dropped at the cap */
  voices = 0; maxVoices = 0;
  played: Partial<Record<SfxKind, number>> = {};
  dropped = 0; stolen = 0;
  droppedBy: Partial<Record<SfxKind, number>> = {};
  private active: Voice[] = [];
  private model: PanningModelType = 'equalpower';
  private t = 0; private placeT = 0; private humT = 0;
  private heads = 0; private excite = 0;
  private lastHeld = { drink: false, food: false }; private lastMoodT = -1; private lastTokens = -1;
  private cheerSum = 0; private cheerX = 0; private cheerZ = 0; private cheerDelay = 0;
  private groanSum = 0; private groanX = 0; private groanZ = 0;

  constructor() {
    try { const m = JSON.parse(localStorage.getItem(MIX_KEY) ?? 'null') as Partial<Record<Bus, number>> | null; if (m) for (const b of BUSES) if (typeof m[b] === 'number') this.mix[b] = Math.min(1, Math.max(0, m[b]!)); } catch { /* a convenience */ }
  }

  /** the page's pieces; the sound starts on the first tap or key (a browser needs a gesture), or from the test hook */
  attach(h: AudioCtxHooks) {
    this.h = h;
    const go = () => { this.start(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
    addEventListener('pointerdown', go); addEventListener('keydown', go);
    // the pause sheet's four sliders
    for (const b of BUSES) {
      const el = document.getElementById('mix-' + b) as HTMLInputElement | null;
      if (!el) continue;
      el.value = String(Math.round(this.mix[b] * 100));
      el.addEventListener('input', () => this.setMix(b, Number(el.value) / 100));
    }
  }

  setMix(b: Bus, v: number) {
    this.mix[b] = Math.min(1, Math.max(0, v));
    if (this.ctx) this.bus[b].gain.setTargetAtTime(this.mix[b], this.ctx.currentTime, 0.05);
    try { localStorage.setItem(MIX_KEY, JSON.stringify(this.mix)); } catch { /* a convenience */ }
    const el = document.getElementById('mix-' + b) as HTMLInputElement | null; if (el && el !== document.activeElement) el.value = String(Math.round(this.mix[b] * 100));
  }

  start() {
    if (this.ctx || !this.h) { void this.ctx?.resume(); return !!this.ctx; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC(); this.ctx = ctx;
    void ctx.resume();
    // noise: white for the murmur, the cheers and the one-shots; pink (Voss) for the freeway
    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    { const d = this.noise.getChannelData(0); let s = 7; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } }
    this.pink = ctx.createBuffer(1, n, ctx.sampleRate);
    { const d = this.pink.getChannelData(0), w = this.noise.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { const x = w[i]; b0 = 0.997 * b0 + 0.029591 * x; b1 = 0.985 * b1 + 0.032534 * x; b2 = 0.95 * b2 + 0.048056 * x; d[i] = (b0 + b1 + b2 + 0.1848 * x) * 0.35; } }
    // the mix: four buses into the master, through a gentle compressor; the reverb is a send from every bus
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
    this.analysers.master = ctx.createAnalyser(); this.analysers.master.fftSize = 1024; this.master.connect(this.analysers.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(ctx, 0.8);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.3; this.verb.connect(this.wet); this.wet.connect(this.master);
    for (const b of BUSES) {
      const g = ctx.createGain(); g.gain.value = this.mix[b]; g.connect(this.master); g.connect(this.verb); this.bus[b] = g;
      const a = ctx.createAnalyser(); a.fftSize = 1024; g.connect(a); this.analysers[b] = a;
    }
    // the murmur's four voices
    for (let i = 0; i < 4; i++) {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.loopStart = i * 0.37; src.playbackRate.value = 0.92 + 0.05 * i;
      const g = ctx.createGain(); g.gain.value = 0; const p = this.panner(ctx, 2.5, 1.2);
      const f = [520, 1450, 2550].map((hz, k) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = hz * (1 + 0.04 * i); b.Q.value = 3.5 - k * 0.6; src.connect(b); b.connect(g); return b; });
      g.connect(p); p.connect(this.bus.room); src.start(ctx.currentTime + i * 0.05);
      this.murmur.push({ src, f, g, p, x: 0, z: 0 });
    }
    // the broadcast bed, from the big screen
    {
      const big = SCREENS[0], [x, z] = this.h.F.fromFrame(big.at[0] - 0.3, big.at[1]);
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 140;
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 5;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1700; f2.Q.value = 6;
      const gate = ctx.createGain(); gate.gain.value = 0; const level = ctx.createGain(); level.gain.value = 0;
      const p = this.panner(ctx, 3, 1); p.positionX.value = x; p.positionY.value = big.y; p.positionZ.value = z;
      osc.connect(f1); osc.connect(f2); f1.connect(gate); f2.connect(gate); gate.connect(level); level.connect(p); p.connect(this.bus.screens);
      osc.start();
      this.bc = { osc, f1, f2, gate, level, p, next: 0 };
    }
    // the jukebox through a speaker
    {
      const [x, z] = this.h.F.fromFrame(JUKEBOX[0], JUKEBOX[1] + 0.3);
      const inp = ctx.createGain(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1300; pk.gain.value = 4;
      const gain = ctx.createGain(); gain.gain.value = 0; const p = this.panner(ctx, 3, 0.9); p.positionX.value = x; p.positionY.value = 1.1; p.positionZ.value = z;
      inp.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(gain); gain.connect(p); p.connect(this.bus.music);
      const radio = new Radio(() => this.ctx, () => inp, () => this.noise);
      this.juke = { gain, p, radio, on: false };
    }
    // the freeway's hum
    {
      const src = ctx.createBufferSource(); src.buffer = this.pink; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const gain = ctx.createGain(); gain.gain.value = 0; const p = this.panner(ctx, 60, 0.6);
      src.connect(lp); lp.connect(gain); gain.connect(p); p.connect(this.bus.room); src.start();
      this.hum = { gain, p };
    }
    this.setQuality(this.h.quality());
    return true;
  }

  /** the panning model and the voice cap follow the graphics mode (HRTF at HD and Ultra, equal-power at Low) */
  setQuality(q: Quality) {
    this.model = q === 'low' ? 'equalpower' : 'HRTF';
    for (const p of this.panners) p.panningModel = this.model;
  }

  private panner(ctx: AudioContext, ref: number, roll: number) {
    const p = ctx.createPanner(); p.panningModel = this.model; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 400;
    this.panners.push(p); return p;
  }
  /** a room's response: 0.8 s of exponentially decaying noise, low-passed by a running average, a little different
   *  each side */
  private impulse(ctx: AudioContext, secs: number) {
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let s = 11 + c * 31, y = 0;
      for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; const x = (s / 2147483647) * 2 - 1; y += 0.35 * (x - y); d[i] = y * Math.exp((-i / ctx.sampleRate) / 0.17); }
    }
    return b;
  }

  /** once a frame: the listener on the camera, the beds' levels and places, the frame's events */
  update(dt: number) {
    const ctx = this.ctx, h = this.h;
    if (!h) return;
    if (!ctx) { drainSfx(noopEv); return; }
    const now = ctx.currentTime, cam = h.camera, life = h.life;
    this.t += dt;
    // the listener
    const L = ctx.listener, f = _v.set(0, 0, -1).applyQuaternion(cam.quaternion), u = _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; }
    const inside = h.indoor(cam.position.x, cam.position.z), open = h.open();
    this.wet.gain.setTargetAtTime(inside ? 0.32 : 0.07, now, 0.3);           // the patio is drier
    // the murmur: the head count inside, the four nearest live guests (every half second)
    this.placeT -= dt;
    if (this.placeT <= 0) {
      this.placeT = 0.5;
      const ns = life.crowd?.npcs ?? [];
      let heads = 0;
      const best = _best; best.fill(-1); const bd = _bd; bd.fill(1e9);
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i]; if (n.mode !== 'live') continue;
        if (h.indoor(n.x, n.z)) heads++;
        const d = Math.hypot(n.x - cam.position.x, n.z - cam.position.z);
        for (let k = 0; k < 4; k++) if (d < bd[k]) { for (let j = 3; j > k; j--) { bd[j] = bd[j - 1]; best[j] = best[j - 1]; } bd[k] = d; best[k] = i; break; }
      }
      this.heads = heads;
      const level = open ? Math.min(1.3, Math.sqrt(heads / 36)) * 0.07 : 0;
      for (let k = 0; k < 4; k++) {
        const m = this.murmur[k], i = best[k];
        if (i >= 0) { const n = ns[i]; m.x = n.x; m.z = n.z; m.p.positionX.setTargetAtTime(n.x, now, 0.4); m.p.positionY.value = 1.5; m.p.positionZ.setTargetAtTime(n.z, now, 0.4); }
        m.g.gain.setTargetAtTime(i >= 0 ? level : 0, now, 0.6);
        // the formants wander (a crowd of voices, no words)
        for (let j = 0; j < 3; j++) { const base = [520, 1450, 2550][j] * (1 + 0.04 * k); m.f[j].frequency.setTargetAtTime(base * (0.8 + 0.4 * rand01(this.t * 13 + k * 7 + j)), now, 0.2); }
      }
    }
    // the broadcast: on while a match is on the big screen and the bar is open; louder after a moment
    const matchOn = open && life.bigMatchOn(), ex = life.excitement();
    this.excite += (ex - this.excite) * Math.min(1, dt * 2);
    this.bc.level.gain.setTargetAtTime(matchOn ? 0.05 + 0.09 * this.excite : 0, now, 0.4);
    if (matchOn && now >= this.bc.next) {
      // a syllable: a vowel's two formants, a pitch on a falling contour, a 70 to 220 ms gate; a pause now and then
      const r = rand01(now * 31), len = 0.07 + 0.15 * rand01(now * 17), gap = r < 0.12 ? 0.25 + 0.4 * rand01(now * 7) : 0.02;
      const V = VOWELS[Math.floor(rand01(now * 5) * VOWELS.length)];
      this.bc.f1.frequency.setTargetAtTime(V[0], now, 0.02); this.bc.f2.frequency.setTargetAtTime(V[1], now, 0.02);
      this.bc.osc.frequency.setTargetAtTime((120 + 70 * this.excite) * (0.85 + 0.3 * rand01(now * 3)), now, 0.04);
      const g = this.bc.gate.gain; g.cancelScheduledValues(now); g.setTargetAtTime(1, now, 0.012); g.setTargetAtTime(0, now + len, 0.03);
      this.bc.next = now + len + gap;
    }
    // the jukebox: KFWY while open; louder on dance nights
    const wantJuke = open;
    if (wantJuke !== this.juke.on) { this.juke.on = wantJuke; if (wantJuke) this.juke.radio.tune(1); else this.juke.radio.stop(); }
    this.juke.gain.gain.setTargetAtTime(wantJuke ? (h.dance() ? 0.55 : 0.28) : 0, now, 0.5);
    // the freeway: from the nearest point of the I-5's carriageways (every second), louder outside
    this.humT -= dt;
    if (this.humT <= 0 && h.freeway.length) {
      this.humT = 1;
      let bx = 0, bz = 0, bdd = 1e18;
      for (const fw of h.freeway) for (let i = 0; i < fw.pts.length; i += 2) { const p = fw.pts[i], d = (p[0] - cam.position.x) ** 2 + (p[1] - cam.position.z) ** 2; if (d < bdd) { bdd = d; bx = p[0]; bz = p[1]; } }
      this.hum.p.positionX.setTargetAtTime(bx, now, 0.5); this.hum.p.positionY.value = 7; this.hum.p.positionZ.setTargetAtTime(bz, now, 0.5);
      this.hum.gain.gain.setTargetAtTime(inside ? 0.05 : 0.22 + 0.1 * h.night(), now, 0.8);
    }
    // the bar and the interface: your drink and food arriving, a moodlet, tokens earned
    const hd = !!life.held.drink, hf = !!life.held.food;
    if (hd && !this.lastHeld.drink) this.one('clink', cam.position.x, cam.position.z - 0.3, 1, 0);
    if (hf && !this.lastHeld.food) this.one('bell', cam.position.x, cam.position.z, 0.7, 0);
    this.lastHeld.drink = hd; this.lastHeld.food = hf;
    let mt = -1; for (const m of life.moodlets.list) if (m.t0 > mt) mt = m.t0;
    if (this.lastMoodT >= 0 && mt > this.lastMoodT) this.one('chime', NaN, NaN, 1, 0);
    this.lastMoodT = Math.max(this.lastMoodT, mt);
    const tok = life.save.tokens;
    if (this.lastTokens >= 0 && tok > this.lastTokens) this.one('spark', NaN, NaN, 1, 0);
    this.lastTokens = tok;
    // the frame's events: reactions summed, the rest one each
    this.cheerSum = 0; this.groanSum = 0;
    drainSfx(this.onEvent);
    if (this.cheerSum > 0) this.one('cheer', this.cheerX / this.cheerSum, this.cheerZ / this.cheerSum, this.cheerSum, this.cheerDelay);
    if (this.groanSum > 0) this.one('groan', this.groanX / this.groanSum, this.groanZ / this.groanSum, this.groanSum, 0.3);
  }
  private onEvent = (e: SfxEvent) => {
    if (e.kind === 'cheer' || e.kind === 'clap') { if (this.cheerSum === 0) { this.cheerX = 0; this.cheerZ = 0; this.cheerDelay = e.delay; } this.cheerSum += e.k; this.cheerX += e.x * e.k; this.cheerZ += e.z * e.k; this.cheerDelay = Math.min(this.cheerDelay, e.delay); return; }
    if (e.kind === 'groan') { if (this.groanSum === 0) { this.groanX = 0; this.groanZ = 0; } this.groanSum += e.k; this.groanX += e.x * e.k; this.groanZ += e.z * e.k; return; }
    this.one(e.kind, e.x, e.z, e.k, e.delay);
  };

  /** one code-made sound, under the voice cap */
  one(kind: SfxKind, x: number, z: number, k: number, delay: number) {
    const ctx = this.ctx; if (!ctx || !this.h) return false;
    if (this.voices + BEDS >= VOICE_CAP[this.h.quality()]) {
      // the cap: take the slot of the oldest of the lowest-priority sounds playing, if it's lower than this one
      let v: Voice | null = null;
      for (const a of this.active) if (!a.done && (!v || a.prio < v.prio)) v = a;
      if (!v || v.prio >= PRIO[kind]) { this.dropped++; this.droppedBy[kind] = (this.droppedBy[kind] ?? 0) + 1; return false; }
      this.release(v, true); this.stolen++;
    }
    const t = ctx.currentTime + Math.max(0, delay) + 0.01;
    const bus = kind === 'cheer' || kind === 'groan' ? this.bus.room : this.bus.effects;
    let out: AudioNode = bus;
    if (Number.isFinite(x)) { const p = this.panner(ctx, kind === 'cheer' || kind === 'groan' ? 6 : 1.5, 1); p.positionX.value = x; p.positionY.value = 1.2; p.positionZ.value = z; p.connect(bus); out = p; }
    const g = ctx.createGain(); g.gain.value = 0; g.connect(out);
    let end = t + 0.3;
    const tone = (hz: number, a: number, dec: number, type: OscillatorType = 'sine', at = t) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; const e = ctx.createGain(); e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(a, at + 0.002); e.gain.setTargetAtTime(0, at + 0.004, dec); o.connect(e); e.connect(g); o.start(at); o.stop(at + dec * 7 + 0.01); end = Math.max(end, at + dec * 7 + 0.01); return o; };
    const burst = (dur: number, type: BiquadFilterType, hz: number, q: number, a: number, at = t, attack = 0.002) => { const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = hz; bq.Q.value = q; const e = ctx.createGain(); e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(a, at + attack); e.gain.setTargetAtTime(0, at + attack, dur / 3); s.connect(bq); bq.connect(e); e.connect(g); s.start(at, rand01(at * 3) * 1.5); s.stop(at + dur + 0.05); end = Math.max(end, at + dur + 0.05); return { s, bq }; };
    g.gain.setValueAtTime(1, t);
    switch (kind) {
      case 'click': for (let i = 0; i < Math.min(3, k); i++) { const at = t + i * 0.018; tone(2300 + 400 * i, 0.22, 0.03, 'sine', at); tone(3150, 0.14, 0.025, 'sine', at); tone(3900, 0.08, 0.02, 'sine', at); } break;
      case 'cushion': burst(0.08, 'lowpass', 220, 0.8, 0.5); break;
      case 'pot': { const o = tone(320, 0.35, 0.05, 'triangle'); o.frequency.exponentialRampToValueAtTime(110, t + 0.12); burst(0.18, 'bandpass', 900, 2, 0.15, t + 0.05); break; }
      case 'thunk': burst(0.07, 'lowpass', 650, 0.9, 0.6); tone(880, 0.12, 0.03); break;
      case 'slide': { const { bq } = burst(1.0, 'bandpass', 380, 2.5, 0.25 * k, t, 0.05); bq.frequency.exponentialRampToValueAtTime(1300, t + 0.9); break; }
      case 'clack': tone(1650, 0.25, 0.025, 'triangle'); tone(2450, 0.15, 0.02); break;
      case 'cheer': {
        const lv = Math.min(1, 0.25 + 0.12 * Math.sqrt(k));
        burst(2.0, 'bandpass', 1150, 0.7, 0.6 * lv, t, 0.15);
        burst(1.6, 'bandpass', 2400, 0.9, 0.3 * lv, t + 0.05, 0.2);
        const claps = Math.min(18, 4 + Math.round(k * 1.5));
        for (let i = 0; i < claps; i++) burst(0.02, 'highpass', 1500, 0.7, 0.25 * lv, t + 0.2 + 1.6 * rand01(t * 7 + i), 0.001);
        break;
      }
      case 'groan': { const lv = Math.min(1, 0.2 + 0.1 * Math.sqrt(k)); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(95, t + 1.3); const bq = ctx.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = 480; bq.Q.value = 2.5; const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.18 * lv, t + 0.4); e.gain.setTargetAtTime(0, t + 0.6, 0.35); o.connect(bq); bq.connect(e); e.connect(g); o.start(t); o.stop(t + 2.2); end = t + 2.2; burst(1.4, 'lowpass', 600, 0.7, 0.2 * lv, t, 0.3); break; }
      case 'clap': burst(0.02, 'highpass', 1500, 0.7, 0.25); break;
      case 'clink': for (const [hz, a] of [[2480, 0.14], [4130, 0.1], [5870, 0.07], [7310, 0.05]] as [number, number][]) tone(hz, a, 0.09); break;
      case 'bell': tone(1180, 0.16, 0.25); tone(2950, 0.08, 0.15); break;
      case 'chime': tone(880, 0.1, 0.12); tone(1320, 0.08, 0.14, 'sine', t + 0.09); break;
      case 'spark': { const o = tone(600, 0.08, 0.06, 'triangle'); o.frequency.exponentialRampToValueAtTime(1800, t + 0.28); break; }
      case 'tick': tone(2000, 0.05, 0.004); break;
    }
    this.voices++; if (this.voices > this.maxVoices) this.maxVoices = this.voices; this.played[kind] = (this.played[kind] ?? 0) + 1;
    const voice: Voice = { kind, prio: PRIO[kind], g, out, done: false };
    this.active.push(voice);
    const ms = (end - ctx.currentTime) * 1000 + 50;
    setTimeout(() => this.release(voice, false), ms);
    return true;
  }
  /** a one-shot's end (or its slot taken: a 10 ms fade first): its nodes off the graph, its slot free */
  private release(v: Voice, steal: boolean) {
    if (v.done) return;
    v.done = true; this.voices--;
    const i = this.active.indexOf(v); if (i >= 0) this.active.splice(i, 1);
    const off = () => { v.g.disconnect(); if (v.out instanceof PannerNode) { v.out.disconnect(); const k = this.panners.indexOf(v.out); if (k >= 0) this.panners.splice(k, 1); } };
    if (steal && this.ctx) { v.g.gain.cancelScheduledValues(this.ctx.currentTime); v.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01); setTimeout(off, 60); } else off();
  }

  /** each bus's level now (RMS, dBFS), for the checks */
  levels() {
    const out: Record<string, number> = {};
    for (const b of [...BUSES, 'master'] as const) { const a = this.analysers[b]; if (!a) continue; a.getFloatTimeDomainData(this.buf); let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i]; const r = Math.sqrt(s / this.buf.length); out[b] = r > 0 ? +(20 * Math.log10(r)).toFixed(1) : -200; }
    return out;
  }
  report() {
    const q = this.h?.quality() ?? 'low';
    return {
      on: !!this.ctx, state: this.ctx?.state ?? 'not started', sampleRate: this.ctx?.sampleRate ?? 0, panning: this.model, cap: VOICE_CAP[q], beds: BEDS, voices: this.voices, maxVoices: this.maxVoices, dropped: this.dropped, droppedBy: { ...this.droppedBy }, stolen: this.stolen,
      played: { ...this.played }, mix: { ...this.mix }, heads: this.heads, excite: +this.excite.toFixed(3), murmur: this.murmur.map((m) => +m.g.gain.value.toFixed(4)),
      broadcast: this.bc ? +this.bc.level.gain.value.toFixed(4) : 0, jukebox: this.juke ? { on: this.juke.on, station: this.juke.radio.current?.call ?? null, gain: +this.juke.gain.gain.value.toFixed(3) } : null,
      freeway: this.hum ? +this.hum.gain.gain.value.toFixed(3) : 0, wet: this.wet ? +this.wet.gain.value.toFixed(3) : 0, levels: this.ctx ? this.levels() : null,
    };
  }
}
const _v = new THREE.Vector3(), _u = new THREE.Vector3();
const _best = new Int32Array(4), _bd = new Float64Array(4);
const noopEv = () => {};
/** vowels' first two formants (Hz): a voice's colour, no words */
const VOWELS: [number, number][] = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [640, 1190], [490, 1350]];
/** a hash in [0, 1) */
function rand01(x: number) { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
