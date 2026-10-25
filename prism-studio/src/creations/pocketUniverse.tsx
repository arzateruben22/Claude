import * as React from "react";
import { A, ActivityOverlay, Aura, Lin, PrepGlow, Rad, Sheen, arcHalf, f, halves, orbit, pts, sparkPath, type Box, type Ctx } from "./kit";

/* The Pocket Universe: deep violet, starlight white, a little cyan.
   Motif: the four-point cosmic spark, which becomes star, sun and galactic heart. */

const C = {
  v: "#5B3CC4",
  v2: "#4527A0",
  vD: "#26145E",
  ink: "#170B3F",
  lav: "#B9A6FF",
  lil: "#DCD0FF",
  mag: "#B44CC8",
  pink: "#E58AD6",
  cyan: "#5FD8EA",
  cyanL: "#B5F3FA",
  star: "#FFFDF6",
  warm: "#FFF0D8",
};

/** deterministic pseudo-random numbers */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function Defs({ ctx }: { ctx: Ctx }) {
  const u = ctx.id;
  return (
    <defs>
      <Rad id={u("deep")} stops={[[0, C.vD, 0.95], [0.45, C.v2, 0.72], [0.75, C.v, 0.3], [1, C.v, 0]]} />
      <Rad id={u("mag")} stops={[[0, C.mag, 0.7], [0.5, C.mag, 0.3], [1, C.mag, 0]]} />
      <Rad id={u("cy")} stops={[[0, C.cyan, 0.6], [0.5, C.cyan, 0.22], [1, C.cyan, 0]]} />
      <Rad id={u("pk")} stops={[[0, C.pink, 0.6], [1, C.pink, 0]]} />
      <Rad id={u("flare")} stops={[[0, "#FFFFFF"], [0.22, "#FFFFFF", 0.95], [0.55, C.lil, 0.8], [1, C.lav, 0.05]]} />
      <Rad id={u("spark")} stops={[[0, "#FFFFFF", 0.95], [0.18, C.lil, 0.7], [0.5, C.v, 0.28], [1, C.v, 0]]} />
      <Rad id={u("star")} fx={0.42} fy={0.4} stops={[[0, "#FFFFFF"], [0.35, C.warm], [0.75, C.lil], [1, C.lav]]} />
      <Rad id={u("pA")} fx={0.32} fy={0.3} r={0.65} stops={[[0, "#EFFDFF"], [0.45, C.cyan], [1, "#22708C"]]} />
      <Rad id={u("pB")} fx={0.32} fy={0.3} r={0.65} stops={[[0, "#FBE3FF"], [0.45, C.pink], [1, "#6E2580"]]} />
      <Rad id={u("pC")} fx={0.32} fy={0.3} r={0.65} stops={[[0, C.lil], [0.5, C.v], [1, C.ink]]} />
      <Lin id={u("bands")} stops={[[0, "#F3EDFF", 0], [0.3, "#F3EDFF", 0.35], [0.36, "#F3EDFF", 0], [0.6, C.pink, 0.4], [0.68, C.pink, 0], [1, "#F3EDFF", 0]]} />
      <Lin id={u("ring")} x1={0} y1={0} x2={1} y2={0} stops={[[0, C.lav, 0.5], [0.5, C.cyanL, 0.95], [1, C.lav, 0.5]]} />
      <Rad id={u("disk")} stops={[[0, C.lil, 0.6], [0.25, C.lav, 0.4], [0.6, C.v, 0.22], [1, C.v, 0]]} />
      <Lin id={u("land")} stops={[[0, C.v], [0.5, C.v2], [1, C.vD]]} />
      <Lin id={u("under")} stops={[[0, C.vD, 0.95], [1, C.vD, 0]]} />
      <Lin id={u("dome")} x1={0} y1={0} x2={1} y2={0} stops={[[0, "#F4F0FF"], [0.6, C.lil], [1, "#9C8BD8"]]} />
      <Lin id={u("beam")} x1={0} y1={1} x2={0} y2={0} stops={[[0, C.cyanL, 0.75], [1, C.cyanL, 0]]} />
      <Lin id={u("tail")} x1={0} y1={0} x2={1} y2={0} stops={[[0, C.cyanL, 0], [1, C.star, 0.95]]} />
    </defs>
  );
}

/* ---------------- parts ---------------- */

function Spark({ ctx, x, y, r, glow = true }: { ctx: Ctx; x: number; y: number; r: number; glow?: boolean }) {
  return (
    <g>
      {glow && ctx.fx && (
        <A k="breathe" d={4} at={[x, y]} v={{ s: 1.12 }}>
          <circle cx={x} cy={y} r={r * 1.9} fill={ctx.url("spark")} />
        </A>
      )}
      <A k="breathe" d={3} at={[x, y]} v={{ s: 1.08 }}>
        <path d={sparkPath(x, y, r * 0.5, 0.12)} transform={`rotate(45 ${x} ${y})`} fill={ctx.url("flare")} />
        <path d={sparkPath(x, y, r, 0.075)} fill={ctx.url("flare")} />
        <path d={sparkPath(x, y, r * 0.42, 0.16)} fill="#FFFFFF" stroke={C.v} strokeOpacity={0.35} strokeWidth={0.8} />
        <circle cx={x} cy={y} r={r * 0.1} fill="#FFFFFF" />
      </A>
    </g>
  );
}

function Cloud({ ctx, x, y, rx, ry, g, rot = 0, o = 1 }: { ctx: Ctx; x: number; y: number; rx: number; ry: number; g: string; rot?: number; o?: number }) {
  if (!ctx.fx) return null;
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={ctx.url(g)} opacity={o} transform={rot ? `rotate(${rot} ${x} ${y})` : undefined} />;
}

function Stars({ seed, cx, cy, rx, ry, n, tw = true }: { seed: number; cx: number; cy: number; rx: number; ry: number; n: number; tw?: boolean }) {
  const r = rng(seed);
  const items = Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, s: 0.6 + r() * 1.3, t: r() };
  });
  return (
    <g>
      {items.map((s, i) =>
        tw && i % 4 === 0 ? (
          <A key={i} k="twinkle" d={2.5 + s.t * 3} dl={-s.t * 4} at={[s.x, s.y]}>
            <path d={sparkPath(s.x, s.y, s.s * 2.6, 0.18)} fill={C.star} />
          </A>
        ) : (
          <circle key={i} cx={f(s.x)} cy={f(s.y)} r={f(s.s)} fill={i % 7 === 0 ? C.cyanL : C.star} opacity={0.6 + s.t * 0.4} />
        ),
      )}
    </g>
  );
}

function Planet({ ctx, r, g, ring = false, ringTilt = -18 }: { ctx: Ctx; r: number; g: string; ring?: boolean; ringTilt?: number }) {
  const back = `M${f(-r * 2)} 0A${f(r * 2)} ${f(r * 0.55)} 0 0 1 ${f(r * 2)} 0`;
  const front = `M${f(-r * 2)} 0A${f(r * 2)} ${f(r * 0.55)} 0 0 0 ${f(r * 2)} 0`;
  return (
    <g>
      {ring && (
        <g transform={`rotate(${ringTilt})`}>
          <path d={back} fill="none" stroke={ctx.url("ring")} strokeWidth={r * 0.32} opacity={0.75} />
        </g>
      )}
      <circle r={r} fill={ctx.url(g)} stroke={C.ink} strokeOpacity={0.45} strokeWidth={0.8} />
      {g === "pC" && <circle r={r} fill={ctx.url("bands")} />}
      <path d={`M${f(-r * 0.62)} ${f(-r * 0.3)}A${f(r * 0.7)} ${f(r * 0.7)} 0 0 1 ${f(r * 0.1)} ${f(-r * 0.7)}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={Math.max(1, r * 0.1)} strokeLinecap="round" />
      {ring && (
        <g transform={`rotate(${ringTilt})`}>
          <path d={front} fill="none" stroke={ctx.url("ring")} strokeWidth={r * 0.32} />
          <path d={front} fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={0.8} />
        </g>
      )}
    </g>
  );
}

/** two-armed spiral galaxy, drawn flat then tilted; the disc slowly turns */
function Galaxy({ ctx, cx, cy, R, tilt, k, seed, d = 120, arms = 2 }: { ctx: Ctx; cx: number; cy: number; R: number; tilt: number; k: number; seed: number; d?: number; arms?: number }) {
  const r = rng(seed);
  const blobs: { x: number; y: number; s: number; g: string }[] = [];
  const dots: { x: number; y: number; s: number }[] = [];
  const lanes: string[] = [];
  const armPaths: string[] = [];
  for (let a = 0; a < arms; a++) {
    const off = (a / arms) * Math.PI * 2;
    const lane: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const th = t * 9.5;
      const rr = (R / 154) * 14 * Math.exp(0.24 * th);
      const x = Math.cos(th + off) * rr;
      const y = Math.sin(th + off) * rr;
      if (i % 2 === 0) blobs.push({ x, y, s: 6 + t * 15, g: i % 6 === 0 ? "mag" : i % 4 === 0 ? "cy" : "pk" });
      for (let j = 0; j < 3; j++) dots.push({ x: x + (r() - 0.5) * (8 + t * 26), y: y + (r() - 0.5) * (8 + t * 26), s: 0.7 + r() * 1.4 });
      const li = Math.cos(th + off - 0.25) * rr * 0.92;
      const lj = Math.sin(th + off - 0.25) * rr * 0.92;
      if (i > 4 && i < 26) lane.push([li, lj]);
    }
    lanes.push(`M${lane.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`);
    const arm: string[] = [];
    for (let i = 0; i <= 30; i++) {
      const th = (i / 30) * 9.5;
      const rr = (R / 154) * 14 * Math.exp(0.24 * th);
      arm.push(`${f(Math.cos(th + off) * rr)} ${f(Math.sin(th + off) * rr)}`);
    }
    armPaths.push(`M${arm.join("L")}`);
  }
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${tilt}) scale(1 ${k})`}>
      <A k="spin" d={d}>
        <circle r={R} fill={ctx.url("disk")} />
        {armPaths.map((p, i) => (
          <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={p} stroke={C.lav} strokeWidth={26} opacity={0.22} />
            <path d={p} stroke={C.lil} strokeWidth={11} opacity={0.4} />
            <path d={p} stroke={C.star} strokeWidth={3} opacity={0.75} />
          </g>
        ))}
        {ctx.fx && blobs.map((b, i) => <circle key={i} cx={f(b.x)} cy={f(b.y)} r={f(b.s)} fill={ctx.url(b.g)} />)}
        {lanes.map((l, i) => (
          <path key={i} d={l} fill="none" stroke={C.ink} strokeOpacity={0.45} strokeWidth={2.4} strokeLinecap="round" />
        ))}
        {dots.map((p, i) => (
          <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.s)} fill={i % 5 === 0 ? C.cyanL : C.star} />
        ))}
      </A>
    </g>
  );
}

function Observatory({ ctx, x, y, s, beam = true }: { ctx: Ctx; x: number; y: number; s: number; beam?: boolean }) {
  const w = 22 * s;
  return (
    <g>
      {beam && ctx.fx && (
        <A k="pulse" d={3.5} v={{ o: 0.35 }}>
          <polygon points={pts([[x + w * 0.62, y - w * 1.18], [x + w * 0.82, y - w * 1.02], [x + w * 3.4, y - w * 4.8], [x + w * 2.1, y - w * 5.2]])} fill={ctx.url("beam")} />
        </A>
      )}
      <rect x={x - w} y={y - w * 0.55} width={w * 2} height={w * 0.75} fill={C.v2} stroke={C.ink} strokeWidth={0.9} />
      <rect x={x - w * 0.7} y={y - w * 0.3} width={w * 1.4} height={w * 0.16} rx={1} fill={C.warm} opacity={0.9} />
      <path d={`M${f(x + w * 0.5)} ${f(y - w * 1.0)}L${f(x + w * 1.55)} ${f(y - w * 2.0)}`} stroke={C.lil} strokeWidth={w * 0.32} strokeLinecap="round" />
      <path d={`M${f(x + w * 0.5)} ${f(y - w * 1.0)}L${f(x + w * 1.55)} ${f(y - w * 2.0)}`} stroke={C.ink} strokeOpacity={0.5} strokeWidth={w * 0.32 + 1.6} strokeLinecap="round" fill="none" opacity={0.35} />
      <path d={`M${f(x - w * 1.05)} ${f(y - w * 0.55)}A${f(w * 1.05)} ${f(w * 1.05)} 0 0 1 ${f(x + w * 1.05)} ${f(y - w * 0.55)}Z`} fill={ctx.url("dome")} stroke={C.ink} strokeWidth={0.9} />
      <path d={`M${f(x + w * 0.15)} ${f(y - w * 1.58)}L${f(x + w * 0.62)} ${f(y - w * 1.45)}L${f(x + w * 0.42)} ${f(y - w * 0.62)}L${f(x + w * 0.06)} ${f(y - w * 0.62)}Z`} fill={C.ink} />
      <path d={`M${f(x - w * 0.8)} ${f(y - w * 0.9)}A${f(w * 0.9)} ${f(w * 0.9)} 0 0 1 ${f(x - w * 0.1)} ${f(y - w * 1.52)}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

/** faceted floating asteroid with a flat top at (x, y); r = half-width */
function Moonlet({ x, y, r }: { ctx?: Ctx; x: number; y: number; r: number }) {
  const P = (dx: number, dy: number): [number, number] => [x + dx * r, y + dy * r];
  const top = [P(-1, 0.1), P(-0.7, -0.08), P(0.75, -0.1), P(1.05, 0.12)];
  const a = P(-0.5, 0.78);
  const b = P(0.15, 1.1);
  const c = P(0.7, 0.66);
  return (
    <g stroke={C.ink} strokeOpacity={0.55} strokeWidth={0.8} strokeLinejoin="round">
      <polygon points={pts([top[0], top[1], top[2], top[3]])} fill={C.lav} />
      <polygon points={pts([top[0], top[1], a])} fill={C.v} />
      <polygon points={pts([top[1], top[2], b, a])} fill={C.v2} />
      <polygon points={pts([top[2], top[3], c, b])} fill={C.vD} />
      <path d={`M${pts([top[2], top[3], c]).replace(/ /g, "L")}`} fill="none" stroke={C.cyan} strokeOpacity={1} strokeWidth={1.6} />
    </g>
  );
}

function Crystal({ x, y, h, a = 0 }: { x: number; y: number; h: number; a?: number }) {
  const w = h * 0.32;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${a})`} stroke={C.ink} strokeOpacity={0.5} strokeWidth={0.7} strokeLinejoin="round">
      <polygon points={pts([[-w / 2, 0], [-w / 2, -h * 0.7], [0, -h], [0, 0]])} fill={C.cyanL} />
      <polygon points={pts([[0, 0], [0, -h], [w / 2, -h * 0.7], [w / 2, 0]])} fill={C.cyan} />
    </g>
  );
}

/** small floating world: violet top, fading underside, crystal spires */
function Landscape({ ctx, cx, cy, rx, ry, children }: { ctx: Ctx; cx: number; cy: number; rx: number; ry: number; children?: React.ReactNode }) {
  return (
    <g>
      <path d={`M${cx - rx} ${cy}Q${cx - rx * 0.5} ${cy + ry * 2.4} ${cx} ${cy + ry * 2.8}Q${cx + rx * 0.5} ${cy + ry * 2.4} ${cx + rx} ${cy}Z`} fill={ctx.url("under")} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={ctx.url("land")} stroke={C.ink} strokeOpacity={0.5} strokeWidth={0.9} />
      <path d={arcHalf(cx, cy, rx * 0.98, ry * 0.9, 0, true)} fill="none" stroke={C.cyan} strokeWidth={1.6} opacity={0.9} />
      <path d={`M${cx - rx * 0.7} ${cy + 2}L${cx - rx * 0.5} ${cy - ry * 0.9}L${cx - rx * 0.3} ${cy + 3}Z`} fill={C.v} opacity={0.9} />
      <path d={`M${cx + rx * 0.2} ${cy + 3}L${cx + rx * 0.42} ${cy - ry * 1.1}L${cx + rx * 0.68} ${cy + 2}Z`} fill={C.v} opacity={0.9} />
      {children}
    </g>
  );
}

function Comet({ ctx, x, y, len, a }: { ctx: Ctx; x: number; y: number; len: number; a: number }) {
  if (!ctx.fx) return null;
  return (
    <A k="drift" d={6} v={{ x: "10px", y: "4px" }}>
      <g transform={`translate(${x} ${y}) rotate(${a})`}>
        <path d={`M${-len} -1.4L0 -2.4L0 2.4L${-len} 1.4Z`} fill={ctx.url("tail")} />
        <circle r={3} fill="#FFFFFF" stroke={C.cyan} strokeWidth={1} />
      </g>
    </A>
  );
}

function Swirl({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (ctx.activity !== "rendering" || !ctx.fx) return null;
  return (
    <g>
      {[0, 1, 2].map((w) => (
        <A key={w} k="swirl" d={3} dl={-w} at={[box.cx, box.cy]} v={{ s: 1.25 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 + w;
            const rr = box.r * (0.6 + (i % 3) * 0.1);
            return <circle key={i} cx={f(box.cx + Math.cos(a) * rr)} cy={f(box.cy + Math.sin(a) * rr * 0.8)} r={i % 3 === 0 ? 2.6 : 1.6} fill={i % 2 ? C.cyanL : C.star} stroke={C.v2} strokeWidth={0.5} />;
          })}
        </A>
      ))}
    </g>
  );
}

/* ---------------- forms ---------------- */

function Form1({ ctx }: { ctx: Ctx }) {
  return (
    <g>
      <Cloud ctx={ctx} x={200} y={204} rx={96} ry={88} g="deep" />
      <Cloud ctx={ctx} x={168} y={180} rx={56} ry={44} g="mag" />
      <Cloud ctx={ctx} x={240} y={232} rx={48} ry={38} g="cy" />
      <A k="spin" d={36} at={[200, 204]}>
        <g fill="none" strokeLinecap="round">
          <path d="M138 222A64 52 0 0 1 222 148" stroke={C.lav} strokeWidth={3} opacity={0.75} />
          <path d="M264 186A64 52 0 0 1 184 262" stroke={C.cyan} strokeWidth={2.2} opacity={0.8} />
          <path d="M150 176A70 60 0 0 1 176 156" stroke={C.pink} strokeWidth={1.8} opacity={0.8} />
        </g>
        <Stars seed={3} cx={200} cy={204} rx={82} ry={76} n={16} tw={false} />
      </A>
      <Spark ctx={ctx} x={200} y={204} r={44} />
      <Stars seed={11} cx={200} cy={204} rx={110} ry={100} n={6} />
    </g>
  );
}

function Form2({ ctx }: { ctx: Ctx }) {
  const cx = 200;
  const cy = 202;
  const disk = (
    <g transform={`translate(${cx} ${cy}) rotate(-12) scale(1 0.23)`}>
      <A k="spin" d={40}>
        <circle r={126} fill="none" stroke={C.lav} strokeWidth={9} opacity={0.5} />
        <circle r={104} fill="none" stroke={C.pink} strokeWidth={6} opacity={0.55} />
        <circle r={84} fill="none" stroke={C.cyan} strokeWidth={4} opacity={0.5} />
        <circle r={126} fill="none" stroke={C.star} strokeWidth={2.4} strokeDasharray="1 10" />
        <circle r={96} fill="none" stroke={C.star} strokeWidth={2} strokeDasharray="1 14" />
      </A>
    </g>
  );
  const h = halves(ctx, "disk", cx, cy, -12, disk);
  const p1 = orbit(ctx, "p1", { cx, cy, rx: 116, ry: 27, rot: -12, d: 14, phase: 40 }, <Planet ctx={ctx} r={5} g="pA" />);
  return (
    <g>
      <Cloud ctx={ctx} x={200} y={200} rx={128} ry={112} g="deep" />
      <Cloud ctx={ctx} x={146} y={164} rx={70} ry={54} g="mag" />
      <Cloud ctx={ctx} x={262} y={246} rx={62} ry={46} g="cy" />
      <Stars seed={21} cx={200} cy={200} rx={120} ry={104} n={22} />
      {h.back}
      {p1.back}
      {ctx.fx && <circle cx={cx} cy={cy} r={86} fill={ctx.url("spark")} />}
      <A k="breathe" d={5} at={[cx, cy]} v={{ s: 1.04 }}>
        <circle cx={cx} cy={cy} r={38} fill={ctx.url("star")} stroke={C.lav} strokeWidth={1.2} />
      </A>
      <Sheen ctx={ctx} o={0.4}>
        <circle cx={cx} cy={cy} r={38} />
      </Sheen>
      <Spark ctx={ctx} x={cx} y={cy} r={70} glow={false} />
      {h.front}
      {p1.front}
    </g>
  );
}

function Form3({ ctx }: { ctx: Ctx }) {
  const cx = 200;
  const cy = 196;
  const b = ctx.branch === "b";
  const orbits = [
    { rx: 70, ry: 18, d: 9, ph: 20, body: <Planet ctx={ctx} r={6.5} g="pA" /> },
    { rx: 112, ry: 28, d: 16, ph: 150, body: <Planet ctx={ctx} r={10} g="pB" /> },
    { rx: 158, ry: 40, d: 30, ph: 300, body: <Planet ctx={ctx} r={15} g="pC" ring /> },
  ].map((o, i) => ({
    line: { back: arcHalf(cx, cy, o.rx, o.ry, -10, false), front: arcHalf(cx, cy, o.rx, o.ry, -10, true) },
    body: orbit(ctx, `o${i}`, { cx, cy, rx: o.rx, ry: o.ry, rot: -10, d: o.d, phase: o.ph }, o.body),
  }));
  return (
    <g>
      <Cloud ctx={ctx} x={200} y={196} rx={168} ry={132} g="deep" />
      {b ? (
        <g>
          <Cloud ctx={ctx} x={120} y={130} rx={90} ry={60} g="mag" rot={-20} />
          <Cloud ctx={ctx} x={290} y={250} rx={80} ry={56} g="cy" rot={-20} />
          <Cloud ctx={ctx} x={286} y={120} rx={50} ry={34} g="pk" />
        </g>
      ) : (
        <g opacity={0.4}>
          <Galaxy ctx={ctx} cx={200} cy={196} R={170} tilt={-10} k={0.5} seed={5} d={160} />
        </g>
      )}
      <Stars seed={31} cx={200} cy={196} rx={160} ry={124} n={30} />
      {orbits.map((o, i) => (
        <g key={i}>
          <path d={o.line.back} fill="none" stroke={C.lil} strokeWidth={1} strokeDasharray="2 4" opacity={0.7} />
          {o.body.back}
        </g>
      ))}
      <circle cx={cx} cy={cy} r={28} fill={ctx.url("star")} stroke={C.lav} strokeWidth={1} />
      <Spark ctx={ctx} x={cx} y={cy} r={44} />
      {orbits.map((o, i) => (
        <g key={i}>
          <path d={o.line.front} fill="none" stroke={C.lil} strokeWidth={1.2} opacity={0.9} />
          {o.body.front}
        </g>
      ))}
      {b ? (
        <A k="bob" d={7} v={{ a: "-4px" }}>
          <Moonlet ctx={ctx} x={316} y={318} r={30} />
          <Observatory ctx={ctx} x={312} y={318} s={0.5} />
        </A>
      ) : (
        <A k="bob" d={7} v={{ a: "-4px" }}>
          <Landscape ctx={ctx} cx={316} cy={322} rx={44} ry={8}>
            <Crystal x={304} y={324} h={20} a={-8} />
            <Crystal x={314} y={325} h={12} a={10} />
            <Crystal x={330} y={323} h={16} a={6} />
          </Landscape>
        </A>
      )}
    </g>
  );
}

function Form4({ ctx }: { ctx: Ctx }) {
  const b = ctx.branch === "b";
  return (
    <g>
      <Cloud ctx={ctx} x={200} y={190} rx={190} ry={120} g="deep" rot={-12} />
      {b && (
        <g>
          <Cloud ctx={ctx} x={70} y={230} rx={44} ry={110} g="mag" rot={8} />
          <Cloud ctx={ctx} x={336} y={150} rx={40} ry={96} g="cy" rot={-6} />
          <Cloud ctx={ctx} x={330} y={250} rx={44} ry={70} g="pk" />
        </g>
      )}
      <Stars seed={41} cx={200} cy={190} rx={186} ry={130} n={34} />
      <Galaxy ctx={ctx} cx={200} cy={186} R={168} tilt={-14} k={0.5} seed={9} />
      {ctx.fx && <circle cx={200} cy={186} r={40} fill={ctx.url("spark")} />}
      <circle cx={200} cy={186} r={12} fill={ctx.url("star")} />
      <Spark ctx={ctx} x={200} y={186} r={40} />
      {b ? (
        <g>
          <g transform="translate(76 300)">
            <Planet ctx={ctx} r={20} g="pB" ring />
          </g>
          <A k="bob" d={7} v={{ a: "-4px" }}>
            <Moonlet ctx={ctx} x={314} y={322} r={38} />
            <Observatory ctx={ctx} x={308} y={321} s={0.62} />
          </A>
        </g>
      ) : (
        <g>
          <g transform="translate(72 92)">
            <Planet ctx={ctx} r={15} g="pB" ring />
          </g>
          <Landscape ctx={ctx} cx={200} cy={334} rx={150} ry={22}>
            <Crystal x={130} y={336} h={26} a={-8} />
            <Crystal x={142} y={338} h={16} a={10} />
            <Crystal x={262} y={334} h={30} a={6} />
            <Crystal x={250} y={337} h={18} a={-12} />
          </Landscape>
        </g>
      )}
    </g>
  );
}

function Form5({ ctx }: { ctx: Ctx }) {
  const b = ctx.branch === "b";
  const cons: [number, number][] = [
    [300, 64],
    [326, 84],
    [352, 74],
    [366, 102],
    [342, 120],
  ];
  return (
    <g>
      <Cloud ctx={ctx} x={200} y={186} rx={196} ry={150} g="deep" rot={-10} />
      <A k="pulse" d={7} v={{ o: 0.6 }}>
        <Cloud ctx={ctx} x={110} y={110} rx={110} ry={70} g="mag" rot={-25} />
      </A>
      <A k="pulse" d={9} dl={-3} v={{ o: 0.6 }}>
        <Cloud ctx={ctx} x={300} y={250} rx={100} ry={64} g="cy" rot={-20} />
      </A>
      <Cloud ctx={ctx} x={310} y={110} rx={60} ry={40} g="pk" />
      <Stars seed={51} cx={200} cy={186} rx={196} ry={150} n={46} />
      <g fill="none" stroke={C.lil} strokeWidth={0.8} opacity={0.75}>
        <path d={`M${cons.map(([x, y]) => `${x} ${y}`).join("L")}`} />
      </g>
      {cons.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill={C.star} stroke={C.v2} strokeWidth={0.5} />
      ))}
      <g opacity={0.85}>
        <Galaxy ctx={ctx} cx={74} cy={64} R={34} tilt={20} k={0.45} seed={17} d={80} />
      </g>
      <Galaxy ctx={ctx} cx={200} cy={174} R={184} tilt={-12} k={0.48} seed={13} d={140} arms={b ? 2 : 3} />
      {ctx.fx && <circle cx={200} cy={172} r={52} fill={ctx.url("spark")} />}
      <circle cx={200} cy={172} r={14} fill={ctx.url("star")} />
      <Spark ctx={ctx} x={200} y={172} r={52} />
      <Comet ctx={ctx} x={330} y={52} len={70} a={160} />
      <A k="bob" d={9} v={{ a: "-5px" }}>
        <g transform="translate(58 238)">
          <Planet ctx={ctx} r={22} g="pB" ring ringTilt={-22} />
        </g>
        <g transform="translate(96 284)">
          <Planet ctx={ctx} r={6} g="pA" />
        </g>
      </A>
      {b ? (
        <A k="bob" d={8} dl={-2} v={{ a: "-4px" }}>
          <Cloud ctx={ctx} x={200} y={334} rx={120} ry={40} g="mag" />
          <Moonlet ctx={ctx} x={200} y={322} r={66} />
          <Moonlet ctx={ctx} x={312} y={300} r={14} />
          <Observatory ctx={ctx} x={192} y={318} s={1} />
        </A>
      ) : (
        <A k="bob" d={8} dl={-2} v={{ a: "-3px" }}>
          <Landscape ctx={ctx} cx={200} cy={336} rx={176} ry={26}>
            <Crystal x={70} y={340} h={22} a={-14} />
            <Crystal x={150} y={334} h={14} a={4} />
            <Crystal x={96} y={338} h={30} a={-10} />
            <Crystal x={110} y={340} h={18} a={8} />
            <Crystal x={300} y={336} h={36} a={8} />
            <Crystal x={286} y={340} h={20} a={-10} />
            <Crystal x={318} y={340} h={14} a={18} />
            <Observatory ctx={ctx} x={200} y={334} s={0.72} />
          </Landscape>
        </A>
      )}
    </g>
  );
}

function AscendHalo({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (!ctx.ascended || !ctx.fx) return null;
  return (
    <g>
      <A k="shimmer" d={6} v={{ o: 0.4 }}>
        <ellipse cx={box.cx} cy={box.cy} rx={box.r * 0.98} ry={box.r * 0.36} transform={`rotate(-24 ${box.cx} ${box.cy})`} fill="none" stroke={ctx.url("irid")} strokeWidth={3} />
      </A>
      <A k="bob" d={6} v={{ a: "-6px" }}>
        <g transform={`translate(${f(box.cx + box.r * 0.72)} ${f(box.cy - box.r * 0.62)})`}>
          <circle r={9} fill={ctx.url("irid")} stroke={C.v2} strokeWidth={0.8} />
          <ellipse rx={17} ry={4} fill="none" stroke={ctx.url("irid2")} strokeWidth={2} transform="rotate(-20)" />
        </g>
      </A>
    </g>
  );
}

const BOX: Record<number, Box> = {
  1: { cx: 200, cy: 204, r: 120 },
  2: { cx: 200, cy: 202, r: 140 },
  3: { cx: 200, cy: 198, r: 172 },
  4: { cx: 200, cy: 200, r: 186 },
  5: { cx: 200, cy: 196, r: 192 },
};

export function PocketUniverse(ctx: Ctx): React.ReactNode {
  const box = BOX[ctx.form];
  const F = [Form1, Form2, Form3, Form4, Form5][ctx.form - 1];
  return (
    <>
      <Defs ctx={ctx} />
      <Aura ctx={ctx} cx={box.cx} cy={box.cy} r={box.r} color={C.lav} />
      <PrepGlow ctx={ctx} box={box} color={C.cyan} />
      <F ctx={ctx} />
      <AscendHalo ctx={ctx} box={box} />
      <Swirl ctx={ctx} box={box} />
      <ActivityOverlay ctx={ctx} box={box} glow={C.cyanL} ink={C.v2} />
    </>
  );
}
