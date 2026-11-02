"use client";
// On a phone the monitor strip is a sideways row of names: bring the current one into view (the new channels sit at
// the end of the rig order, past the edge of a 390 px screen).
import { useEffect } from "react";

export function StripCurrent() {
  useEffect(() => {
    const a = document.querySelector<HTMLElement>(".strip [aria-current='page']");
    const row = a?.closest<HTMLElement>(".strip-rig");
    if (!a || !row || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft += a.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - a.offsetWidth) / 2;
  }, []);
  return null;
}
