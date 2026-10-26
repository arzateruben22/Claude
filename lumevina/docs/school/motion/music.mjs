// Lumevina Skin School motion studio: the music bed under every lesson clip.
//
//   node docs/school/motion/music.mjs        (from lumevina/; needs ffmpeg)
//   → docs/school/motion/music/bed.m4a        48 s, calm and low, written to sit under on-screen words
//
// Original and synthesised here, so nothing is licensed: a slow four-chord loop in F (Fmaj9, Am7, Dm9,
// B♭maj9, eight seconds each, cross-faded), each chord a soft pad of slightly detuned sine voices with a
// little of the second and third harmonic, a round sine bass under it, a soft chime on a chord tone every
// few seconds, and a slow breath in the level. ffmpeg adds the room (a short echo cluster), trims the
// lows and highs, and sets the loudness soft (-20 LUFS): heard on a phone speaker, never loud.
// add-music.mjs lays it under the clips, faded in and out to each clip's length.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "music");
fs.mkdirSync(OUT, { recursive: true });

const SR = 44100, DUR = 48, N = SR * DUR, BAR = 8;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// voicings (MIDI): the pad, then the bass
const CHORDS = [
  { pad: [53, 57, 60, 64, 67], bass: 41 },   // Fmaj9
  { pad: [57, 60, 64, 67], bass: 45 },       // Am7
  { pad: [53, 57, 60, 64], bass: 38 },       // Dm9 (F A C E over D)
  { pad: [50, 53, 57, 60], bass: 34 }        // B♭maj9 (D F A C over B♭)
];
const TAU = Math.PI * 2;
const XF = 2.5;                                  // seconds of cross-fade between chords
const rc = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));
// a chord's envelope: up over XF before its bar starts, down over XF after it ends
const env = (t, k) => { const a = k * BAR - XF / 2, b = (k + 1) * BAR + XF / 2; return rc((t - a) / XF) * rc((b - t) / XF); };

const L = new Float32Array(N), R = new Float32Array(N);
// pad and bass
for (let k = 0; k * BAR < DUR; k++) {
  const c = CHORDS[k % CHORDS.length];
  const t0 = Math.max(0, Math.floor((k * BAR - XF) * SR)), t1 = Math.min(N, Math.ceil(((k + 1) * BAR + XF) * SR));
  for (let i = t0; i < t1; i++) {
    const t = i / SR, e = env(t, k);
    if (!e) continue;
    let l = 0, r = 0;
    c.pad.forEach((m, j) => {
      const f = hz(m), det = 1 + 0.0018 * (j % 2 ? 1 : -1), pan = 0.5 + 0.18 * Math.sin(j * 1.7);
      const v = Math.sin(TAU * f * t) + Math.sin(TAU * f * det * t + j) + 0.22 * Math.sin(TAU * 2 * f * t + 0.3 * j) + 0.06 * Math.sin(TAU * 3 * f * t);
      l += v * (1 - pan); r += v * pan;
    });
    const b = Math.sin(TAU * hz(c.bass) * t) + 0.15 * Math.sin(TAU * 2 * hz(c.bass) * t);
    const breath = 0.86 + 0.14 * Math.sin(TAU * t / 11);
    L[i] += e * breath * (0.05 * l + 0.09 * b);
    R[i] += e * breath * (0.05 * r + 0.09 * b);
  }
}
// chimes: a chord tone two octaves up, every 2.7 s, decaying over a couple of seconds
for (let n = 0, t = 1.6; t < DUR - 1; n++, t += 2.7) {
  const k = Math.floor(t / BAR) % CHORDS.length, pad = CHORDS[k].pad, f = hz(pad[(n * 3) % pad.length] + 24);
  const pan = 0.5 + 0.3 * Math.sin(n * 2.3);
  for (let i = Math.floor(t * SR), end = Math.min(N, Math.floor((t + 3.5) * SR)); i < end; i++) {
    const u = i / SR - t, a = Math.min(1, u / 0.006) * Math.exp(-u / 1.1);
    const v = a * (Math.sin(TAU * f * u) + 0.25 * Math.sin(TAU * 2.01 * f * u) * Math.exp(-u / 0.4));
    L[i] += 0.022 * v * (1 - pan); R[i] += 0.022 * v * pan;
  }
}
// 16-bit stereo WAV
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.7 / (peak || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4); }
const dry = path.join(OUT, ".dry.wav");
fs.writeFileSync(dry, buf);
// the room, the trims, the loudness
const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", dry,
  "-af", "aecho=0.8:0.55:47|83|131|197:0.32|0.24|0.18|0.12,highpass=f=55,lowpass=f=7000,loudnorm=I=-20:TP=-2:LRA=7",
  "-ar", "44100", "-c:a", "aac", "-b:a", "128k", path.join(OUT, "bed.m4a")], { stdio: "inherit" });
fs.unlinkSync(dry);
if (r.status !== 0) process.exit(r.status || 1);
console.log("music bed → docs/school/motion/music/bed.m4a", Math.round(fs.statSync(path.join(OUT, "bed.m4a")).size / 1024) + " KB");
