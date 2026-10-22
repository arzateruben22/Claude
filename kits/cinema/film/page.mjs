// page.mjs — the film page (kits/cinema/film): page(scene, W, H, theme) → the HTML one frame is drawn on.
// Brand-neutral. Everything a channel owns (colours, faces, safe box, extra CSS) comes from its theme.json;
// everything an episode owns comes from its film folder (film.json, scene.mjs). Node only (it reads files).
//
// The page:
//   - a full-bleed stage (W × H px) with the WebGL canvas #gl and the overlay root #hud;
//   - the theme's faces as @font-face rules with absolute file:// URLs (from the channel's fonts/ folder),
//     each loaded up front (window.FONTS_READY), so the first frame never measures a fallback face;
//   - the theme's tokens as CSS custom properties (--<token>), its roles as --hud-<role>, and the faces
//     as --font-display / --font-text / --font-mono / --font-glyph;
//   - an import map, so a scene module can `import * as THREE from "three"` and import kit modules by
//     absolute URL as "cinema/<path under kits/cinema>" (e.g. "cinema/sci/hud.js");
//   - <base href> at the scene module's folder, so its relative imports resolve as they would on disk;
//   - window.W, window.H, window.FILM (film.json), window.THEME (tokens, the safe box for this aspect),
//     window.SCENE ({ id, dur, poster, shots }), window.M ({ t }: cinema3d.js reads M.t for its focus);
//   - the scene module itself, inline (render.mjs splices cinema3d.js into it first).
// The runtime the scene and the HUD share is ./runtime.js (seg, eases, presence/enter/leave, the shot
// stage), imported as "cinema/film/runtime.js". No Lumevina code, palette or type is used anywhere.
//
// theme.json (README.md has a full example):
//   { "id": "...", "tokens": { "bg": "#080A1C", "text": "#EEF0FF", ... },
//     "roles": { "accent": "teal", "plate": "rgba(21,26,61,.85)", "cap-lit": "teal", ... },  → --hud-<role>
//     "fonts": [{ "family": "Lexend", "file": "fonts/Lexend-var.woff2", "weight": "100 900", "style": "normal" }],
//     "type": { "display": "Unbounded", "text": "Lexend", "mono": "Martian Mono" },
//     "safe": { "9x16": { "x": [90, 900], "y": [250, 1420], "frame": [1080, 1920] } },
//     "captionY": { "9x16": 0.61 }, "css": "hud.css" }
//   Paths are relative to theme.json. A font file that is missing is left out (loadTheme reports it), and
//   the role falls back to the system-safe stack below, never to the box's generic sans-serif (on this
//   container fontconfig maps sans-serif and system-ui to Inter, which is Lumevina's face).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const KIT = path.resolve(here, "..");                                   // kits/cinema
export const THREE_FILE = path.join(KIT, "vendor/three.module.min.js");
export const RUNTIME_FILE = path.join(here, "runtime.js");
export const fileUrl = (p) => pathToFileURL(p).href;

// the system-safe stacks every role ends with (DejaVu ships with the container and with most Linux boxes)
const FALLBACK = {
  display: ['"DejaVu Sans"', '"Liberation Sans"', "sans-serif"],
  text: ['"DejaVu Sans"', '"Liberation Sans"', "sans-serif"],
  mono: ['"DejaVu Sans Mono"', '"Liberation Mono"', "monospace"],
  glyph: ['"DejaVu Sans"', "sans-serif"],
};
const DEFAULT_SAFE = {
  "9x16": { x: [90, 900], y: [250, 1420], frame: [1080, 1920] },   // TikTok / Reels / Shorts organic safe area
  "16x9": { x: [96, 1824], y: [54, 1026], frame: [1920, 1080] },   // 5% title-safe
};
const DEFAULT_CAPTION_Y = { "9x16": 0.61, "16x9": 0.78 };

export const loadTheme = (file) => {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")), dir = path.dirname(file);
  const fonts = [], missing = [];
  for (const f of raw.fonts || []) {
    const abs = path.resolve(dir, f.file);
    (fs.existsSync(abs) ? fonts : missing).push({ family: f.family, file: abs, weight: String(f.weight ?? "400"), style: f.style || "normal" });
  }
  const cssFile = raw.css ? path.resolve(dir, raw.css) : null;
  if (cssFile && !fs.existsSync(cssFile)) throw new Error(`theme ${file}: css file ${raw.css} does not exist`);
  for (const k of Object.keys(raw.tokens || {})) if (!/^[a-z][a-z0-9-]*$/i.test(k)) throw new Error(`theme ${file}: token name "${k}" is not a CSS identifier`);
  return { id: raw.id || path.basename(dir), name: raw.name || "", file, dir, tokens: raw.tokens || {}, roles: raw.roles || {}, type: raw.type || {},
    fonts, missing, cssFile, css: cssFile ? fs.readFileSync(cssFile, "utf8") : raw.cssText || "", safe: raw.safe || {}, captionY: raw.captionY || {} };
};

export const importMap = (extra = {}) => ({ imports: { three: fileUrl(THREE_FILE), "cinema/": fileUrl(KIT) + "/", ...extra } });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const json = (x) => JSON.stringify(x).replace(/</g, "\\u003c");          // safe inside <script>
const quote = (fam) => (/^["']/.test(fam) || /^[a-z-]+$/.test(fam) ? fam : `"${fam.replace(/"/g, "")}"`);
const stack = (v, role) => [...(Array.isArray(v) ? v : v ? [v] : []).map(quote), ...FALLBACK[role]].join(", ");

export const page = (scene, W, H, theme) => {
  const aspect = W >= H ? "16x9" : "9x16";
  const sb = (theme.safe && theme.safe[aspect]) || DEFAULT_SAFE[aspect], [fw, fh] = sb.frame || DEFAULT_SAFE[aspect].frame;
  const safe = { l: sb.x[0] / fw, r: sb.x[1] / fw, t: sb.y[0] / fh, b: sb.y[1] / fh };
  const captionY = (theme.captionY && theme.captionY[aspect]) ?? DEFAULT_CAPTION_Y[aspect];
  const tokens = theme.tokens || {};
  const roleVal = (v) => (typeof v === "string" && v in tokens ? `var(--${v})` : String(v));
  const faces = theme.fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("${fileUrl(f.file)}") format("${/\.woff2$/i.test(f.file) ? "woff2" : /\.woff$/i.test(f.file) ? "woff" : /\.otf$/i.test(f.file) ? "opentype" : "truetype"}"); font-weight: ${f.weight}; font-style: ${f.style}; font-display: block; }`).join("\n");
  const loads = theme.fonts.map((f) => `document.fonts.load(${json(`${f.style === "italic" ? "italic " : ""}${f.weight.split(/\s+/)[0]} 32px "${f.family}"`)})`).join(", ");
  const vars = [
    ...Object.entries(tokens).map(([k, v]) => `--${k}: ${v};`),
    ...Object.entries(theme.roles || {}).map(([k, v]) => `--hud-${k}: ${roleVal(v)};`),
    ...["display", "text", "mono", "glyph"].map((r) => `--font-${r}: ${stack(theme.type[r] || (r === "glyph" ? theme.type.text : null), r)};`),
  ].join("\n  ");
  const base = scene.base ? fileUrl(scene.base).replace(/\/?$/, "/") : null;
  const globals = { id: scene.id, dur: scene.dur, poster: scene.poster, shots: scene.shots };
  const themeOut = { id: theme.id, tokens, safe, captionY, aspect };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${base ? `<base href="${esc(base)}">` : ""}
<title>${esc(scene.id)}</title>
<script type="importmap">${json(importMap(scene.imports))}</script>
<style>
${faces}
:root {
  ${vars}
}
*, *::before, *::after { box-sizing: border-box; margin: 0; transition: none !important; animation: none !important; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--bg, #000); color: var(--text, #fff); font-family: var(--font-text);
  -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; font-kerning: normal; }
.stage { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--stage-bg, var(--bg, #000)); }
#gl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 1; }
svg text { font-family: var(--font-text); }
</style>
<style>${theme.css || ""}
${scene.css || ""}</style>
</head><body><div class="stage" id="stage"><canvas id="gl" width="${W}" height="${H}"></canvas>${scene.html || ""}<div id="hud"></div></div>
<script>
window.W = ${W}; window.H = ${H};
window.FILM = ${json(scene.film || {})};
window.THEME = ${json(themeOut)};
window.SCENE = ${json(globals)};
window.M = { t: 0 };
window.FONTS_READY = Promise.all([${loads}]).then(function () { return document.fonts.ready; });
</script>
<script type="module">${scene.module}</script>
</body></html>`;
};
