"use client";
// The Review reel's small helpers; without them it still swipes (scroll snap) and steps (anchor links). With them:
// a video stops when its episode leaves the screen, the address keeps the episode in view (#ep-…), ← and → step,
// and Previous/Next scroll the reel sideways instead of jumping the page.
import { useEffect } from "react";

export function ReelNav({ id }: { id: string }) {
  useEffect(() => {
    const reel = document.getElementById(id);
    if (!reel) return;
    const slides = [...reel.querySelectorAll<HTMLElement>(".slide")];
    const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    const show = (el: Element | null) => el && (el as HTMLElement).scrollIntoView({ behavior: smooth(), block: "start", inline: "start" });
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { if (location.hash !== `#${e.target.id}`) history.replaceState(null, "", `#${e.target.id}`); }
        else e.target.querySelector("video")?.pause();
      }
    }, { root: reel.scrollWidth > reel.clientWidth ? reel : null, threshold: 0.6 });
    slides.forEach((s) => seen.observe(s));
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-step]");
      if (!a || !reel.contains(a)) return;
      e.preventDefault();
      show(document.getElementById(a.hash.slice(1)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || (e.target as Element).closest("input, textarea, select, video, [contenteditable]")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = slides.findIndex((s) => `#${s.id}` === location.hash);
      const to = slides[Math.min(slides.length - 1, Math.max(0, (i < 0 ? 0 : i) + (e.key === "ArrowRight" ? 1 : -1)))];
      if (to) { e.preventDefault(); show(to); }
    };
    reel.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { seen.disconnect(); reel.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [id]);
  return null;
}
