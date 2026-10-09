// Every sound is synthesized with the Web Audio API: there are no recordings to load.
// The engine is a V8 firing at 4 pulses per revolution: stacked saw and square voices through a soft clipper and a
// throttle-opened filter, with a lumpy idle, intake noise under load, pops on lift-off, a rev limiter and shift cuts.

import { clamp } from '../util';

export interface AudioState {
  rpm: number; throttle: number; speed: number; slip: number; limiter: boolean; scrape: number; cockpit: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode; private engineBus!: GainNode; private ambientBus!: GainNode;
  private voices: { osc: OscillatorNode; mult: number }[] = [];
  private lfo!: OscillatorNode; private lfoDepth!: GainNode; private am!: GainNode;
  private eng!: GainNode; private engFilter!: BiquadFilterNode; private cabin!: BiquadFilterNode;
  private intake!: BiquadFilterNode; private intakeGain!: GainNode;
  private turbo!: OscillatorNode; private turboGain!: GainNode;
  private roll!: GainNode; private rollF!: BiquadFilterNode;
  private screech!: GainNode; private wind!: GainNode; private windF!: BiquadFilterNode;
  private scrapeG!: GainNode;
  private noise!: AudioBuffer;
  private rainG: GainNode | null = null;
  private muffleF: BiquadFilterNode | null = null;
  musicBus: GainNode | null = null;
  get context() { return this.ctx; }
  get noiseBuffer() { return this.noise; }
  // 20 kHz is open; lower is muffled (Ultra Realism at speed)
  setMuffle(hz: number) { if (this.ctx && this.muffleF) this.muffleF.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.25); }
  setMusicVolume(v: number) { if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(v * 0.55, this.ctx.currentTime, 0.1); }
  setRain(w: number) { if (this.ctx && this.rainG) this.rainG.gain.setTargetAtTime(w * 0.16, this.ctx.currentTime, 0.4); }
  private lastThrottle = 0; private popT = 0; private limT = 0;
  vol = { master: 0.8, engine: 0.9, ambient: 0.7 };
  get ready() { return !!this.ctx; }

  // must be called from a click or key press (browsers only start audio on a gesture)
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    // Ultra Realism's muffling: everything outside the radio goes through this
    this.muffleF = ctx.createBiquadFilter(); this.muffleF.type = 'lowpass'; this.muffleF.frequency.value = 20000; this.muffleF.Q.value = 0.5; this.muffleF.connect(comp);
    this.master = ctx.createGain(); this.master.connect(this.muffleF);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.5; this.musicBus.connect(comp);
    this.engineBus = ctx.createGain(); this.engineBus.connect(this.master);
    this.ambientBus = ctx.createGain(); this.ambientBus.connect(this.master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }
    this.noise = buf;
    // engine
    this.cabin = ctx.createBiquadFilter(); this.cabin.type = 'lowpass'; this.cabin.frequency.value = 6000; this.cabin.connect(this.engineBus);
    this.eng = ctx.createGain(); this.eng.gain.value = 0; this.eng.connect(this.cabin);
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.Q.value = 0.9; this.engFilter.connect(this.eng);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve; shaper.connect(this.engFilter);
    this.am = ctx.createGain(); this.am.gain.value = 0.8; this.am.connect(shaper);
    const mix: [OscillatorType, number, number][] = [['sawtooth', 1, 0.34], ['sawtooth', 2.003, 0.12], ['square', 0.5, 0.2], ['sine', 0.25, 0.34], ['triangle', 3.01, 0.05]];
    for (const [type, mult, gain] of mix) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 60 * mult;
      const g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(this.am); o.start();
      this.voices.push({ osc: o, mult });
    }
    this.lfo = ctx.createOscillator(); this.lfo.type = 'triangle'; this.lfo.frequency.value = 8;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 0.25; this.lfo.connect(this.lfoDepth); this.lfoDepth.connect(this.am.gain); this.lfo.start();
    const loop = (filter: BiquadFilterNode, bus: AudioNode, gain = 0) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const g = ctx.createGain(); g.gain.value = gain; src.connect(filter); filter.connect(g); g.connect(bus); src.start(); return g;
    };
    this.intake = ctx.createBiquadFilter(); this.intake.type = 'bandpass'; this.intake.Q.value = 1.3;
    this.intakeGain = loop(this.intake, this.am);
    this.turbo = ctx.createOscillator(); this.turbo.type = 'sine'; this.turbo.frequency.value = 3000;
    this.turboGain = ctx.createGain(); this.turboGain.gain.value = 0; this.turbo.connect(this.turboGain); this.turboGain.connect(this.engineBus); this.turbo.start();
    // tyres, wind, freeway
    this.rollF = ctx.createBiquadFilter(); this.rollF.type = 'lowpass'; this.rollF.frequency.value = 500; this.roll = loop(this.rollF, this.ambientBus);
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1900; sf.Q.value = 5; this.screech = loop(sf, this.ambientBus);
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 600; this.windF.Q.value = 0.5; this.wind = loop(this.windF, this.ambientBus);
    const scf = ctx.createBiquadFilter(); scf.type = 'bandpass'; scf.frequency.value = 2600; scf.Q.value = 1.5; this.scrapeG = loop(scf, this.ambientBus);
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220; loop(hf, this.ambientBus, 0.05);   // the freeway's low hum
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2500; this.rainG = loop(rf, this.ambientBus, 0);   // rain on the roof
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.engineBus.gain.setTargetAtTime(this.vol.engine, t, 0.05);
    this.ambientBus.gain.setTargetAtTime(this.vol.ambient, t, 0.05);
  }

  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }
  silence() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const g of [this.eng, this.roll, this.screech, this.wind, this.scrapeG, this.turboGain, this.intakeGain]) g.gain.setTargetAtTime(0, t, 0.05); }

  update(dt: number, s: AudioState) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, k = 0.03;
    const f = (s.rpm / 60) * 4;                                  // V8 firing frequency
    for (const v of this.voices) v.osc.frequency.setTargetAtTime(f * v.mult, t, 0.012);
    this.lfo.frequency.setTargetAtTime(f / 4, t, 0.02);
    this.lfoDepth.gain.setTargetAtTime(0.28 * (1 - s.throttle * 0.7) * clamp(2500 / s.rpm, 0.2, 1), t, k);
    const load = clamp(s.throttle, 0, 1);
    this.engFilter.frequency.setTargetAtTime(380 + s.rpm * 0.32 + load * 3600, t, k);
    let gain = 0.18 + load * 0.42 + (s.rpm / 8000) * 0.18;
    // the limiter bounces the engine on and off
    if (s.limiter) { this.limT += dt; gain *= Math.floor(this.limT * 22) % 2 ? 0.25 : 1; }
    this.eng.gain.setTargetAtTime(gain, t, 0.015);
    this.intake.frequency.setTargetAtTime(f * 2.6, t, k);
    this.intakeGain.gain.setTargetAtTime(0.05 + load * 0.22, t, k);
    this.turbo.frequency.setTargetAtTime(1800 + s.rpm * 0.55, t, 0.08);
    this.turboGain.gain.setTargetAtTime(load * clamp((s.rpm - 2500) / 4000, 0, 1) * 0.012, t, 0.1);
    this.cabin.frequency.setTargetAtTime(s.cockpit ? 4200 : 9000, t, 0.2);
    // lift off from high revs: pops and crackles in the exhaust
    if (this.lastThrottle > 0.6 && s.throttle < 0.1 && s.rpm > 4200) this.popT = 0.9;
    this.lastThrottle = s.throttle;
    if (this.popT > 0) { this.popT -= dt; if (Math.random() < dt * 14) this.pop(0.18 + Math.random() * 0.3); }
    const v = s.speed;
    this.roll.gain.setTargetAtTime(clamp(v / 90, 0, 1) * 0.32, t, 0.1);
    this.rollF.frequency.setTargetAtTime(240 + v * 9, t, 0.1);
    this.screech.gain.setTargetAtTime(clamp((s.slip - 0.09) * 4, 0, 1) * clamp(v / 15, 0, 1) * 0.3, t, 0.05);
    this.wind.gain.setTargetAtTime(Math.pow(clamp(v / 90, 0, 1.2), 2) * 0.42, t, 0.1);
    this.windF.frequency.setTargetAtTime(300 + v * 14, t, 0.1);
    this.scrapeG.gain.setTargetAtTime(clamp(s.scrape, 0, 1) * 0.55, t, 0.03);
  }

  private burst(dur: number, filterType: BiquadFilterType, freq: number, gain: number, q = 1, sweepTo?: number, bus?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(bus || this.ambientBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', bus?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.ambientBus); o.start(t); o.stop(t + dur + 0.02);
  }

  pop(level: number) { this.burst(0.05, 'bandpass', 900 + Math.random() * 900, level, 1.2, undefined, this.engineBus); }
  shift() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.eng.gain.cancelScheduledValues(t); this.eng.gain.setValueAtTime(0.12, t);
    this.tone(70, 0.09, 0.25, 'sine', this.engineBus);
    this.pop(0.25);
  }
  passBy(rel: number, lateral: number, big: boolean) {
    const level = clamp((Math.abs(rel) / 40) * (3 / Math.max(1.5, lateral)), 0, 1) * 0.5;
    if (level < 0.03) return;
    this.burst(big ? 0.9 : 0.6, 'bandpass', big ? 900 : 1600, level, 0.8, big ? 220 : 380);
  }
  crash(intensity: number) {
    const k = clamp(intensity / 25, 0.15, 1);
    this.burst(0.7, 'lowpass', 2400, 0.9 * k, 0.7);
    this.tone(55, 0.35, 0.8 * k);
    for (const fq of [420, 690, 1130, 1790]) this.tone(fq * (0.9 + Math.random() * 0.2), 0.9, 0.06 * k, 'triangle');
  }
  thump(intensity: number) { this.tone(80, 0.15, clamp(intensity / 10, 0.05, 0.4)); this.burst(0.25, 'bandpass', 2600, clamp(intensity / 12, 0.05, 0.4), 1.5); }
}
