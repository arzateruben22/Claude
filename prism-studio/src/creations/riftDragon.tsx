import * as React from "react";
import { A, ActivityOverlay, Aura, Ground, Lin, PrepGlow, Rad, Sheen, f, kite, orbit, pts, sparkPath, type Box, type Ctx } from "./kit";

/* The Rift Dragon: amber, ember orange, deep ink.
   Motif: the amber rift (a vesica of light): a crack in the egg, a mark on
   the hatchling's brow, then a portal that grows behind the dragon. */

const C = {
  amber: "#F5A53A",
  amber2: "#E88A1E",
  amberL: "#FFD08A",
  amberP: "#FFEBC4",
  ember: "#E5562E",
  ember2: "#B83A1E",
  ink: "#1C1829",
  ink2: "#2B263E",
  ink3: "#413B5A",
  ink4: "#5B5478",
  inkL: "#8F88AE",
};

type P = readonly [number, number];

const vesica = (x: number, y: number, h: number, w: number) => `M${f(x)} ${f(y - h)}Q${f(x + w * 2)} ${f(y)} ${f(x)} ${f(y + h)}Q${f(x - w * 2)} ${f(y)} ${f(x)} ${f(y - h)}Z`;
const poly = (a: readonly P[]) => pts(a);

function Defs({ ctx }: { ctx: Ctx }) {
  const u = ctx.id;
  return (
    <defs>
      <Rad id={u("rift")} stops={[[0, "#FFFFFF"], [0.3, C.amberP], [0.7, C.amber], [1, C.ember]]} />
      <Rad id={u("riftGlow")} stops={[[0, C.amber, 0.7], [0.45, C.amber, 0.25], [1, C.amber, 0]]} />
      <Rad id={u("portal")} stops={[[0, "#26193A"], [0.5, "#3A2142"], [0.76, C.ember2, 0.95], [0.92, C.amber], [1, C.amberP]]} />
      <Lin id={u("wing")} x1={0} y1={0} x2={1} y2={1} stops={[[0, C.ember, 0.92], [0.55, C.amber2, 0.8], [1, C.amberL, 0.7]]} />
      <Lin id={u("wingFar")} x1={0} y1={0} x2={1} y2={1} stops={[[0, C.ember2, 0.9], [1, C.amber2, 0.75]]} />
      <Rad id={u("eye")} stops={[[0, "#FFFFFF"], [0.4, C.amberP], [1, C.amber]]} />
      <Lin id={u("rock")} stops={[[0, C.ink4], [1, C.ink]]} />
      <Lin id={u("crystal")} x1={0} y1={0} x2={1} y2={0} stops={[[0, C.amberP], [0.5, C.amber], [1, C.ember2]]} />
      <Rad id={u("pool")} stops={[[0, C.amber, 0.38], [1, C.amber, 0]]} />
      <Lin id={u("holo")} x1={0} y1={0} x2={1} y2={0} stops={[[0, C.amberL, 0.05], [1, C.amberL, 0.45]]} />
    </defs>
  );
}

/* ---------------- motif parts ---------------- */

function Rift({ ctx, x, y, h, w, flicker = false }: { ctx: Ctx; x: number; y: number; h: number; w: number; flicker?: boolean }) {
  const inner = (
    <g>
      {ctx.fx && <ellipse cx={x} cy={y} rx={w * 4} ry={h * 1.6} fill={ctx.url("riftGlow")} />}
      <path d={vesica(x, y, h, w)} fill={ctx.url("rift")} stroke={C.ember2} strokeWidth={0.8} />
    </g>
  );
  return flicker ? (
    <A k="flicker" d={2.2}>
      {inner}
    </A>
  ) : (
    <A k="pulse" d={3} v={{ o: 0.6 }}>
      {inner}
    </A>
  );
}

function Portal({ ctx, x, y, h, w, facet = false }: { ctx: Ctx; x: number; y: number; h: number; w: number; facet?: boolean }) {
  const d = vesica(x, y, h, w);
  const clip = ctx.id(`portal${Math.round(h)}`);
  const stars = Array.from({ length: 14 }, (_, i) => {
    const a = i * 2.39996;
    const r = Math.sqrt((i + 0.5) / 14);
    return [x + Math.cos(a) * w * 0.8 * r, y + Math.sin(a) * h * 0.85 * r] as P;
  });
  const body = (
    <g>
      {ctx.fx && (
        <A k="pulse" d={4} v={{ o: 0.55 }}>
          <ellipse cx={x} cy={y} rx={w * 2.4} ry={h * 1.18} fill={ctx.url("riftGlow")} />
        </A>
      )}
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={ctx.url("portal")} />
      <g clipPath={`url(#${clip})`}>
        <A k="spin" d={36} at={[x, y]}>
          {[0.35, 0.6, 0.85].map((k) => (
            <ellipse key={k} cx={x} cy={y} rx={w * k * 1.6} ry={h * k * 0.55} fill="none" stroke={C.amberL} strokeWidth={1.2} strokeDasharray="4 7" opacity={0.55} />
          ))}
        </A>
        {stars.map(([sx, sy], i) => (
          <circle key={i} cx={f(sx)} cy={f(sy)} r={i % 4 ? 0.9 : 1.6} fill={C.amberP} />
        ))}
      </g>
      {ctx.fx && <path d={d} fill="none" stroke={C.amber} strokeWidth={6} opacity={0.35} />}
      <path d={d} fill="none" stroke={C.amberP} strokeWidth={2} />
      {facet && (
        <g fill="none" stroke={C.amberL} strokeWidth={1.4} strokeLinejoin="round">
          <polygon points={poly([[x, y - h - 14], [x + w * 1.3, y - h * 0.5], [x + w * 1.3, y + h * 0.5], [x, y + h + 14], [x - w * 1.3, y + h * 0.5], [x - w * 1.3, y - h * 0.5]])} />
          <path d={`M${x} ${f(y - h - 14)}L${x} ${f(y - h)}M${x} ${f(y + h)}L${x} ${f(y + h + 14)}`} />
        </g>
      )}
    </g>
  );
  return ctx.activity === "rendering" ? (
    <A k="flicker" d={1.8}>
      {body}
    </A>
  ) : (
    body
  );
}

function Ember({ x, y, s, dl = 0 }: { x: number; y: number; s: number; dl?: number }) {
  return (
    <A k="drift" d={5} dl={dl} v={{ x: "4px", y: "-14px" }}>
      <path d={sparkPath(x, y, s, 0.3)} fill={C.amberL} stroke={C.ember2} strokeWidth={0.6} />
    </A>
  );
}

/* ---------------- dragon parts ---------------- */

type HornKind = "nub" | "swept" | "crown";

function Head({ ctx, x, y, s, r = 0, horns }: { ctx: Ctx; x: number; y: number; s: number; r?: number; horns: HornKind }) {
  const storm = ctx.branch === "a" || ctx.form < 3;
  const hornFill = storm ? C.ink4 : ctx.url("crystal");
  const hornEdge = storm ? C.amberL : C.ember2;
  const hornList: string[] =
    horns === "nub"
      ? ["M14 -20Q24 -30 34 -33Q27 -24 25 -14Z"]
      : horns === "swept"
        ? ["M20 -16Q46 -26 72 -30Q50 -18 30 -8Z", "M12 -20Q40 -38 68 -52Q46 -30 26 -12Z"]
        : ["M20 -16Q54 -32 86 -40Q58 -22 30 -8Z", "M10 -22Q34 -54 56 -82Q42 -48 24 -14Z", "M0 -24Q6 -44 12 -62Q14 -42 10 -22Z", "M14 -21Q44 -48 74 -64Q50 -34 28 -11Z"];
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      {hornList.map((d, i) => (
        <path key={i} d={d} fill={hornFill} stroke={hornEdge} strokeWidth={1.1} strokeLinejoin="round" opacity={i === 0 && hornList.length > 1 ? 0.8 : 1} />
      ))}
      {storm && horns !== "nub" && ctx.form >= 3 && (
        <path d={horns === "crown" ? "M40 -50L50 -58L46 -50L58 -54" : "M42 -34L52 -44L48 -36L60 -40"} fill="none" stroke={C.amberL} strokeWidth={1.4} strokeLinejoin="round" />
      )}
      <polygon points="24,8 44,20 30,-1" fill={C.ink3} stroke={C.amberL} strokeWidth={0.9} strokeLinejoin="round" />
      <polygon points="30,-4 20,-20 2,-24 -16,-16 -38,-7 -46,2 -38,10 -12,12 10,20 26,10" fill={C.ink3} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
      <polygon points="20,-20 2,-24 -16,-16 -38,-7 -22,-2 4,-8" fill={C.ink4} />
      <polygon points="-36,8 -14,4 14,2 26,10 10,20 -12,12" fill={C.ink2} />
      <path d="M-38 10L-12 12" stroke={C.ink} strokeWidth={1} />
      <path d="M-18 -15L6 -16L20 -20" fill="none" stroke={C.amberL} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={-40} cy={0} r={1.6} fill={C.ink} />
      {ctx.fx && <ellipse cx={-6} cy={-7} rx={12} ry={8} fill={ctx.url("riftGlow")} />}
      <path d="M-15 -7Q-6 -13 3 -7Q-6 -2 -15 -7Z" fill={ctx.url("eye")} stroke={C.ember2} strokeWidth={0.8} />
      <path d="M-6 -11L-6 -3" stroke={C.ink} strokeWidth={1.6} strokeLinecap="round" />
      <path d={vesica(9, -17, 4, 1.4)} fill={C.amberP} stroke={C.ember} strokeWidth={0.5} />
    </g>
  );
}

function Wing({ ctx, sh, el, wr, tips, far = false, astral = true, flap = 0 }: { ctx: Ctx; sh: P; el: P; wr: P; tips: P[]; far?: boolean; astral?: boolean; flap?: number }) {
  let d = `M${f(sh[0])} ${f(sh[1])}L${f(el[0])} ${f(el[1])}L${f(wr[0])} ${f(wr[1])}L${f(tips[0][0])} ${f(tips[0][1])}`;
  const all = [...tips, sh];
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1];
    const b = all[i];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const cx = mx + (wr[0] - mx) * 0.28;
    const cy = my + (wr[1] - my) * 0.28;
    d += `Q${f(cx)} ${f(cy)} ${f(b[0])} ${f(b[1])}`;
  }
  d += "Z";
  const clip = ctx.id(`wing${Math.round(sh[0])}${Math.round(wr[0])}`);
  const crystal = ctx.branch === "b" && ctx.form >= 3;
  const content = (
    <g>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={far ? ctx.url("wingFar") : ctx.url("wing")} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
      {astral && (
        <g clipPath={`url(#${clip})`}>
          {tips.map((t, i) => (
            <circle key={i} cx={f(wr[0] + (t[0] - wr[0]) * 0.55 + (i % 2 ? 6 : -4))} cy={f(wr[1] + (t[1] - wr[1]) * 0.55 + 8)} r={1.4} fill={C.amberP} />
          ))}
          {tips.map((t, i) => (
            <circle key={`b${i}`} cx={f(sh[0] + (t[0] - sh[0]) * 0.4)} cy={f(sh[1] + (t[1] - sh[1]) * 0.45)} r={1} fill="#FFFFFF" opacity={0.85} />
          ))}
        </g>
      )}
      <Sheen ctx={ctx} o={0.35}>
        <path d={d} />
      </Sheen>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {tips.map((t, i) => (
          <path key={i} d={`M${f(wr[0])} ${f(wr[1])}L${f(t[0])} ${f(t[1])}`} stroke={C.ink3} strokeWidth={2.6} />
        ))}
        <path d={`M${f(sh[0])} ${f(sh[1])}L${f(el[0])} ${f(el[1])}L${f(wr[0])} ${f(wr[1])}`} stroke={C.ink3} strokeWidth={6} />
        <path d={`M${f(sh[0])} ${f(sh[1])}L${f(el[0])} ${f(el[1])}L${f(wr[0])} ${f(wr[1])}`} stroke={C.amberL} strokeWidth={1.2} />
      </g>
      <path d={`M${f(wr[0] - 3)} ${f(wr[1] + 2)}L${f(wr[0] + 1)} ${f(wr[1] - 12)}L${f(wr[0] + 5)} ${f(wr[1] + 1)}Z`} fill={crystal ? ctx.url("crystal") : C.amberL} stroke={C.ink} strokeWidth={0.8} />
      {crystal &&
        [0.35, 0.7].map((k) => {
          const px = el[0] + (wr[0] - el[0]) * k;
          const py = el[1] + (wr[1] - el[1]) * k;
          return <polygon key={k} points={poly([[px - 3, py + 2], [px, py - 11], [px + 3, py + 2]])} fill={ctx.url("crystal")} stroke={C.ink} strokeWidth={0.7} />;
        })}
    </g>
  );
  return flap ? (
    <A k="sway" d={5} at={sh} v={{ a: `${flap}deg` }}>
      {content}
    </A>
  ) : (
    content
  );
}

/** spine plates: storm = dark blades with amber edge, crystal = amber crystals */
function Plates({ ctx, list }: { ctx: Ctx; list: [number, number, number, number][] }) {
  const crystal = ctx.branch === "b" && ctx.form >= 3;
  return (
    <g strokeLinejoin="round">
      {list.map(([x, y, a, s], i) => {
        const rad = (a * Math.PI) / 180;
        const tip: P = [x + Math.cos(rad) * s, y + Math.sin(rad) * s];
        if (crystal) {
          const k = kite([x, y], tip, s * 0.32, 0.4);
          return (
            <g key={i} stroke={C.ember2} strokeWidth={0.7}>
              <polygon points={k.a} fill={C.amberP} />
              <polygon points={k.b} fill={C.amber} />
            </g>
          );
        }
        const nx = -Math.sin(rad) * s * 0.4;
        const ny = Math.cos(rad) * s * 0.4;
        return <polygon key={i} points={poly([[x - nx, y - ny], tip, [x + nx, y + ny]])} fill={C.ink2} stroke={C.amberL} strokeWidth={0.9} />;
      })}
    </g>
  );
}

function Scales({ ctx, x, y, w, rows, gap = 7, rot = 0 }: { ctx: Ctx; x: number; y: number; w: number; rows: number; gap?: number; rot?: number }) {
  return (
    <A k="shimmer" d={4} v={{ o: 0.55 }}>
      <g transform={rot ? `rotate(${rot} ${x} ${y})` : undefined} fill="none" stroke={C.amberP} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        {Array.from({ length: rows }, (_, i) => {
          const ww = w * (1 - i * 0.06);
          const yy = y + i * gap;
          const n = Math.max(2, Math.round(ww / 9));
          let d = "";
          for (let j = 0; j < n; j++) {
            const x0 = x - ww / 2 + (j * ww) / n;
            d += `M${f(x0)} ${f(yy)}L${f(x0 + ww / n / 2)} ${f(yy + 3.4)}L${f(x0 + ww / n)} ${f(yy)}`;
          }
          return <path key={i} d={d} />;
        })}
        {ctx.fx && <rect x={x - w / 2} y={y - 2} width={w} height={rows * gap + 2} fill={C.amber} opacity={0.08} stroke="none" />}
      </g>
    </A>
  );
}

function Seam({ ctx, d, w = 1.6 }: { ctx: Ctx; d: string; w?: number }) {
  return (
    <A k="pulse" d={3.2} v={{ o: 0.55 }}>
      {ctx.fx && <path d={d} fill="none" stroke={C.amber} strokeWidth={w * 3.5} opacity={0.3} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={C.amberL} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </A>
  );
}

function Arc({ ctx, d, dl = 0 }: { ctx: Ctx; d: string; dl?: number }) {
  if (!ctx.fx) return null;
  return (
    <A k="flicker" d={1.4} dl={dl}>
      <path d={d} fill="none" stroke={C.amber} strokeWidth={4} opacity={0.35} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#FFF6E2" strokeWidth={1.3} strokeLinejoin="round" />
    </A>
  );
}

function Rock({ ctx, x, y, w, h, crystals = 0 }: { ctx: Ctx; x: number; y: number; w: number; h: number; crystals?: number }) {
  const top: P[] = [
    [x - w, y + 4],
    [x - w * 0.55, y - 6],
    [x + w * 0.5, y - 7],
    [x + w, y + 3],
  ];
  const a: P = [x - w * 0.6, y + h * 0.55];
  const b: P = [x + w * 0.05, y + h];
  const c: P = [x + w * 0.62, y + h * 0.5];
  return (
    <g>
      <g stroke={C.ink} strokeWidth={0.9} strokeLinejoin="round">
        <polygon points={poly(top)} fill={C.ink4} />
        <polygon points={poly([top[0], top[1], a])} fill={C.ink3} />
        <polygon points={poly([top[1], top[2], b, a])} fill={C.ink2} />
        <polygon points={poly([top[2], top[3], c, b])} fill={C.ink} />
        <path d={`M${poly([top[0], top[1], top[2], top[3]]).replace(/ /g, "L")}`} fill="none" stroke={C.amberL} strokeWidth={1.2} />
      </g>
      {Array.from({ length: crystals }, (_, i) => {
        const cx = x - w * 0.8 + (i * w * 1.6) / Math.max(1, crystals - 1);
        const hh = 10 + ((i * 7) % 3) * 6;
        const k = kite([cx, y + 2], [cx + (i % 2 ? 4 : -4), y - hh], 3.5, 0.3);
        return (
          <g key={i} stroke={C.ember2} strokeWidth={0.6}>
            <polygon points={k.a} fill={C.amberP} />
            <polygon points={k.b} fill={C.amber} />
          </g>
        );
      })}
      {ctx.fx && <ellipse cx={x} cy={y + h + 10} rx={w * 0.4} ry={6} fill={ctx.url("pool")} />}
    </g>
  );
}

function Holo({ ctx, x, y, from }: { ctx: Ctx; x: number; y: number; from: P }) {
  if (ctx.activity !== "researching" || !ctx.fx) return null;
  return (
    <g>
      <A k="pulse" d={2.4} v={{ o: 0.4 }}>
        <polygon points={poly([from, [x + 16, y - 14], [x + 16, y + 22]])} fill={ctx.url("holo")} />
      </A>
      <A k="bob" d={3} v={{ a: "-5px" }}>
        <A k="flicker" d={2.6}>
          <g transform={`translate(${x} ${y})`} fill="none" strokeLinecap="round">
            <path d="M-9 -9Q-9 -21 1 -21Q11 -21 11 -11Q11 -4 4 -1Q1 1 1 7" stroke={C.amber} strokeWidth={6} opacity={0.35} />
            <path d="M-9 -9Q-9 -21 1 -21Q11 -21 11 -11Q11 -4 4 -1Q1 1 1 7" stroke={C.amberP} strokeWidth={2.4} />
            <circle cx={1} cy={14} r={2} fill={C.amberP} />
            <path d="M-12 -14L14 -14M-12 -4L14 -4M-12 6L14 6" stroke={C.amberL} strokeWidth={0.6} opacity={0.6} />
          </g>
        </A>
      </A>
    </g>
  );
}

/* ---------------- forms ---------------- */

function eggMesh() {
  const rows: P[][] = [
    [[200, 126]],
    [
      [150, 168],
      [186, 160],
      [222, 162],
      [256, 170],
    ],
    [
      [134, 208],
      [170, 204],
      [206, 210],
      [242, 202],
      [270, 214],
    ],
    [
      [136, 250],
      [176, 246],
      [214, 252],
      [250, 244],
      [268, 258],
    ],
    [
      [150, 290],
      [190, 288],
      [228, 292],
      [262, 286],
    ],
    [[200, 304]],
  ];
  const tris: P[][] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    let i = 0;
    let j = 0;
    while (i < a.length - 1 || j < b.length - 1) {
      if (j < b.length - 1 && (i >= a.length - 1 || b[j + 1][0] < a[i + 1][0])) {
        tris.push([a[i], b[j], b[j + 1]]);
        j++;
      } else {
        tris.push([a[i], b[j], a[i + 1]]);
        i++;
      }
    }
  }
  return tris;
}
const EGG_TRIS = eggMesh();

function Form1({ ctx }: { ctx: Ctx }) {
  const egg = "M200 132C240 132 258 196 258 232C258 272 232 296 200 296C168 296 142 272 142 232C142 196 160 132 200 132Z";
  const clip = ctx.id("egg");
  const shades = [C.ink4, C.ink3, C.ink3, C.ink2, C.ink2, C.ink];
  const crack = "M213 150L204 176L216 196L198 222L210 244L192 268L198 288";
  const shards: [number, number, number, number][] = [
    [148, 292, -40, 22],
    [170, 300, -15, 16],
    [236, 300, 20, 18],
    [254, 292, 42, 22],
    [134, 298, -60, 14],
    [268, 300, 60, 14],
  ];
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={304} rx={80} ry={11} pool={ctx.url("pool")} />
      <A k="sway" d={5} at={[200, 296]} v={{ a: "1.6deg" }}>
        <clipPath id={clip}>
          <path d={egg} />
        </clipPath>
        <path d={egg} fill={C.ink3} />
        <g clipPath={`url(#${clip})`} stroke={C.ink} strokeOpacity={0.6} strokeWidth={0.7} strokeLinejoin="round">
          {EGG_TRIS.map((t, i) => {
            const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
            const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
            const lit = (cx - 140) / 130 + (cy - 130) / 260;
            return <polygon key={i} points={poly(t)} fill={shades[Math.min(5, Math.max(0, Math.round(lit * 3.2 + (i % 2) * 0.4)))]} />;
          })}
          <g fill="none" stroke={C.amber} strokeWidth={1.3} opacity={0.9}>
            <path d="M146 250Q200 270 254 250" strokeDasharray="7 5" />
            <path d="M160 176L168 168L176 176M232 182L238 172L244 182M158 214L166 214M166 210L166 218" strokeLinecap="round" />
          </g>
          {[
            [176, 236],
            [228, 228],
            [186, 160],
            [240, 262],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.8} fill={C.amberL} stroke="none" />
          ))}
        </g>
        <path d="M150 210C152 172 170 144 192 136" fill="none" stroke={C.inkL} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        <path d={egg} fill="none" stroke={C.ink} strokeWidth={1.4} />
        <A k={ctx.activity === "rendering" ? "flicker" : "pulse"} d={ctx.activity === "rendering" ? 1.6 : 3} v={{ o: 0.55 }}>
          {ctx.fx && <path d={crack} fill="none" stroke={C.amber} strokeWidth={9} opacity={0.3} strokeLinejoin="round" />}
          <path d={crack} fill="none" stroke={C.amber} strokeWidth={4} strokeLinejoin="round" />
          <path d={crack} fill="none" stroke={C.amberP} strokeWidth={1.6} strokeLinejoin="round" />
        </A>
        <Rift ctx={ctx} x={205} y={210} h={16} w={4} flicker={ctx.activity === "rendering"} />
        <Sheen ctx={ctx} o={0.3}>
          <path d={egg} />
        </Sheen>
      </A>
      <Plates ctx={ctx} list={shards} />
      <Ember x={252} y={196} s={4} />
      <Ember x={150} y={182} s={3} dl={-2} />
      <Ember x={226} y={140} s={3} dl={-3.4} />
      <Holo ctx={ctx} x={116} y={166} from={[198, 210]} />
    </g>
  );
}

function Form2({ ctx }: { ctx: Ctx }) {
  const cup = "M142 238L152 226L162 240L174 222L186 238L198 224L210 240L224 222L236 238L248 226L258 238C258 274 232 298 200 298C168 298 142 274 142 238Z";
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={304} rx={82} ry={11} pool={ctx.url("pool")} />
      <ellipse cx={200} cy={236} rx={58} ry={12} fill={C.ink} />
      <A k="bob" d={4} v={{ a: "-3px" }}>
        <path d="M232 240Q264 252 284 234Q294 222 286 210Q288 228 270 236Q252 242 234 230Z" fill={C.ink3} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <Plates ctx={ctx} list={[[258, 238, -70, 7], [272, 232, -40, 6], [282, 222, -10, 5]]} />
        <polygon points="222,208 238,188 252,184 248,200 240,214" fill={ctx.url("wing")} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <path d="M224 206L250 186M232 210L248 200" stroke={C.ink3} strokeWidth={1.4} strokeLinecap="round" />
        <polygon points="172,252 176,214 194,196 220,200 238,222 240,252" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <polygon points="176,214 194,196 204,200 190,252 172,252" fill={C.ink4} />
        <polygon points="184,206 204,198 198,168 178,172" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <Scales ctx={ctx} x={208} y={216} w={26} rows={4} gap={7} />
        <Seam ctx={ctx} d="M204 156Q214 178 226 200Q236 214 238 232" />
        <Head ctx={ctx} x={176} y={160} s={0.95} r={-6} horns="nub" />
        <polygon points="164,240 170,226 182,232 178,244" fill={C.ink3} stroke={C.ink} strokeWidth={0.9} />
        <path d="M164 240L160 246M170 242L168 248M176 243L176 249" stroke={C.amberL} strokeWidth={1.4} strokeLinecap="round" />
      </A>
      <path d={cup} fill={C.ink3} stroke={C.ink} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M142 238C142 274 168 298 200 298L196 252L162 240Z" fill={C.ink4} opacity={0.8} />
      <path d="M150 262Q200 282 250 262" fill="none" stroke={C.amber} strokeWidth={1.3} strokeDasharray="7 5" />
      <path d="M142 238L152 226L162 240L174 222L186 238L198 224L210 240L224 222L236 238L248 226L258 238" fill="none" stroke={C.amberL} strokeWidth={1.2} strokeLinejoin="round" />
      <A k="drift" d={6} v={{ x: "-4px", y: "-6px" }}>
        <polygon points="126,176 140,170 136,188" fill={C.ink4} stroke={C.amberL} strokeWidth={0.9} />
      </A>
      <A k="drift" d={7} dl={-2} v={{ x: "4px", y: "-6px" }}>
        <polygon points="270,168 286,174 274,186" fill={C.ink3} stroke={C.amberL} strokeWidth={0.9} />
      </A>
      <Ember x={250} y={150} s={3.5} />
      <Ember x={140} y={210} s={3} dl={-2.5} />
      <Holo ctx={ctx} x={104} y={118} from={[170, 152]} />
    </g>
  );
}

function Form3({ ctx }: { ctx: Ctx }) {
  const a = ctx.branch === "a";
  return (
    <g>
      <Ground ctx={ctx} cx={210} cy={320} rx={130} ry={12} pool={ctx.url("pool")} />
      <Portal ctx={ctx} x={236} y={172} h={104} w={34} facet={!a} />
      <A k="bob" d={4.5} v={{ a: "-2px" }}>
        <path d="M262 248Q306 270 334 252Q352 240 354 216Q362 236 350 256Q326 286 260 270Z" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        {a ? (
          <g>
            <path d="M354 216L346 202L360 208L358 192L368 210Z" fill={C.amberL} stroke={C.ember2} strokeWidth={0.8} />
            <Arc ctx={ctx} d="M356 214L364 200L360 196L370 184" />
          </g>
        ) : (
          <Plates ctx={ctx} list={[[354, 216, -80, 16], [356, 220, -40, 10]]} />
        )}
        <polygon points="252,262 262,292 256,318 244,320 246,292 238,270" fill={C.ink2} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <polygon points="176,262 172,292 176,318 162,318 162,292 160,262" fill={C.ink2} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <Wing ctx={ctx} sh={[206, 210]} el={[236, 168]} wr={[262, 150]} tips={[[290, 180], [272, 204], [246, 214]]} astral={false} />
        <polygon points="150,232 176,206 226,204 268,222 278,252 252,272 190,274 158,262" fill={C.ink3} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="176,206 226,204 268,222 232,226 186,226" fill={C.ink4} />
        <Scales ctx={ctx} x={212} y={250} w={62} rows={3} gap={7} />
        <polygon points="248,236 286,252 284,280 270,298 276,318 256,320 256,300 242,272" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <polygon points="164,234 190,242 182,270 188,300 182,318 162,320 168,298 156,262" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M258 320L252 324M266 320L264 325M274 319L276 324M164 320L158 324M172 320L170 325M180 320L182 324" stroke={C.amberL} strokeWidth={1.6} strokeLinecap="round" />
        <polygon points="150,240 140,206 124,172 142,160 162,184 178,212" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <polygon points="140,206 124,172 142,160 150,190" fill={C.ink4} />
        <Plates
          ctx={ctx}
          list={[
            [146, 164, -60, 12],
            [158, 182, -50, 12],
            [170, 200, -45, 12],
            [190, 205, -85, 13],
            [212, 204, -90, 14],
            [234, 208, -80, 13],
            [256, 216, -65, 12],
            [278, 230, -50, 10],
          ]}
        />
        <Seam ctx={ctx} d="M142 162Q160 190 176 206Q222 200 268 222Q300 240 334 250" />
        <Head ctx={ctx} x={116} y={152} s={1.05} r={-8} horns="swept" />
      </A>
      {a ? (
        <g>
          <Arc ctx={ctx} d="M178 98L190 108L184 112L200 124L194 128L212 140" />
          <Arc ctx={ctx} d="M300 120L290 132L298 136L286 150" dl={-0.6} />
        </g>
      ) : (
        <g>
          {[0, 1, 2].map((i) => {
            const o = orbit(ctx, `c${i}`, { cx: 236, cy: 172, rx: 74, ry: 20, rot: -12, d: 12, phase: i * 120 }, <polygon points="0,-7 4,0 0,7 -4,0" fill={ctx.url("crystal")} stroke={C.ember2} strokeWidth={0.7} />);
            return <g key={i}>{o.front}</g>;
          })}
        </g>
      )}
      <Ember x={316} y={130} s={3.5} />
      <Holo ctx={ctx} x={56} y={108} from={[108, 146]} />
    </g>
  );
}

function Form4({ ctx }: { ctx: Ctx }) {
  const a = ctx.branch === "a";
  return (
    <g>
      <Portal ctx={ctx} x={226} y={168} h={136} w={44} facet={!a} />
      <Rock ctx={ctx} x={210} y={310} w={92} h={56} crystals={a ? 0 : 5} />
      <A k="bob" d={5} v={{ a: "-2px" }}>
        <Wing ctx={ctx} sh={[200, 204]} el={[160, 124]} wr={[104, 74]} tips={[[38, 118], [56, 168], [98, 200], [150, 212]]} far flap={-3} />
        <Wing ctx={ctx} sh={[232, 204]} el={[284, 122]} wr={[336, 74]} tips={[[376, 122], [360, 172], [318, 202], [268, 214]]} flap={3} />
        <path d="M240 288Q300 316 338 296Q356 284 352 260Q366 280 354 300Q322 330 238 304Z" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        {a ? <Arc ctx={ctx} d="M352 262L360 248L356 244L366 232" /> : <Plates ctx={ctx} list={[[352, 262, -80, 15]]} />}
        <polygon points="228,262 262,288 258,306 236,308 222,290" fill={C.ink2} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <polygon points="176,252 190,206 226,196 252,232 256,288 228,302 192,294 180,272" fill={C.ink3} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="190,206 226,196 236,212 196,226" fill={C.ink4} />
        <Scales ctx={ctx} x={212} y={226} w={40} rows={8} gap={8} rot={-6} />
        <polygon points="236,252 268,276 264,304 246,308 236,292" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M246 308L240 312M254 308L252 313M262 306L264 311" stroke={C.amberL} strokeWidth={1.6} strokeLinecap="round" />
        <polygon points="194,236 166,246 150,266 158,270 172,256 198,252" fill={C.ink3} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <path d="M150 266L144 272M154 268L150 275M158 270L157 277" stroke={C.amberL} strokeWidth={1.5} strokeLinecap="round" />
        <polygon points="190,214 176,170 158,132 180,118 200,160 216,200" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <polygon points="176,170 158,132 180,118 186,150" fill={C.ink4} />
        <Plates ctx={ctx} list={[[184, 126, -30, 12], [194, 146, -20, 12], [204, 166, -15, 12], [214, 186, -10, 12], [230, 200, -40, 12]]} />
        <Seam ctx={ctx} d="M182 120Q200 160 216 200Q240 222 252 252Q256 280 248 296" />
        <Head ctx={ctx} x={158} y={114} s={1.12} r={-14} horns="swept" />
      </A>
      {a && (
        <g>
          <Arc ctx={ctx} d="M210 52L218 66L212 68L222 84" />
          <Arc ctx={ctx} d="M104 74L92 64L98 60L84 50" dl={-0.5} />
          <Arc ctx={ctx} d="M336 74L348 62L342 58L356 48" dl={-0.9} />
        </g>
      )}
      <Ember x={300} y={240} s={3.5} />
      <Ember x={120} y={238} s={3} dl={-2} />
      <Holo ctx={ctx} x={84} y={80} from={[148, 108]} />
    </g>
  );
}

function Form5({ ctx }: { ctx: Ctx }) {
  const a = ctx.branch === "a";
  return (
    <g>
      {ctx.fx && (
        <A k="spin" d={80} at={[204, 176]}>
          <circle cx={204} cy={176} r={176} fill="none" stroke={C.amber} strokeWidth={1} strokeDasharray="2 9" opacity={0.7} />
        </A>
      )}
      <Portal ctx={ctx} x={204} y={172} h={160} w={56} facet={!a} />
      <Rock ctx={ctx} x={206} y={318} w={120} h={62} crystals={a ? 0 : 7} />
      <A k="bob" d={5.5} v={{ a: "-2px" }}>
        <Wing ctx={ctx} sh={[192, 200]} el={[134, 128]} wr={[62, 62]} tips={[[8, 112], [18, 170], [54, 212], [104, 226], [156, 222]]} far flap={-2.5} />
        <Wing ctx={ctx} sh={[228, 200]} el={[288, 126]} wr={[352, 60]} tips={[[394, 112], [384, 170], [350, 212], [302, 226], [252, 222]]} flap={2.5} />
        <path d="M238 296Q290 336 342 318Q372 304 370 274Q368 250 346 248Q362 262 356 280Q344 306 300 304Q262 300 240 284Z" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        {a ? (
          <g>
            <path d="M346 248L338 236L352 240L350 224L362 244Z" fill={C.amberL} stroke={C.ember2} strokeWidth={0.8} />
            <Arc ctx={ctx} d="M348 246L356 232L350 228L360 216" />
          </g>
        ) : (
          <Plates ctx={ctx} list={[[346, 250, -100, 18], [342, 252, -140, 12]]} />
        )}
        <Plates ctx={ctx} list={[[262, 304, 80, 10], [290, 314, 80, 10], [318, 314, 70, 10], [346, 304, 40, 10]]} />
        <polygon points="226,262 264,290 260,316 238,318 222,296" fill={C.ink2} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <polygon points="172,250 186,200 228,188 256,228 260,290 230,306 190,298 176,276" fill={C.ink3} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="186,200 228,188 238,206 192,222" fill={C.ink4} />
        <Scales ctx={ctx} x={214} y={220} w={46} rows={10} gap={7.5} rot={-5} />
        <polygon points="238,256 272,280 268,316 248,318 238,298" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M248 318L242 322M256 318L254 323M264 316L266 321" stroke={C.amberL} strokeWidth={1.6} strokeLinecap="round" />
        <polygon points="190,232 162,246 150,268 160,272 172,258 196,250" fill={C.ink3} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <path d="M150 268L144 274M154 270L150 277M158 272L157 279" stroke={C.amberL} strokeWidth={1.5} strokeLinecap="round" />
        <path d="M188 210C176 176 168 140 172 100L196 92C194 130 200 170 216 198Z" fill={C.ink3} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M188 210C176 176 168 140 172 100L184 98C182 136 186 170 198 204Z" fill={C.ink4} />
        <Plates ctx={ctx} list={[[196, 104, -10, 12], [196, 124, -5, 13], [199, 144, -8, 13], [204, 164, -12, 13], [212, 184, -20, 12], [230, 196, -40, 12]]} />
        <Seam ctx={ctx} d="M194 96C194 140 200 170 216 198Q246 222 256 260Q260 290 246 306" />
        <Head ctx={ctx} x={176} y={88} s={1.28} r={-12} horns="crown" />
      </A>
      {a ? (
        <g>
          <Arc ctx={ctx} d="M232 18L240 32L234 34L246 50L240 52L250 64" />
          <Arc ctx={ctx} d="M62 62L48 52L54 48L36 38" dl={-0.4} />
          <Arc ctx={ctx} d="M352 60L366 48L360 44L378 34" dl={-0.8} />
          <Arc ctx={ctx} d="M204 70L198 86L206 88L196 104L204 108L194 124" dl={-1.1} />
        </g>
      ) : (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const o = orbit(ctx, `c${i}`, { cx: 204, cy: 176, rx: 150, ry: 34, rot: -10, d: 18, phase: i * 72 }, <polygon points="0,-9 5,0 0,9 -5,0" fill={ctx.url("crystal")} stroke={C.ember2} strokeWidth={0.7} />);
            return <g key={i}>{o.front}</g>;
          })}
        </g>
      )}
      <Ember x={110} y={270} s={3.5} />
      <Ember x={316} y={262} s={3} dl={-2.4} />
      <Ember x={150} y={40} s={3} dl={-1.2} />
      <Holo ctx={ctx} x={100} y={52} from={[162, 82]} />
    </g>
  );
}

function SecondRift({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (!ctx.ascended || !ctx.fx) return null;
  const x = box.cx - box.r * 0.78;
  const y = box.cy - box.r * 0.66;
  return (
    <g>
      <A k="bob" d={6} v={{ a: "-6px" }}>
        <path d={vesica(x, y, 18, 6)} fill={ctx.url("irid")} stroke={C.amberP} strokeWidth={1.2} />
      </A>
      {[0, 1, 2].map((i) => (
        <A key={i} k="drift" d={6 + i} dl={-i * 1.5} v={{ x: `${4 - i * 4}px`, y: "-8px" }}>
          <polygon
            points={poly([
              [box.cx + box.r * (0.6 + i * 0.1), box.cy + box.r * (0.2 - i * 0.3) - 7],
              [box.cx + box.r * (0.6 + i * 0.1) + 4, box.cy + box.r * (0.2 - i * 0.3)],
              [box.cx + box.r * (0.6 + i * 0.1), box.cy + box.r * (0.2 - i * 0.3) + 7],
              [box.cx + box.r * (0.6 + i * 0.1) - 4, box.cy + box.r * (0.2 - i * 0.3)],
            ])}
            fill={ctx.url("irid")}
            stroke={C.ember2}
            strokeWidth={0.6}
          />
        </A>
      ))}
    </g>
  );
}

const BOX: Record<number, Box> = {
  1: { cx: 200, cy: 218, r: 116 },
  2: { cx: 200, cy: 222, r: 124 },
  3: { cx: 214, cy: 206, r: 160 },
  4: { cx: 208, cy: 196, r: 184 },
  5: { cx: 204, cy: 190, r: 194 },
};

export function RiftDragon(ctx: Ctx): React.ReactNode {
  const box = BOX[ctx.form];
  const F = [Form1, Form2, Form3, Form4, Form5][ctx.form - 1];
  return (
    <>
      <Defs ctx={ctx} />
      <Aura ctx={ctx} cx={box.cx} cy={box.cy} r={box.r} color={C.amber} />
      <PrepGlow ctx={ctx} box={box} color={C.amberL} />
      <SecondRift ctx={ctx} box={box} />
      <F ctx={ctx} />
      <ActivityOverlay ctx={ctx} box={box} glow={C.amberL} ink={C.ember2} scan={false} />
    </>
  );
}
