"use client";
// Plays an earned evolution's reveal once, then records it as seen so it never replays.
import { useState } from "react";
import { EvolutionReveal } from "@/creations/EvolutionReveal";
import type { CreationKey, Form } from "@/creations/types";
import { seenEvolution } from "@/app/actions";

export function RevealOnce(p: { evolutionId: string; creation: CreationKey; from: Form; to: Form; branch: "a" | "b" | null; ascended: boolean; title: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={`Evolution: ${p.title}`}>
      <div className="modal stack" style={{ textAlign: "center", justifyItems: "center" }}>
        <EvolutionReveal creation={p.creation} from={p.from} to={p.to} branch={p.branch} ascended={p.ascended} size={260} />
        <h2 style={{ margin: 0 }}>{p.title}</h2>
        <button className="btn" autoFocus onClick={() => { setOpen(false); void seenEvolution(p.evolutionId); }}>Welcome it</button>
      </div>
    </div>
  );
}
