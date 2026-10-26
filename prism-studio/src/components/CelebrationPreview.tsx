"use client";
import { useState } from "react";
import { Celebration } from "./Celebration";

export function CelebrationPreview({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn ghost small" style={{ color: "var(--ivory)", borderColor: "rgba(246,241,231,.3)", justifySelf: "start" }} onClick={() => setOpen(true)}>Preview the moment <span className="demo-tag">DEMO</span></button>
      {open ? <Celebration titles={[title]} demo onClose={() => setOpen(false)} /> : null}
    </>
  );
}
