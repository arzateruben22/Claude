// compilation.mjs — a channel's latest episodes, piled into one long-form 16:9 video for YouTube.
//
//   node kits/cinema/film/compilation.mjs --channel films/channels/physics --episodes ep01,ep02,ep03,ep04 \
//        [--title "Everyday physics, slowed down"] [--thumb "Short thumbnail text"] [--name vol01]
//        [--out <channel>/compilations] [--cards-only] [--narration <dir>/narration.json] [--bridge 2]   (--bridge S: an S-second "Next: …" card between episodes, silent; default none)   (draws the cards and the thumbnail, then stops)
//        [--height 1440|1080] (default 1440) [--crf 15] [--max-mb 90]
//
// --raw: play each episode's pre-delivery master (<episode>/build/final/9x16/master-audio.mp4) instead of its delivered file, so social-only additions on the delivered file (a held end card with a follow line) stay out of the long video.
// Each episode's delivered 9:16 file (<episode>/out/*-9x16.mp4) plays whole, full height, in the middle
// of a 16:9 frame drawn in the channel's own theme (2560×1440 by default: YouTube is widely reported to give
// 1440p uploads its better encoder; the cards are drawn at that size, the episodes upscaled into the slot): the channel and the episode's title on the left,
// the chapter list on the right (the current one lit). A 4 s intro card (the channel's name, promise and
// the episodes' posters, over its sonic signature) opens it; an 8 s outro card closes it, with the right
// half left clear for YouTube's end-screen elements. Nothing is re-rendered: the episodes are the finals.
//
// The encode matches the episodes' delivery (x264 slow, CRF 15, aq-mode 3), its rate capped so the file stays
// under --max-mb (GitHub refuses files over 100 MB).
//
// Writes <out>/<name>/: <name>-16x9.mp4, thumbnail.jpg (1280×720), chapters.txt (YouTube chapters: the
// first at 0:00, each ≥ 10 s, so the intro belongs to chapter one and the outro to the last),
// description.md (ready to paste: chapters, every episode's sources from claims.json, the AI-voice
// label, credits) and qa.json (format, length, loudness and true peak measured on the file).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const argv = process.argv.slice(2), A = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) A[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const die = (m) => { console.error("compilation: " + m); process.exit(2); };
if (!A.channel || !A.episodes) die("usage: --channel <dir> --episodes ep01,ep02,… [--title T] [--name vol01] [--out DIR]");
const chan = path.resolve(A.channel), theme = JSON.parse(fs.readFileSync(path.join(chan, "theme.json"), "utf8"));
let INTRO = 4.0, OUTRO = 8.0;
const W = 1920, H = 1080, FPS = 30, SLOT = { x: 656, w: 608 };     // the layout, in CSS px at 1080
const OH = Number(A.height || 1440), S = OH / H, OW = Math.round(W * S);                      // the delivered frame
if (![1080, 1440].includes(OH)) die("--height is 1080 or 1440");
// --narration: an opening, a bridge between each pair of episodes and a finale, each a narrated card (the AI voice over the channel's music; the sentence on the card
// is the only text). narration.json: { segments: { opening, bridge1.., finale: { file, dur, sentences: [{ text, t0, t1 }] } } }; the files are relative to it.
const NARR = A.narration ? JSON.parse(fs.readFileSync(path.resolve(A.narration), "utf8")) : null, NDIR = A.narration ? path.dirname(path.resolve(A.narration)) : null;
const BR = Number(A.bridge || 0);                                                               // seconds of the card between two episodes (0: none)
const CRF = Number(A.crf ?? 15), MAX_MB = Number(A["max-mb"] || 90);
const SLOT_PX = { x: Math.round(SLOT.x * S), w: 2 * Math.round((OH * 9) / 16 / 2) };            // the episode, full height, 9:16
const run = (cmd, args, o = {}) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, ...o }); if (r.status !== 0) die(`${cmd} failed: ${(r.stderr || "").slice(-800)}`); return r.stdout; };
const probe = (f) => JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", f]));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = (s) => String(s || "").replace(/\*/g, "");
const ts = (t) => { const s = Math.floor(t + 1e-6), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + ":" + String(r).padStart(2, "0"); };

// ── the episodes ──────────────────────────────────────────────────────────────
if (NARR) { INTRO = NARR.segments.opening.dur + 1.2; OUTRO = Number(A.outro || 6); }
const eps = String(A.episodes).split(",").map((id, k) => {
  const dir = path.join(chan, id.trim()), film = JSON.parse(fs.readFileSync(path.join(dir, "film.json"), "utf8"));
  const out = path.join(dir, "out"), mp4 = fs.existsSync(out) && fs.readdirSync(out).find((f) => /-9x16\.mp4$/.test(f));
  if (!mp4) die(`${id}: no delivered episode in ${path.relative(repo, out)} (render and assemble its final first)`);
  const file = A.raw ? path.join(dir, "build/final/9x16/master-audio.mp4") : path.join(out, mp4), j = probe(file), v = j.streams.find((s) => s.codec_type === "video");
  if (v.width !== 1080 || v.height !== 1920) die(`${id}: ${mp4} is ${v.width}×${v.height}, not 1080×1920`);
  const claims = fs.existsSync(path.join(dir, "claims.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8")) : [];
  const series = plain(film.title && film.title.series) || "", num = (series.match(/(?:No\.|Season 2 · Episode)\s*\d+/) || [`No. ${String(k + 1).padStart(3, "0")}`])[0];
  return { id, dir, file, dur: Number(j.format.duration), title: plain(film.title && film.title.title) || id, num, claims,
    poster: path.join(out, mp4.replace(/\.mp4$/, ".jpg")) };
});
if (eps.length < 2) die("a compilation needs at least two episodes");
const BRS = eps.slice(1).map((_, i) => (NARR ? NARR.segments["bridge" + (i + 1)].dur + 1.0 : BR)), FIN = NARR ? NARR.segments.finale.dur + 1.2 : 0, BRSUM = BRS.reduce((a, b) => a + b, 0);
const name = A.name || `vol${String(Math.ceil(eps.length / 6)).padStart(2, "0")}`;
const outDir = path.resolve(A.out || path.join(chan, "compilations"), name), work = path.join(outDir, "work");
fs.mkdirSync(work, { recursive: true });
const title = A.title || `${theme.name}: ${eps.map((e) => e.title).slice(0, 2).join(", ")}${eps.length > 2 ? ` and ${eps.length - 2} more` : ""}`;

// ── the cards, drawn in the channel's theme by the browser ─────────────────────
const tok = theme.tokens || {}, roles = theme.roles || {};
const val = (v) => (typeof v === "string" && v in tok ? `var(--${v})` : String(v));
const fontUrl = (f) => pathToFileURL(path.resolve(chan, f.file)).href;
const css = `
${theme.fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("${fontUrl(f)}"); font-weight: ${f.weight}; font-style: ${f.style}; font-display: block; }`).join("\n")}
:root { ${Object.entries(tok).map(([k, v]) => `--${k}: ${v};`).join(" ")} ${Object.entries(roles).map(([k, v]) => `--hud-${k}: ${val(v)};`).join(" ")}
  --display: "${theme.type.display}", sans-serif; --text: "${theme.type.text}", sans-serif; --mono: "${theme.type.mono || theme.type.text}", monospace;
  --ink: var(--hud-text, var(--text-color, ${tok.text || "#fff"})); --ink2: ${tok["text-2"] || tok.text || "#aaa"}; --acc: var(--hud-accent, ${tok.text || "#fff"}); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { background: radial-gradient(1400px 900px at 50% 40%, ${tok["bg-hi"] || tok["cyc-hi"] || tok["void-top"] || tok.surface || tok.bg} 0%, ${tok.bg} 70%); color: ${tok.text}; font-family: var(--text); }
.slot { position: absolute; left: ${SLOT.x}px; top: 0; width: ${SLOT.w}px; height: ${H}px; background: #000; box-shadow: 0 0 60px rgba(0,0,0,.35); }
.left { position: absolute; left: 96px; top: 300px; width: 500px; }
.kick { font: 700 26px/1.2 var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--acc); }
.num { margin-top: 22px; font: 600 26px/1 var(--mono); color: ${tok["text-2"] || tok.text}; }
.t { margin-top: 18px; font: 700 62px/1.05 var(--display); letter-spacing: -.01em; text-wrap: balance; color: ${tok.text}; }
.of { margin-top: 26px; font: 500 24px/1.3 var(--text); color: ${tok["text-2"] || tok.text}; }
.right { position: absolute; left: 1324px; top: 300px; width: 500px; }
.hd { font: 600 22px/1 var(--text); letter-spacing: .12em; text-transform: uppercase; color: ${tok["text-2"] || tok.text}; margin-bottom: 26px; }
.row { display: flex; gap: 18px; align-items: baseline; padding: 14px 0 14px 22px; border-left: 5px solid transparent; font: 600 28px/1.25 var(--text); color: ${tok["text-2"] || tok.text}; }
.row b { font: 600 22px/1 var(--mono); min-width: 2.2em; }
.row.past { opacity: .55; } .row.now { color: ${tok.text}; border-left-color: var(--acc); }
.foot { position: absolute; left: 96px; bottom: 64px; font: 500 20px/1.3 var(--text); color: ${tok["text-2"] || tok.text}; }
.card { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 140px; }
.big { font: 700 112px/1.02 var(--display); letter-spacing: -.02em; color: ${tok.text}; max-width: 960px; text-wrap: balance; }
.prom { margin-top: 28px; font: 500 40px/1.3 var(--text); color: ${tok["text-2"] || tok.text}; max-width: 1100px; }
.meta { margin-top: 30px; font: 600 26px/1 var(--mono); color: var(--acc); }
.posters { position: absolute; right: 120px; top: 50%; transform: translateY(-50%); display: flex; gap: 22px; }
.posters img { width: 200px; height: 356px; object-fit: cover; border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.35); }
.pill { display: inline-block; margin-top: 40px; padding: 18px 34px; border-radius: 999px; background: var(--acc); color: ${tok.bg}; font: 700 30px/1 var(--text); align-self: flex-start; }
.thumb .big { font-size: 128px; max-width: 820px; }
.thumb .posters img { width: 240px; height: 427px; }
.thumb .posters img:nth-child(2) { transform: translateY(-26px); }
.line { margin-top: 30px; font: 700 76px/1.14 var(--display); letter-spacing: -.01em; max-width: 1500px; text-wrap: balance; color: ${tok.text}; }
`;
const rows = (k) => eps.map((e, i) => `<div class="row ${i < k ? "past" : i === k ? "now" : ""}"><b>${String(i + 1).padStart(2, "0")}</b><span>${esc(e.title)}</span></div>`).join("");
const minutes = Math.round((INTRO + OUTRO + BRSUM + FIN + eps.reduce((a, e) => a + e.dur, 0)) / 60);
const posters = (n) => `<div class="posters">${eps.slice(0, n).filter((e) => fs.existsSync(e.poster)).map((e) => `<img src="${pathToFileURL(e.poster).href}">`).join("")}</div>`;
const pages = {
  intro: `<div class="card"><p class="kick">${esc(theme.name)}</p><p class="big" style="margin-top:22px">${esc(title)}</p><p class="prom"${theme.compilation && theme.compilation.introPromiseWidth ? ` style="max-width:${+theme.compilation.introPromiseWidth}px"` : ""}>${esc(theme.promise || "")}</p><p class="meta">${eps.length} episodes · about ${minutes} min</p></div>${posters(3)}`,
  outro: `<div class="card"><p class="kick">${esc(theme.name)}</p><p class="big" style="margin-top:22px;max-width:900px">A new one every day.</p><p class="prom" style="max-width:820px">${esc(theme.promise || "")}</p><span class="pill">Subscribe</span></div>`,
  thumb: `<div class="card thumb"><p class="kick">${esc(theme.name)}</p><p class="big" style="margin-top:20px">${esc(A.thumb || title)}</p></div>${posters(3)}`,
};
eps.forEach((e, k) => { if (BR && k > 0) pages[`bridge${k}`] = `<div class="card"><p class="kick">${esc(theme.name)} · ${esc(e.num)}</p><p class="big" style="margin-top:22px;font-size:96px">${esc(e.title)}</p><p class="prom">Episode ${k + 1} of ${eps.length}</p></div>`; pages[`ep${k}`] = `<div class="slot"></div><div class="left"><p class="kick">${esc(theme.name)}</p><p class="num">${esc(e.num)}</p><p class="t">${esc(e.title)}</p><p class="of">Episode ${k + 1} of ${eps.length}</p></div><div class="right"><p class="hd">In this video</p>${rows(k)}</div><p class="foot">Narration: synthetic voice (AI)</p>`; });

if (NARR) for (const id of Object.keys(NARR.segments)) pages[`n-${id}-bg`] = `<div class="card"><p class="kick">${esc(theme.name)}</p><p class="line">&nbsp;</p></div>`;
if (NARR) for (const [id, sg] of Object.entries(NARR.segments)) sg.sentences.forEach((q, i) => { pages[`n-${id}-${i}`] = `<div class="card"><p class="kick">${esc(theme.name)}</p><p class="line">${esc(q.text)}</p></div>`; });
const pwDir = process.env.PLAYWRIGHT_DIR || path.dirname(run("npm", ["root", "-g"]).trim());
const { chromium } = createRequire(path.join(pwDir, "x.js"))("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
for (const [k, body] of Object.entries(pages)) {
  const thumb = k === "thumb", page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: S });   // drawn at the delivered size
  const html = path.join(work, `${k}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${body}</body>`);
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  await page.screenshot({ path: path.join(work, `${k}.png`) });
  await page.close();
  if (thumb) run("ffmpeg", ["-v", "error", "-y", "-i", path.join(work, "thumb.png"), "-vf", "scale=1280:720:flags=lanczos", "-q:v", "2", path.join(outDir, "thumbnail.jpg")]);
}
await browser.close();
if (A["cards-only"]) { console.log(`cards: ${path.relative(repo, work)}/*.png, ${path.relative(repo, outDir)}/thumbnail.jpg`); process.exit(0); }

// ── the sound for the cards: the channel's preset and sonic signature, through the studio ──
const preset = theme.preset || (fs.existsSync(path.join(chan, eps[0].id, "sheet.json")) ? JSON.parse(fs.readFileSync(path.join(chan, eps[0].id, "sheet.json"), "utf8")).preset : null);
const cardSound = (k, dur, energy, sigAt, voiceFile = null) => {
  const sheet = { duration: dur, fps: FPS, preset, sections: [{ id: k, t0: 0, t1: dur, energy }], events: sigAt === null ? [] : [{ t: sigAt, kind: "signature", tag: k }], voice: voiceFile ? [{ id: k, t: 0.6, file: voiceFile }] : [] };
  const sp = path.join(work, `${k}-sheet.json`), od = path.join(work, `${k}-audio`);
  fs.writeFileSync(sp, JSON.stringify(sheet));
  run("python3", ["-I", path.join(repo, "kits/cinema/studio/render.py"), sp, od]);
  return path.join(od, "mix.wav");
};
const nsound = (id, energy, sig) => (preset ? cardSound(id, NARR.segments[id].dur + (id === "opening" || id === "finale" ? 1.2 : 1.0), energy, sig, path.resolve(NDIR, NARR.segments[id].file)) : null);
const introWav = preset ? (NARR ? nsound("opening", 0.55, 0.3) : cardSound("intro", INTRO, 0.6, 0.5)) : null, outroWav = preset ? cardSound("outro", OUTRO, 0.4, 0.6) : null;
const bridgeWavs = NARR && preset ? BRS.map((_, i) => nsound("bridge" + (i + 1), 0.45, null)) : [], finaleWav = NARR && preset ? nsound("finale", 0.5, null) : null;

// ── the picture: segments encoded alike (picture only), then joined without re-encoding ──
const total = INTRO + OUTRO + BRSUM + FIN + eps.reduce((a, e) => a + e.dur, 0);
const capK = Math.floor((MAX_MB * 8e6) / total / 1000 - 400);                                 // kbps for the picture, room left for sound
const V = ["-c:v", "libx264", "-preset", "slow", "-crf", String(CRF), "-maxrate", `${capK}k`, "-bufsize", `${capK * 2}k`, "-x264-params", "aq-mode=3:deblock=-1,-1",
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(FPS), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"];
const card = (k, dur) => {
  const o = path.join(work, `seg-${k}.mp4`);
  run("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-t", String(dur), "-i", path.join(work, `${k}.png`), "-filter_complex",
    `[0:v]fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${dur - 0.4}:d=0.4[v]`, "-map", "[v]", "-an", "-t", String(dur), ...V, o]);
  return o;
};
const narrCard = (id, dur) => {                                  // a narrated card: each sentence fades up over the plain card as it is spoken (soft in and out), and the whole card pushes in slowly, so nothing sits still
  const o = path.join(work, `seg-${id}.mp4`), sg = NARR.segments[id], lst = path.join(work, `${id}-clips.txt`), rows = [], PUSH = 0.045, bg = path.join(work, `n-${id}-bg.png`);
  const L = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "0", "-pix_fmt", "yuv444p", "-r", String(FPS)];
  sg.sentences.forEach((q, i) => {
    const end = i + 1 < sg.sentences.length ? sg.sentences[i + 1].t0 + 0.6 : dur, start = i === 0 ? 0 : q.t0 + 0.6, d = Math.round((end - start) * FPS) / FPS, c = path.join(work, `${id}-clip${i}.mp4`);
    const fi = Math.min(0.4, d / 3), fo = Math.min(0.25, d / 4);
    run("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-t", d.toFixed(4), "-i", bg, "-loop", "1", "-t", d.toFixed(4), "-i", path.join(work, `n-${id}-${i}.png`), "-filter_complex",
      `[1:v]format=yuva444p,fade=t=in:st=0:d=${fi.toFixed(3)}:alpha=1,fade=t=out:st=${(d - fo).toFixed(3)}:d=${fo.toFixed(3)}:alpha=1[t];[0:v][t]overlay=format=auto,fps=${FPS},format=yuv444p[v]`, "-map", "[v]", "-an", ...L, c]);
    rows.push(`file '${c}'`);
  });
  fs.writeFileSync(lst, rows.join("\n") + "\n");
  const cat = path.join(work, `${id}-cat.mp4`);
  run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat]);
  run("ffmpeg", ["-v", "error", "-y", "-i", cat, "-filter_complex",
    `[0:v]scale=3840:2160:flags=lanczos,scale=w='3840*(1+${PUSH}*t/${dur})':h='2160*(1+${PUSH}*t/${dur})':eval=frame:flags=bicubic,crop=3840:2160,scale=${OW}:${OH}:flags=lanczos,fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${dur - 0.4}:d=0.4[v]`, "-map", "[v]", "-an", "-t", String(dur), ...V, o]);
  return o;
};
const segs = [NARR ? narrCard("opening", INTRO) : card("intro", INTRO)];
eps.forEach((e, k) => {
  const o = path.join(work, `seg-ep${k}.mp4`);
  run("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", path.join(work, `ep${k}.png`), "-i", e.file, "-filter_complex",
    `[0:v]fps=${FPS},format=yuv420p[bg];[1:v]scale=${SLOT_PX.w}:${OH}:flags=lanczos+accurate_rnd+full_chroma_int[ep];[bg][ep]overlay=${SLOT_PX.x}:0:shortest=1,format=yuv420p[v]`,
    "-map", "[v]", "-an", "-t", e.dur.toFixed(3), ...V, o]);
  segs.push(o);
  if (k < eps.length - 1) { if (NARR) segs.push(narrCard(`bridge${k + 1}`, BRS[k])); else if (BR) segs.push(card(`bridge${k + 1}`, BR)); }
});
if (NARR) segs.push(narrCard("finale", FIN));
segs.push(card("outro", OUTRO));
const list = path.join(work, "concat.txt"), final = path.join(outDir, `${name}-16x9.mp4`);
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join("\n") + "\n");

// ── the sound: one continuous track, encoded once ──────────────────────────────
// Joining separately encoded AAC segments leaves a jump at every seam (a +0.3 dBTP spike in one build); one track, the
// cards' music 4 dB under the episodes' mastered sound (a frame around speech, not the programme) and each episode's
// master decoded once, has no seams. One AAC encode can still overshoot a peak, so it is measured and trimmed under −1.
const inputs = [], parts = [];
const part = (src, dur, card) => {                     // src: a file, or a lavfi source for a card without music
  const i = parts.length;
  inputs.push(...(src.startsWith("anullsrc") ? ["-f", "lavfi", "-i", src] : ["-i", src]));
  parts.push(`[${i}:a:0]aformat=sample_rates=48000:channel_layouts=stereo${card ? `,volume=-4dB,afade=t=out:st=${dur - 0.5}:d=0.5` : ""},apad=whole_dur=${dur},atrim=0:${dur},asetpts=N/SR/TB[a${i}]`);
};
part(introWav || `anullsrc=r=48000:cl=stereo:d=${INTRO}`, INTRO, !NARR);
eps.forEach((e, k) => { part(e.file, +e.dur.toFixed(3), false); if (k < eps.length - 1) { if (NARR) part(bridgeWavs[k] || `anullsrc=r=48000:cl=stereo:d=${BRS[k]}`, BRS[k], false); else if (BR) part(`anullsrc=r=48000:cl=stereo:d=${BR}`, BR, true); } });
if (NARR) part(finaleWav || `anullsrc=r=48000:cl=stereo:d=${FIN}`, FIN, false);
part(outroWav || `anullsrc=r=48000:cl=stereo:d=${OUTRO}`, OUTRO, true);
const wavAll = path.join(work, "sound.wav"), m4a = path.join(work, "sound.m4a");
run("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", `${parts.join(";")};${parts.map((_, j) => `[a${j}]`).join("")}concat=n=${parts.length}:v=0:a=1[a]`,
  "-map", "[a]", "-c:a", "pcm_f32le", wavAll]);
const truePeak = (f) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const m = /Peak:\s+(-?[\d.]+|-inf) dBFS\s*$/m.exec(r.stderr.split("Summary:").pop() || "");
  return m ? Number(m[1]) : -99;
};
const encodeSound = (gainDb) => run("ffmpeg", ["-v", "error", "-y", "-i", wavAll, "-af", `volume=${gainDb.toFixed(2)}dB`, "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", m4a]);
encodeSound(0);
let tp = truePeak(m4a);
if (tp > -1.2) { encodeSound(-1.2 - tp); tp = truePeak(m4a); }
run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-i", m4a, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", final]);

// ── chapters, description, QA ──────────────────────────────────────────────────
const starts = [];
let t = INTRO;
eps.forEach((e, k) => { starts.push(t); t += e.dur + (k < eps.length - 1 ? BRS[k] : 0); });
starts[0] = 0;   // YouTube: the first chapter starts at 0:00 (the intro belongs to it); the outro belongs to the last
const chapters = eps.map((e, k) => `${ts(starts[k])} ${e.title}`).join("\n");
fs.writeFileSync(path.join(outDir, "chapters.txt"), chapters + "\n");
const srcs = eps.map((e, k) => {
  const seen = new Set(), items = [];
  for (const c of e.claims) if (c.source_url && !seen.has(c.source_url)) { seen.add(c.source_url); items.push(`- ${c.source_title}: ${c.source_url}`); }
  return `${String(k + 1).padStart(2, "0")} ${e.title}\n${items.join("\n") || "- (no claims ledger)"}`;
}).join("\n\n");
const families = [...new Set(theme.fonts.map((f) => f.family))].join(", ");
fs.writeFileSync(path.join(outDir, "description.md"), `${title}

${theme.promise || ""}

Chapters
${chapters}

Sources (every number in these episodes is checked against a source)
${srcs}

Narration is a synthetic voice (AI-generated). Music and sound design are original, made for ${theme.name}. Type: ${families} (SIL Open Font License).
TODO before posting: the channel handle and links, the expert sign-offs listed in each episode's review/HUMAN-REVIEW.md, and YouTube's altered/synthetic content setting.
`);
const pj = probe(final), vv = pj.streams.find((s) => s.codec_type === "video"), aa = pj.streams.find((s) => s.codec_type === "audio");
const loud = JSON.parse(run("python3", ["-I", "-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(repo, "kits/cinema"))}); from studio.master import measure_file; print(json.dumps(measure_file(${JSON.stringify(final)})))`]));
const dur = Number(pj.format.duration), short = eps.map((e, k) => (k + 1 < eps.length ? starts[k + 1] : dur) - starts[k]).filter((d) => d < 10);
const qa = { file: path.relative(repo, final), w: vv.width, h: vv.height, fps: vv.r_frame_rate, dur: +dur.toFixed(3), video_s: +Number(vv.duration).toFixed(3), audio_s: +Number(aa.duration).toFixed(3),
  size_mb: +(fs.statSync(final).size / 1e6).toFixed(1), ...loud, chapters: eps.length, chapters_under_10s: short.length,
  fails: [vv.width !== OW || vv.height !== OH ? `not ${OW}x${OH}` : null, fs.statSync(final).size > 95e6 ? "over 95 MB" : null, dur < 300 || dur > 660 ? `length ${ts(dur)} outside 5–11 min` : null,
    Math.abs(loud.lufs + 14) > 1.5 ? `loudness ${loud.lufs} LUFS` : null, loud.true_peak_db > -1 ? `true peak ${loud.true_peak_db} dBTP` : null,
    short.length ? "a chapter under 10 s" : null, Math.abs(Number(vv.duration) - Number(aa.duration)) > 0.1 ? "picture and sound lengths differ" : null].filter(Boolean) };
fs.writeFileSync(path.join(outDir, "qa.json"), JSON.stringify(qa, null, 1));
console.log(`${qa.file}: ${OW}×${OH}, ${ts(dur)} (${eps.length} episodes), ${qa.size_mb} MB · ${loud.lufs} LUFS, ${loud.true_peak_db} dBTP · ${qa.fails.length ? "FAIL: " + qa.fails.join("; ") : "PASS"}`);
console.log(chapters);
