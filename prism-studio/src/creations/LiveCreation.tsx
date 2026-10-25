"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Creation } from "./Creation";
import type { CreationProps } from "./types";

/**
 * Creation that pauses its idle animations while offscreen or while the page
 * is hidden. The wrapper toggles `prism-paused`; each creation's scoped
 * stylesheet turns that into `animation-play-state: paused`.
 */
export function LiveCreation(props: CreationProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) setInView(e.isIntersecting);
        },
        { rootMargin: "120px" },
      );
      io.observe(el);
    }
    const onVisibility = () => setPageHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const paused = !inView || pageHidden;
  return (
    <span
      ref={ref}
      className={paused ? "prism-live prism-paused" : "prism-live"}
      style={{ display: "inline-block", lineHeight: 0, verticalAlign: "middle" }}
    >
      <Creation {...props} />
    </span>
  );
}
