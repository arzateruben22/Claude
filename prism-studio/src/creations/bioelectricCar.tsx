import * as React from "react";
import { A, ActivityOverlay, Aura, Ground, Lin, PrepGlow, Rad, Sheen, f, pts, sparkPath, type Box, type Ctx } from "./kit";

/* The Bioelectric Car: coral, warm graphite, soft white.
   Motif: a coral heart-core cell whose nerve-like energy pathways spread
   through the machine as it grows from skeleton to apex prototype. */

const C = {
  coral: "#F2604F",
  coral2: "#FF8A76",
  coralL: "#FFB8A8",
  coralP: "#FFE4DA",
  deep: "#A8372F",
  deep2: "#7E2722",
  g: "#3A3431",
  g2: "#4D4541",
  g3: "#6E645F",
  gD: "#211D1B",
  gL: "#9A8E87",
  pearl: "#FBF6F1",
  pearl2: "#E8DDD4",
  pearl3: "#C7B8AD",
};

function Defs({ ctx }: { ctx: Ctx }) {
  const u = ctx.id;
  return (
    <defs>
      <Lin id={u("coral")} stops={[[0, "#FF9F8E"], [0.45, C.coral], [1, "#C4423A"]]} />
      <Lin id={u("pearl")} stops={[[0, "#FFFFFF"], [0.5, C.pearl2], [1, C.pearl3]]} />
      <Lin id={u("shade")} stops={[[0, "#FFFFFF", 0.38], [0.32, "#FFFFFF", 0], [0.72, C.deep2, 0], [1, C.deep2, 0.35]]} />
      <Lin id={u("graph")} stops={[[0, C.g3], [0.4, C.g], [1, C.gD]]} />
      <Lin id={u("glass")} x1={0} y1={0} x2={1} y2={1} stops={[[0, "#7A6B66"], [0.45, "#3B3331"], [1, "#1E1A19"]]} />
      <Rad id={u("rim")} fx={0.4} fy={0.35} stops={[[0, "#FFFFFF"], [0.55, C.pearl2], [1, C.gL]]} />
      <Rad id={u("core")} fx={0.42} fy={0.4} stops={[[0, "#FFFFFF"], [0.3, C.coralP], [0.65, C.coral2], [1, C.deep]]} />
      <Rad id={u("coreGlow")} stops={[[0, C.coral2, 0.75], [0.45, C.coral, 0.25], [1, C.coral, 0]]} />
      <Rad id={u("pool")} stops={[[0, C.coral, 0.32], [1, C.coral, 0]]} />
      <Lin id={u("streak")} x1={0} y1={0} x2={1} y2={0} stops={[[0, C.coral, 0], [1, C.coral, 0.8]]} />
      <Lin id={u("fade")} stops={[[0, "#FFFFFF", 0.32], [0.6, "#FFFFFF", 0]]} />
      <Lin id={u("halo")} stops={[[0, C.coral, 0.95], [0.55, C.coral, 0.35], [0.75, C.coral, 0]]} />
    </defs>
  );
}

/* ---------------- parts ---------------- */

/** wheel arch segment from left to right along the sill */
const arch = (cx: number, cy: number, R: number, sill: number) => {
  const dx = Math.sqrt(R * R - (sill - cy) * (sill - cy));
  return `L${f(cx - dx)} ${sill}A${R} ${R} 0 0 1 ${f(cx + dx)} ${sill}`;
};

function Wheel({ ctx, x, y, r, far = false, ring = false, disc = false }: { ctx: Ctx; x: number; y: number; r: number; far?: boolean; ring?: boolean; disc?: boolean }) {
  if (far) {
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill={C.gD} stroke={C.g2} strokeWidth={1} />
        <circle cx={x} cy={y} r={r * 0.6} fill={C.g} />
      </g>
    );
  }
  const blade = `M0 ${f(-r * 0.14)}C${f(r * 0.22)} ${f(-r * 0.3)} ${f(r * 0.34)} ${f(-r * 0.5)} ${f(r * 0.26)} ${f(-r * 0.64)}L${f(r * 0.1)} ${f(-r * 0.62)}C${f(
    r * 0.14,
  )} ${f(-r * 0.46)} ${f(r * 0.08)} ${f(-r * 0.3)} 0 ${f(-r * 0.14)}Z`;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.gD} stroke={C.g3} strokeWidth={1.4} />
      <circle cx={x} cy={y} r={r * 0.86} fill="none" stroke={C.g2} strokeWidth={r * 0.07} />
      <circle cx={x} cy={y} r={r * 0.67} fill={disc ? ctx.url("pearl") : ctx.url("rim")} stroke={C.g} strokeWidth={0.8} />
      {disc ? (
        <g>
          <circle cx={x} cy={y} r={r * 0.5} fill="none" stroke={C.coral} strokeWidth={r * 0.06} />
          <A k="spin" d={10} at={[x, y]}>
            {[0, 120, 240].map((a) => (
              <circle key={a} cx={f(x + Math.cos((a * Math.PI) / 180) * r * 0.36)} cy={f(y + Math.sin((a * Math.PI) / 180) * r * 0.36)} r={r * 0.05} fill={C.g2} />
            ))}
          </A>
        </g>
      ) : (
        <A k="spin" d={10} at={[x, y]}>
          {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} d={blade} transform={`translate(${x} ${y}) rotate(${a})`} fill={C.g2} />
          ))}
        </A>
      )}
      <path
        d={`M${f(x - r * 0.58)} ${f(y - r * 0.32)}A${f(r * 0.66)} ${f(r * 0.66)} 0 0 1 ${f(x - r * 0.1)} ${f(y - r * 0.66)}`}
        fill="none"
        stroke={C.coral}
        strokeWidth={r * 0.12}
        strokeLinecap="round"
      />
      {ring && (
        <g>
          {ctx.fx && <circle cx={x} cy={y} r={r * 0.76} fill="none" stroke={C.coral2} strokeWidth={r * 0.14} opacity={0.3} />}
          <A k="pulse" d={2.6} v={{ o: 0.6 }}>
            <circle cx={x} cy={y} r={r * 0.76} fill="none" stroke={C.coralL} strokeWidth={1.4} />
          </A>
        </g>
      )}
      <circle cx={x} cy={y} r={r * 0.15} fill={ctx.url("core")} stroke={C.deep} strokeWidth={0.8} />
    </g>
  );
}

function Core({ ctx, x, y, s = 1 }: { ctx: Ctx; x: number; y: number; s?: number }) {
  const hex = (k: number) =>
    pts([
      [x - 15 * s * k, y],
      [x - 8 * s * k, y - 9 * s * k],
      [x + 8 * s * k, y - 9 * s * k],
      [x + 15 * s * k, y],
      [x + 8 * s * k, y + 9 * s * k],
      [x - 8 * s * k, y + 9 * s * k],
    ]);
  return (
    <g>
      {ctx.fx && (
        <A k="breathe" d={1.6} at={[x, y]} v={{ s: 1.18 }}>
          <circle cx={x} cy={y} r={30 * s} fill={ctx.url("coreGlow")} />
        </A>
      )}
      <polygon points={hex(1)} fill={ctx.url("core")} stroke={C.deep} strokeWidth={1.1} strokeLinejoin="round" />
      <A k="pulse" d={1.6} v={{ o: 0.35 }}>
        <polygon points={hex(0.5)} fill="#FFFFFF" opacity={0.85} />
      </A>
      <path d={`M${f(x - 11 * s)} ${f(y)}L${f(x - 5 * s)} ${f(y)}L${f(x - 2 * s)} ${f(y - 5 * s)}L${f(x + 2 * s)} ${f(y + 5 * s)}L${f(x + 5 * s)} ${f(y)}L${f(x + 11 * s)} ${f(y)}`} fill="none" stroke={C.deep} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

/** illuminated energy pathways; pulse in sequence while rendering */
function Veins({ ctx, d, tone = "coral", w = 1.6 }: { ctx: Ctx; d: string[]; tone?: "coral" | "pale"; w?: number }) {
  const line = tone === "coral" ? C.coral : C.coralP;
  const glow = tone === "coral" ? C.coral2 : "#FFD3C6";
  const rendering = ctx.activity === "rendering";
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => (
        <A key={i} k={rendering ? "seq" : "pulse"} d={rendering ? 1.6 : 4.5} dl={rendering ? i * 0.14 : -i * 0.6} v={{ o: rendering ? 0.25 : 0.6 }}>
          {ctx.fx && <path d={p} stroke={glow} strokeWidth={w * 3.4} opacity={0.4} />}
          <path d={p} stroke={line} strokeWidth={w} />
        </A>
      ))}
    </g>
  );
}

function Port({ ctx, x, y, s }: { ctx: Ctx; x: number; y: number; s: number }) {
  return (
    <g>
      <polygon
        points={pts([
          [x - 22 * s, y],
          [x - 12 * s, y - 14 * s],
          [x + 12 * s, y - 14 * s],
          [x + 22 * s, y],
          [x + 12 * s, y + 14 * s],
          [x - 12 * s, y + 14 * s],
        ])}
        fill={C.gD}
        stroke={C.pearl2}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Core ctx={ctx} x={x} y={y} s={s} />
    </g>
  );
}

function Body({ ctx, d, paint, k = "m", children }: { ctx: Ctx; d: string; paint: "coral" | "pearl"; k?: string; children?: React.ReactNode }) {
  const clip = ctx.id(`body-${k}`);
  return (
    <g>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={ctx.url(paint)} />
      <g clipPath={`url(#${clip})`}>
        {children}
        {paint === "coral" && <path d={d} fill={ctx.url("shade")} />}
      </g>
      <path d={d} fill="none" stroke={paint === "coral" ? C.deep2 : C.g} strokeOpacity={0.85} strokeWidth={1.4} strokeLinejoin="round" />
      <Sheen ctx={ctx} o={0.36}>
        <path d={d} />
      </Sheen>
    </g>
  );
}

function Streaks({ ctx, y, x0 = 20, x1 = 90, n = 4 }: { ctx: Ctx; y: number; x0?: number; x1?: number; n?: number }) {
  if (!ctx.fx) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <A key={i} k="sweep" d={2.2} dl={-i * 0.55} v={{ x0: "30px", x1: "-40px" }}>
          <rect x={x0 + (i % 2) * 12} y={y + i * 9} width={x1 - x0 - (i % 2) * 20} height={1.6} rx={0.8} fill={ctx.url("streak")} />
        </A>
      ))}
    </g>
  );
}

function Spark({ x, y, s, dl = 0 }: { x: number; y: number; s: number; dl?: number }) {
  return (
    <A k="twinkle" d={3} dl={dl} at={[x, y]}>
      <path d={sparkPath(x, y, s)} fill={C.coralP} stroke={C.coral} strokeWidth={0.8} />
    </A>
  );
}

/* ---------------- forms ---------------- */

function Form1({ ctx }: { ctx: Ctx }) {
  return (
    <g>
      <Ground ctx={ctx} cx={200} cy={300} rx={124} ry={10} pool={ctx.url("pool")} />
      <Wheel ctx={ctx} x={134} y={263} r={29} far />
      <Wheel ctx={ctx} x={286} y={263} r={29} far />
      <A k="bob" d={3.2} v={{ a: "-1.5px" }}>
        <g fill="none" strokeLinecap="round">
          <path d="M262 258C252 226 240 208 214 206L186 206C160 208 148 226 140 258" stroke={C.gD} strokeWidth={9} />
          <path d="M262 258C252 226 240 208 214 206L186 206C160 208 148 226 140 258" stroke={C.g3} strokeWidth={5} />
          <path d="M172 210C170 232 172 246 174 258M200 206L200 258M228 210C230 232 228 246 226 258" stroke={C.g2} strokeWidth={3.2} />
          <path d="M150 236C160 222 176 212 188 209" stroke={C.gL} strokeWidth={1.2} />
        </g>
        <rect x={94} y={258} width={212} height={15} rx={7} fill={ctx.url("graph")} stroke={C.gD} strokeWidth={1} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={106 + i * 21.5} y={252} width={15} height={8} rx={3} fill={C.g2} stroke={C.gD} strokeWidth={0.8} />
        ))}
        <path d="M100 261L300 261" stroke={C.gL} strokeWidth={1} opacity={0.8} />
        <path d="M150 266L124 270M250 266L276 270" stroke={C.g} strokeWidth={6} strokeLinecap="round" />
        <Veins
          ctx={ctx}
          d={["M200 246L200 256", "M196 262Q160 266 128 270", "M204 262Q240 266 272 270", "M192 228Q176 220 168 210", "M208 228Q224 220 232 210", "M120 256L300 256"]}
          w={1.5}
        />
        <Core ctx={ctx} x={200} y={236} s={1.1} />
        <path d="M304 260L312 265L304 270Z" fill={C.coralP} stroke={C.coral} strokeWidth={0.9} />
        <rect x={88} y={261} width={6} height={9} rx={2} fill={C.coral} />
      </A>
      <Wheel ctx={ctx} x={124} y={270} r={30} />
      <Wheel ctx={ctx} x={276} y={270} r={30} />
      <Spark x={196} y={176} s={5} />
      <Spark x={322} y={222} s={4} dl={-1.4} />
    </g>
  );
}

function Form2({ ctx }: { ctx: Ctx }) {
  const d = `M66 286${arch(118, 269, 37, 286)}${arch(284, 269, 37, 286)}L336 286Q348 284 348 272Q348 256 330 250Q300 242 272 236Q240 196 200 194Q140 194 104 226Q76 236 66 252Q60 270 66 286Z`;
  return (
    <g>
      <Ground ctx={ctx} cx={202} cy={300} rx={140} ry={10} pool={ctx.url("pool")} />
      <Wheel ctx={ctx} x={127} y={264} r={30} far />
      <Wheel ctx={ctx} x={293} y={264} r={30} far />
      <A k="bob" d={3.4} v={{ a: "-1.5px" }}>
        <Body ctx={ctx} d={d} paint="pearl">
          <path d="M40 266Q200 260 360 268L360 300L40 300Z" fill={ctx.url("graph")} />
          <path d="M40 266Q200 260 360 268" fill="none" stroke={C.gL} strokeWidth={1} />
        </Body>
        <path d="M258 238Q234 206 200 204Q152 204 122 228L128 238Z" fill={ctx.url("glass")} stroke={C.g} strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M196 204L194 238" stroke={C.pearl} strokeWidth={4} />
        <path d="M134 226Q160 210 196 208" fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
        <path d="M118 222Q160 198 212 198" fill="none" stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M236 240Q238 262 232 284M160 238Q156 262 158 284" fill="none" stroke={C.pearl3} strokeWidth={1} />
        <Veins ctx={ctx} d={["M214 254Q264 254 328 258", "M178 254Q124 252 72 254"]} w={1.8} />
        <Port ctx={ctx} x={196} y={253} s={0.62} />
        <path d="M330 252Q342 254 346 262L336 262Q332 257 325 255Z" fill={C.coralP} stroke={C.coral} strokeWidth={0.9} />
        <path d="M67 246L64 258L70 258L73 248Z" fill={C.coral} />
      </A>
      <Wheel ctx={ctx} x={118} y={269} r={31} />
      <Wheel ctx={ctx} x={284} y={269} r={31} />
      <Spark x={214} y={170} s={5} />
    </g>
  );
}

function Form3({ ctx }: { ctx: Ctx }) {
  const a = ctx.branch === "a";
  const d = a
    ? `M50 284${arch(110, 267, 39, 284)}${arch(296, 267, 39, 284)}L352 284Q364 283 366 274L362 266Q332 256 292 248Q252 216 216 210Q164 207 132 220Q96 232 60 242L50 248Q44 266 50 284Z`
    : `M38 284${arch(110, 267, 39, 284)}${arch(296, 267, 39, 284)}L348 284Q360 283 362 272Q360 260 342 254Q316 248 292 246Q254 214 218 208Q166 205 134 216Q92 228 44 236Q32 258 38 284Z`;
  return (
    <g>
      <Ground ctx={ctx} cx={204} cy={300} rx={160} ry={10} pool={ctx.url("pool")} />
      <Wheel ctx={ctx} x={119} y={262} r={32} far />
      <Wheel ctx={ctx} x={305} y={262} r={32} far />
      <A k="bob" d={3} v={{ a: "-1.5px" }}>
        {!a && (
          <g>
            <path d="M150 214Q112 207 68 196L50 236Q96 226 134 216Z" fill={ctx.url("coral")} stroke={C.deep2} strokeWidth={1.1} strokeLinejoin="round" />
            <path d="M150 214Q112 207 68 196" fill="none" stroke={C.pearl} strokeWidth={2} strokeLinecap="round" />
          </g>
        )}
        <Body ctx={ctx} d={d} paint="coral">
          <path d="M30 270Q200 266 370 272L370 300L30 300Z" fill={ctx.url("graph")} />
          {!a && <path d="M30 244Q200 236 370 252L370 262Q200 246 30 254Z" fill={C.pearl} />}
        </Body>
        <path d={a ? "M280 247Q252 222 218 216Q174 214 146 226L156 238Z" : "M282 246Q254 220 220 214Q176 212 148 222L158 236Z"} fill={ctx.url("glass")} stroke={C.deep2} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M160 230Q190 216 226 218" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.8} strokeLinecap="round" />
        <path d={a ? "M140 222Q176 206 222 210Q258 216 288 244" : "M142 218Q178 204 224 208Q260 214 290 242"} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M154 248L194 246L188 274L150 276Z" fill={C.gD} stroke={C.deep2} strokeWidth={1} strokeLinejoin="round" />
        <Veins ctx={ctx} d={["M160 252L190 251", "M158 259L188 258", "M156 266L186 265"]} w={1.4} />
        <Veins
          ctx={ctx}
          tone="pale"
          d={[
            "M242 258Q280 256 316 252",
            "M280 256Q300 262 312 270",
            "M300 254Q330 256 346 262",
            "M210 258Q206 252 196 250",
            "M196 262Q170 268 150 272",
            "M244 252Q262 240 280 238",
          ]}
        />
        <Port ctx={ctx} x={226} y={258} s={0.7} />
        {a ? (
          <g>
            <path d="M70 240L64 214M92 234L88 212" stroke={C.g} strokeWidth={3.2} strokeLinecap="round" />
            <path d="M36 212Q66 202 106 208L104 216Q70 213 38 218Z" fill={ctx.url("graph")} stroke={C.gD} strokeWidth={1} strokeLinejoin="round" />
            <path d="M38 211Q68 203 104 208" fill="none" stroke={C.coral} strokeWidth={1.6} />
          </g>
        ) : (
          <g>
            <path d="M196 208L206 196L226 198L224 210Z" fill={C.g} stroke={C.gD} strokeWidth={0.8} />
            <circle cx={184} cy={262} r={9} fill={C.pearl} stroke={C.coral} strokeWidth={2} />
            <circle cx={184} cy={262} r={3} fill={C.coral} />
          </g>
        )}
        {a ? (
          <path d="M338 258L362 266L356 270L334 264Z" fill={C.coralP} stroke={C.deep2} strokeWidth={0.8} />
        ) : (
          <g>
            <circle cx={347} cy={262} r={5} fill={C.coralP} stroke={C.deep2} strokeWidth={0.8} />
            <circle cx={334} cy={258} r={4} fill={C.coralP} stroke={C.deep2} strokeWidth={0.8} />
          </g>
        )}
        <path d={a ? "M51 250L62 246L62 252L52 256Z" : "M40 240L46 238L44 256L39 256Z"} fill={C.coralL} stroke={C.deep2} strokeWidth={0.6} />
        <path d="M330 285L368 285L372 289L330 290Z" fill={C.g} />
      </A>
      <Wheel ctx={ctx} x={110} y={267} r={33} disc={!a} />
      <Wheel ctx={ctx} x={296} y={267} r={33} disc={!a} />
    </g>
  );
}

/** heartbeat trace behind the later forms (+ a halo ring for the apex form) */
function Pulse({ ctx, y, halo = false }: { ctx: Ctx; y: number; halo?: boolean }) {
  if (!ctx.fx) return null;
  const ecg = `M14 ${y}L132 ${y}L144 ${y - 16}L156 ${y + 22}L170 ${y - 46}L184 ${y + 14}L194 ${y}L386 ${y}`;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {halo && (
        <g>
          <circle cx={200} cy={y} r={132} stroke={ctx.url("halo")} strokeWidth={3} />
          <A k="spin" d={40} at={[200, y]}>
            <circle cx={200} cy={y} r={116} stroke={C.coralL} strokeWidth={1.2} strokeDasharray="2 7" opacity={0.85} />
          </A>
          {ctx.fx && <circle cx={200} cy={y} r={124} stroke={C.coral2} strokeWidth={14} opacity={0.08} />}
        </g>
      )}
      {ctx.fx && <path d={ecg} stroke={C.coral2} strokeWidth={6} opacity={0.18} />}
      <A k="pulse" d={1.6} v={{ o: 0.45 }}>
        <path d={ecg} stroke={C.coral} strokeWidth={1.5} opacity={0.75} />
      </A>
    </g>
  );
}

function Form4({ ctx }: { ctx: Ctx }) {
  const a = ctx.branch === "a";
  const d = a
    ? `M40 284${arch(104, 266, 40, 284)}${arch(300, 266, 40, 284)}L362 284Q372 283 375 276L368 268Q334 262 302 250Q272 234 248 222Q216 204 184 206Q152 208 130 222Q94 236 54 240L38 250Q34 270 40 284Z`
    : `M26 282${arch(104, 266, 40, 284)}${arch(300, 266, 40, 284)}L360 284Q370 283 372 274L364 266Q332 260 302 250Q272 234 248 222Q216 204 184 206Q152 208 130 220Q84 232 32 238Q20 258 26 282Z`;
  return (
    <g>
      <Ground ctx={ctx} cx={204} cy={300} rx={170} ry={10} pool={ctx.url("pool")} />
      <Pulse ctx={ctx} y={190} />
      <Streaks ctx={ctx} y={226} x0={4} x1={40} />
      <Wheel ctx={ctx} x={114} y={261} r={33} far />
      <Wheel ctx={ctx} x={310} y={261} r={33} far />
      <A k="bob" d={2.8} v={{ a: "-1.5px" }}>
        {!a && (
          <g>
            <path d="M150 212Q104 203 54 188L36 236Q88 230 130 220Z" fill={ctx.url("coral")} stroke={C.deep2} strokeWidth={1.1} strokeLinejoin="round" />
            <path d="M150 212Q104 203 54 188" fill="none" stroke={C.pearl} strokeWidth={2.2} strokeLinecap="round" />
            <path d="M118 214Q90 208 62 200" fill="none" stroke={C.coralP} strokeWidth={1.2} strokeLinecap="round" />
          </g>
        )}
        <Body ctx={ctx} d={d} paint="coral">
          <path d="M20 262Q140 252 200 262Q260 272 380 270L380 300L20 300Z" fill={ctx.url("graph")} />
          <path d="M20 262Q140 252 200 262Q260 272 380 270" fill="none" stroke={C.gL} strokeWidth={1} />
          {!a && <path d="M20 240Q200 228 380 252L380 260Q200 238 20 248Z" fill={C.pearl} />}
        </Body>
        <path d="M246 224Q214 206 184 208Q154 210 132 224Q150 236 190 238Q226 236 246 224Z" fill={ctx.url("glass")} stroke={C.deep2} strokeWidth={1.1} />
        <path d="M150 222Q176 210 214 214" fill="none" stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M132 220Q160 204 196 205Q232 208 262 230" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.3} strokeLinecap="round" />
        <path d="M264 252Q236 248 212 262Q240 257 264 259Z" fill={C.pearl} stroke={C.deep2} strokeWidth={0.8} />
        <Veins
          ctx={ctx}
          tone="pale"
          d={[
            "M218 252Q252 248 290 252Q320 256 346 262",
            "M252 249Q264 236 286 234",
            "M290 252Q300 262 304 268",
            "M320 256Q326 246 342 244",
            "M182 252Q150 250 122 246Q92 242 62 244",
            "M150 250Q140 238 124 230",
            "M122 246Q110 254 106 262",
            "M92 243Q82 236 70 234",
          ]}
          w={1.5}
        />
        <Port ctx={ctx} x={200} y={252} s={0.72} />
        {a ? (
          <g>
            <path d="M76 238Q70 214 62 200M100 232Q96 212 90 200" fill="none" stroke={C.g} strokeWidth={3.4} strokeLinecap="round" />
            <path d="M26 198Q64 186 114 194L112 203Q70 199 28 206Z" fill={ctx.url("graph")} stroke={C.gD} strokeWidth={1} strokeLinejoin="round" />
            <path d="M27 197Q64 187 113 194" fill="none" stroke={C.coral} strokeWidth={1.8} />
            <path d="M26 196L28 208" stroke={C.coral} strokeWidth={3} strokeLinecap="round" />
            <path d="M44 284L40 294M54 284L52 294M64 284L64 294" stroke={C.g} strokeWidth={2.2} strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <path d="M188 207L196 194L222 196L220 208Z" fill={C.g} stroke={C.gD} strokeWidth={0.8} />
            <circle cx={170} cy={264} r={10} fill={C.pearl} stroke={C.coral} strokeWidth={2.2} />
            <circle cx={170} cy={264} r={3.2} fill={C.coral} />
          </g>
        )}
        {a ? (
          <path d="M344 264Q362 268 374 276L368 278Q356 272 340 268Z" fill={C.coralP} stroke={C.deep2} strokeWidth={0.8} />
        ) : (
          <g>
            <circle cx={352} cy={265} r={5.5} fill={C.coralP} stroke={C.deep2} strokeWidth={0.8} />
            <circle cx={339} cy={260} r={4.5} fill={C.coralP} stroke={C.deep2} strokeWidth={0.8} />
          </g>
        )}
        <path d={a ? "M38 252L58 248" : "M27 244L30 270"} stroke={C.coralL} strokeWidth={3} strokeLinecap="round" />
        <path d="M330 286L376 286L378 290L330 291Z" fill={C.g} />
      </A>
      <Wheel ctx={ctx} x={104} y={266} r={34} ring disc={!a} />
      <Wheel ctx={ctx} x={300} y={266} r={34} ring disc={!a} />
    </g>
  );
}

function Car5({ ctx, refl = false }: { ctx: Ctx; refl?: boolean }) {
  const a = ctx.branch === "a";
  const fus = a
    ? "M378 268Q366 252 326 246Q282 236 250 218Q214 196 172 200Q120 206 78 226Q46 238 22 246Q40 262 82 268L340 276Q370 276 378 268Z"
    : "M376 268Q364 252 324 246Q282 236 250 218Q214 196 172 200Q120 206 72 222Q30 232 8 240Q28 260 82 268L340 276Q368 276 376 268Z";
  const podF = "M256 266Q256 222 302 218Q348 220 358 258Q334 236 304 236Q272 238 256 266Z";
  const podR = "M52 266Q52 222 98 218Q144 220 152 258Q132 236 100 236Q68 238 52 266Z";
  return (
    <g>
      <Wheel ctx={ctx} x={110} y={261} r={35} far />
      <Wheel ctx={ctx} x={312} y={261} r={35} far />
      {a ? (
        <g>
          <path d="M44 236Q40 220 40 206M70 232Q70 220 72 208" stroke={C.coralL} strokeWidth={1.4} strokeDasharray="2 3" />
          <path d="M8 204Q60 184 122 196Q66 198 12 214Z" fill={ctx.url("pearl")} stroke={C.g} strokeWidth={1.1} strokeLinejoin="round" />
          <path d="M10 205Q60 188 118 196" fill="none" stroke={C.coral} strokeWidth={2} strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M156 206Q96 196 34 180L16 238Q76 230 120 214Z" fill={ctx.url("coral")} stroke={C.deep2} strokeWidth={1.1} strokeLinejoin="round" />
          <path d="M156 206Q96 196 34 180" fill="none" stroke={C.pearl} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M124 210Q80 202 44 194" fill="none" stroke={C.coralP} strokeWidth={1.2} strokeLinecap="round" />
        </g>
      )}
      <path d="M88 268L338 278L328 290L98 283Z" fill={ctx.url("graph")} stroke={C.gD} strokeWidth={1} />
      <path d="M110 284L322 289" stroke={C.coral} strokeWidth={1.6} opacity={0.9} />
      <Body ctx={ctx} d={fus} paint="coral" k={refl ? "r" : "m"}>
        {!a && <path d="M0 236Q200 214 400 252L400 260Q200 224 0 246Z" fill={C.pearl} />}
      </Body>
      <path d="M264 226Q226 194 180 197Q138 200 118 218Q160 232 210 232Q248 232 264 226Z" fill={ctx.url("glass")} stroke={C.pearl2} strokeWidth={1.6} />
      <path d="M136 214Q166 202 206 204" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" />
      <path d="M232 210Q244 216 252 224" fill="none" stroke={C.coralL} strokeOpacity={0.8} strokeWidth={1.4} strokeLinecap="round" />
      <Veins
        ctx={ctx}
        tone="pale"
        d={[
          "M222 250Q270 248 320 252Q350 256 372 266",
          "M268 248Q284 240 300 238",
          "M320 252Q330 246 346 246",
          "M180 250Q140 248 100 244Q60 240 26 246",
          "M140 248Q128 238 112 232",
          "M100 244Q90 252 84 262",
          "M60 242Q50 236 38 236",
        ]}
        w={1.6}
      />
      <Port ctx={ctx} x={200} y={250} s={0.85} />
      <g>
        <path d={podR} fill={ctx.url("pearl")} stroke={C.g} strokeWidth={1.2} strokeLinejoin="round" />
        <path d={podF} fill={ctx.url("pearl")} stroke={C.g} strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M60 252Q66 228 98 224M264 252Q270 228 302 224" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
        <Veins ctx={ctx} d={["M140 244Q148 236 150 252", "M256 256Q246 250 240 252", "M302 220Q300 230 296 238", "M98 220Q96 230 96 238"]} w={1.4} />
        <Sheen ctx={ctx} o={0.4}>
          <path d={podF} />
        </Sheen>
        <Sheen ctx={ctx} o={0.4}>
          <path d={podR} />
        </Sheen>
      </g>
      <path d="M354 256Q370 260 378 268" fill="none" stroke={C.coralP} strokeWidth={3.2} strokeLinecap="round" />
      {ctx.fx && <path d="M354 256Q370 260 378 268" fill="none" stroke={C.coral2} strokeWidth={8} strokeLinecap="round" opacity={0.35} />}
      <path d={a ? "M24 244L30 256" : "M9 238L14 252"} stroke={C.coralL} strokeWidth={3.4} strokeLinecap="round" />
      <Wheel ctx={ctx} x={100} y={266} r={36} ring disc={!a} />
      <Wheel ctx={ctx} x={302} y={266} r={36} ring disc={!a} />
    </g>
  );
}

function Form5({ ctx }: { ctx: Ctx }) {
  const mask = ctx.id("refl");
  return (
    <g>
      {ctx.fx && <ellipse cx={204} cy={304} rx={190} ry={22} fill={ctx.url("pool")} />}
      <ellipse cx={204} cy={304} rx={186} ry={18} fill="none" stroke={C.coral} strokeWidth={1.2} opacity={0.7} />
      <ellipse cx={204} cy={304} rx={150} ry={13} fill="none" stroke={C.coralL} strokeWidth={0.9} strokeDasharray="3 5" opacity={0.8} />
      <Ground ctx={ctx} cx={204} cy={302} rx={168} ry={8} o={0.5} />
      {ctx.fx && (
        <g>
          <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={302} width={400} height={98}>
            <rect x={0} y={302} width={400} height={98} fill={ctx.url("fade")} />
          </mask>
          <g mask={`url(#${mask})`}>
            <g transform="translate(0 604) scale(1 -1)">
              <Car5 ctx={ctx} refl />
            </g>
          </g>
        </g>
      )}
      <Pulse ctx={ctx} y={196} halo />
      <Streaks ctx={ctx} y={218} x0={0} x1={30} n={5} />
      <A k="bob" d={2.8} v={{ a: "-2px" }}>
        <Car5 ctx={ctx} />
      </A>
      <Spark x={228} y={168} s={6} />
      <Spark x={350} y={214} s={4.5} dl={-1.2} />
    </g>
  );
}

function Runway({ ctx, box }: { ctx: Ctx; box: Box }) {
  if (!ctx.ascended || !ctx.fx) return null;
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <A key={i} k="shimmer" d={4} dl={-i * 1.2} v={{ o: 0.3 }}>
          <rect x={box.cx - box.r * (0.95 - i * 0.12)} y={(ctx.form === 5 ? 300 : 286) + i * 8} width={box.r * 2 * (0.95 - i * 0.12)} height={2.4} rx={1.2} fill={ctx.url("irid")} />
        </A>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <A key={`c${i}`} k="sweep" d={2.6} dl={-i * 0.65} v={{ x0: "40px", x1: "-50px" }}>
          <rect x={6 + (i % 2) * 14} y={box.cy - 34 + i * 12} width={60 - (i % 2) * 18} height={2.2} rx={1.1} fill={ctx.url("irid")} />
        </A>
      ))}
    </g>
  );
}

const BOX: Record<number, Box> = {
  1: { cx: 200, cy: 222, r: 132 },
  2: { cx: 204, cy: 222, r: 150 },
  3: { cx: 204, cy: 222, r: 172 },
  4: { cx: 204, cy: 214, r: 182 },
  5: { cx: 200, cy: 210, r: 192 },
};

export function BioelectricCar(ctx: Ctx): React.ReactNode {
  const box = BOX[ctx.form];
  const F = [Form1, Form2, Form3, Form4, Form5][ctx.form - 1];
  return (
    <>
      <Defs ctx={ctx} />
      <Aura ctx={ctx} cx={box.cx} cy={box.cy} r={box.r} color={C.coral2} />
      <PrepGlow ctx={ctx} box={box} color={C.coral2} />
      <Runway ctx={ctx} box={box} />
      <g transform={`translate(0 ${ctx.form === 5 ? -14 : -26})`}>
        <F ctx={ctx} />
      </g>
      <ActivityOverlay ctx={ctx} box={box} glow={C.coralL} ink={C.deep} />
    </>
  );
}
