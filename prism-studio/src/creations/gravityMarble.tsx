import * as React from "react";
import {
  A,
  ActivityOverlay,
  Aura,
  Ground,
  Lin,
  PrepGlow,
  Rad,
  Sheen,
  arcHalf,
  f,
  halves,
  orbit,
  pts,
  sparkPath,
  type Box,
  type Ctx,
} from "./kit";

/* The Gravity Marble: electric blue, steel, white.
   Motif: a clear glass marble with an electric-blue swirl at the heart of every machine. */

const C = {
  blue: "#2F6BFF",
  blue2: "#1E50E0",
  blue3: "#1438B0",
  deep: "#0C2470",
  bl: "#7FB0FF",
  bp: "#CFE0FF",
  cyan: "#8FE6FF",
  steel: "#A3AEBF",
  steel2: "#7A869A",
  steel3: "#56627A",
  steel4: "#343D50",
  steelL: "#E2E7EF",
};

type P = readonly [number, number];

function Defs({ ctx }: { ctx: Ctx }) {
  const u = ctx.id;
  return (
    <defs>
      <Rad id={u("marble")} fx={0.36} fy={0.3} r={0.62} stops={[[0, "#FFFFFF"], [0.22, "#E6EEFF"], [0.55, "#A8C6FF"], [0.85, "#4579F2"], [1, "#1B45C4"]]} />
      <Rad id={u("depth")} stops={[[0, C.deep, 0], [0.68, C.deep, 0.06], [1, C.deep, 0.5]]} />
      <Lin id={u("swirl")} x1={0} y1={0} x2={1} y2={1} stops={[[0, "#0E2F9E"], [0.5, C.blue], [1, C.cyan]]} />
      <Rad id={u("glowB")} stops={[[0, C.bl, 0.8], [0.4, C.blue, 0.28], [1, C.blue, 0]]} />
      <Lin id={u("band")} x1={0} y1={0} x2={1} y2={0.3} stops={[[0, "#F4F7FB"], [0.4, C.steel], [1, C.steel3]]} />
      <Lin id={u("face")} stops={[[0, "#EEF2F8"], [1, C.steel]]} />
      <Rad id={u("pool")} stops={[[0, C.blue, 0.42], [1, C.blue, 0]]} />
      <Lin id={u("grid")} x1={20} y1={0} x2={380} y2={0} user stops={[[0, C.blue, 0], [0.22, C.blue, 0.6], [0.78, C.blue, 0.6], [1, C.blue, 0]]} />
      <Lin id={u("trail")} x1={0} y1={0} x2={1} y2={1} stops={[[0, C.bl, 0], [0.7, C.blue, 0.75], [1, "#FFFFFF", 1]]} />
    </defs>
  );
}

/* ---------------- parts ---------------- */

function Marble({ ctx, x, y, r, blaze = 0 }: { ctx: Ctx; x: number; y: number; r: number; blaze?: number }) {
  const clip = ctx.id(`mc${Math.round(x)}${Math.round(y)}`);
  const ribbon = (s: number) =>
    `M${f(x - r * 0.95)} ${f(y + r * 0.22 * s)}C${f(x - r * 0.4)} ${f(y - r * 0.55 * s)} ${f(x + r * 0.15)} ${f(y + r * 0.55 * s)} ${f(x + r * 0.95)} ${f(
      y - r * 0.28 * s,
    )}L${f(x + r * 0.95)} ${f(y - r * 0.02 * s)}C${f(x + r * 0.1)} ${f(y + r * 0.82 * s)} ${f(x - r * 0.42)} ${f(y - r * 0.24 * s)} ${f(x - r * 0.95)} ${f(
      y + r * 0.46 * s,
    )}Z`;
  return (
    <g>
      {ctx.fx && (
        <A k="pulse" d={4} v={{ o: 0.6 }}>
          <circle cx={x} cy={y} r={r * (2.1 + blaze)} fill={ctx.url("glowB")} />
        </A>
      )}
      <clipPath id={clip}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <circle cx={x} cy={y} r={r} fill={ctx.url("marble")} />
      <g clipPath={`url(#${clip})`}>
        <A k="spin" d={16} at={[x, y]}>
          <path d={ribbon(1)} fill={ctx.url("swirl")} opacity={0.92} />
          <path d={ribbon(0.55)} transform={`rotate(180 ${x} ${y}) translate(0 ${f(r * 0.18)})`} fill={C.bl} opacity={0.45} />
        </A>
        <circle cx={x} cy={y} r={r} fill={ctx.url("depth")} />
      </g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={C.deep} strokeOpacity={0.55} strokeWidth={Math.max(1, r * 0.03)} />
      <ellipse cx={x - r * 0.36} cy={y - r * 0.42} rx={r * 0.28} ry={r * 0.16} transform={`rotate(-30 ${f(x - r * 0.36)} ${f(y - r * 0.42)})`} fill="#FFFFFF" opacity={0.9} />
      <path
        d={`M${f(x + r * 0.2)} ${f(y + r * 0.8)}A${f(r * 0.86)} ${f(r * 0.86)} 0 0 0 ${f(x + r * 0.82)} ${f(y + r * 0.22)}`}
        fill="none"
        stroke={C.cyan}
        strokeWidth={Math.max(1.2, r * 0.06)}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Sheen ctx={ctx} o={0.38}>
        <circle cx={x} cy={y} r={r} />
      </Sheen>
    </g>
  );
}

type RingKind = "steel" | "light" | "fine";

/** a ring split into back/front halves around the core */
function ring(ctx: Ctx, o: { cx: number; cy: number; rx: number; ry: number; rot?: number; w?: number; kind?: RingKind; ticks?: boolean }) {
  const { cx, cy, rx, ry, rot = 0, w = 4, kind = "steel", ticks = false } = o;
  const half = (front: boolean) => {
    const d = arcHalf(cx, cy, rx, ry, rot, front);
    if (kind === "light") {
      return (
        <g fill="none" strokeLinecap="round">
          {ctx.fx && <path d={d} stroke={C.blue} strokeOpacity={front ? 0.3 : 0.16} strokeWidth={w * 2.8} />}
          <path d={d} stroke={front ? C.blue : C.blue2} strokeWidth={w * 0.75} opacity={front ? 1 : 0.6} />
          <path d={d} stroke={front ? "#FFFFFF" : C.bl} strokeWidth={w * 0.25} opacity={front ? 0.95 : 0.6} />
        </g>
      );
    }
    if (kind === "fine") {
      return <path d={d} fill="none" stroke={C.steel2} strokeWidth={1} strokeDasharray="2 5" opacity={front ? 0.9 : 0.5} />;
    }
    return (
      <g fill="none" opacity={front ? 1 : 0.75}>
        <path d={d} stroke={C.steel4} strokeWidth={w + 2} />
        <path d={d} stroke={front ? ctx.url("band") : C.steel2} strokeWidth={w} />
        <path d={d} stroke={C.steelL} strokeWidth={Math.max(0.8, w * 0.22)} opacity={0.9} />
        {ticks && <path d={d} stroke={C.blue} strokeWidth={w * 0.55} strokeDasharray="1.2 6" />}
      </g>
    );
  };
  return { back: half(false), front: half(true) };
}

function Bead({ r, light = false }: { r: number; light?: boolean }) {
  return (
    <g>
      <circle r={r} fill={light ? C.bl : C.steel} stroke={light ? C.blue2 : C.steel4} strokeWidth={0.9} />
      <circle r={r * 0.55} cx={-r * 0.1} cy={-r * 0.1} fill={light ? "#FFFFFF" : C.blue} opacity={light ? 0.85 : 1} />
      <circle r={r * 0.22} cx={-r * 0.38} cy={-r * 0.42} fill="#FFFFFF" />
    </g>
  );
}

/** comet light trail on a tilted orbit */
function Trail({ ctx, k, cx, cy, rx, ry, rot, d, len = 110, w = 3, dl = 0 }: { ctx: Ctx; k: string; cx: number; cy: number; rx: number; ry: number; rot: number; d: number; len?: number; w?: number; dl?: number }) {
  const a = (-len * Math.PI) / 180;
  const tx = rx * Math.cos(a);
  const ty = rx * Math.sin(a);
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(1 ${f((ry / rx) * 1000) / 1000})`} data-trail={k}>
      <A k="spin" d={d} dl={dl}>
        <path d={`M${f(tx)} ${f(ty)}A${rx} ${rx} 0 0 1 ${rx} 0`} fill="none" stroke={ctx.url("trail")} strokeWidth={w} strokeLinecap="round" />
        <circle cx={rx} cy={0} r={w * 1.15} fill="#FFFFFF" stroke={C.blue} strokeWidth={0.8} />
      </A>
    </g>
  );
}

function Plinth({ ctx, cx, cy, rx, ry, h }: { ctx: Ctx; cx: number; cy: number; rx: number; ry: number; h: number }) {
  const hex = [0, 60, 120, 180, 240, 300].map((a) => [cx + rx * Math.cos((a * Math.PI) / 180), cy + ry * Math.sin((a * Math.PI) / 180)] as P);
  const dn = (p: P): P => [p[0], p[1] + h];
  return (
    <g stroke={C.steel4} strokeOpacity={0.7} strokeWidth={0.9} strokeLinejoin="round">
      <polygon points={pts([hex[3], hex[2], dn(hex[2]), dn(hex[3])])} fill={C.steel} />
      <polygon points={pts([hex[2], hex[1], dn(hex[1]), dn(hex[2])])} fill={C.steel2} />
      <polygon points={pts([hex[1], hex[0], dn(hex[0]), dn(hex[1])])} fill={C.steel3} />
      <polygon points={pts(hex)} fill={ctx.url("face")} />
      <path d={`M${pts([hex[3], hex[2], hex[1], hex[0]]).replace(/ /g, "L")}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1} />
      <path d={`M${pts([dn(hex[3]), dn(hex[2]), dn(hex[1]), dn(hex[0])]).replace(/ /g, "L")}`} fill="none" stroke={C.blue} strokeOpacity={0.9} strokeWidth={1.4} />
      <ellipse cx={cx} cy={cy} rx={rx * 0.5} ry={ry * 0.5} fill="none" stroke={C.blue} strokeWidth={1.6} />
      {ctx.fx && <ellipse cx={cx} cy={cy} rx={rx * 0.5} ry={ry * 0.5} fill={ctx.url("glowB")} stroke="none" opacity={0.8} />}
    </g>
  );
}

function Cube({ x, y, s }: { x: number; y: number; s: number }) {
  const w = s * 0.87;
  return (
    <g stroke={C.blue2} strokeOpacity={0.8} strokeWidth={0.8} strokeLinejoin="round">
      <polygon points={pts([[x, y - s], [x + w, y - s / 2], [x, y], [x - w, y - s / 2]])} fill={C.steelL} />
      <polygon points={pts([[x - w, y - s / 2], [x, y], [x, y + s], [x - w, y + s / 2]])} fill={C.steel} />
      <polygon points={pts([[x, y], [x + w, y - s / 2], [x + w, y + s / 2], [x, y + s]])} fill={C.steel3} />
      <path d={`M${f(x - w)} ${f(y - s / 2)}L${f(x)} ${f(y)}L${f(x + w)} ${f(y - s / 2)}`} fill="none" stroke={C.bl} strokeWidth={1.1} />
    </g>
  );
}

/** floating bipyramid prism (kinetic structure) drawn around (0,0) */
function Shard({ h, w }: { h: number; w: number }) {
  const t = h * 0.3;
  return (
    <g stroke={C.deep} strokeOpacity={0.55} strokeWidth={0.8} strokeLinejoin="round">
      <polygon points={pts([[-w / 2, -h / 2 + t], [0, -h / 2], [0, h / 2], [-w / 2, h / 2 - t]])} fill={C.bp} />
      <polygon points={pts([[0, -h / 2], [w / 2, -h / 2 + t], [w / 2, h / 2 - t], [0, h / 2]])} fill={C.blue2} />
      <path d={`M0 ${f(-h / 2)}L0 ${f(h / 2)}`} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1} />
    </g>
  );
}

function Spark({ x, y, s, dl = 0 }: { x: number; y: number; s: number; dl?: number }) {
  return (
    <A k="twinkle" d={3.2} dl={dl} at={[x, y]}>
      <path d={sparkPath(x, y, s)} fill="#FFFFFF" stroke={C.blue} strokeWidth={0.8} />
    </A>
  );
}

/** wrap a part so it assembles + orbits in while rendering */
function asm(ctx: Ctx, i: number, at: P, node: React.ReactNode) {
  if (ctx.activity !== "rendering" || !ctx.fx) return node;
  const dirs: [number, number, number][] = [
    [-70, -40, -140],
    [80, -30, 120],
    [-40, 70, 160],
    [60, 60, -100],
    [0, -80, 200],
  ];
  const [x, y, r] = dirs[i % dirs.length];
  return (
    <A k="assemble" d={3.6} dl={-i * 0.25} at={at} v={{ x: `${x}px`, y: `${y}px`, r: `${r}deg`, s: 1.3 }}>
      {node}
    </A>
  );
}

function Ripples({ cx, cy, n = 3, rx = 40 }: { cx: number; cy: number; n?: number; rx?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <A key={i} k="pulse" d={4} dl={-i * 1.3} v={{ o: 0.15 }}>
          <ellipse cx={cx} cy={cy} rx={rx + i * 22} ry={(rx + i * 22) * 0.17} fill="none" stroke={C.blue} strokeWidth={1.1} opacity={0.75 - i * 0.2} />
        </A>
      ))}
    </g>
  );
}

/* ---------------- forms ---------------- */

function Form1({ ctx }: { ctx: Ctx }) {
  const cup = ring(ctx, { cx: 200, cy: 274, rx: 40, ry: 11, w: 7 });
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={290} rx={70} ry={11} pool={ctx.url("pool")} />
      <Ripples cx={200} cy={290} rx={62} />
      {cup.back}
      <Marble ctx={ctx} x={200} y={222} r={54} />
      {cup.front}
      <Spark x={142} y={168} s={6} />
      <Spark x={262} y={186} s={4.5} dl={-1.5} />
    </g>
  );
}

function Form2({ ctx }: { ctx: Ctx }) {
  const R1 = ring(ctx, { cx: 200, cy: 196, rx: 112, ry: 28, rot: -14, w: 3.5 });
  const R2 = ring(ctx, { cx: 200, cy: 196, rx: 140, ry: 38, rot: 10, kind: "fine" });
  const b1 = orbit(ctx, "b1", { cx: 200, cy: 196, rx: 112, ry: 28, rot: -14, d: 9, phase: 30 }, <Bead r={8} />);
  const b2 = orbit(ctx, "b2", { cx: 200, cy: 196, rx: 140, ry: 38, rot: 10, d: 16, phase: 200 }, <Bead r={4.5} light />);
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={326} rx={78} ry={10} pool={ctx.url("pool")} />
      <Plinth ctx={ctx} cx={200} cy={300} rx={58} ry={15} h={20} />
      {R2.back}
      {b2.back}
      {asm(ctx, 0, [200, 196], R1.back)}
      {b1.back}
      <A k="bob" d={5} v={{ a: "-7px" }}>
        <Marble ctx={ctx} x={200} y={196} r={50} />
      </A>
      {asm(ctx, 0, [200, 196], R1.front)}
      {b1.front}
      {R2.front}
      {b2.front}
      <Spark x={110} y={128} s={5} />
      <Spark x={300} y={250} s={4} dl={-1.6} />
    </g>
  );
}

function Form3({ ctx }: { ctx: Ctx }) {
  const cx = 200;
  const cy = 182;
  if (ctx.branch === "b") {
    const loops = [38, 58, 80];
    const field = (front: boolean) => (
      <g>
        {loops.map((a, i) =>
          [-1, 1].map((s) => {
            const r = ring(ctx, { cx: cx + s * a * 0.92, cy, rx: a, ry: a * 1.25, w: 2.6 - i * 0.4, kind: "light" });
            return (
              <A key={`${i}${s}`} k="seq" d={3} dl={-i * 0.4} v={{ o: 0.55 }}>
                {front ? r.front : r.back}
              </A>
            );
          }),
        )}
      </g>
    );
    const eq = ring(ctx, { cx, cy, rx: 112, ry: 22, w: 3, kind: "light" });
    const p1 = orbit(ctx, "p1", { cx, cy, rx: 112, ry: 22, d: 6 }, <circle r={4} fill="#FFFFFF" stroke={C.blue} strokeWidth={1.2} />);
    const p2 = orbit(ctx, "p2", { cx, cy, rx: 112, ry: 22, d: 6, phase: 180 }, <circle r={3} fill={C.cyan} stroke={C.blue2} strokeWidth={1} />);
    return (
      <g>
        <Ground ctx={ctx} cx={200} cy={334} rx={80} ry={10} pool={ctx.url("pool")} />
        <A k="bob" d={6} dl={-2} v={{ a: "-4px" }}>
          <ellipse cx={200} cy={306} rx={74} ry={17} fill={ctx.url("face")} stroke={C.steel4} strokeOpacity={0.6} />
          <path d="M126 306A74 17 0 0 0 274 306L274 314A74 17 0 0 1 126 314Z" fill={C.steel2} stroke={C.steel4} strokeOpacity={0.6} />
          {[52, 36, 20].map((r, i) => (
            <A key={r} k="pulse" d={2.4} dl={-i * 0.5} v={{ o: 0.3 }}>
              <ellipse cx={200} cy={306} rx={r} ry={r * 0.23} fill="none" stroke={C.blue} strokeWidth={1.6} />
            </A>
          ))}
        </A>
        {ctx.fx && <path d="M186 300L176 232L224 232L214 300Z" fill={ctx.url("glowB")} opacity={0.5} />}
        {asm(ctx, 1, [cx, cy], eq.back)}
        {p1.back}
        {p2.back}
        {asm(ctx, 0, [cx, cy], field(false))}
        <Marble ctx={ctx} x={cx} y={cy} r={44} blaze={0.3} />
        {asm(ctx, 0, [cx, cy], field(true))}
        {asm(ctx, 1, [cx, cy], eq.front)}
        {p1.front}
        {p2.front}
        <Spark x={92} y={120} s={5} />
        <Spark x={312} y={246} s={4} dl={-1.2} />
      </g>
    );
  }
  const outer = ring(ctx, { cx, cy, rx: 100, ry: 100, w: 5, ticks: true });
  const mid = ring(ctx, { cx, cy, rx: 84, ry: 24, rot: -22, w: 4 });
  const inner = ring(ctx, { cx, cy, rx: 66, ry: 66, w: 3.5 });
  const sat = orbit(ctx, "s1", { cx, cy, rx: 84, ry: 24, rot: -22, d: 7 }, <Bead r={6.5} />);
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={336} rx={92} ry={12} pool={ctx.url("pool")} />
      <ellipse cx={200} cy={318} rx={84} ry={18} fill={C.steel3} stroke={C.steel4} strokeOpacity={0.7} />
      <path d="M116 318A84 18 0 0 0 284 318L284 330A84 18 0 0 1 116 330Z" fill={C.steel2} stroke={C.steel4} strokeOpacity={0.7} />
      <path d={arcHalf(200, 324, 84, 18, 0, true)} fill="none" stroke={C.steelL} strokeWidth={2} strokeDasharray="1.5 5" />
      <ellipse cx={200} cy={304} rx={60} ry={13} fill={ctx.url("face")} stroke={C.steel4} strokeOpacity={0.7} />
      <path d="M140 304A60 13 0 0 0 260 304L260 314A60 13 0 0 1 140 314Z" fill={C.steel} stroke={C.steel4} strokeOpacity={0.7} />
      <path d={arcHalf(200, 309, 60, 13, 0, true)} fill="none" stroke={C.blue} strokeWidth={1.6} />
      <path d="M194 302L196 282L204 282L206 302Z" fill={C.steel2} stroke={C.steel4} strokeOpacity={0.7} />
      <path d={`M200 82L200 70`} stroke={C.steel3} strokeWidth={4} strokeLinecap="round" />
      <circle cx={200} cy={68} r={4} fill={C.blue} stroke={C.deep} strokeWidth={0.8} />
      {asm(ctx, 0, [cx, cy], <A k="squash" d={9} at={[cx, cy]} v={{ sx: 0.55 }}>{outer.back}</A>)}
      {asm(ctx, 1, [cx, cy], mid.back)}
      {sat.back}
      {asm(ctx, 2, [cx, cy], <A k="squash" d={7} at={[cx, cy]} v={{ sx: 1, sy: 0.3 }}>{inner.back}</A>)}
      <Marble ctx={ctx} x={cx} y={cy} r={42} />
      {asm(ctx, 2, [cx, cy], <A k="squash" d={7} at={[cx, cy]} v={{ sx: 1, sy: 0.3 }}>{inner.front}</A>)}
      {asm(ctx, 1, [cx, cy], mid.front)}
      {sat.front}
      {asm(ctx, 0, [cx, cy], <A k="squash" d={9} at={[cx, cy]} v={{ sx: 0.55 }}>{outer.front}</A>)}
      <Spark x={86} y={110} s={5} />
      <Spark x={318} y={232} s={4} dl={-1.2} />
    </g>
  );
}

function Clamp({ ctx, side }: { ctx: Ctx; side: -1 | 1 }) {
  const x = (v: number) => 200 + side * v;
  const d = `M${x(52)} 300C${x(108)} 266 ${x(112)} 136 ${x(52)} 92`;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={C.steel4} strokeWidth={17} />
      <path d={d} stroke={ctx.url("band")} strokeWidth={13} />
      <path d={d} stroke={C.blue} strokeWidth={2.2} strokeDasharray={ctx.branch === "a" ? "10 6" : "2 4"} />
      <circle cx={x(52)} cy={92} r={7} fill={C.blue} stroke={C.deep} strokeWidth={1.2} />
      <circle cx={x(50)} cy={90} r={2.4} fill="#FFFFFF" />
    </g>
  );
}

function Form4({ ctx }: { ctx: Ctx }) {
  const cx = 200;
  const cy = 190;
  const a = ctx.branch === "a";
  const r1 = ring(ctx, { cx, cy, rx: 92, ry: 26, rot: -18, w: a ? 4 : 2.6, kind: a ? "steel" : "light", ticks: a });
  const r2 = ring(ctx, { cx, cy, rx: 72, ry: 72, w: a ? 3.5 : 2.4, kind: a ? "steel" : "light" });
  const r3 = ring(ctx, { cx, cy, rx: 112, ry: 34, rot: 16, w: 2.2, kind: a ? "fine" : "light" });
  const t1 = halves(ctx, "t1", cx, cy, -18, <Trail ctx={ctx} k="1" cx={cx} cy={cy} rx={128} ry={36} rot={-18} d={5} />);
  const t2 = halves(ctx, "t2", cx, cy, 16, <Trail ctx={ctx} k="2" cx={cx} cy={cy} rx={112} ry={34} rot={16} d={7} dl={-3} len={90} w={2.4} />);
  const s1 = orbit(ctx, "s1", { cx, cy, rx: 92, ry: 26, rot: -18, d: 8, phase: 140 }, a ? <Bead r={7} /> : <circle r={4.5} fill="#FFFFFF" stroke={C.blue} strokeWidth={1.4} />);
  const cubes: [number, number, number, number][] = [
    [96, 236, 11, 0],
    [312, 140, 13, -2],
    [300, 262, 9, -4],
    [112, 120, 8, -1],
  ];
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={372} rx={84} ry={8} o={0.35} pool={ctx.url("pool")} />
      <A k="bob" d={6} v={{ a: "-4px" }}>
        {ctx.fx &&
          [150, 200, 250].map((x) => (
            <ellipse key={x} cx={x} cy={344} rx={10} ry={18} fill={ctx.url("glowB")} />
          ))}
        <Plinth ctx={ctx} cx={200} cy={312} rx={100} ry={22} h={22} />
      </A>
      <Clamp ctx={ctx} side={-1} />
      <Clamp ctx={ctx} side={1} />
      {a ? (
        <g>
          <path d="M126 196L150 196L166 188" fill="none" stroke={C.steel3} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M274 196L250 196L234 188" fill="none" stroke={C.steel3} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          {[
            [150, 196],
            [250, 196],
          ].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r={7} fill={C.steel} stroke={C.steel4} />
              <circle cx={x} cy={y} r={2.5} fill={C.blue} />
            </g>
          ))}
          <A k="spin" d={12} at={[143, 262]}>
            <circle cx={143} cy={262} r={14} fill="none" stroke={C.steel3} strokeWidth={6} strokeDasharray="3 3" />
            <circle cx={143} cy={262} r={9} fill={C.steel} stroke={C.steel4} />
          </A>
          <A k="spinr" d={12} at={[257, 262]}>
            <circle cx={257} cy={262} r={14} fill="none" stroke={C.steel3} strokeWidth={6} strokeDasharray="3 3" />
            <circle cx={257} cy={262} r={9} fill={C.steel} stroke={C.steel4} />
          </A>
        </g>
      ) : (
        <g>
          {[46, 70, 98].map((r, i) => (
            <A key={r} k="breathe" d={3} dl={-i} at={[cx, cy]} v={{ s: 1.12 }}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.blue} strokeWidth={1} opacity={0.5 - i * 0.12} />
            </A>
          ))}
          <path d="M152 92Q200 140 248 92M152 300Q200 250 248 300" fill="none" stroke={C.bl} strokeWidth={1.4} strokeDasharray="3 4" />
        </g>
      )}
      {asm(ctx, 0, [cx, cy], r3.back)}
      {t2.back}
      {asm(ctx, 1, [cx, cy], r1.back)}
      {s1.back}
      {t1.back}
      {asm(ctx, 2, [cx, cy], <A k="squash" d={8} at={[cx, cy]} v={{ sx: 0.4 }}>{r2.back}</A>)}
      <A k="bob" d={4} v={{ a: "-3px" }}>
        <Marble ctx={ctx} x={cx} y={cy} r={40} blaze={0.6} />
      </A>
      {asm(ctx, 2, [cx, cy], <A k="squash" d={8} at={[cx, cy]} v={{ sx: 0.4 }}>{r2.front}</A>)}
      {t1.front}
      {asm(ctx, 1, [cx, cy], r1.front)}
      {s1.front}
      {t2.front}
      {asm(ctx, 0, [cx, cy], r3.front)}
      {cubes.map(([x, y, s, dl], i) => (
        <A key={i} k="bob" d={5 + i} dl={dl} v={{ a: `${-6 - i * 2}px` }}>
          {asm(ctx, i + 1, [x, y], <Cube x={x} y={y} s={s} />)}
        </A>
      ))}
      <Spark x={330} y={200} s={5} />
      <Spark x={70} y={180} s={4} dl={-1.4} />
    </g>
  );
}

function Grid({ ctx }: { ctx: Ctx }) {
  const rings = [
    [40, 356],
    [80, 345],
    [122, 338],
    [166, 334],
  ] as const;
  const spokes = 12;
  return (
    <g fill="none" stroke={ctx.url("grid")} strokeWidth={1}>
      {rings.map(([r, y]) => (
        <ellipse key={r} cx={200} cy={y} rx={r} ry={r * 0.24} />
      ))}
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        const ox = 200 + Math.cos(a) * 166;
        const oy = 334 + Math.sin(a) * 166 * 0.24;
        const mx = 200 + Math.cos(a) * 80;
        const my = 345 + Math.sin(a) * 80 * 0.24;
        return <path key={i} d={`M200 364Q${f(mx)} ${f(my + 4)} ${f(ox)} ${f(oy)}`} />;
      })}
    </g>
  );
}

function Form5({ ctx }: { ctx: Ctx }) {
  const cx = 200;
  const cy = 192;
  const a = ctx.branch === "a";
  const rA = ring(ctx, { cx, cy, rx: 150, ry: 40, rot: -16, w: a ? 5 : 3, kind: a ? "steel" : "light", ticks: a });
  const rB = ring(ctx, { cx, cy, rx: 122, ry: 122, w: a ? 4 : 2.4, kind: a ? "steel" : "light" });
  const rC = ring(ctx, { cx, cy, rx: 104, ry: 30, rot: 24, w: a ? 3.5 : 2.4, kind: a ? "steel" : "light" });
  const torus = a
    ? null
    : [0, 30, 60, 90, 120, 150].map((rot) => ring(ctx, { cx, cy, rx: 84, ry: 30, rot, w: 1.8, kind: "light" }));
  const sats = a
    ? [0, 120, 240].map((ph, i) => orbit(ctx, `sa${i}`, { cx, cy, rx: 150, ry: 40, rot: -16, d: 14, phase: ph }, <Bead r={i === 0 ? 9 : 6.5} light={i === 2} />))
    : [0, 180].map((ph, i) => orbit(ctx, `sa${i}`, { cx, cy, rx: 150, ry: 40, rot: -16, d: 10, phase: ph }, <circle r={5} fill="#FFFFFF" stroke={C.blue} strokeWidth={1.6} />));
  const shards = [0, 90, 180, 270].map((ph, i) =>
    orbit(ctx, `sh${i}`, { cx, cy: 300, rx: 172, ry: 30, d: 30, phase: ph + 45 }, <A k="bob" d={4} dl={-i} v={{ a: "-5px" }}><Shard h={i % 2 ? 30 : 38} w={i % 2 ? 11 : 14} /></A>),
  );
  const t1 = halves(ctx, "t1", cx, cy, -16, <Trail ctx={ctx} k="1" cx={cx} cy={cy} rx={168} ry={46} rot={-16} d={6} len={120} w={3} />);
  const t2 = halves(ctx, "t2", cx, cy, 24, <Trail ctx={ctx} k="2" cx={cx} cy={cy} rx={120} ry={34} rot={24} d={4.5} dl={-2} len={90} w={2.4} />);
  return (
    <g>
      {ctx.fx && <ellipse cx={200} cy={346} rx={120} ry={30} fill={ctx.url("pool")} />}
      <Grid ctx={ctx} />
      {shards.map((s, i) => (
        <g key={i}>{s.back}</g>
      ))}
      <g opacity={0.95}>
        <circle cx={cx} cy={cy} r={168} fill="none" stroke={C.steel4} strokeWidth={a ? 8 : 3} opacity={a ? 1 : 0.4} />
        <circle cx={cx} cy={cy} r={168} fill="none" stroke={a ? ctx.url("band") : C.bl} strokeWidth={a ? 5 : 1.2} />
        {a && <circle cx={cx} cy={cy} r={168} fill="none" stroke={C.blue} strokeWidth={3} strokeDasharray="1.2 9.6" />}
        {[0, 90, 180, 270].map((deg) => {
          const rr = (deg * Math.PI) / 180;
          return <circle key={deg} cx={f(cx + Math.cos(rr) * 168)} cy={f(cy + Math.sin(rr) * 168)} r={5} fill={C.blue} stroke={C.deep} strokeWidth={1} />;
        })}
      </g>
      {torus && torus.map((r, i) => <A key={i} k="seq" d={3.6} dl={-i * 0.6} v={{ o: 0.5 }}>{r.back}</A>)}
      {asm(ctx, 0, [cx, cy], rA.back)}
      {sats.map((s, i) => (
        <g key={i}>{s.back}</g>
      ))}
      {t1.back}
      {t2.back}
      {asm(ctx, 1, [cx, cy], <A k="squash" d={10} at={[cx, cy]} v={{ sx: 0.35 }}>{rB.back}</A>)}
      {asm(ctx, 2, [cx, cy], rC.back)}
      {[58, 70, 84].map((r, i) => (
        <A key={r} k="breathe" d={4} dl={-i * 1.2} at={[cx, cy]} v={{ s: 1.08 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.blue} strokeWidth={1.1} opacity={0.55 - i * 0.14} />
        </A>
      ))}
      <A k="bob" d={5} v={{ a: "-3px" }}>
        <Marble ctx={ctx} x={cx} y={cy} r={46} blaze={1} />
      </A>
      {asm(ctx, 2, [cx, cy], rC.front)}
      {asm(ctx, 1, [cx, cy], <A k="squash" d={10} at={[cx, cy]} v={{ sx: 0.35 }}>{rB.front}</A>)}
      {t2.front}
      {t1.front}
      {asm(ctx, 0, [cx, cy], rA.front)}
      {sats.map((s, i) => (
        <g key={i}>{s.front}</g>
      ))}
      {torus && torus.map((r, i) => <A key={i} k="seq" d={3.6} dl={-i * 0.6} v={{ o: 0.5 }}>{r.front}</A>)}
      {shards.map((s, i) => (
        <g key={i}>{s.front}</g>
      ))}
      <Spark x={60} y={86} s={6} />
      <Spark x={346} y={300} s={5} dl={-1.4} />
      <Spark x={338} y={84} s={4} dl={-2.4} />
    </g>
  );
}

function Prisms({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (!ctx.ascended || !ctx.fx) return null;
  return (
    <A k="spin" d={50} at={[box.cx, box.cy]}>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        const x = box.cx + Math.cos(r) * box.r * 0.92;
        const y = box.cy + Math.sin(r) * box.r * 0.92;
        return (
          <polygon
            key={i}
            points={pts([[x, y - 8], [x + 6, y + 5], [x - 6, y + 5]])}
            fill={ctx.url("irid")}
            stroke={C.blue2}
            strokeWidth={0.7}
            transform={`rotate(${deg + 90} ${f(x)} ${f(y)})`}
          />
        );
      })}
    </A>
  );
}

const BOX: Record<number, Box> = {
  1: { cx: 200, cy: 226, r: 112 },
  2: { cx: 200, cy: 212, r: 140 },
  3: { cx: 200, cy: 200, r: 150 },
  4: { cx: 200, cy: 200, r: 176 },
  5: { cx: 200, cy: 200, r: 190 },
};

export function GravityMarble(ctx: Ctx): React.ReactNode {
  const box = BOX[ctx.form];
  const F = [Form1, Form2, Form3, Form4, Form5][ctx.form - 1];
  return (
    <>
      <Defs ctx={ctx} />
      <Aura ctx={ctx} cx={box.cx} cy={box.cy} r={box.r} color={C.bl} />
      <PrepGlow ctx={ctx} box={box} color={C.bl} />
      <F ctx={ctx} />
      <Prisms ctx={ctx} box={box} />
      <ActivityOverlay ctx={ctx} box={box} glow={C.bl} ink={C.blue2} />
    </>
  );
}
