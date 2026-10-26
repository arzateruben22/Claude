"use client";
import { useState } from "react";
import { Celebration } from "./Celebration";

export function CelebrationPreview({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn ghost small" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>Preview the moment <span className="demo-tag">DEMO</span></button>
      {open ? <Celebration titles={[title]} demo onClose={() => setOpen(false)} /> : null}
    </>
  );
}
