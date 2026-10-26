"use client";

import * as React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Creation } from "./Creation";
import { CREATIONS } from "./meta";
import type { Branch, CreationKey, Form } from "./types";

export interface EvolutionRevealProps {
  creation: CreationKey;
  from: Form;
  to: Form;
  branch?: Branch;
  ascended?: boolean;
  onDone?: () => void;
  /** default false; when true a short WebAudio chime plays at the burst */
  sound?: boolean;
  /** stage size in px, default 280 */
  size?: number;
  className?: string;
}

type Phase = "charge" | "burst" | "reveal" | "done";

const CHARGE = 1300;
const BURST = 450;
const REVEAL = 1450;
const ROMAN = ["", "I", "II", "III", "IV", "V"];

/** deterministic burst particles: angle, distance factor, shape, spin */
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.17;
  return {
    a,
    dist: 0.36 + ((i * 7) % 5) * 0.045,
    shape: (["dia", "tri", "sq"] as const)[i % 3],
    size: 6 + ((i * 5) % 4) * 2,
    spin: (i % 2 ? 1 : -1) * (120 + ((i * 37) % 160)),
    delay: ((i * 13) % 5) * 0.02,
  };
});

function chime() {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    void ac.resume?.();
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.16;
    master.connect(ac.destination);
    [659.25, 987.77, 1318.51, 1975.53].forEach((hz, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = i % 2 ? "triangle" : "sine";
      o.frequency.value = hz;
      const t0 = now + i * 0.075;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.6 / (i + 1), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 1.6);
    });
    window.setTimeout(() => void ac.close(), 2000);
  } catch {
    /* audio is optional */
  }
}

/**
 * 2–4 s evolution reveal: the old form charges in its glow colour, a burst
 * of geometric particles, the new form scales into place and its name
 * appears. Prefers-reduced-motion gets a 250 ms crossfade with no flash.
 */
export function EvolutionReveal(props: EvolutionRevealProps): React.JSX.Element {
  const { creation, from, to, branch = null, ascended = false, onDone, sound = false, size = 280, className } = props;
  const u = `er${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [phase, setPhase] = useState<Phase>("charge");
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    setPhase("charge");
    const finish = () => {
      setPhase("done");
      doneRef.current?.();
    };
    if (reduced) {
      at(20, () => setPhase("reveal"));
      at(270, finish);
    } else {
      at(CHARGE, () => {
        setPhase("burst");
        if (sound) chime();
      });
      at(CHARGE + BURST, () => setPhase("reveal"));
      at(CHARGE + BURST + REVEAL, finish);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [creation, from, to, sound]);

  const meta = CREATIONS[creation];
  const G = meta.colors.glow;
  const P = meta.colors.primary;
  const S = `.${u}`;
  const css = `
${S}{position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:12px}
${S} .st{position:relative;width:${size}px;height:${size}px}
${S} .ly{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
${S} .ly svg{display:block}
${S} .old{transform-origin:50% 55%}
${S}.charge .old{animation:${u}-charge ${CHARGE}ms cubic-bezier(.5,0,.8,.6) both}
${S}.burst .old{animation:${u}-vanish ${BURST}ms ease-in both}
${S}.reveal .old,${S}.done .old{opacity:0}
${S} .new{opacity:0;transform-origin:50% 55%}
${S}.reveal .new{animation:${u}-rise 1150ms cubic-bezier(.2,.9,.25,1.12) both}
${S}.done .new{opacity:1}
${S} .glow{background:radial-gradient(circle at 50% 52%,${G} 0%,${G}99 26%,${G}00 62%);opacity:0}
${S}.charge .glow{animation:${u}-glow ${CHARGE}ms ease-in both}
${S}.burst .glow{animation:${u}-glowout 900ms ease-out both}
${S} .wash{background:radial-gradient(circle at 50% 55%,${G}cc 0%,${G}00 58%);mix-blend-mode:screen;opacity:0}
${S}.charge .wash{animation:${u}-wash ${CHARGE}ms ease-in both}
${S} .flash{background:radial-gradient(circle at 50% 52%,#fff 0%,${G} 22%,${G}00 58%);opacity:0}
${S}.burst .flash{animation:${u}-flash 520ms ease-out both}
${S} .ring{position:absolute;left:20%;top:22%;width:60%;height:60%;border-radius:50%;border:2px solid ${G};box-shadow:0 0 18px ${G};opacity:0}
${S}.burst .ring{animation:${u}-ring 750ms ease-out both}
${S} .pt{position:absolute;left:50%;top:52%;opacity:0;background:${G};box-shadow:0 0 0 1px ${P}55}
${S} .pt.tri{clip-path:polygon(50% 0,100% 100%,0 100%);box-shadow:none;background:${P}}
${S} .pt.sq{background:#fff;box-shadow:0 0 0 1px ${P}88}
${S}.burst .pt,${S}.reveal .pt{animation:${u}-fly 1000ms cubic-bezier(.15,.7,.3,1) both;animation-delay:var(--dl)}
${S} .cv{position:absolute;left:50%;top:52%;width:6px;height:6px;margin:-3px;border-radius:50%;background:${G};box-shadow:0 0 6px ${G};opacity:0}
${S}.charge .cv{animation:${u}-conv ${CHARGE}ms ease-in both;animation-delay:var(--dl)}
${S} .cap{opacity:0;text-align:center;line-height:1.15;min-height:3.2em}
${S} .cap small{display:block;font:600 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.24em;text-transform:uppercase;opacity:.72}
${S} .cap strong{display:block;margin-top:6px;font:italic 400 28px/1.05 "Instrument Serif","Cormorant Garamond",Georgia,serif;letter-spacing:.01em}
${S} .cap em{display:block;margin-top:4px;font:500 12px/1.2 system-ui,-apple-system,sans-serif;font-style:normal;opacity:.65}
${S}.reveal .cap{animation:${u}-cap 800ms 420ms ease-out both}
${S}.done .cap{opacity:1}
@keyframes ${u}-charge{0%{transform:scale(1)}68%{transform:scale(1.05)}78%{transform:scale(1.045) translate(1px,-1px)}84%{transform:scale(1.07) translate(-1px,1px)}91%{transform:scale(1.06) translate(1px,1px)}100%{transform:scale(1.09)}}
@keyframes ${u}-vanish{0%{transform:scale(1.09);opacity:1}100%{transform:scale(1.32);opacity:0}}
@keyframes ${u}-rise{0%{transform:scale(.45);opacity:0}45%{opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes ${u}-glow{0%{opacity:0;transform:scale(.55)}100%{opacity:1;transform:scale(1.05)}}
@keyframes ${u}-glowout{0%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.6)}}
@keyframes ${u}-wash{0%,40%{opacity:0}100%{opacity:.85}}
@keyframes ${u}-flash{0%{opacity:0}22%{opacity:.95}100%{opacity:0}}
@keyframes ${u}-ring{0%{opacity:.95;transform:scale(.3)}100%{opacity:0;transform:scale(1.75)}}
@keyframes ${u}-fly{0%{opacity:1;transform:translate(-50%,-50%) rotate(0deg) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rot)) scale(.3)}}
@keyframes ${u}-conv{0%{opacity:0;transform:rotate(var(--a0)) translateX(var(--d0))}35%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--a0) + 200deg)) translateX(3px)}}
@keyframes ${u}-cap{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
${S} *{animation:none!important}
${S} .glow,${S} .wash,${S} .flash,${S} .ring,${S} .pt,${S} .cv{display:none}
${S} .old,${S} .new,${S} .cap{transition:opacity 250ms linear}
${S}.reveal .old,${S}.done .old{opacity:0}
${S}.reveal .new,${S}.done .new,${S}.reveal .cap,${S}.done .cap{opacity:1}
}`;

  const name = meta.forms[to - 1];
  const branchName = branch && to >= 3 ? meta.branches[branch].name : null;
  const showNew = phase === "reveal" || phase === "done";
  return (
    <div className={[u, phase, className].filter(Boolean).join(" ")} data-phase={phase}>
      <style>{css}</style>
      <div className="st">
        <div className="ly glow" />
        <div className="ly old" aria-hidden={showNew}>
          <Creation creation={creation} form={from} branch={branch} ascended={ascended} size={size} motion="full" />
        </div>
        <div className="ly wash" />
        <div className="ly new" aria-hidden={!showNew}>
          <Creation creation={creation} form={to} branch={branch} ascended={ascended} size={size} motion="full" activity={phase === "done" ? "idle" : "celebrating"} />
        </div>
        <div className="ly flash" />
        <div className="ring" />
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={`c${i}`}
            className="cv"
            style={{ ["--a0" as string]: `${i * 45}deg`, ["--d0" as string]: `${size * 0.42}px`, ["--dl" as string]: `${(i % 4) * 110}ms` } as React.CSSProperties}
          />
        ))}
        {PARTICLES.map((pt, i) => (
          <span
            key={i}
            className={`pt ${pt.shape}`}
            style={
              {
                width: pt.size,
                height: pt.size,
                ["--dx" as string]: `${Math.round(Math.cos(pt.a) * pt.dist * size)}px`,
                ["--dy" as string]: `${Math.round(Math.sin(pt.a) * pt.dist * size)}px`,
                ["--rot" as string]: `${pt.spin}deg`,
                ["--dl" as string]: `${pt.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="cap" role="status" aria-live="polite">
        {showNew && (
          <>
            <small>
              Form {ROMAN[to]}
              {ascended ? " · Ascended" : ""}
            </small>
            <strong>{name}</strong>
            {branchName && <em>{branchName}</em>}
          </>
        )}
      </div>
    </div>
  );
}
