"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

function subscribe(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduced-motion"] });
  return () => observer.disconnect();
}

const readProfilePref = () => document.documentElement.dataset.reducedMotion === "true";

/**
 * True when motion should be reduced: the OS "reduce motion" setting or the user's CareerQuest
 * preference (Settings → Appearance, mirrored on <html data-reduced-motion>).
 */
export function useShouldReduceMotion(): boolean {
  const os = useReducedMotion();
  const profile = useSyncExternalStore(subscribe, readProfilePref, () => false);
  return Boolean(os) || profile;
}
