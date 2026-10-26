import * as React from "react";
import type { Activity, Form, Motion } from "./types";

/* ------------------------------------------------------------------ */
/* Render context passed to every creation renderer                    */
/* ------------------------------------------------------------------ */

export interface Ctx {
  /** unique, CSS-safe prefix for this instance (class + id namespace) */
  p: string;
  form: Form;
  /** branch used for drawing (null resolves to "a") */
  branch: "a" | "b";
  ascended: boolean;
  activity: Activity;
  locked: boolean;
  /** false when locked: skip glows, auras and light effects so the silhouette stays crisp */
  fx: boolean;
  id: (name: string) => string;
  url: (name: string) => string;
}

export function makeCtx(p: string, o: Omit<Ctx, "p" | "fx" | "id" | "url">): Ctx {
  return {
    ...o,
    p,
    fx: !o.locked,
    id: (n) => `${p}-${n}`,
    url: (n) => `url(#${p}-${n})`,
  };
}

/** round to 1 decimal for compact path strings */
export const f = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* Gradients                                                            */
/* ------------------------------------------------------------------ */

export type Stop = readonly [number, string, number?];

const stopsOf = (stops: readonly Stop[]) =>
  stops.map((s, i) => <stop key={i} offset={s[0]} stopColor={s[1]} stopOpacity={s[2] ?? 1} />);

export function Lin(props: {
  id: string;
  stops: readonly Stop[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  user?: boolean;
}) {
  const { id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1, user } = props;
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={user ? "userSpaceOnUse" : undefined}>
      {stopsOf(stops)}
    </linearGradient>
  );
}

export function Rad(props: {
  id: string;
  stops: readonly Stop[];
  cx?: number;
  cy?: number;
  r?: number;
  fx?: number;
  fy?: number;
  user?: boolean;
}) {
  const { id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy, user } = props;
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx} fy={fy} gradientUnits={user ? "userSpaceOnUse" : undefined}>
      {stopsOf(stops)}
    </radialGradient>
  );
}

/* ------------------------------------------------------------------ */
/* Animation wrapper                                                    */
/* ------------------------------------------------------------------ */

export type AnimKind =
  | "bob"
  | "sway"
  | "spin"
  | "spinr"
  | "breathe"
  | "pulse"
  | "shimmer"
  | "twinkle"
  | "drift"
  | "sweep"
  | "seq"
  | "pop"
  | "swirl"
  | "assemble"
  | "flicker"
  | "squash";

type Vars = Record<string, string | number>;

/**
 * Wraps children in an animated group. `at` sets the pivot (children keep
 * absolute coordinates). `d` = duration (s), `dl` = delay (s), `v` = CSS vars
 * consumed by the keyframes (e.g. a: "-6px", s: 1.05, o: .4).
 */
export function A(props: {
  k: AnimKind;
  d?: number;
  dl?: number;
  at?: readonly [number, number];
  v?: Vars;
  o?: number;
  children?: React.ReactNode;
}) {
  const { k, d, dl, at, v, o, children } = props;
  const style: Record<string, string> = {};
  if (d !== undefined) style["--d"] = `${d}s`;
  if (dl !== undefined) style["--dl"] = `${dl}s`;
  if (v) for (const key of Object.keys(v)) style[`--${key}`] = String(v[key]);
  const inner = at ? <g transform={`translate(${-at[0]} ${-at[1]})`}>{children}</g> : children;
  const g = (
    <g className={`a-${k}`} style={style as React.CSSProperties} opacity={o}>
      {inner}
    </g>
  );
  return at ? <g transform={`translate(${at[0]} ${at[1]})`}>{g}</g> : g;
}

const KF: Record<AnimKind, readonly [string, string]> = {
  bob: ["0%,100%{transform:translate(0,0)}50%{transform:translate(0,var(--a,-6px))}", "ease-in-out"],
  sway: ["0%,100%{transform:rotate(calc(var(--a,3deg)*-1))}50%{transform:rotate(var(--a,3deg))}", "ease-in-out"],
  spin: ["to{transform:rotate(360deg)}", "linear"],
  spinr: ["to{transform:rotate(-360deg)}", "linear"],
  breathe: ["0%,100%{transform:scale(1)}50%{transform:scale(var(--s,1.04))}", "ease-in-out"],
  pulse: ["0%,100%{opacity:var(--o,.45)}50%{opacity:1}", "ease-in-out"],
  shimmer: ["0%,100%{opacity:var(--o,.35)}50%{opacity:1}", "ease-in-out"],
  twinkle: ["0%,100%{opacity:.15;transform:scale(.55)}50%{opacity:1;transform:scale(1)}", "ease-in-out"],
  drift: ["0%,100%{transform:translate(0,0)}50%{transform:translate(var(--x,4px),var(--y,-5px))}", "ease-in-out"],
  sweep: [
    "0%{opacity:0;transform:translate(var(--x0,-220px),var(--y0,0px))}20%,75%{opacity:1}100%{opacity:0;transform:translate(var(--x1,220px),var(--y1,0px))}",
    "ease-in-out",
  ],
  seq: ["0%,100%{opacity:var(--o,.3)}10%{opacity:1}34%{opacity:var(--o,.3)}", "ease-in-out"],
  pop: [
    "0%,62%,100%{opacity:0;transform:scale(.2) rotate(0deg)}16%{opacity:1;transform:scale(1) rotate(25deg)}42%{opacity:0;transform:scale(.45) rotate(70deg)}",
    "ease-out",
  ],
  swirl: [
    "0%{opacity:0;transform:rotate(0deg) scale(var(--s,1.5))}25%{opacity:1}100%{opacity:0;transform:rotate(var(--r,-320deg)) scale(.1)}",
    "ease-in",
  ],
  assemble: [
    "0%{opacity:0;transform:translate(var(--x,0px),var(--y,-50px)) rotate(var(--r,-120deg)) scale(var(--s,1.25))}38%,84%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}100%{opacity:0;transform:translate(0,0) rotate(30deg) scale(.92)}",
    "cubic-bezier(.2,.7,.2,1)",
  ],
  flicker: ["0%,100%{opacity:1}6%{opacity:.3}9%{opacity:.9}31%{opacity:.55}34%{opacity:1}61%{opacity:.4}66%{opacity:1}", "linear"],
  squash: ["0%,100%{transform:scale(1,1)}50%{transform:scale(var(--sx,.45),var(--sy,1))}", "ease-in-out"],
};

/** Per-instance stylesheet: idle motion, pause hook and reduced-motion handling. */
export function motionCss(p: string, motion: Motion): string {
  const S = `.${p}`;
  const pause = `.prism-paused ${S} *,${S}.prism-paused *{animation-play-state:paused!important}`;
  const base = `${S} g{transform-box:view-box;transform-origin:0 0}${S} .a-sweep,${S} .a-swirl{opacity:0}`;
  if (motion === "static") return base + pause;
  // reduced: only very slow, opacity-only breathing (shimmer + glow pulse at 1/3 speed)
  const kinds = (motion === "full" ? Object.keys(KF) : ["shimmer", "pulse"]) as AnimKind[];
  const frames = kinds.map((k) => `@keyframes ${p}-${k}{${KF[k][0]}}`).join("");
  const rules = kinds
    .map(
      (k) =>
        `${S} .a-${k}{animation-name:${p}-${k};animation-duration:calc(var(--d,${k === "shimmer" ? 9 : 6}s)*var(--k,1)${
          motion === "reduced" ? "*3" : ""
        });animation-delay:calc(var(--dl,0s)*var(--k,1));animation-timing-function:${KF[k][1]};animation-iteration-count:infinite;animation-fill-mode:both}`,
    )
    .join("");
  return `${base}${frames}@media (prefers-reduced-motion:no-preference){${rules}}${pause}`;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                     */
/* ------------------------------------------------------------------ */

/** concave four-point sparkle */
export function sparkPath(x: number, y: number, r: number, w = 0.2): string {
  const q = r * w;
  return `M${f(x)} ${f(y - r)}Q${f(x + q)} ${f(y - q)} ${f(x + r)} ${f(y)}Q${f(x + q)} ${f(y + q)} ${f(x)} ${f(y + r)}Q${f(
    x - q,
  )} ${f(y + q)} ${f(x - r)} ${f(y)}Q${f(x - q)} ${f(y - q)} ${f(x)} ${f(y - r)}Z`;
}

/** half of a rotated ellipse; front = lower half (towards viewer) */
export function arcHalf(cx: number, cy: number, rx: number, ry: number, rot: number, front: boolean): string {
  const t = (rot * Math.PI) / 180;
  const ax = cx + rx * Math.cos(t);
  const ay = cy + rx * Math.sin(t);
  const bx = cx - rx * Math.cos(t);
  const by = cy - rx * Math.sin(t);
  return `M${f(ax)} ${f(ay)}A${rx} ${ry} ${rot} 0 ${front ? 1 : 0} ${f(bx)} ${f(by)}`;
}

export const pts = (a: readonly (readonly [number, number])[]) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

/** kite leaf from base b to tip t, split along the midrib into two facets */
export function kite(b: readonly [number, number], t: readonly [number, number], w: number, at = 0.45) {
  const dx = t[0] - b[0];
  const dy = t[1] - b[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = b[0] + dx * at;
  const my = b[1] + dy * at;
  const l: [number, number] = [mx + nx * w, my + ny * w];
  const r: [number, number] = [mx - nx * w, my - ny * w];
  return { a: pts([b, l, t]), b: pts([b, t, r]), all: pts([b, l, t, r]) };
}

/** soft pointed leaf (two quadratic curves) */
export function leafPath(b: readonly [number, number], t: readonly [number, number], w: number): string {
  const dx = t[0] - b[0];
  const dy = t[1] - b[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = b[0] + dx * 0.5;
  const my = b[1] + dy * 0.5;
  return `M${f(b[0])} ${f(b[1])}Q${f(mx + nx * w)} ${f(my + ny * w)} ${f(t[0])} ${f(t[1])}Q${f(mx - nx * w)} ${f(
    my - ny * w,
  )} ${f(b[0])} ${f(b[1])}Z`;
}

/* ------------------------------------------------------------------ */
/* Orbit on a tilted ellipse (2.5D) with front / back depth split       */
/* ------------------------------------------------------------------ */

export interface OrbitSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot?: number;
  /** seconds per revolution */
  d: number;
  /** starting angle in degrees (0 = right end of the major axis) */
  phase?: number;
  reverse?: boolean;
}

/**
 * Returns the same orbiting body twice: `back` (only visible on the far half
 * of the orbit) and `front` (near half). Place `back` before the core and
 * `front` after it. Children are drawn around (0,0) and are never squashed.
 */
export function orbit(ctx: Ctx, key: string, s: OrbitSpec, body: React.ReactNode) {
  const rot = s.rot ?? 0;
  const k = s.ry / s.rx;
  const phase = s.phase ?? 0;
  const t = (rot * Math.PI) / 180;
  const ux = Math.cos(t);
  const uy = Math.sin(t);
  const nx = -uy;
  const ny = ux;
  const L = 600;
  const half = (sgn: 1 | -1) =>
    pts([
      [s.cx + ux * L, s.cy + uy * L],
      [s.cx - ux * L, s.cy - uy * L],
      [s.cx - ux * L + nx * L * sgn, s.cy - uy * L + ny * L * sgn],
      [s.cx + ux * L + nx * L * sgn, s.cy + uy * L + ny * L * sgn],
    ]);
  const spin = s.reverse ? "spinr" : "spin";
  const unspin = s.reverse ? "spin" : "spinr";
  const make = () => (
    <g transform={`translate(${s.cx} ${s.cy}) rotate(${rot}) scale(1 ${f(k * 1000) / 1000})`}>
      <A k={spin} d={s.d}>
        <g transform={`rotate(${phase}) translate(${s.rx} 0) rotate(${-phase})`}>
          <A k={unspin} d={s.d}>
            <g transform={`scale(1 ${f((1 / k) * 1000) / 1000}) rotate(${-rot})`}>{body}</g>
          </A>
        </g>
      </A>
    </g>
  );
  const bid = ctx.id(`ob-${key}-b`);
  const fid = ctx.id(`ob-${key}-f`);
  return {
    back: (
      <g>
        <clipPath id={bid}>
          <polygon points={half(-1)} />
        </clipPath>
        <g clipPath={`url(#${bid})`}>{make()}</g>
      </g>
    ),
    front: (
      <g>
        <clipPath id={fid}>
          <polygon points={half(1)} />
        </clipPath>
        <g clipPath={`url(#${fid})`}>{make()}</g>
      </g>
    ),
  };
}

/**
 * Clip one node into its far (back) and near (front) halves around a line
 * through (cx,cy) at `rot` degrees, for layering around a central body.
 */
export function halves(ctx: Ctx, key: string, cx: number, cy: number, rot: number, node: React.ReactNode) {
  const t = (rot * Math.PI) / 180;
  const ux = Math.cos(t);
  const uy = Math.sin(t);
  const L = 600;
  const poly = (sgn: 1 | -1) =>
    pts([
      [cx + ux * L, cy + uy * L],
      [cx - ux * L, cy - uy * L],
      [cx - ux * L - uy * L * sgn, cy - uy * L + ux * L * sgn],
      [cx + ux * L - uy * L * sgn, cy + uy * L + ux * L * sgn],
    ]);
  const bid = ctx.id(`hv-${key}-b`);
  const fid = ctx.id(`hv-${key}-f`);
  return {
    back: (
      <g>
        <clipPath id={bid}>
          <polygon points={poly(-1)} />
        </clipPath>
        <g clipPath={`url(#${bid})`}>{node}</g>
      </g>
    ),
    front: (
      <g>
        <clipPath id={fid}>
          <polygon points={poly(1)} />
        </clipPath>
        <g clipPath={`url(#${fid})`}>{node}</g>
      </g>
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Shared defs + overlays                                               */
/* ------------------------------------------------------------------ */

export function SharedDefs({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Rad id={ctx.id("shadow")} stops={[[0, "#2A1D16", 0.55], [0.55, "#2A1D16", 0.22], [1, "#2A1D16", 0]]} />
      {ctx.ascended && (
        <>
          <Lin
            id={ctx.id("irid")}
            x1={0}
            y1={0}
            x2={1}
            y2={1}
            stops={[
              [0, "#FF9FD6"],
              [0.22, "#A8E9FF"],
              [0.45, "#FFF1A8"],
              [0.68, "#C2A8FF"],
              [0.85, "#9FFFD9"],
              [1, "#FFB3C7"],
            ]}
          />
          <Lin
            id={ctx.id("irid2")}
            x1={1}
            y1={0}
            x2={0}
            y2={1}
            stops={[
              [0, "#B6FFE6"],
              [0.3, "#FFB8E1"],
              [0.55, "#B9C8FF"],
              [0.8, "#FFE9A6"],
              [1, "#A6F0FF"],
            ]}
          />
        </>
      )}
      {ctx.locked && (
        <filter
          id={ctx.id("locked")}
          x={0}
          y={0}
          width={400}
          height={400}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feComponentTransfer in="SourceAlpha" result="a">
            <feFuncA type="linear" slope={1.8} intercept={0} />
          </feComponentTransfer>
          <feMorphology in="a" operator="dilate" radius={1.6} result="d" />
          <feFlood floodColor="#9A8E82" floodOpacity={0.5} result="rc" />
          <feComposite in="rc" in2="d" operator="in" result="rim" />
          <feFlood floodColor="#2E2924" result="c" />
          <feComposite in="c" in2="a" operator="in" result="sil" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="sil" />
          </feMerge>
        </filter>
      )}
    </>
  );
}

/** ground shadow (reads on ivory) + optional coloured light pool (reads on dark) */
export function Ground(props: { ctx: Ctx; cx: number; cy: number; rx: number; ry: number; o?: number; pool?: string }) {
  const { ctx, cx, cy, rx, ry, o = 0.55, pool } = props;
  return (
    <g>
      {pool && ctx.fx && <ellipse cx={cx} cy={cy} rx={rx * 1.35} ry={ry * 1.6} fill={pool} />}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={ctx.url("shadow")} opacity={o} />
    </g>
  );
}

/** iridescent sheen overlay for ascended forms; pass the same path/shape you want coated */
export function Sheen({ ctx, children, o = 0.42 }: { ctx: Ctx; children: React.ReactElement; o?: number }) {
  if (!ctx.ascended || !ctx.fx) return null;
  const el = children as React.ReactElement<Record<string, unknown>>;
  return (
    <g pointerEvents="none">
      <A k="shimmer" d={7} v={{ o: 0.25 }}>
        <g opacity={o}>{React.cloneElement(el, { fill: ctx.url("irid"), stroke: "none" })}</g>
      </A>
      <A k="shimmer" d={7} dl={-3.5} v={{ o: 0.15 }}>
        <g opacity={o * 0.8}>{React.cloneElement(el, { fill: ctx.url("irid2"), stroke: "none" })}</g>
      </A>
    </g>
  );
}

/** subtle prismatic aura behind ascended creations */
export function Aura({ ctx, cx, cy, r, color }: { ctx: Ctx; cx: number; cy: number; r: number; color: string }) {
  if (!ctx.ascended || !ctx.fx) return null;
  return (
    <g>
      <Rad id={ctx.id("aura")} stops={[[0, color, 0.34], [0.55, color, 0.16], [0.82, color, 0.07], [1, color, 0]]} />
      <A k="breathe" d={8} at={[cx, cy]} v={{ s: 1.05 }}>
        <circle cx={cx} cy={cy} r={r} fill={ctx.url("aura")} />
      </A>
      <A k="spin" d={60} at={[cx, cy]}>
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.9}
          fill="none"
          stroke={ctx.url("irid")}
          strokeWidth={1.4}
          strokeDasharray="1 7"
          strokeLinecap="round"
          opacity={0.75}
        />
      </A>
      <A k="shimmer" d={6} v={{ o: 0.2 }}>
        <circle cx={cx} cy={cy} r={r * 0.97} fill="none" stroke={ctx.url("irid2")} strokeWidth={0.8} opacity={0.6} />
      </A>
    </g>
  );
}

export interface Box {
  cx: number;
  cy: number;
  r: number;
}

/** light wash for "preparing" (behind the art) */
export function PrepGlow({ ctx, box, color }: { ctx: Ctx; box: Box; color: string }) {
  if (ctx.activity !== "preparing" || !ctx.fx) return null;
  return (
    <g>
      <Rad id={ctx.id("prep")} stops={[[0, color, 0.5], [0.6, color, 0.18], [1, color, 0]]} />
      <A k="pulse" d={5} v={{ o: 0.15 }}>
        <circle cx={box.cx} cy={box.cy} r={box.r} fill={ctx.url("prep")} />
      </A>
    </g>
  );
}

/** overlays drawn above the art: scan shimmer (researching) and sparkles (celebrating) */
export function ActivityOverlay(props: { ctx: Ctx; box: Box; glow: string; ink: string; scan?: boolean }) {
  const { ctx, box, glow, ink, scan = true } = props;
  if (!ctx.fx) return null;
  if (ctx.activity === "researching" && scan) {
    const w = box.r * 1.05;
    return (
      <g pointerEvents="none">
        <Rad id={ctx.id("scan")} stops={[[0, glow, 0.55], [0.5, glow, 0.22], [1, glow, 0]]} />
        <A k="sweep" d={4.2} v={{ x0: "0px", x1: "0px", y0: `${-box.r * 0.9}px`, y1: `${box.r * 0.9}px` }}>
          <ellipse cx={box.cx} cy={box.cy} rx={w} ry={16} fill={ctx.url("scan")} />
          <ellipse cx={box.cx} cy={box.cy} rx={w * 0.8} ry={0.8} fill={glow} opacity={0.9} />
        </A>
      </g>
    );
  }
  if (ctx.activity === "celebrating") {
    const n = 9;
    return (
      <g pointerEvents="none">
        {Array.from({ length: n }, (_, i) => {
          const ang = (i / n) * Math.PI * 2 + 0.4;
          const rr = box.r * (0.72 + ((i * 37) % 10) / 40);
          const x = box.cx + Math.cos(ang) * rr;
          const y = box.cy + Math.sin(ang) * rr * 0.9;
          const s = 6 + ((i * 53) % 7);
          return (
            <A key={i} k="pop" d={2.6} dl={-(i * 0.29)} at={[x, y]}>
              <path d={sparkPath(x, y, s)} fill={glow} stroke={ink} strokeWidth={0.7} strokeOpacity={0.7} />
              <circle cx={x} cy={y} r={s * 0.18} fill="#FFFFFF" />
            </A>
          );
        })}
      </g>
    );
  }
  return null;
}
