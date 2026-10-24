// clock.js — time warp for the science films (kits/cinema/sci). A plain ES module with no imports.
//
// The film plays at one rate (film time t, seconds of video). The thing being filmed runs on its own
// clock, scene time τ: a ball slowed ×20, a heartbeat at ×1/10, an orbit at ×10⁶, a freeze-frame.
// Playback-rate keys say how fast τ runs; τ(t) is their integral, worked out in closed form, so any
// frame can be sought on its own (no stepping, no state).
//
// clock(keys, opts) → C
//   keys: [{ t, rate, ramp = 0, curve = "auto", badge }], sorted by t (film seconds).
//     rate    scene seconds per film second from t on: 1 real time, 0.05 slowed ×20, 0 frozen, 1e6
//     ramp    seconds to blend from the previous rate to this one, starting at t (0 = a cut)
//     curve   how the rate blends: "log" (a constant factor per second, the natural blend between
//             1 and 1/20 or 10⁶), "lin", or "auto" (log when both rates are > 0, else lin)
//     badge   overrides the badge text for this key (null: no badge; a string: that text)
//   Before the first key, the first key's rate holds. Rates are never negative.
//   opts: { tau0 = 0 (τ at t = 0), words, round }
//     words   the badge wording: { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused",
//             normal: null }: plain words, the number first (hud.js lights it and picks the icon from
//             "faster" / "slower" / "paused"). A channel may word its own.
//
//   C.tau(t)      scene time at film time t
//   C.rate(t)     the playback rate at t (scene seconds per film second)
//   C.tOf(τ)      the first film time at which scene time reaches τ (sound cues for scene events:
//                 a bounce at τ = 0.452 s lands on the film frame C.tOf(0.452)). τ before the clock's
//                 start returns -Infinity; τ never reached returns Infinity
//   C.badge(t)    { text, t0, t1 } of the badge on screen at t, or null (real time). A badge holds
//                 from its key (the start of the ramp) to the next key with different wording
//   C.badges      every badge as { text, t0, t1 }, in order (for the HUD and the cue sheet)
//   C.segments    the pieces τ is integrated over: { t0, t1, r0, r1, curve, tau0, tau1 }
//
// rateText(rate, words) → the badge text for one rate, or null
// factor(n)             20 → "20", 2.5 → "2.5", 1000 → "1,000", 1e6 → "10⁶" (powers of ten from 10⁴ up)
// stopwatch(τ, o)       "0.452 s": o = { digits: 3, unit: " s", min: false } (min: "8:20" style)

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const commas = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const factor = (n) => {
  if (!(n > 0) || !Number.isFinite(n)) return String(n);
  const p = Math.log10(n), pr = Math.round(p);
  if (pr >= 4 && Math.abs(p - pr) < 1e-9) return "10" + String(pr).split("").map((c) => SUP[c]).join("");
  if (Math.abs(n - Math.round(n)) < 1e-9) return commas(String(Math.round(n)));
  return String(+n.toFixed(2));
};

export const WORDS = { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused", normal: null };
export const rateText = (rate, words = WORDS) => {
  const w = { ...WORDS, ...words };
  if (rate === 0) return w.freeze;
  if (Math.abs(rate - 1) < 1e-12) return w.normal;
  const tpl = rate < 1 ? w.slow : w.fast;
  return tpl == null ? null : tpl.replace("{n}", factor(rate < 1 ? 1 / rate : rate));
};

export const stopwatch = (tau, o = {}) => {
  const digits = o.digits ?? 3, unit = o.unit ?? " s";
  if (o.min) {
    const s = Math.max(0, tau), m = Math.floor(s / 60), r = s - m * 60;
    const rs = r.toFixed(digits), [a, b] = rs.split(".");
    return m + ":" + a.padStart(2, "0") + (b ? "." + b : "");
  }
  return tau.toFixed(digits) + unit;
};

// ∫ of the rate over one piece, from its start to u·d seconds in (u in [0, 1]); closed form for each curve
const area = (sg, u) => {
  const d = sg.t1 - sg.t0, { r0, r1 } = sg;
  if (d <= 0 || u <= 0) return 0;
  if (sg.curve === "log") {
    const k = Math.log(r1 / r0);
    return Math.abs(k) < 1e-12 ? r0 * d * u : (d * r0 * (Math.exp(k * u) - 1)) / k;
  }
  return d * (r0 * u + ((r1 - r0) * u * u) / 2);   // "lin", and a hold (r0 = r1)
};
// the inverse: how far into the piece (in seconds) its integral reaches a; null if it never does
const reach = (sg, a) => {
  const d = sg.t1 - sg.t0, { r0, r1 } = sg;
  if (a <= 0) return 0;
  if (a > sg.tau1 - sg.tau0 + 1e-12) return null;
  let u;
  if (sg.curve === "log" && Math.abs(Math.log(r1 / r0)) > 1e-12) {
    const k = Math.log(r1 / r0);
    u = Math.log(1 + (a * k) / (d * r0)) / k;
  } else if (Math.abs(r1 - r0) < 1e-15) {
    u = r0 > 0 ? a / (d * r0) : 0;
  } else {
    const A = (r1 - r0) / 2, B = r0, C = -a / d, disc = Math.max(0, B * B - 4 * A * C);
    u = (-B + Math.sqrt(disc)) / (2 * A);              // the root in [0, 1]: rates are never negative
    if (!(u >= 0)) u = (-B - Math.sqrt(disc)) / (2 * A);
  }
  return Math.min(d, Math.max(0, u * d));
};

export const clock = (keys, opts = {}) => {
  const ks = (keys && keys.length ? keys : [{ t: 0, rate: 1 }]).map((k) => ({ ramp: 0, curve: "auto", ...k })).sort((a, b) => a.t - b.t);
  for (const k of ks) if (!(k.rate >= 0) || !Number.isFinite(k.rate)) throw new Error(`clock: rate must be a finite number >= 0, not ${k.rate} (at t ${k.t})`);
  const tau0 = opts.tau0 ?? 0, words = { ...WORDS, ...(opts.words || {}) };
  // the pieces: before the first key, the first rate holds back to -∞; each key ramps from the rate
  // before it (over at most the gap to the next key), then holds until the next key
  const S = [];
  let rPrev = ks[0].rate;
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i], next = ks[i + 1] ? ks[i + 1].t : Infinity;
    const ramp = Math.max(0, Math.min(k.ramp, next - k.t));
    const curve = k.curve !== "auto" ? k.curve : rPrev > 0 && k.rate > 0 ? "log" : "lin";
    if (ramp > 0 && rPrev !== k.rate) S.push({ t0: k.t, t1: k.t + ramp, r0: rPrev, r1: k.rate, curve });
    else if (ramp > 0) S.push({ t0: k.t, t1: k.t + ramp, r0: k.rate, r1: k.rate, curve: "lin" });
    S.push({ t0: k.t + ramp, t1: next, r0: k.rate, r1: k.rate, curve: "lin" });
    rPrev = k.rate;
  }
  const head = { t0: -Infinity, t1: ks[0].t, r0: ks[0].rate, r1: ks[0].rate, curve: "lin" };
  // τ at each piece's start, anchored so that τ(0) = tau0
  let acc = 0;
  for (const sg of S) { sg.tau0 = acc; acc += sg.t1 === Infinity ? 0 : area(sg, 1); sg.tau1 = sg.t1 === Infinity ? Infinity : acc; }
  const raw = (t) => {
    if (t < ks[0].t) return -head.r0 * (ks[0].t - t);
    for (const sg of S) if (t < sg.t1) return sg.tau0 + (sg.t1 === Infinity ? sg.r0 * (t - sg.t0) : area(sg, (t - sg.t0) / (sg.t1 - sg.t0)));
    return S[S.length - 1].tau0;
  };
  const off = tau0 - raw(0);
  const tau = (t) => raw(t) + off;
  const rate = (t) => {
    if (t < ks[0].t) return ks[0].rate;
    for (const sg of S) if (t < sg.t1) {
      const u = sg.t1 === Infinity ? 0 : (t - sg.t0) / (sg.t1 - sg.t0);
      return sg.curve === "log" ? sg.r0 * Math.pow(sg.r1 / sg.r0, u) : sg.r0 + (sg.r1 - sg.r0) * u;
    }
    return ks[ks.length - 1].rate;
  };
  const tOf = (xs) => {
    const x = xs - off, first = 0;                    // in the pieces' own frame, where τ(first key) = 0
    if (x < first) return head.r0 > 0 ? ks[0].t - (first - x) / head.r0 : -Infinity;
    for (const sg of S) {
      if (sg.t1 === Infinity) return sg.r0 > 0 ? sg.t0 + (x - sg.tau0) / sg.r0 : x <= sg.tau0 + 1e-12 ? sg.t0 : Infinity;
      if (x <= sg.tau1 + 1e-12) { const dt = reach(sg, x - sg.tau0); if (dt != null) return sg.t0 + dt; }
    }
    return Infinity;
  };
  // badges: one per run of keys with the same wording, from the first key's t to the next change
  const badges = [];
  for (let i = 0; i < ks.length; i++) {
    const text = "badge" in ks[i] ? ks[i].badge : rateText(ks[i].rate, words);
    const t1 = ks[i + 1] ? ks[i + 1].t : Infinity, last = badges[badges.length - 1];
    if (text == null) continue;
    if (last && last.t1 === ks[i].t && last.text === text) last.t1 = t1;
    else badges.push({ text, t0: ks[i].t, t1 });
  }
  const badge = (t) => badges.find((b) => t >= b.t0 && t < b.t1) || null;
  return { tau, rate, tOf, badge, badges, segments: S.map((sg) => ({ ...sg, tau0: sg.tau0 + off, tau1: sg.tau1 + off })), keys: ks };
};
