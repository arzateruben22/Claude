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
  kite,
  leafPath,
  orbit,
  pts,
  sparkPath,
  type Box,
  type Ctx,
} from "./kit";

/* The Glass Garden: champagne-ivory, dusty rose, pale sage glass, water-light.
   Motif: the rose-champagne dewdrop, which becomes seed, heart and crown. */

const C = {
  ivory: "#FFF9F1",
  champ: "#F0DFC2",
  champ2: "#DDC199",
  champ3: "#B8936A",
  champ4: "#8C6A4A",
  rose: "#EDB9B6",
  rose2: "#D6939B",
  rose3: "#B46E7B",
  rose4: "#86495A",
  sage: "#D5E4D4",
  sage2: "#B0C9B5",
  sage3: "#86A690",
  sage4: "#58785F",
  water: "#D8F1EC",
  water2: "#A8DAD5",
  water3: "#71B7B6",
  water4: "#4A9193",
};

type P = readonly [number, number];

const dropD = (x: number, y: number, R: number) =>
  `M${f(x)} ${f(y - 1.6 * R)}C${f(x + 0.38 * R)} ${f(y - 1.12 * R)} ${f(x + R)} ${f(y - 0.62 * R)} ${f(x + R)} ${f(y)}A${f(R)} ${f(
    R,
  )} 0 0 1 ${f(x - R)} ${f(y)}C${f(x - R)} ${f(y - 0.62 * R)} ${f(x - 0.38 * R)} ${f(y - 1.12 * R)} ${f(x)} ${f(y - 1.6 * R)}Z`;

function Defs({ ctx }: { ctx: Ctx }) {
  const u = ctx.id;
  return (
    <defs>
      <Rad id={u("drop")} fx={0.38} fy={0.66} r={0.62} stops={[[0, "#FFFCF6"], [0.3, "#F9E3D9"], [0.68, C.rose], [1, C.rose3]]} />
      <Lin id={u("leaf")} x1={0} y1={0} x2={1} y2={1} stops={[[0, C.sage], [0.55, C.sage2], [1, C.sage3]]} />
      <Lin id={u("petal")} stops={[[0, "#F7D3CD"], [0.6, C.rose2], [1, C.rose3]]} />
      <Lin id={u("petalIn")} stops={[[0, "#FFF0EA"], [1, C.rose]]} />
      <Lin id={u("glass")} x1={0} y1={0} x2={1} y2={0} stops={[[0, C.sage2, 0.42], [0.35, C.ivory, 0.12], [0.7, C.water, 0.2], [1, C.rose, 0.32]]} />
      <Lin id={u("glassRose")} x1={0} y1={0} x2={1} y2={1} stops={[[0, "#FFF4EE", 0.8], [0.5, C.rose, 0.62], [1, C.rose2, 0.72]]} />
      <Lin id={u("water")} stops={[[0, C.water2, 0.95], [0.5, C.water3, 0.9], [1, C.water4, 0.75]]} />
      <Lin id={u("fall")} stops={[[0, C.water, 0.95], [0.45, C.water2, 0.75], [1, C.water2, 0]]} />
      <Rad id={u("pool")} stops={[[0, C.water2, 0.55], [1, C.water2, 0]]} />
      <Rad id={u("glow")} stops={[[0, "#FFF3E6", 0.9], [0.4, C.rose, 0.4], [1, C.rose, 0]]} />
      <Lin id={u("moss")} stops={[[0, C.sage2], [1, C.sage3]]} />
      <Lin id={u("base")} stops={[[0, "#F8EEDC"], [0.45, C.champ2], [1, C.champ3]]} />
      <Lin id={u("stone")} x1={0} y1={0} x2={1} y2={0} stops={[[0, "#E8F1E6"], [1, C.sage2]]} />
      <Lin id={u("ray")} stops={[[0, C.champ, 0.75], [1, C.champ, 0]]} />
      <Lin id={u("band")} x1={0} y1={0} x2={1} y2={0} stops={[[0, "#FFF8EC", 0], [0.5, "#FFF8EC", 0.75], [1, "#FFF8EC", 0]]} />
    </defs>
  );
}

/* ---------------- motif + botanical parts ---------------- */

function Drop({ ctx, x, y, R, seed = false, glow = false }: { ctx: Ctx; x: number; y: number; R: number; seed?: boolean; glow?: boolean }) {
  const d = dropD(x, y, R);
  const k = kite([x - R * 0.05, y + R * 0.42], [x + R * 0.08, y - R * 0.3], R * 0.16);
  return (
    <g>
      {glow && ctx.fx && (
        <A k="pulse" d={4} v={{ o: 0.55 }}>
          <circle cx={x} cy={y - R * 0.25} r={R * 2.6} fill={ctx.url("glow")} />
        </A>
      )}
      <path d={d} fill={ctx.url("drop")} stroke={C.rose4} strokeOpacity={0.5} strokeWidth={Math.max(0.8, R * 0.028)} />
      <ellipse cx={x} cy={y + R * 0.46} rx={R * 0.58} ry={R * 0.3} fill={C.water2} opacity={0.4} />
      {seed && (
        <g>
          <polygon points={k.a} fill={C.sage} />
          <polygon points={k.b} fill={C.sage3} />
        </g>
      )}
      <path
        d={`M${f(x - R * 0.64)} ${f(y + R * 0.36)}Q${f(x)} ${f(y + R * 0.98)} ${f(x + R * 0.64)} ${f(y + R * 0.36)}`}
        fill="none"
        stroke={C.ivory}
        strokeOpacity={0.9}
        strokeWidth={R * 0.07}
        strokeLinecap="round"
      />
      <ellipse cx={x - R * 0.42} cy={y - R * 0.28} rx={R * 0.13} ry={R * 0.34} transform={`rotate(28 ${f(x - R * 0.42)} ${f(y - R * 0.28)})`} fill="#FFFFFF" opacity={0.85} />
      <circle cx={x - R * 0.1} cy={y - R * 0.98} r={R * 0.06} fill="#FFFFFF" opacity={0.85} />
      <Sheen ctx={ctx} o={0.5}>
        <path d={d} />
      </Sheen>
    </g>
  );
}

function Leaf({ ctx, b, t, w }: { ctx: Ctx; b: P; t: P; w: number }) {
  return (
    <g>
      <path d={leafPath(b, t, w)} fill={ctx.url("leaf")} stroke={C.sage4} strokeOpacity={0.55} strokeWidth={0.9} />
      <path
        d={`M${f(b[0])} ${f(b[1])}L${f(b[0] + (t[0] - b[0]) * 0.86)} ${f(b[1] + (t[1] - b[1]) * 0.86)}`}
        stroke={C.ivory}
        strokeOpacity={0.7}
        strokeWidth={1}
      />
    </g>
  );
}

function CLeaf({ b, t, w }: { b: P; t: P; w: number }) {
  const k = kite(b, t, w);
  return (
    <g stroke={C.sage4} strokeOpacity={0.5} strokeWidth={0.8} strokeLinejoin="round">
      <polygon points={k.a} fill={C.sage} />
      <polygon points={k.b} fill={C.sage3} />
    </g>
  );
}

function Bloom({ ctx, x, y, r, open = 1 }: { ctx: Ctx; x: number; y: number; r: number; open?: number }) {
  const petal = (len: number, wid: number) => `M0 0Q${f(wid)} ${f(-len * 0.45)} 0 ${f(-len)}Q${f(-wid)} ${f(-len * 0.45)} 0 0Z`;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(1 0.8)`}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d={petal(r, r * 0.62 * open)} transform={`rotate(${a})`} fill={ctx.url("petal")} stroke={C.rose4} strokeOpacity={0.4} strokeWidth={0.8} />
      ))}
      {[30, 90, 150, 210, 270, 330].map((a) => (
        <path key={a} d={petal(r * 0.7, r * 0.48)} transform={`rotate(${a})`} fill={ctx.url("petalIn")} stroke={C.rose3} strokeOpacity={0.45} strokeWidth={0.7} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d={petal(r * 0.4, r * 0.32)} transform={`rotate(${a})`} fill={C.rose2} stroke={C.rose4} strokeOpacity={0.3} strokeWidth={0.6} />
      ))}
      <circle r={r * 0.16} fill={C.champ} stroke={C.champ3} strokeWidth={0.8} />
      <circle cx={-r * 0.05} cy={-r * 0.05} r={r * 0.06} fill="#FFFFFF" opacity={0.9} />
    </g>
  );
}

/** rose-quartz hexagonal crystal; base at (x,y), rotated a degrees */
function Quartz({ x, y, w, h, a = 0, glass = false }: { x: number; y: number; w: number; h: number; a?: number; glass?: boolean }) {
  const L = -w / 2;
  const M1 = -w * 0.17;
  const M2 = w * 0.17;
  const R = w / 2;
  const t = w * 0.75;
  const fills = glass
    ? [C.water, C.sage2, C.sage3, "#F6FBF5", C.sage, C.sage2]
    : ["#F6D6D1", C.rose2, C.rose3, "#FFEDE8", C.rose, C.rose2];
  const op = glass ? 0.62 : 1;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${a})`} stroke={glass ? C.sage4 : C.rose4} strokeOpacity={0.45} strokeWidth={0.8} strokeLinejoin="round">
      <polygon points={pts([[L, 0], [M1, 3], [M1, -h], [L, -h]])} fill={fills[0]} fillOpacity={op} />
      <polygon points={pts([[M1, 3], [M2, 3], [M2, -h], [M1, -h]])} fill={fills[1]} fillOpacity={op} />
      <polygon points={pts([[M2, 3], [R, 0], [R, -h], [M2, -h]])} fill={fills[2]} fillOpacity={op} />
      <polygon points={pts([[L, -h], [M1, -h], [0, -h - t]])} fill={fills[3]} fillOpacity={op} />
      <polygon points={pts([[M1, -h], [M2, -h], [0, -h - t]])} fill={fills[4]} fillOpacity={op} />
      <polygon points={pts([[M2, -h], [R, -h], [0, -h - t]])} fill={fills[5]} fillOpacity={op} />
      {glass &&
        [0.25, 0.5, 0.75].map((q) => (
          <path key={q} d={`M${f(L)} ${f(-h * q)}L${f(R)} ${f(-h * q)}`} stroke={C.champ3} strokeOpacity={0.7} strokeWidth={0.9} />
        ))}
      <path d={`M${f(M1)} 2L${f(M1)} ${f(-h)}L0 ${f(-h - t)}`} fill="none" stroke={C.ivory} strokeOpacity={0.85} strokeWidth={1.1} />
    </g>
  );
}

function Glint({ x, y, s, dl = 0 }: { x: number; y: number; s: number; dl?: number }) {
  return (
    <A k="twinkle" d={3.6} dl={dl} at={[x, y]}>
      <path d={sparkPath(x, y, s)} fill={C.ivory} stroke={C.rose3} strokeOpacity={0.75} strokeWidth={0.7} />
    </A>
  );
}

/** floating island: moss top + faceted warm-stone underside */
function Island({ ctx, x, y, rx, ry, depth, children }: { ctx: Ctx; x: number; y: number; rx: number; ry: number; depth: number; children?: React.ReactNode }) {
  const angs = [180, 150, 118, 62, 30, 0];
  const rim = angs.map((a) => [x + rx * Math.cos((a * Math.PI) / 180), y + ry * Math.sin((a * Math.PI) / 180)] as P);
  const low = angs.map((a) => [x + rx * 0.66 * Math.cos((a * Math.PI) / 180), y + ry * 0.7 * Math.sin((a * Math.PI) / 180) + depth * 0.5] as P);
  const tip: P = [x + rx * 0.05, y + depth];
  const quad = ["#E6CFAE", "#D7B694", "#C8A085", "#B48879", "#A0736E"];
  const tri = ["#C7A487", "#B58A76", "#A1746B", "#8B6062", "#7A5355"];
  return (
    <g>
      <g stroke={C.champ4} strokeOpacity={0.35} strokeWidth={0.7} strokeLinejoin="round">
        {quad.map((c, i) => (
          <polygon key={`q${i}`} points={pts([rim[i], rim[i + 1], low[i + 1], low[i]])} fill={c} />
        ))}
        {tri.map((c, i) => (
          <polygon key={`t${i}`} points={pts([low[i], low[i + 1], tip])} fill={c} />
        ))}
      </g>
      <polyline
        points={pts(rim.map((p, i) => [p[0] * 0.55 + low[i][0] * 0.45, p[1] * 0.55 + low[i][1] * 0.45] as P))}
        fill="none"
        stroke={C.ivory}
        strokeOpacity={0.4}
        strokeWidth={0.9}
      />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={ctx.url("moss")} stroke={C.sage4} strokeOpacity={0.45} strokeWidth={0.9} />
      <path d={arcHalf(x, y, rx * 0.97, ry * 0.85, 0, true)} fill="none" stroke={C.ivory} strokeOpacity={0.55} strokeWidth={1.2} />
      {children}
    </g>
  );
}

function Fall({ ctx, x, y, w, h }: { ctx: Ctx; x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <path
        d={`M${f(x - w / 2)} ${f(y)}Q${f(x - w / 2 - 3)} ${f(y + h * 0.5)} ${f(x - w * 0.32)} ${f(y + h)}L${f(x + w * 0.32)} ${f(y + h)}Q${f(
          x + w / 2 + 3,
        )} ${f(y + h * 0.5)} ${f(x + w / 2)} ${f(y)}Z`}
        fill={ctx.url("fall")}
      />
      <path d={`M${f(x - w * 0.18)} ${f(y + 2)}L${f(x - w * 0.14)} ${f(y + h * 0.7)}`} stroke={C.ivory} strokeOpacity={0.75} strokeWidth={1.2} strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <A key={i} k="sweep" d={2.4} dl={-i * 0.8} v={{ x0: "0px", x1: "0px", y0: "0px", y1: `${f(h * 0.75)}px` }}>
          <path d={`M${f(x + w * (0.12 - i * 0.1))} ${f(y + 4)}l0 ${f(h * 0.16)}`} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
        </A>
      ))}
    </g>
  );
}

function LightSweep({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (ctx.activity !== "rendering" || !ctx.fx) return null;
  return (
    <A k="sweep" d={3.2} v={{ x0: `${-box.r}px`, x1: `${box.r}px` }}>
      <rect x={box.cx - 22} y={box.cy - box.r} width={44} height={box.r * 2} fill={ctx.url("band")} transform={`rotate(22 ${box.cx} ${box.cy})`} />
    </A>
  );
}

/** ascended extra environment: pastel prism arc + drifting glass petals */
function PrismArc({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (!ctx.ascended || !ctx.fx) return null;
  const cols = [C.rose2, C.champ2, C.sage2, C.water2, "#C7B6EA"];
  const cy = box.cy + box.r * 0.45;
  return (
    <g opacity={0.6}>
      {cols.map((c, i) => {
        const r = box.r * 0.98 - i * 5;
        return <path key={c} d={`M${f(box.cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 0 1 ${f(box.cx + r)} ${f(cy)}`} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" />;
      })}
    </g>
  );
}

function Petals({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (!ctx.ascended || !ctx.fx) return null;
  const spots: [number, number, number][] = [
    [-0.78, -0.35, 20],
    [0.74, -0.52, -35],
    [0.86, 0.18, 60],
    [-0.62, 0.3, -70],
  ];
  return (
    <g>
      {spots.map(([dx, dy, a], i) => {
        const x = box.cx + dx * box.r;
        const y = box.cy + dy * box.r;
        return (
          <A key={i} k="drift" d={7 + i} dl={-i * 1.7} v={{ x: `${6 - i * 3}px`, y: "-9px" }}>
            <path d={`M0 0Q6 -7 0 -16Q-6 -7 0 0Z`} transform={`translate(${f(x)} ${f(y)}) rotate(${a})`} fill={ctx.url("irid")} stroke={C.rose3} strokeOpacity={0.5} strokeWidth={0.6} />
          </A>
        );
      })}
    </g>
  );
}

/* ---------------- forms ---------------- */

function Form1({ ctx }: { ctx: Ctx }) {
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={322} rx={56} ry={9} pool={ctx.url("pool")} />
      {[0, 1, 2].map((i) => (
        <A key={i} k="pulse" d={4.5} dl={-i * 1.5} v={{ o: 0.2 }}>
          <ellipse cx={200} cy={322} rx={34 + i * 24} ry={5 + i * 4} fill="none" stroke={C.water3} strokeWidth={1.3} opacity={0.8 - i * 0.22} />
        </A>
      ))}
      <ellipse cx={200} cy={323} rx={17} ry={3} fill={C.rose2} opacity={0.4} />
      <A k="bob" d={6} v={{ a: "-8px" }}>
        <Drop ctx={ctx} x={200} y={228} R={46} seed glow />
      </A>
      {(
        [
          [136, 176, 6, 0],
          [270, 160, 7.5, -2],
          [258, 256, 4.5, -4],
        ] as const
      ).map(([x, y, r, dl]) => (
        <A key={x} k="drift" d={7} dl={dl} v={{ x: "3px", y: "-6px" }}>
          <Drop ctx={ctx} x={x} y={y} R={r} />
        </A>
      ))}
      <Glint x={150} y={232} s={6} />
      <Glint x={252} y={204} s={5} dl={-1.6} />
    </g>
  );
}

function Stone({ cx, cy, rx, ry, h }: { cx: number; cy: number; rx: number; ry: number; h: number }) {
  const hex = [0, 60, 120, 180, 240, 300].map((a) => [cx + rx * Math.cos((a * Math.PI) / 180), cy + ry * Math.sin((a * Math.PI) / 180)] as P);
  const down = (p: P): P => [p[0], p[1] + h];
  return (
    <g stroke={C.sage4} strokeOpacity={0.55} strokeWidth={0.9} strokeLinejoin="round">
      <polygon points={pts([hex[3], hex[2], down(hex[2]), down(hex[3])])} fill={C.sage2} />
      <polygon points={pts([hex[2], hex[1], down(hex[1]), down(hex[2])])} fill={C.sage3} />
      <polygon points={pts([hex[1], hex[0], down(hex[0]), down(hex[1])])} fill={C.sage4} fillOpacity={0.85} />
      <polygon points={pts(hex)} fill="#E4EEE2" />
      <path d={`M${pts([hex[3], hex[2], hex[1], hex[0]]).replace(/ /g, "L")}`} fill="none" stroke={C.ivory} strokeOpacity={0.9} strokeWidth={1.1} />
    </g>
  );
}

function Form2({ ctx }: { ctx: Ctx }) {
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={330} rx={78} ry={10} pool={ctx.url("pool")} />
      <Stone cx={200} cy={296} rx={66} ry={17} h={26} />
      <ellipse cx={200} cy={297} rx={30} ry={7} fill="none" stroke={C.water3} strokeWidth={1.2} opacity={0.8} />
      <A k="sway" d={7} at={[200, 290]} v={{ a: "2deg" }}>
        <path d="M200 248C196 228 208 206 203 162" fill="none" stroke={C.sage4} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M199 246C195 228 206 206 202 164" fill="none" stroke={C.sage} strokeWidth={1.4} strokeLinecap="round" />
        <CLeaf b={[200, 232]} t={[142, 204]} w={14} />
        <CLeaf b={[203, 212]} t={[262, 182]} w={14} />
        <CLeaf b={[202, 190]} t={[174, 170]} w={7} />
        <g stroke={C.rose4} strokeOpacity={0.45} strokeWidth={0.8} strokeLinejoin="round">
          <polygon points={kite([201, 166], [186, 134], 7).all} fill={C.rose2} />
          <polygon points={kite([205, 166], [221, 134], 7).all} fill={C.rose2} />
          <polygon points={kite([203, 168], [203, 124], 9).a} fill="#F7D3CD" />
          <polygon points={kite([203, 168], [203, 124], 9).b} fill={C.rose3} />
        </g>
        <circle cx={143} cy={204} r={2.6} fill={C.water} stroke={C.water4} strokeWidth={0.6} />
        <circle cx={262} cy={182} r={3} fill={C.water} stroke={C.water4} strokeWidth={0.6} />
      </A>
      <Drop ctx={ctx} x={200} y={281} R={21} glow />
      <Glint x={152} y={168} s={6} />
      <Glint x={252} y={220} s={5} dl={-1.4} />
      <Glint x={232} y={140} s={4} dl={-2.2} />
    </g>
  );
}

function Form3({ ctx }: { ctx: Ctx }) {
  const b = ctx.branch === "b";
  const vessel = b ? `M${pts([[200, 72], [278, 150], [284, 290], [238, 334], [162, 334], [116, 290], [122, 150]]).replace(/ /g, "L")}Z` : dropD(200, 236, 96);
  const clip = ctx.id("vessel");
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={360} rx={98} ry={11} pool={ctx.url("pool")} />
      <ellipse cx={200} cy={334} rx={72} ry={13} fill={C.champ3} />
      <clipPath id={clip}>
        <path d={vessel} />
      </clipPath>
      <path d={vessel} fill={ctx.url("glass")} />
      <g clipPath={`url(#${clip})`}>
        {ctx.fx && <ellipse cx={200} cy={292} rx={110} ry={40} fill={ctx.url("pool")} />}
        <rect x={90} y={290} width={220} height={60} fill={ctx.url("water")} />
        <ellipse cx={200} cy={290} rx={96} ry={12} fill={C.water} stroke={C.ivory} strokeOpacity={0.8} />
        <path d="M112 302Q158 260 200 266Q246 260 290 302Z" fill={ctx.url("moss")} stroke={C.sage4} strokeOpacity={0.4} />
        <ellipse cx={168} cy={284} rx={6} ry={3.5} fill={C.champ2} />
        <ellipse cx={236} cy={286} rx={5} ry={3} fill={C.rose} />
        {!b ? (
          <A k="sway" d={8} at={[200, 290]} v={{ a: "1.5deg" }}>
            <path d="M199 290C192 252 208 210 200 166" fill="none" stroke={C.sage4} strokeWidth={4} strokeLinecap="round" />
            <path d="M203 236C218 220 228 210 234 196" fill="none" stroke={C.sage4} strokeWidth={2.4} strokeLinecap="round" />
            <Leaf ctx={ctx} b={[198, 266]} t={[138, 238]} w={16} />
            <Leaf ctx={ctx} b={[199, 252]} t={[264, 228]} w={16} />
            <Leaf ctx={ctx} b={[201, 226]} t={[148, 198]} w={12} />
            <Leaf ctx={ctx} b={[201, 214]} t={[250, 186]} w={11} />
            <Leaf ctx={ctx} b={[198, 282]} t={[246, 278]} w={8} />
            <Bloom ctx={ctx} x={200} y={160} r={30} />
            <Bloom ctx={ctx} x={236} y={194} r={10} open={0.6} />
          </A>
        ) : (
          <g>
            <CLeaf b={[194, 284]} t={[140, 246]} w={12} />
            <CLeaf b={[206, 284]} t={[262, 242]} w={12} />
            <Quartz x={158} y={286} w={15} h={28} a={-32} />
            <Quartz x={244} y={286} w={15} h={32} a={30} />
            <Quartz x={176} y={280} w={22} h={50} a={-17} />
            <Quartz x={226} y={280} w={22} h={56} a={15} />
            <Quartz x={200} y={276} w={30} h={74} />
          </g>
        )}
        <A k="bob" d={5} v={{ a: "-5px" }}>
          <Drop ctx={ctx} x={200} y={b ? 136 : 118} R={b ? 12 : 9} glow />
        </A>
        <LightSweep ctx={ctx} box={{ cx: 200, cy: 210, r: 130 }} />
      </g>
      <path d={vessel} fill="none" stroke={C.sage4} strokeOpacity={0.65} strokeWidth={1.6} strokeLinejoin="round" />
      {b ? (
        <g stroke={C.ivory} strokeOpacity={0.6} strokeWidth={1} fill="none">
          <path d="M122 150L278 150M116 290L284 290M200 72L170 150L170 290L162 334M200 72L230 150L230 290L238 334" />
          <path d="M128 160L128 280" stroke={C.ivory} strokeOpacity={0.9} strokeWidth={3.2} strokeLinecap="round" />
        </g>
      ) : (
        <g fill="none" strokeLinecap="round">
          <path d="M124 270Q112 196 172 128" stroke={C.ivory} strokeOpacity={0.9} strokeWidth={4} />
          <path d="M280 228Q284 262 270 292" stroke={C.ivory} strokeOpacity={0.6} strokeWidth={2.5} />
        </g>
      )}
      <Sheen ctx={ctx} o={0.32}>
        <path d={vessel} />
      </Sheen>
      <path d="M128 334A72 13 0 0 0 272 334L272 347A72 13 0 0 1 128 347Z" fill={ctx.url("base")} stroke={C.champ4} strokeOpacity={0.5} strokeWidth={0.9} />
      <path d={arcHalf(200, 334, 72, 13, 0, true)} fill="none" stroke={C.ivory} strokeOpacity={0.85} strokeWidth={1.2} />
      <path d={arcHalf(200, 341, 72, 13, 0, true)} fill="none" stroke={C.rose2} strokeWidth={1.4} />
    </g>
  );
}

function Conservatory({ ctx }: { ctx: Ctx }) {
  if (ctx.branch === "b") {
    return (
      <g>
        {ctx.fx && <circle cx={214} cy={210} r={70} fill={ctx.url("glow")} opacity={0.6} />}
        <Quartz x={160} y={270} w={34} h={50} glass />
        <Quartz x={270} y={270} w={38} h={64} glass />
        <Quartz x={214} y={272} w={60} h={92} glass />
        <CLeaf b={[180, 272]} t={[150, 252]} w={8} />
        <CLeaf b={[246, 272]} t={[282, 252]} w={8} />
        <Quartz x={132} y={276} w={12} h={18} a={-24} />
        <Quartz x={298} y={276} w={12} h={22} a={22} />
        <Quartz x={240} y={276} w={10} h={14} a={10} />
      </g>
    );
  }
  const nave = "M182 268L182 196Q182 166 214 142Q246 166 246 196L246 268Z";
  const wl = "M148 268L148 222Q150 204 182 196L182 268Z";
  const wr = "M246 268L246 196Q278 204 280 222L280 268Z";
  const frame = { fill: "none", stroke: C.champ3, strokeWidth: 1.4, strokeLinejoin: "round" as const };
  const nclip = ctx.id("nave");
  return (
    <g>
      {ctx.fx && <circle cx={214} cy={214} r={72} fill={ctx.url("glow")} opacity={0.55} />}
      <clipPath id={nclip}>
        <path d={nave} />
      </clipPath>
      <path d={wl} fill={ctx.url("glass")} />
      <path d={wr} fill={ctx.url("glass")} />
      <path d={nave} fill={ctx.url("glassRose")} opacity={0.75} />
      <g clipPath={`url(#${nclip})`} opacity={0.85}>
        <Leaf ctx={ctx} b={[206, 268]} t={[188, 210]} w={9} />
        <Leaf ctx={ctx} b={[222, 268]} t={[242, 214]} w={9} />
        <Bloom ctx={ctx} x={214} y={204} r={14} />
      </g>
      <path d="M204 268L204 246Q214 232 224 246L224 268Z" fill={C.champ2} stroke={C.champ4} strokeOpacity={0.6} />
      <g {...frame}>
        <path d={nave} />
        <path d={wl} />
        <path d={wr} />
        <path d="M198 268L198 172M230 268L230 172M214 232L214 146M182 226L246 226M165 268L165 214M263 268L263 214M148 242L182 242M246 242L280 242" strokeWidth={0.9} />
      </g>
      <path d="M186 262L186 198Q187 172 210 150" fill="none" stroke={C.ivory} strokeOpacity={0.85} strokeWidth={1.6} />
      <Sheen ctx={ctx} o={0.35}>
        <path d={nave} />
      </Sheen>
      <path d="M214 142L214 130" stroke={C.champ3} strokeWidth={1.6} />
      <rect x={142} y={266} width={144} height={6} rx={2} fill={ctx.url("base")} stroke={C.champ4} strokeOpacity={0.5} strokeWidth={0.7} />
      <Leaf ctx={ctx} b={[150, 228]} t={[132, 212]} w={7} />
      <Leaf ctx={ctx} b={[156, 216]} t={[170, 200]} w={6} />
      <Leaf ctx={ctx} b={[276, 230]} t={[296, 214]} w={7} />
      <Bloom ctx={ctx} x={150} y={232} r={9} />
      <Bloom ctx={ctx} x={282} y={236} r={8} />
      <Leaf ctx={ctx} b={[146, 268]} t={[126, 250]} w={8} />
      <Leaf ctx={ctx} b={[282, 268]} t={[302, 252]} w={8} />
    </g>
  );
}

function SmallGarden({ ctx, x, y, s = 1 }: { ctx: Ctx; x: number; y: number; s?: number }) {
  if (ctx.branch === "b") {
    return (
      <g>
        <Quartz x={x - 7 * s} y={y + 1} w={8 * s} h={14 * s} a={-18} />
        <Quartz x={x + 6 * s} y={y + 1} w={9 * s} h={20 * s} a={12} />
      </g>
    );
  }
  return (
    <g>
      <Leaf ctx={ctx} b={[x, y]} t={[x - 18 * s, y - 16 * s]} w={6 * s} />
      <Leaf ctx={ctx} b={[x, y]} t={[x + 16 * s, y - 20 * s]} w={6 * s} />
      <path d={`M${x} ${y}L${x + 1} ${y - 22 * s}`} stroke={C.sage4} strokeWidth={1.6} />
      <Bloom ctx={ctx} x={x + 1} y={y - 24 * s} r={7 * s} />
    </g>
  );
}

function Form4({ ctx }: { ctx: Ctx }) {
  return (
    <g>
      <Ground ctx={ctx} cx={205} cy={386} rx={66} ry={7} o={0.35} pool={ctx.url("pool")} />
      <A k="bob" d={7} dl={-2} v={{ a: "-6px" }}>
        <Island ctx={ctx} x={322} y={150} rx={32} ry={7} depth={30}>
          <SmallGarden ctx={ctx} x={322} y={150} s={0.9} />
        </Island>
      </A>
      <A k="bob" d={8} v={{ a: "-4px" }}>
        <Island ctx={ctx} x={200} y={270} rx={118} ry={24} depth={82}>
          <ellipse cx={136} cy={276} rx={28} ry={6.5} fill={ctx.url("water")} stroke={C.ivory} strokeOpacity={0.8} />
          <Conservatory ctx={ctx} />
          <A k="bob" d={5} v={{ a: "-5px" }}>
            <Drop ctx={ctx} x={214} y={ctx.branch === "b" ? 102 : 114} R={9} glow />
          </A>
        </Island>
        <Fall ctx={ctx} x={124} y={286} w={16} h={92} />
      </A>
      <A k="bob" d={6.5} dl={-3.5} v={{ a: "-7px" }}>
        <Island ctx={ctx} x={84} y={196} rx={36} ry={8} depth={34}>
          <SmallGarden ctx={ctx} x={84} y={196} />
        </Island>
      </A>
      <Glint x={300} y={238} s={5} />
      <Glint x={110} y={250} s={4} dl={-1.2} />
      <Glint x={268} y={120} s={4.5} dl={-2.4} />
    </g>
  );
}

function Sanctuary({ ctx }: { ctx: Ctx }) {
  if (ctx.branch === "b") {
    return (
      <g>
        {ctx.fx && <circle cx={200} cy={200} r={96} fill={ctx.url("glow")} opacity={0.6} />}
        <g fill="none" stroke={C.ivory} strokeOpacity={0.8} strokeWidth={2.2} strokeLinecap="round">
          <path d="M116 244Q130 196 152 214M284 244Q270 196 248 214M152 214Q170 150 200 170M248 214Q230 150 200 170" />
        </g>
        <g fill="none" stroke={C.champ3} strokeWidth={0.9}>
          <path d="M116 244Q130 196 152 214M284 244Q270 196 248 214M152 214Q170 150 200 170M248 214Q230 150 200 170" />
        </g>
        <Quartz x={116} y={286} w={28} h={42} glass />
        <Quartz x={284} y={286} w={28} h={42} glass />
        <Quartz x={152} y={288} w={40} h={78} glass />
        <Quartz x={248} y={288} w={40} h={78} glass />
        <Quartz x={200} y={290} w={58} h={124} glass />
        <Quartz x={176} y={294} w={12} h={18} a={-20} />
        <Quartz x={226} y={294} w={13} h={22} a={18} />
        <Quartz x={96} y={292} w={11} h={16} a={-26} />
        <Quartz x={306} y={292} w={11} h={18} a={24} />
      </g>
    );
  }
  const petal = (b: P, t: P, w: number, key: string) => (
    <g key={key}>
      <path d={leafPath(b, t, w)} fill={ctx.url("glassRose")} stroke={C.champ3} strokeWidth={1.3} />
      <path d={`M${b[0]} ${b[1]}L${t[0]} ${t[1]}`} stroke={C.champ3} strokeOpacity={0.75} strokeWidth={0.8} />
      <path d={leafPath(b, t, w * 0.55)} fill="none" stroke={C.ivory} strokeOpacity={0.65} strokeWidth={0.9} />
    </g>
  );
  return (
    <g>
      {ctx.fx && <circle cx={200} cy={210} r={100} fill={ctx.url("glow")} opacity={0.65} />}
      <Leaf ctx={ctx} b={[132, 292]} t={[60, 206]} w={22} />
      <Leaf ctx={ctx} b={[268, 292]} t={[340, 202]} w={22} />
      <Leaf ctx={ctx} b={[114, 298]} t={[68, 262]} w={12} />
      <Leaf ctx={ctx} b={[288, 298]} t={[334, 258]} w={12} />
      {petal([200, 256], [200, 106], 17, "s")}
      {petal([190, 272], [156, 164], 22, "l2")}
      {petal([210, 272], [244, 164], 22, "r2")}
      {petal([200, 272], [200, 148], 26, "c2")}
      {petal([166, 288], [108, 232], 20, "l1o")}
      {petal([234, 288], [292, 232], 20, "r1o")}
      {petal([180, 290], [140, 206], 26, "l1")}
      {petal([220, 290], [260, 206], 26, "r1")}
      {petal([200, 292], [200, 196], 30, "c1")}
      <Sheen ctx={ctx} o={0.32}>
        <path d={leafPath([200, 292], [200, 196], 30)} />
      </Sheen>
      <Bloom ctx={ctx} x={134} y={290} r={13} />
      <Bloom ctx={ctx} x={268} y={292} r={12} />
      <Bloom ctx={ctx} x={232} y={300} r={7} />
    </g>
  );
}

function Form5({ ctx }: { ctx: Ctx }) {
  const b = ctx.branch === "b";
  const crownY = b ? 70 : 82;
  const ring = { cx: 200, cy: 210, rx: 176, ry: 30, rot: -6 };
  const dropsOnRing = [0, 90, 180, 270].map((ph, i) =>
    orbit(ctx, `w${i}`, { ...ring, d: 26, phase: ph }, <Drop ctx={ctx} x={0} y={0} R={i % 2 ? 5 : 6.5} />),
  );
  return (
    <g>
      <Ground ctx={ctx} cx={205} cy={390} rx={84} ry={7} o={0.3} pool={ctx.url("pool")} />
      {ctx.fx && (
        <A k="shimmer" d={8} v={{ o: 0.45 }}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = -90 + (i - 4) * 22;
            return (
              <rect key={i} x={197} y={crownY - 4} width={6} height={112} fill={ctx.url("ray")} transform={`rotate(${a + 90} 200 ${crownY - 4})`} opacity={0.7} />
            );
          })}
        </A>
      )}
      <A k="bob" d={9} dl={-3} v={{ a: "-5px" }}>
        <g opacity={0.6}>
          <Island ctx={ctx} x={100} y={104} rx={18} ry={4} depth={15} />
        </g>
        <Island ctx={ctx} x={336} y={128} rx={30} ry={7} depth={28}>
          <SmallGarden ctx={ctx} x={336} y={128} s={0.85} />
        </Island>
      </A>
      <path d={arcHalf(ring.cx, ring.cy, ring.rx, ring.ry, ring.rot, false)} fill="none" stroke={C.water3} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="2 5" />
      {dropsOnRing.map((o, i) => <g key={i}>{o.back}</g>)}
      <A k="bob" d={9} v={{ a: "-4px" }}>
        <Island ctx={ctx} x={200} y={290} rx={154} ry={30} depth={84}>
          <ellipse cx={200} cy={292} rx={128} ry={22} fill={ctx.url("water")} stroke={C.ivory} strokeOpacity={0.85} strokeWidth={1.2} />
          <ellipse cx={200} cy={289} rx={98} ry={15} fill={ctx.url("moss")} stroke={C.sage4} strokeOpacity={0.4} />
          <Sanctuary ctx={ctx} />
          <A k="bob" d={5} v={{ a: "-6px" }}>
            <Drop ctx={ctx} x={200} y={crownY} R={15} glow />
            {ctx.fx && <ellipse cx={200} cy={crownY + 22} rx={26} ry={5} fill="none" stroke={C.champ2} strokeWidth={1.4} opacity={0.9} />}
          </A>
        </Island>
        <Fall ctx={ctx} x={92} y={304} w={16} h={80} />
        <Fall ctx={ctx} x={306} y={306} w={13} h={70} />
      </A>
      <path d={arcHalf(ring.cx, ring.cy, ring.rx, ring.ry, ring.rot, true)} fill="none" stroke={C.water3} strokeOpacity={0.85} strokeWidth={1.3} strokeDasharray="2 5" />
      {dropsOnRing.map((o, i) => <g key={i}>{o.front}</g>)}
      <A k="bob" d={7} dl={-1.5} v={{ a: "-7px" }}>
        <Island ctx={ctx} x={58} y={180} rx={30} ry={7} depth={30}>
          <SmallGarden ctx={ctx} x={58} y={180} s={0.85} />
        </Island>
      </A>
      <Glint x={300} y={176} s={6} />
      <Glint x={96} y={252} s={5} dl={-1.2} />
      <Glint x={250} y={96} s={4.5} dl={-2.4} />
      <Glint x={150} y={120} s={4} dl={-0.6} />
    </g>
  );
}

const BOX: Record<number, Box> = {
  1: { cx: 200, cy: 236, r: 112 },
  2: { cx: 200, cy: 236, r: 122 },
  3: { cx: 200, cy: 214, r: 150 },
  4: { cx: 200, cy: 220, r: 172 },
  5: { cx: 200, cy: 214, r: 186 },
};

export function GlassGarden(ctx: Ctx): React.ReactNode {
  const box = BOX[ctx.form];
  const F = [Form1, Form2, Form3, Form4, Form5][ctx.form - 1];
  return (
    <>
      <Defs ctx={ctx} />
      <Aura ctx={ctx} cx={box.cx} cy={box.cy} r={box.r} color={C.rose} />
      <PrismArc ctx={ctx} box={box} />
      <PrepGlow ctx={ctx} box={box} color={C.champ} />
      <F ctx={ctx} />
      {ctx.form !== 3 && <LightSweep ctx={ctx} box={box} />}
      <Petals ctx={ctx} box={box} />
      <ActivityOverlay ctx={ctx} box={box} glow={C.rose} ink={C.rose4} />
    </>
  );
}
