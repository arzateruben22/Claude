"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/** True after hydration on the client, false during SSR — without a setState-in-effect. */
export function useIsMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
