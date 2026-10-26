"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn ghost small" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch {
        const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
      }
      setDone(true); setTimeout(() => setDone(false), 1600);
    }}>
      <Icon name={done ? "check" : "copy"} size={18} /> <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
