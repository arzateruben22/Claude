"use client";
// The unlock moment: a modal with confetti (none under reduced motion), focus moved into it, Escape to close.
import { useEffect, useRef } from "react";

const COLORS = ["#F2A93B", "#2F5BFF", "#FF6F5E", "#5B3FD0", "#D99A92", "#141210"];

export function Celebration({ titles, demo, onClose }: { titles: string[]; demo?: boolean; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="confetti" aria-hidden>
        {Array.from({ length: 48 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 12) * 0.06}s`, transform: `rotate(${i * 29}deg)` }} />
        ))}
      </div>
      <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" onClick={onClose}>
        <div className="modal stack" onClick={(e) => e.stopPropagation()}>
          <div className="kicker">{demo ? <span className="demo-tag">DEMO</span> : "Unlocked"}</div>
          <h2 id="celebrate-title">{titles.join(" · ")}</h2>
          <p className="muted">{demo ? "A preview with demo numbers: nothing real was unlocked or reserved." : "It's on your trophy shelf now. Rewards only ever use money you set aside yourself."}</p>
          <button ref={btn} className="btn" onClick={onClose}>Lovely</button>
        </div>
      </div>
    </>
  );
}
