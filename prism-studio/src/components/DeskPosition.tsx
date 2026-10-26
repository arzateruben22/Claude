"use client";
// The Upload Desk remembers where you were: leaving for the TikTok or YouTube app and coming back lands you on
// the same task (sessionStorage; per tab, nothing private stored).
import { useEffect } from "react";

const KEY = "prism.desk.position";
export function DeskPosition() {
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || "null") as { id?: string; y?: number } | null;
      const el = saved?.id ? document.getElementById(saved.id) : null;
      if (el) el.scrollIntoView({ block: "start" }); else if (saved?.y) window.scrollTo(0, saved.y);
    } catch { /* storage unavailable: start at the top */ }
    const save = () => {
      const cards = [...document.querySelectorAll<HTMLElement>("[data-task]")];
      const cur = cards.find((c) => c.getBoundingClientRect().bottom > 80);
      try { sessionStorage.setItem(KEY, JSON.stringify({ id: cur?.id, y: window.scrollY })); } catch { /* ignore */ }
    };
    const vis = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", save);
    document.addEventListener("click", save, true);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", save); document.removeEventListener("click", save, true); };
  }, []);
  return null;
}
