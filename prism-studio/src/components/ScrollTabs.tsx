"use client";
// A row of tabs that scrolls sideways on a phone. The current tab is scrolled into view (centred) whenever it changes,
// so the filter or section that's on is always visible. Without JavaScript the row still works; it starts at the left.
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function ScrollTabs({ label, current, children }: { label: string; current: string; children: ReactNode }) {
  const nav = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const row = nav.current, tab = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !tab) return;
    const r = row.getBoundingClientRect(), t = tab.getBoundingClientRect();
    if (t.left >= r.left && t.right <= r.right) return;              // already in view: don't move the row
    row.scrollLeft += t.left - r.left - (r.width - t.width) / 2;     // only the row scrolls, never the page
  }, [current]);
  return <nav ref={nav} className="tabs" aria-label={label}>{children}</nav>;
}
