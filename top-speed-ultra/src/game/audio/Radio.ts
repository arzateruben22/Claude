// The car radio: three fictional stations whose music is composed live in code (oscillators and noise), so there
// is nothing licensed, recorded or streamed. Each station has its own tempo, key, chords and drum pattern, and a
// little station ident when you tune in. Notes are scheduled a fraction of a second ahead on the audio clock.

export interface Station { id: string; call: string; freq: string; name: string; bpm: number; swing: number; root: number; chords: number[][]; style: 'pads' | 'synthwave' | 'lofi' }

export const STATIONS: Station[] = [
  // chord tones in semitones above the station's root (MIDI note); four bars, one chord a bar
  { id: 'coast', call: 'KCST', freq: '101.5', name: 'Coast', bpm: 86, swing: 0, root: 50, style: 'pads', chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]] },
  { id: 'freeway', call: 'KFWY', freq: '96.9', name: 'Freeway FM', bpm: 112, swing: 0, root: 45, style: 'synthwave', chords: [[0, 3, 7, 12], [8, 12, 15, 20], [3, 7, 10, 15], [10, 14, 17, 22]] },
  { id: 'canyon', call: 'KNYN', freq: '88.3', name: 'Canyon Radio', bpm: 76, swing: 0.18, root: 53, style: 'lofi', chords: [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 13, 16, 19]] },
];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class Radio {
  station = -1;                       // -1: off
  private out: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private next = 0;
  private seed = 1;

  constructor(private ctx: () => AudioContext | null, private bus: () => GainNode | null, private noise: () => AudioBuffer | null) {}

  get current() { return this.station >= 0 ? STATIONS[this.station] : null; }

  // next station (or off), returns its name for the toast
  cycle() { this.tune(this.station + 1 >= STATIONS.length ? -1 : this.station + 1); return this.current ? `${this.current.call} ${this.current.freq} · ${this.current.name}` : 'Radio off'; }

  tune(i: number) {
    const ctx = this.ctx(), bus = this.bus();
    this.stop();
    this.station = i;
    if (i < 0 || !ctx || !bus) return;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(bus);
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    this.step = 0; this.next = ctx.currentTime + 0.1; this.seed = 1 + i * 97;
    this.ident(ctx.currentTime + 0.05);
    const tick = () => { this.schedule(); this.timer = window.setTimeout(tick, 40); };
    tick();
  }

  stop() {
    clearTimeout(this.timer);
    const ctx = this.ctx();
    if (this.out && ctx) { const o = this.out; o.gain.setTargetAtTime(0, ctx.currentTime, 0.08); setTimeout(() => o.disconnect(), 600); }
    this.out = null;
  }

  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  // a three-note chime: the station's call sign, in music
  private ident(t: number) {
    const st = this.current!;
    [0, 7, 12].forEach((n, k) => this.tone(t + k * 0.13, hz(st.root + 24 + n), 0.5, 'sine', 0.16, 0.002, 0.45));
  }

  private schedule() {
    const ctx = this.ctx(), st = this.current;
    if (!ctx || !st || !this.out) return;
    const six = 60 / st.bpm / 4;                                  // a sixteenth note
    while (this.next < ctx.currentTime + 0.25) {
      const s = this.step % 64, bar = Math.floor(s / 16), pos = s % 16;
      const swing = pos % 2 === 1 ? st.swing * six : 0;
      this.play(st, bar, pos, this.next + swing, six);
      this.next += six; this.step++;
    }
  }

  private play(st: Station, bar: number, pos: number, t: number, six: number) {
    const ch = st.chords[bar], root = st.root;
    if (st.style === 'pads') {
      if (pos === 0) for (const n of ch) this.tone(t, hz(root + 12 + n), six * 16, 'sawtooth', 0.035, 0.6, 1.2, 900);
      if (pos === 0 || pos === 8) this.tone(t, hz(root - 12 + ch[0]), six * 7, 'sine', 0.22, 0.01, 0.2);
      if (pos === 0 || pos === 8) this.kick(t, 0.5);
      if (pos % 4 === 2) this.hat(t, 0.05);
      if (pos % 4 === 0 && this.rnd() < 0.45) this.tone(t, hz(root + 24 + ch[Math.floor(this.rnd() * 4)]), six * 3, 'triangle', 0.06, 0.005, 0.3);
    } else if (st.style === 'synthwave') {
      // a running sixteenth arpeggio, a pumping bass, four on the floor, a snare on two and four
      const arp = ch[[0, 1, 2, 3, 2, 1][pos % 6]];
      this.tone(t, hz(root + 24 + arp), six * 0.9, 'square', 0.045, 0.002, 0.08, 2600);
      if (pos % 2 === 0) this.tone(t, hz(root - 12 + ch[0] + (pos % 4 === 2 ? 12 : 0)), six * 1.6, 'sawtooth', 0.09, 0.003, 0.1, 700);
      if (pos === 0) for (const n of ch) this.tone(t, hz(root + 12 + n), six * 16, 'sawtooth', 0.025, 0.3, 0.8, 1400);
      if (pos % 4 === 0) this.kick(t, 0.75);
      if (pos === 4 || pos === 12) this.snare(t, 0.32);
      if (pos % 2 === 1) this.hat(t, 0.06);
    } else {
      // lo-fi: soft keys, a lazy boom-bap, vinyl hiss under it all
      if (pos === 0 || pos === 6 || pos === 10) for (const n of ch) this.tone(t + this.rnd() * 0.015, hz(root + 12 + n), six * 5, 'triangle', 0.05, 0.004, 0.6, 1800);
      if (pos === 0 || pos === 7 || pos === 10) this.tone(t, hz(root - 12 + ch[0]), six * 3, 'sine', 0.24, 0.01, 0.25);
      if (pos === 0 || pos === 10) this.kick(t, 0.6);
      if (pos === 4 || pos === 12) this.snare(t, 0.22);
      if (pos % 2 === 0) this.hat(t, 0.035);
      if (pos === 0 && bar === 0) this.crackle(t, six * 64);
    }
  }

  private tone(t: number, f: number, dur: number, type: OscillatorType, gain: number, attack: number, release: number, cutoff = 6000) {
    const ctx = this.ctx(); if (!ctx || !this.out) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur - release * 0.3), release / 3);
    o.connect(lp); lp.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + release * 2);
  }
  private kick(t: number, v: number) {
    const ctx = this.ctx(); if (!ctx || !this.out) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.35);
  }
  private burst(t: number, v: number, dur: number, type: BiquadFilterType, f: number) {
    const ctx = this.ctx(), nb = this.noise(); if (!ctx || !this.out || !nb) return;
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nb; src.playbackRate.value = 1.3; flt.type = type; flt.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.out); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  private snare(t: number, v: number) { this.burst(t, v, 0.18, 'bandpass', 1800); this.tone(t, 190, 0.08, 'triangle', v * 0.4, 0.001, 0.05); }
  private hat(t: number, v: number) { this.burst(t, v, 0.05, 'highpass', 7000); }
  private crackle(t: number, dur: number) { this.burst(t, 0.025, dur, 'highpass', 3500); }
}
