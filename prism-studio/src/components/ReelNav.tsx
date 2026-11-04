"use client";
// The Review reel's small helpers; without them it still swipes (scroll snap) and steps (anchor links). With them:
// a video stops when its episode leaves the screen, the address keeps the episode in view (#ep-…), ← and → step,
// Previous/Next scroll the reel sideways instead of jumping the page, and the Hold sheet closes on Escape and puts
// the cursor in its box when it opens. The episode page uses it for the Hold sheet only (its steps are page links).
import { useEffect } from "react";

export function ReelNav({ id }: { id: string }) {
  useEffect(() => {
    const reel = document.getElementById(id);
    if (!reel) return;
    const slides = [...reel.querySelectorAll<HTMLElement>(".slide")];
    const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    const show = (el: Element | null) => el && (el as HTMLElement).scrollIntoView({ behavior: smooth(), block: "start", inline: "start" });
    const sideways = reel.scrollWidth > reel.clientWidth;
    // pause as soon as a slide is fully off screen; the address follows the slide across the middle of the view
    // (desktop cards are taller than the window, so a share of the card can't be the test)
    const gone = new IntersectionObserver((entries) => {
      for (const e of entries) if (!e.isIntersecting) e.target.querySelector("video")?.pause();
    }, { root: sideways ? reel : null, threshold: 0 });
    // the channel switcher (outside the reel): its buttons, and the one for the channel in view
    const chans = [...document.querySelectorAll<HTMLAnchorElement>("a[data-chan]")];
    const mark = (slide: Element | null) => {
      const ch = slide?.getAttribute("data-channel");
      for (const b of chans) {
        const on = b.dataset.chan === ch;
        if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
        if (on) b.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    const current = () => slides.find((s) => `#${s.id}` === location.hash) ?? slides[0] ?? null;
    mark(current());
    const here = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        if (location.hash !== `#${e.target.id}`) history.replaceState(null, "", `#${e.target.id}`);
        mark(e.target);
      }
    }, sideways ? { root: reel, threshold: 0.6 } : { rootMargin: "-50% 0px -50% 0px" });
    if (slides.length > 1) slides.forEach((s) => { gone.observe(s); here.observe(s); });
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      // Next channel: the first slide of the channel after the one in view (the anchor's own link is the fallback)
      if (t.closest("a[data-chan-next]") && chans.length > 1) {
        const ch = current()?.getAttribute("data-channel");
        const i = chans.findIndex((b) => b.dataset.chan === ch);
        const to = document.getElementById(chans[(i + 1) % chans.length].hash.slice(1));
        if (to) { e.preventDefault(); show(to); }
        return;
      }
      const jump = t.closest<HTMLAnchorElement>("a[data-chan]");
      if (jump) {
        const to = document.getElementById(jump.hash.slice(1));
        if (to) { e.preventDefault(); show(to); }
        return;
      }
      const a = t.closest<HTMLAnchorElement>("a[data-step]");
      const to = a && reel.contains(a) && a.hash ? document.getElementById(a.hash.slice(1)) : null;
      if (!to) return;
      e.preventDefault();
      show(to);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const open = reel.querySelector<HTMLDetailsElement>("details.hold[open]");
        if (open) { open.open = false; open.querySelector("summary")?.focus(); }
        return;
      }
      if (slides.length < 2 || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || (e.target as Element).closest("input, textarea, select, video, [contenteditable]")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = slides.findIndex((s) => `#${s.id}` === location.hash);
      const to = slides[Math.min(slides.length - 1, Math.max(0, (i < 0 ? 0 : i) + (e.key === "ArrowRight" ? 1 : -1)))];
      if (to) { e.preventDefault(); show(to); }
    };
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (d.matches?.("details.hold") && d.open) d.querySelector("textarea")?.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);
    reel.addEventListener("toggle", onToggle, true);
    document.addEventListener("keydown", onKey);
    return () => { gone.disconnect(); here.disconnect(); document.removeEventListener("click", onClick); reel.removeEventListener("toggle", onToggle, true); document.removeEventListener("keydown", onKey); };
  }, [id]);
  return null;
}
