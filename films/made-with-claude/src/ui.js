/* ═══════════════════════════════════════════════════════════
   The editor UI — an original, generic motion-editor layout drawn in
   canvas 2D (references: layout + vocabulary only, no app branding).
   Coordinates are "UI px" on a 2400 × 1350 sheet; each panel is its
   own canvas (own pixel density) mapped onto a plane in the 3D slab.
   Every draw is a pure function of the per-frame UI state.
   ═══════════════════════════════════════════════════════════ */

export const C = {
  slab: "#161618", panel: "#232326", header: "#1d1d20", inset: "#141416", line: "#2e2e33", line2: "#38383e",
  text: "#c6c6ca", dim: "#8a8a91", faint: "#5e5e66", blue: "#2d8ceb", blueText: "#4da3ff", blueDeep: "#1d5fa8",
  coral: "#d97757", coralLight: "#f0a07a", white: "#f4efea",
  red: "#e05252", yellow: "#e8c547", teal: "#5fc2a8", violet: "#8e7cd6", sand: "#c9a57a"
};

export const PANELS = {
  menu:     { x: 0,    y: 0,   w: 2400, h: 88,  density: 3 },
  project:  { x: 0,    y: 88,  w: 560,  h: 672, density: 2 },
  viewer:   { x: 560,  y: 88,  w: 1140, h: 672, density: 2.5 },
  right:    { x: 1700, y: 88,  w: 700,  h: 672, density: 3 },
  timeline: { x: 0,    y: 760, w: 2400, h: 590, density: 3 },
  timecode: { x: 14,   y: 798, w: 300,  h: 40,  density: 3, overlay: true }
};

// Comp (the 1920×1080 composition) inside the viewer panel, in UI px.
export const COMP = { x: 610, y: 132, w: 1040, h: 585 };
// Timeline geometry (UI px)
export const TL = {
  left: 1080, right: 2370, rulerY: 812, rowH: 34, firstRow: 878,
  rows: ["title", "transform", "position", "scale", "spark", "swoosh", "clawd", "bg"]
};
export function rowY(name) { return TL.firstRow + TL.rows.indexOf(name) * TL.rowH + TL.rowH / 2; }

const LAYERS = [
  { n: 1, name: "MADE WITH CLAUDE", icon: "T", color: C.red, row: "title" },
  { n: 2, name: "Spark", icon: "★", color: C.yellow, row: "spark" },
  { n: 3, name: "Swoosh", icon: "★", color: C.teal, row: "swoosh" },
  { n: 4, name: "clawd.png", icon: "▣", color: C.violet, row: "clawd" },
  { n: 5, name: "BG Solid", icon: "■", color: C.sand, row: "bg" }
];

// The sprite: 12 × 8 pixels. X = body, E = eye, . = empty
export const SPRITE = [
  "..XXXXXXXX..",
  "..XXXXXXXX..",
  "..XEXXXXEX..",
  "XXXEXXXXEXXX",
  "..XXXXXXXX..",
  "..XXXXXXXX..",
  "..X.X..X.X..",
  "..X.X..X.X.."
];
export const SPRITE_PX = 12;     // UI px per sprite pixel
// title lockup per format: one line in 16:9; stacked MADE WITH / CLAUDE in 9:16, so the portrait end card
// can frame it from ~1.5× closer (bigger type, bigger mascot). y values are offsets from the title anchor.
const FULL_TITLE = "MADE WITH CLAUDE";
const LAYOUTS = {
  wide: { lines: [{ from: 0, to: 16, size: 78, y: 0 }], sparkY: -128, swooshY: 64, opusY: 126, opusSize: 44 },
  tall: { lines: [{ from: 0, to: 9, size: 88, y: -50 }, { from: 10, to: 16, size: 128, y: 62 }], sparkY: -182, swooshY: 144, opusY: 206, opusSize: 54 }
};
let LAYOUT = LAYOUTS.wide;
export function setFormat(fmt) { LAYOUT = fmt === "9x16" ? LAYOUTS.tall : LAYOUTS.wide; }
function lineWidth(ctx, L) {
  font(ctx, L.size, 800, "Montserrat"); ctx.letterSpacing = "2px";
  return ctx.measureText(FULL_TITLE.slice(L.from, L.to)).width;
}
// title + OPUS extents in UI px, measured with the drawing fonts (QA probes use the real glyph boxes):
// title = the whole lockup, titleCap = the line with the smallest capitals (the readability floor)
export function titleMetrics() {
  const ctx = document.createElement("canvas").getContext("2d");
  const cx = COMP.x + COMP.w / 2, cy = COMP.y + COMP.h / 2 - 18;
  const ws = LAYOUT.lines.map((L) => lineWidth(ctx, L) - 2);
  const top = Math.min(...LAYOUT.lines.map((L) => L.y - L.size * 0.35)), bot = Math.max(...LAYOUT.lines.map((L) => L.y + L.size * 0.35));
  const small = LAYOUT.lines.reduce((a, L, i) => (L.size < LAYOUT.lines[a].size ? i : a), 0);
  font(ctx, LAYOUT.opusSize, 600, "Montserrat"); ctx.letterSpacing = "16px";
  const ow = ctx.measureText("OPUS 5.5").width - 16;
  return {
    title: { cx, cy: cy + (top + bot) / 2, w: Math.max(...ws), cap: bot - top },
    titleCap: { cx, cy: cy + LAYOUT.lines[small].y, w: ws[small], cap: LAYOUT.lines[small].size * 0.7 },
    opus: { cx: cx + 8, cy: cy + LAYOUT.opusY, w: ow, cap: LAYOUT.opusSize * 0.7 }
  };
}

/* ─── drawing helpers ─── */

function font(ctx, size, weight = 400, family = "Inter", italic = false) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px "${family}"`;
}
function text(ctx, s, x, y, o = {}) {
  font(ctx, o.size || 14, o.w || 400, o.family || "Inter", o.italic);
  ctx.fillStyle = o.c || C.text;
  ctx.textAlign = o.align || "left";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = (o.ls || 0) + "px";
  ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = "0px";
  return w;
}
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function rrect(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, c, lw = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke();
}
function tabs(ctx, x, y, items) {
  let cx = x;
  items.forEach((it) => {
    const w = text(ctx, it.label, cx, y, { size: it.size || 14, w: it.active ? 600 : 400, c: it.active ? C.text : C.dim });
    let ex = cx + w;
    if (it.sub) ex += 8 + text(ctx, it.sub, cx + w + 8, y, { size: it.size || 14, w: 500, c: C.blueText });
    if (it.menu) { text(ctx, "≡", ex + 8, y, { size: 14, c: C.dim }); ex += 22; }
    if (it.active) rect(ctx, cx, y + 13, ex - cx, 2.5, C.blue);
    cx = ex + 34;
  });
}

/* ─── icons (simple line art, 24 × 24 box centred at x,y) ─── */

function icon(ctx, kind, x, y, c = C.text, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const P = (pts, close) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (close) ctx.closePath(); ctx.stroke(); };
  switch (kind) {
    case "home": P([[-8, 0], [0, -8], [8, 0]]); P([[-6, -1], [-6, 8], [6, 8], [6, -1]]); break;
    case "select": ctx.beginPath(); ctx.moveTo(-5, -9); ctx.lineTo(6, 2); ctx.lineTo(0, 2); ctx.lineTo(3, 9); ctx.lineTo(0, 9); ctx.lineTo(-2, 4); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); break;
    case "hand": P([[-5, 8], [-7, 0], [-6, -2], [-4, 1]]); P([[-4, 1], [-4, -7]]); P([[-1, 0], [-1, -9]]); P([[2, 0], [2, -8]]); P([[5, 1], [5, -5]]); P([[5, 1], [5, 4], [2, 8], [-5, 8]]); break;
    case "zoom": ctx.beginPath(); ctx.arc(-2, -2, 6, 0, 7); ctx.stroke(); P([[3, 3], [8, 8]]); P([[-5, -2], [1, -2]]); P([[-2, -5], [-2, 1]]); break;
    case "rotate": ctx.beginPath(); ctx.arc(0, 0, 7, -2.6, 2.2); ctx.stroke(); P([[-6, -8], [-6, -3], [-1, -3]]); break;
    case "camera": rrect(ctx, -9, -5, 13, 10, 2, null, c, 1.8); P([[4, -2], [9, -5], [9, 5], [4, 2]]); break;
    case "pan": ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.stroke(); P([[0, -10], [0, 10]]); P([[-10, 0], [10, 0]]); break;
    case "rect": rrect(ctx, -9, -6, 18, 12, 1, null, c, 1.8); break;
    case "pen": P([[0, -9], [6, 3], [0, 9], [-6, 3]], true); P([[0, -2], [0, 9]]); break;
    case "text": font(ctx, 22, 500); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("T", 0, 1); break;
    case "brush": P([[-8, 8], [-3, 3]]); P([[-3, 3], [7, -7]]); ctx.beginPath(); ctx.arc(-6, 6, 3, 0, 7); ctx.fill(); break;
    case "stamp": P([[-3, -8], [3, -8], [2, 0], [8, 2], [8, 6], [-8, 6], [-8, 2], [-2, 0]], true); P([[-8, 9], [8, 9]]); break;
    case "eraser": P([[-8, 4], [2, -6], [8, 0], [-2, 10], [-8, 4]]); P([[-3, -1], [3, 5]]); break;
    case "roto": ctx.beginPath(); ctx.arc(-2, -2, 5, 0, 7); ctx.stroke(); P([[2, 2], [8, 8]]); P([[-9, 7], [-4, 2]]); break;
    case "pin": P([[0, -8], [0, 3]]); P([[-6, -4], [6, -4]]); P([[-4, 8], [0, 3], [4, 8]]); break;
    case "search": ctx.beginPath(); ctx.arc(-2, -2, 5.5, 0, 7); ctx.stroke(); P([[2, 2], [7, 7]]); break;
    case "eye": ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill(); break;
    case "grid": rrect(ctx, -9, -7, 18, 14, 1, null, c, 1.6); P([[0, -7], [0, 7]]); P([[-9, 0], [9, 0]]); break;
    case "region": ctx.setLineDash([3, 3]); rrect(ctx, -8, -7, 16, 14, 1, null, c, 1.6); ctx.setLineDash([]); break;
    case "target": ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.stroke(); break;
    case "exposure": ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 8, -Math.PI / 2, Math.PI / 2); ctx.fill(); break;
    case "folder": P([[-9, -6], [-3, -6], [-1, -3], [9, -3], [9, 7], [-9, 7]], true); break;
    case "fx": font(ctx, 15, 600, "Inter", true); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("fx", 0, 1); break;
    case "tri": ctx.beginPath(); ctx.moveTo(-7, 6); ctx.lineTo(0, -7); ctx.lineTo(7, 6); ctx.closePath(); ctx.stroke(); break;
    case "sq": rrect(ctx, -6, -6, 12, 12, 1, null, c, 1.8); break;
    case "circ": ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.stroke(); break;
    case "curve": ctx.beginPath(); ctx.moveTo(-7, 5); ctx.quadraticCurveTo(0, -10, 7, 5); ctx.stroke(); break;
    case "play": ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(8, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); break;
    case "first": rect(ctx, -8, -7, 2.5, 14, c); ctx.beginPath(); ctx.moveTo(7, -7); ctx.lineTo(-4, 0); ctx.lineTo(7, 7); ctx.closePath(); ctx.fill(); break;
    case "last": rect(ctx, 5.5, -7, 2.5, 14, c); ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(4, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); break;
    case "prev": ctx.beginPath(); ctx.moveTo(5, -7); ctx.lineTo(-6, 0); ctx.lineTo(5, 7); ctx.closePath(); ctx.fill(); break;
    case "next": ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(6, 0); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); rect(ctx, 6, -7, 2.2, 14, c); break;
    case "trash": P([[-6, -5], [-5, 8], [5, 8], [6, -5]]); P([[-8, -5], [8, -5]]); P([[-2, -8], [2, -8]]); break;
    default: break;
  }
  ctx.restore();
}

/* ─── panels ─── */

const TOOLS = ["home", "select", "hand", "zoom", "rotate", "camera", "pan", "rect", "pen", "text", "brush", "stamp", "eraser", "roto", "pin"];
const MENUS = ["File", "Edit", "Composition", "Layer", "Effect", "Animation", "View", "Window", "Help"];

function drawMenu(ctx, P, s, tlj) {
  rect(ctx, 0, 0, P.w, P.h, C.header);
  rect(ctx, 0, 34, P.w, 54, "#202023");
  line(ctx, 0, 34, P.w, 34, C.line);
  line(ctx, 0, 87, P.w, 87, C.inset, 2);
  let x = 40;
  MENUS.forEach((m) => { x += text(ctx, m, x, 17, { size: 15, c: C.text }) + 34; });
  // workspaces (right)
  let wx = 1700;
  [["Default", true], ["Review"], ["Learn"], ["Standard"], ["Small Screen"], ["Libraries"]].forEach(([w, a]) => {
    const tw = text(ctx, w, wx, 17, { size: 14, c: a ? C.blueText : C.dim, w: a ? 600 : 400 });
    if (a) rect(ctx, wx, 30, tw, 2, C.blue);
    wx += tw + 30;
  });
  icon(ctx, "search", 2360, 17, C.dim, 0.8);
  // toolbar
  const tb = tlj.ui.toolbar;
  TOOLS.forEach((k, i) => {
    const cx = tb.u0 + i * tb.step, cy = tb.v;
    const p = s.pressed.reduce((m, q) => (Math.abs(q.u - cx) < tb.step / 2 ? Math.max(m, q.amt) : m), 0);
    if (i === 1 || p > 0) {
      rrect(ctx, cx - 22, cy - 19, 44, 38, 5, p > 0 ? `rgba(45,140,235,${0.35 + 0.6 * p})` : "#2f3a48");
    }
    icon(ctx, k, cx, cy, p > 0.5 ? "#ffffff" : C.text, 1.05);
    if ([5, 7, 9, 10].includes(i)) { rect(ctx, cx + 14, cy + 13, 3, 3, C.dim); }
  });
  let fx = tb.u0 + TOOLS.length * tb.step + 40;
  rrect(ctx, fx, 52, 18, 18, 2, null, C.text, 1.6); fx += 26;
  fx += text(ctx, "Fill", fx, 61, { size: 14 }) + 12;
  rrect(ctx, fx, 51, 34, 20, 2, C.coral); fx += 48;
  fx += text(ctx, "Stroke", fx, 61, { size: 14 }) + 12;
  rrect(ctx, fx, 51, 34, 20, 2, null, C.text, 2.5); fx += 48;
  fx += text(ctx, "2 px", fx, 61, { size: 14 }) + 26;
  text(ctx, "Add: ▸", fx, 61, { size: 14, c: C.dim });
  // snapping
  text(ctx, "Snapping", 2240, 61, { size: 13, c: C.dim });
}

function drawProject(ctx, P) {
  rect(ctx, 0, 0, P.w, P.h, C.panel);
  rect(ctx, 0, 0, P.w, 36, C.header);
  tabs(ctx, 22, 18, [{ label: "Project", active: true, menu: true }, { label: "Effect Controls clawd.png" }]);
  // thumbnail + info
  rrect(ctx, 22, 54, 92, 52, 3, "#2a1c16");
  drawSprite(ctx, 68, 80, 4.2, 1);
  text(ctx, "Main Comp ▾, used 1 time", 132, 62, { size: 14, w: 500 });
  text(ctx, "1920 x 1080 (1.00)", 132, 82, { size: 13, c: C.dim });
  text(ctx, "Δ 0;00;12;00, 30.00 fps", 132, 100, { size: 13, c: C.dim });
  rrect(ctx, 18, 124, P.w - 36, 26, 4, C.inset);
  icon(ctx, "search", 36, 137, C.dim, 0.7);
  text(ctx, "Search", 54, 137, { size: 13, c: C.faint });
  // headers
  line(ctx, 0, 166, P.w, 166, C.line);
  text(ctx, "Name", 52, 182, { size: 13, c: C.dim });
  text(ctx, "Type", 300, 182, { size: 13, c: C.dim });
  text(ctx, "Size", 470, 182, { size: 13, c: C.dim });
  line(ctx, 0, 198, P.w, 198, C.line);
  const rows = [["Main Comp", "Composition", "", C.violet, true], ["clawd.png", "PNG file", "38 KB", C.violet], ["Solids", "Folder", "", C.yellow], ["spark.svg", "Vector", "4 KB", C.faint]];
  rows.forEach(([n, ty, sz, col, sel], i) => {
    const y = 216 + i * 30;
    if (sel) rect(ctx, 0, y - 14, P.w, 28, "#2c3442");
    rrect(ctx, 22, y - 6, 16, 12, 2, col);
    text(ctx, n, 52, y, { size: 14, c: sel ? "#e6e6ea" : C.text });
    rect(ctx, 278, y - 5, 12, 10, col);
    text(ctx, ty, 300, y, { size: 13, c: C.dim });
    text(ctx, sz, 470, y, { size: 13, c: C.dim });
  });
  line(ctx, 0, P.h - 36, P.w, P.h - 36, C.line);
  ["sq", "folder", "grid", "trash"].forEach((k, i) => icon(ctx, k, 30 + i * 36, P.h - 18, C.dim, 0.75));
  text(ctx, "8 bpc", P.w - 22, P.h - 18, { size: 13, c: C.dim, align: "right" });
}

export function drawSprite(ctx, cx, cy, px, alpha, squash = 0) {
  const w = SPRITE[0].length, h = SPRITE.length;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy + (h * px) / 2);
  ctx.scale(1 + squash * 0.28, 1 - squash * 0.28);
  ctx.translate(0, -(h * px) / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = SPRITE[j][i];
    if (ch === ".") continue;
    ctx.fillStyle = ch === "E" ? "#1a0f0b" : C.coral;
    ctx.fillRect((i - w / 2) * px, (j - h / 2) * px, px + 0.4, px + 0.4);
  }
  ctx.restore();
}

function starburst(ctx, x, y, r, rot, color, glow) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = "rgba(240,140,100,0.9)"; ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  const n = 12;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.22 : r * (i % 4 === 0 ? 1 : 0.78);
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawViewer(ctx, P, s) {
  rect(ctx, 0, 0, P.w, P.h, C.panel);
  rect(ctx, 0, 0, P.w, 36, C.header);
  const o = { x: P.x, y: P.y };
  tabs(ctx, 22, 18, [{ label: "Composition", sub: "Main Comp", active: true, menu: true }, { label: "Layer (none)" }, { label: "Footage (none)" }]);
  text(ctx, "Main Comp", 22, 40, { size: 11, c: C.blueText });
  // comp
  const cx0 = COMP.x - o.x, cy0 = COMP.y - o.y, cw = COMP.w, ch = COMP.h;
  rect(ctx, cx0 - 2, cy0 - 2, cw + 4, ch + 4, "#0c0c0d");
  ctx.save();
  ctx.beginPath(); ctx.rect(cx0, cy0, cw, ch); ctx.clip();
  const v = s.viewer;
  const g = ctx.createRadialGradient(cx0 + cw / 2, cy0 + ch * 0.48, 10, cx0 + cw / 2, cy0 + ch / 2, cw * 0.62);
  g.addColorStop(0, `rgb(${30 + 18 * v.bgWarm},${17 + 8 * v.bgWarm},${12 + 4 * v.bgWarm})`);
  g.addColorStop(1, "#0b0706");
  ctx.fillStyle = g; ctx.fillRect(cx0, cy0, cw, ch);
  const mx = cx0 + cw / 2, my = cy0 + ch / 2;

  if (v.sprite > 0) {
    ctx.save(); ctx.shadowColor = "rgba(240,140,100,0.85)"; ctx.shadowBlur = 16;
    drawSprite(ctx, COMP.x + COMP.w / 2 - o.x, COMP.y + COMP.h / 2 - 0.5 - o.y, SPRITE_PX, v.sprite, v.wiggle);
    ctx.restore();
    // selection box + handles
    const bw = SPRITE[0].length * SPRITE_PX + 8, bh = SPRITE.length * SPRITE_PX + 8;
    ctx.globalAlpha = v.sprite;
    ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5;
    ctx.strokeRect(mx - bw / 2, my - bh / 2, bw, bh);
    [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].forEach(([a, b]) => {
      ctx.fillStyle = C.blue; ctx.fillRect(mx + (a * bw) / 2 - 3.5, my + (b * bh) / 2 - 3.5, 7, 7);
    });
    ctx.globalAlpha = 1;
  }

  if (v.crack > 0) {
    ctx.globalAlpha = v.crack;
    const f = ctx.createRadialGradient(mx, my, 0, mx, my, 360);
    f.addColorStop(0, "rgba(255,240,225,0.95)"); f.addColorStop(0.25, "rgba(240,160,120,0.45)"); f.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = f; ctx.fillRect(cx0, cy0, cw, ch);
    ctx.globalAlpha = 1;
  }

  // title card
  const T = v.title;
  if (T.chars > 0) {
    const scale = (1 + 0.06 * T.scalePop) * (1 + 0.012 * T.breathe);
    const lift = 18 * (1 - T.settle);
    ctx.save();
    ctx.translate(mx, my - 18 + lift);
    ctx.scale(scale, scale);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const glowA = T.glow;
    let fw = 0, caret = null;
    for (const L of LAYOUT.lines) {
      const lw = lineWidth(ctx, L);                          // also sets the line's font
      fw = Math.max(fw, lw);
      const shown = FULL_TITLE.slice(L.from, Math.min(L.to, T.chars));
      if (T.chars >= L.from && T.chars <= L.to) caret = { x: -lw / 2 + ctx.measureText(shown).width + 4, L };
      if (!shown) continue;
      if (glowA > 0) {
        ctx.shadowColor = `rgba(255,214,190,${0.72 * glowA})`;
        ctx.shadowBlur = (18 + 12 * glowA + 4 * T.breathe) * (L.size / 78);
        ctx.fillStyle = C.white;
        ctx.fillText(shown, -lw / 2, L.y);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = glowA > 0 ? "#fbf6f1" : "#d8d3cf";
      ctx.fillText(shown, -lw / 2, L.y);
    }
    if (T.chars < FULL_TITLE.length && T.caret && caret) {
      const ch = caret.L.size * 0.87;
      rect(ctx, caret.x, caret.L.y - ch / 2, 4, ch, C.blueText);
    }
    ctx.letterSpacing = "0px";
    // spark
    if (T.spark > 0) {
      const k = T.spark;
      starburst(ctx, 0, LAYOUT.sparkY, 46 * k, (1 - k) * 1.2 + 0.02 * T.breathe, C.coral, 18 + 14 * glowA);
    }
    // swoosh
    if (T.swoosh > 0) {
      ctx.save();
      ctx.shadowColor = "rgba(240,140,100,0.8)"; ctx.shadowBlur = 10 + 8 * glowA;
      ctx.strokeStyle = C.coral; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath();
      const x0 = -fw * 0.27, x1 = fw * 0.27, steps = 40, n = Math.max(1, Math.round(steps * T.swoosh));
      for (let i = 0; i <= n; i++) {
        const p = i / steps, x = x0 + (x1 - x0) * p;
        const y = LAYOUT.swooshY + 16 * Math.sin(p * Math.PI) - 10 * p;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.restore();
    }
    // opus
    if (T.opus > 0) {
      ctx.save();
      ctx.globalAlpha = T.opus;
      font(ctx, LAYOUT.opusSize, 600, "Montserrat");
      ctx.letterSpacing = `${16 + 14 * (1 - T.opus)}px`;
      ctx.textAlign = "center";
      ctx.shadowColor = `rgba(255,214,190,${0.6 * glowA})`; ctx.shadowBlur = 12;
      ctx.fillStyle = "#f6f1ec";
      ctx.fillText("OPUS 5.5", 8, LAYOUT.opusY);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();

  // footer
  const fy = P.h - 26;
  rect(ctx, 0, P.h - 46, P.w, 46, C.header);
  line(ctx, 0, P.h - 46, P.w, P.h - 46, C.line);
  text(ctx, "50% ▾", 30, fy, { size: 15 });
  text(ctx, "Full ▾", 120, fy, { size: 15 });
  icon(ctx, "grid", 220, fy, C.text, 0.9); icon(ctx, "region", 262, fy, C.text, 0.9); icon(ctx, "target", 304, fy, C.text, 0.9);
  text(ctx, s.timecode, 380, fy, { size: 19, w: 500, c: C.blueText });
  icon(ctx, "camera", 560, fy, C.text, 0.9);
  rrect(ctx, 592, fy - 15, 206, 30, 3, C.inset, C.line2);
  text(ctx, "Active Camera ▾", 606, fy, { size: 15 });
  rrect(ctx, 812, fy - 15, 110, 30, 3, C.inset, C.line2);
  text(ctx, "1 View ▾", 826, fy, { size: 15 });
  icon(ctx, "exposure", 952, fy, C.text, 0.8);
  text(ctx, "+0.0", 978, fy, { size: 15 });
  // selection rim around the active panel
  ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.strokeRect(1, 1, P.w - 2, P.h - 2);
}

const TREE_ALL = [
  ["▸", "* Animation Presets", 0], ["▸", "3D Channel", 0], ["▸", "Blur & Sharpen", 0], ["▸", "Color Correction", 0],
  ["▸", "Distort", 0], ["▸", "Generate", 0], ["▸", "Keying", 0], ["▸", "Stylize", 0]
];

function drawRight(ctx, P, s) {
  rect(ctx, 0, 0, P.w, P.h, C.panel);
  // Info
  rect(ctx, 0, 0, P.w, 36, C.header);
  tabs(ctx, 22, 18, [{ label: "Info", active: true, menu: true }, { label: "Audio" }]);
  text(ctx, "R :", 24, 60, { size: 14, c: "#e06c6c" }); text(ctx, "217", 60, 60, { size: 14 });
  text(ctx, "G :", 24, 82, { size: 14, c: "#6cc28a" }); text(ctx, "119", 60, 82, { size: 14 });
  text(ctx, "B :", 24, 104, { size: 14, c: "#6c9be0" }); text(ctx, "87", 60, 104, { size: 14 });
  text(ctx, "A :", 24, 126, { size: 14, c: C.dim }); text(ctx, "255", 60, 126, { size: 14 });
  text(ctx, "X : 1046", 220, 60, { size: 14 }); text(ctx, "Y : 682", 220, 82, { size: 14 });
  text(ctx, "clawd.png", 220, 116, { size: 13, c: C.dim });
  // Preview
  line(ctx, 0, 140, P.w, 140, C.inset, 3);
  rect(ctx, 0, 142, P.w, 34, C.header);
  tabs(ctx, 22, 159, [{ label: "Preview", active: true, menu: true }]);
  ["first", "prev", "play", "next", "last"].forEach((k, i) => {
    rrect(ctx, 30 + i * 88, 190, 64, 40, 4, C.inset);
    icon(ctx, k, 62 + i * 88, 210, C.text, 1.0);
  });
  text(ctx, "Shortcut", 24, 252, { size: 13, c: C.dim });
  text(ctx, "Spacebar ▾", 120, 252, { size: 13, c: C.blueText });
  text(ctx, "Include:", 24, 276, { size: 13, c: C.dim });
  // Effects & Presets
  line(ctx, 0, 296, P.w, 296, C.inset, 3);
  rect(ctx, 0, 298, P.w, 36, C.header);
  tabs(ctx, 22, 316, [{ label: "Effects & Presets", active: true, menu: true }, { label: "Libraries" }]);
  const S = s.search;
  // search field (UI y 440 in sheet = 352 local)
  const sy = 362;
  rrect(ctx, 16, sy - 20, P.w - 32, 40, 20, C.inset, S.focus ? C.blue : C.line2, S.focus ? 2 : 1);
  icon(ctx, "search", 42, sy, C.dim, 0.85);
  const tw = text(ctx, S.text, 64, sy, { size: 19, w: 500, c: "#e8e8ec" });
  if (S.caret) rect(ctx, 66 + tw, sy - 11, 2, 22, C.blueText);
  if (S.text) text(ctx, "×", P.w - 40, sy, { size: 18, c: C.dim });
  // tree
  let rows;
  const q = S.text;
  if (!q) rows = TREE_ALL;
  else if (q.length < 3) rows = [["▾", "* Animation Presets", 0], ["▸", "Image - Special Effects", 1], ["▸", "Generate", 0], ["▸", "Stylize", 0], ["▸", "Keying", 0]];
  else rows = [["▸", "* Animation Presets", 0], ["▾", "Stylize", 0], ["fx", "Glow", 1, true], ["▸", "Keying", 0], ["▸", "Generate", 0]];
  rows.forEach(([tw0, label, indent, glowRow], i) => {
    const y = 408 + i * 34;
    if (glowRow) {
      const h = S.highlight;
      rrect(ctx, 12, y - 15, P.w - 24, 30, 3, `rgb(${Math.round(29 + 20 * h)},${Math.round(95 + 25 * h)},${Math.round(168 + 30 * h)})`);
      if (h > 0) { ctx.save(); ctx.shadowColor = "rgba(120,190,255,0.9)"; ctx.shadowBlur = 24 * h; rrect(ctx, 12, y - 15, P.w - 24, 30, 3, null, "#9fd0ff", 2); ctx.restore(); }
      icon(ctx, "fx", 56 + indent * 20, y, "#ffffff", 1.0);
      text(ctx, label, 82 + indent * 20, y, { size: 16, w: 600, c: "#ffffff" });
    } else {
      text(ctx, tw0, 26 + indent * 20, y, { size: 12, c: C.dim });
      if (label !== "* Animation Presets") icon(ctx, "folder", 54 + indent * 20, y, C.dim, 0.7);
      text(ctx, label, label.startsWith("*") ? 46 : 74 + indent * 20, y, { size: 15 });
    }
  });
}

function drawTimeline(ctx, P, tlj) {
  rect(ctx, 0, 0, P.w, P.h, C.panel);
  rect(ctx, 0, 0, P.w, 36, C.header);
  text(ctx, "×", 18, 18, { size: 15, c: C.dim });
  tabs(ctx, 40, 18, [{ label: "Main Comp", active: true, menu: true }, { label: "Render Queue" }]);
  const oy = P.y;
  // left header strip
  rrect(ctx, 340, 44, 300, 26, 4, C.inset); icon(ctx, "search", 358, 57, C.dim, 0.7);
  ["tri", "sq", "circ", "curve"].forEach((k, i) => icon(ctx, k, 700 + i * 44, 57, C.text, 0.9));
  // column headers
  const hy = 852 - oy;
  rect(ctx, 0, hy - 12, TL.left - 10, 24, C.header);
  icon(ctx, "eye", 26, hy, C.dim, 0.7);
  text(ctx, "#", 98, hy, { size: 13, c: C.dim });
  text(ctx, "Source Name", 130, hy, { size: 13, c: C.dim });
  text(ctx, "Mode", 560, hy, { size: 13, c: C.dim });
  text(ctx, "T  TrkMat", 680, hy, { size: 13, c: C.dim });
  text(ctx, "Parent & Link", 820, hy, { size: 13, c: C.dim });
  // ruler (right)
  const ry = TL.rulerY - oy;
  rect(ctx, TL.left - 10, ry - 22, P.w - TL.left + 10, 44, C.header);
  const pps = tlj.ui.playhead.pxPerSecond;
  rrect(ctx, TL.left, ry - 19, TL.right - TL.left, 8, 3, "#3b4a5c");
  for (let sec = 0; sec <= 12; sec++) {
    const x = TL.left + sec * pps;
    line(ctx, x, ry + 2, x, ry + 20, C.dim, 1.5);
    if (sec < 12) text(ctx, sec ? String(sec).padStart(2, "0") + "s" : "0s", x + 5, ry - 2, { size: 13, c: C.dim });
    for (let k = 1; k < 4; k++) line(ctx, x + (k * pps) / 4, ry + 12, x + (k * pps) / 4, ry + 20, C.faint, 1);
  }
  // rows
  const rowDefs = {
    title: { layer: LAYERS[0] }, transform: { prop: "Transform", val: "Reset", indent: 1 },
    position: { prop: "Position", val: "960.0,540.0", indent: 2, stop: true }, scale: { prop: "Scale", val: "∞ 100.0,100.0%", indent: 2, stop: true },
    spark: { layer: LAYERS[1] }, swoosh: { layer: LAYERS[2] }, clawd: { layer: LAYERS[3] }, bg: { layer: LAYERS[4] }
  };
  TL.rows.forEach((name, i) => {
    const y = rowY(name) - oy, top = y - TL.rowH / 2;
    const d = rowDefs[name];
    line(ctx, 0, top + TL.rowH, TL.left - 10, top + TL.rowH, C.line);
    if (d.layer) {
      const L = d.layer;
      icon(ctx, "eye", 26, y, C.dim, 0.7);
      rect(ctx, 70, y - 7, 14, 14, L.color);
      text(ctx, String(L.n), 100, y, { size: 14 });
      text(ctx, "▸  " + L.icon, 126, y, { size: 13, c: C.dim });
      text(ctx, L.name, 176, y, { size: 15, w: L.n === 1 ? 600 : 400, c: L.n === 1 ? "#e6e6ea" : C.text });
      rrect(ctx, 550, y - 12, 96, 24, 3, C.inset); text(ctx, "Normal ▾", 560, y, { size: 13 });
      text(ctx, "None", 690, y, { size: 13 });
      rrect(ctx, 810, y - 12, 120, 24, 3, C.inset); text(ctx, "◎ None ▾", 822, y, { size: 13 });
      // bar
      const bh = TL.rowH * 0.62;
      rrect(ctx, TL.left, y - bh / 2, TL.right - TL.left, bh, 4, L.color);
      const gr = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
      gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0.15)");
      rrect(ctx, TL.left, y - bh / 2, TL.right - TL.left, bh, 4, gr);
    } else {
      if (d.stop) icon(ctx, "target", 130 + d.indent * 18, y, C.blueText, 0.6);
      text(ctx, (d.indent === 1 ? "▾ " : "") + d.prop, 150 + d.indent * 18, y, { size: 14 });
      text(ctx, d.val, 470, y, { size: 14, c: C.blueText });
      line(ctx, TL.left, y, TL.right, y, "#2a2a2f", 1);
    }
  });
  // footer
  line(ctx, 0, P.h - 40, P.w, P.h - 40, C.line);
  ["grid", "region", "target"].forEach((k, i) => icon(ctx, k, 24 + i * 34, P.h - 20, C.dim, 0.7));
  text(ctx, "Frame Render Time", 140, P.h - 20, { size: 14, c: C.dim });
  text(ctx, "12ms", 284, P.h - 20, { size: 14, c: C.blueText });
  text(ctx, "Toggle Switches / Modes", 1840, P.h - 20, { size: 14, c: C.dim });
  ctx.strokeStyle = "#3a3a40"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, P.w - 2, P.h - 2);
}

function drawTimecode(ctx, P, s) {
  rect(ctx, 0, 0, P.w, P.h, C.panel);
  text(ctx, s.timecode, 6, 18, { size: 26, w: 600, c: C.blueText });
  text(ctx, s.frameLabel, 178, 20, { size: 12, c: C.dim });
}

/* ─── state from the timeline (pure function of t) ─── */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const backOut = (p) => { p = clamp01(p); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

export function timecode(t, fps) {
  const f = Math.min(Math.round(t * fps), 12 * fps - 1);
  const sec = Math.floor(f / fps), fr = f % fps;
  return { tc: `0;00;${String(sec).padStart(2, "0")};${String(fr).padStart(2, "0")}`, frames: String(f).padStart(5, "0") };
}

export function uiState(t, J) {
  const tc = timecode(t, J.fps);
  const V = J.viewer;
  const s = {
    timecode: tc.tc, frameLabel: `${tc.frames} (${J.fps}.00 fps)`,
    pressed: J.toolbarPress.map((p) => ({ u: p.u, amt: t >= p.t && t < p.t + 0.35 ? 1 - (t - p.t) / 0.35 : 0 })).filter((p) => p.amt > 0),
    search: { text: "", caret: false, focus: false, highlight: 0 },
    viewer: { sprite: 0, wiggle: 0, crack: 0, bgWarm: 0, title: {} }
  };
  // search typing
  const keys = J.search.keys;
  const typed = keys.filter((k) => t >= k).length;
  s.search.text = J.search.text.slice(0, typed);
  s.search.focus = t >= keys[0] - 0.12 && t < 5.4;
  s.search.caret = s.search.focus && Math.floor(t * 4) % 2 === 0;
  const hl = J.search.highlight;
  s.search.highlight = t >= hl ? Math.max(0.0, 1 - (t - hl) / 0.6) : 0;
  // viewer
  const sp = V.spriteUntil;
  s.viewer.sprite = t < sp ? 1 : Math.max(0, 1 - (t - sp) / 0.1);
  const wig = (J.mascot.find((m) => m.type === "sprite") || {}).wiggle || [];
  s.viewer.wiggle = wig.reduce((m, w) => (t >= w && t < w + 0.3 ? Math.max(m, Math.sin(((t - w) / 0.3) * Math.PI) * (1 - (t - w) / 0.3)) : m), 0);
  s.viewer.crack = t >= V.crack ? Math.max(0, 1 - (t - V.crack) / 0.35) : 0;
  s.viewer.bgWarm = easeOut((t - V.bgWarm) / 0.6);
  const T = s.viewer.title;
  const n = 16;
  T.chars = t < V.typeStart ? 0 : Math.min(n, 1 + Math.floor(((t - V.typeStart) / (V.typeEnd - V.typeStart)) * n));
  T.caret = Math.floor(t * 6) % 2 === 0;
  T.glow = easeOut((t - V.glow) / 0.25);
  T.settle = t < V.settle ? 0 : easeOut((t - V.settle) / 0.35);
  if (t < V.glow) T.settle = 0;
  T.spark = t < V.spark ? 0 : backOut((t - V.spark) / 0.4);
  T.scalePop = t >= V.scalePop && t < V.scalePop + 0.4 ? Math.sin(((t - V.scalePop) / 0.4) * Math.PI) : 0;
  T.swoosh = clamp01((t - V.swoosh) / 0.4);
  T.swoosh = T.swoosh > 0 ? easeOut(T.swoosh) : 0;
  T.opus = easeOut((t - V.opus) / 0.5);
  T.breathe = t > 10 ? Math.sin((t - 10) * Math.PI) * 0.5 + 0.5 : 0;
  return s;
}

/* ─── panel registry ─── */

export function createPanels(J) {
  const out = {};
  for (const [id, P] of Object.entries(PANELS)) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(P.w * P.density);
    cv.height = Math.round(P.h * P.density);
    out[id] = { id, P, canvas: cv, ctx: cv.getContext("2d"), key: null };
  }
  const draw = {
    menu: (ctx, P, s) => drawMenu(ctx, P, s, J),
    project: (ctx, P) => drawProject(ctx, P),
    viewer: (ctx, P, s) => drawViewer(ctx, P, s),
    right: (ctx, P, s) => drawRight(ctx, P, s),
    timeline: (ctx, P) => drawTimeline(ctx, P, J),
    timecode: (ctx, P, s) => drawTimecode(ctx, P, s)
  };
  const keyOf = {
    menu: (s) => JSON.stringify(s.pressed.map((p) => [p.u, p.amt.toFixed(2)])),
    project: () => "static",
    viewer: (s) => JSON.stringify([s.timecode, s.viewer]),
    right: (s) => JSON.stringify(s.search),
    timeline: () => "static",
    timecode: (s) => s.timecode
  };
  // returns ids of panels whose pixels changed
  function update(state) {
    const changed = [];
    for (const p of Object.values(out)) {
      const k = keyOf[p.id](state);
      if (k === p.key) continue;
      p.key = k;
      const { ctx, P } = p;
      ctx.setTransform(P.density, 0, 0, P.density, 0, 0);
      ctx.clearRect(0, 0, P.w, P.h);
      draw[p.id](ctx, P, state);
      changed.push(p.id);
    }
    return changed;
  }
  return { panels: out, update };
}
