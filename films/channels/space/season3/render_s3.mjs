// render_s3.mjs <timeline.json> <out.mp4> <W> <H> <fps> [from_s] [to_s]   — renders a timeline with the engine; picture only (the mix is added by assemble)
import fs from "node:fs"; import path from "node:path"; import { spawn, spawnSync } from "node:child_process"; import { createRequire } from "node:module"; import { pathToFileURL } from "node:url";
const [tlp, outp, WW, HH, FPS = "30", FROM, TO] = process.argv.slice(2);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");
const here = path.dirname(new URL(import.meta.url).pathname), art = path.join(repo, "films/channels/space/long01/art");
const TL = JSON.parse(fs.readFileSync(tlp, "utf8")), W = Number(WW), H = Number(HH), fps = Number(FPS), mode = TL.mode;
const theme = JSON.parse(fs.readFileSync(path.join(repo, "films/channels/space/theme.json"), "utf8"));
const fontCss = theme.fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("${pathToFileURL(path.resolve(repo, "films/channels/space", f.file)).href}"); font-weight: ${f.weight}; font-style: ${f.style}; font-display: block; }`).join("\n");
const eng = fs.readFileSync(path.join(here, "engine.js"), "utf8"); const port = mode === "port";
const css = `${fontCss} html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#0B0F2A} :root{--u:1px} #c{position:absolute;inset:0}
.hud{position:absolute;color:#EEF0FF;font-family:"${theme.type.text}",sans-serif}
#count{left:${port ? "50%" : "calc(70 * var(--u))"};top:${port ? "calc(150 * var(--u))" : "calc(64 * var(--u))"};${port ? "transform:translateX(-50%);text-align:center;" : ""}padding:calc(16 * var(--u)) calc(26 * var(--u));background:rgba(8,10,28,.78);border-radius:calc(22 * var(--u))}
#lab{font:700 calc(24 * var(--u))/1.1 "${theme.type.display}",sans-serif;letter-spacing:.14em;color:#4FE3C6;text-transform:uppercase}
#num{font:600 calc(${port ? 86 : 92} * var(--u))/1.05 "${theme.type.mono || theme.type.text}",monospace;margin-top:calc(8 * var(--u));white-space:nowrap}
#size{font:500 calc(28 * var(--u))/1.2 "${theme.type.text}",sans-serif;color:#B7BEEA;margin-top:calc(6 * var(--u))}
#badge{right:calc(${port ? 120 : 70} * var(--u));top:calc(${port ? 96 : 64} * var(--u));padding:calc(9 * var(--u)) calc(22 * var(--u));border-radius:999px;background:rgba(8,10,28,.78);border:calc(2 * var(--u)) solid rgba(79,227,198,.55);font:600 calc(24 * var(--u))/1 "${theme.type.text}",sans-serif;letter-spacing:.04em}
#cap{left:0;right:0;margin:0 auto;width:max-content;${port ? "top:calc(390 * var(--u));" : "bottom:calc(84 * var(--u));"}max-width:calc(${port ? 900 : 1700} * var(--u));text-align:center;padding:calc(20 * var(--u)) calc(34 * var(--u));border-radius:calc(22 * var(--u));background:rgba(8,10,28,.84);font:600 calc(${port ? 46 : 50} * var(--u))/1.28 "${theme.type.text}",sans-serif;opacity:0}`;
const assets = {}; for (const k of ["plate-beach", "beach-clean", "flood-clean", "figure-layer", "figure-layer-9x16", "beach-clean-9x16", "flood-clean-9x16", "moon-disc", "moon-disc-hi", "eclipse", "eclipse-9x16", "plate-ring", "plate-tonight", "plate-breakup"]) assets[k] = pathToFileURL(path.join(art, k + ".png")).href;
const HUDOFF = process.env.NOHUD ? ".hud{display:none!important}" : "";
const html = `<!doctype html><meta charset="utf-8"><style>${css}${HUDOFF}</style><canvas id="c"></canvas><div class="hud" id="count"><div id="lab">Moon distance</div><div id="num"></div><div id="size"></div></div><div class="hud" id="badge">Thought experiment</div><div class="hud" id="cap"></div><script>${eng}</script>`;
const hp = path.join(path.dirname(path.resolve(outp)), `.${path.basename(outp)}.html`); fs.mkdirSync(path.dirname(path.resolve(outp)), { recursive: true }); fs.writeFileSync(hp, html);
const pwDir = process.env.PLAYWRIGHT_DIR || path.dirname(spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim());
const { chromium } = createRequire(path.join(pwDir, "x.js"))("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined), args: ["--allow-file-access-from-files", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); page.on("pageerror", (e) => console.error("page error:", e.message)); page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto(pathToFileURL(hp).href); await page.evaluate(([tl, a, m, w, h]) => window.setup(tl, a, m, w, h), [TL, assets, mode, W, H]);
const t0 = FROM ? Number(FROM) : 0, t1 = TO ? Number(TO) : TL.dur, n0 = Math.round(t0 * fps), n1 = Math.round(t1 * fps);
const V = ["-c:v", "libx264", "-preset", "slow", "-crf", "15", "-x264-params", "aq-mode=3:deblock=-1,-1", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"];
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-an", ...V, outp], { stdio: ["pipe", "inherit", "inherit"] });
const t_start = Date.now();
for (let i = n0; i < n1; i++) {
  await page.evaluate((t) => window.renderAt(t), i / fps); const buf = await page.screenshot({ type: "jpeg", quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if ((i - n0) % 150 === 0) console.log(`frame ${i - n0}/${n1 - n0}  ${((Date.now() - t_start) / 1000 / Math.max(1, i - n0)).toFixed(2)} s/frame`);
}
ff.stdin.end(); await new Promise((r) => ff.on("close", r)); await browser.close(); console.log("done", outp);
