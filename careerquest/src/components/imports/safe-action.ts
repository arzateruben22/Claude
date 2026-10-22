"use client";

import type { ActionResult } from "@/lib/action-result";

/** Next.js signals redirects / notFound through thrown errors with these digests; they must propagate. */
export function isNavigationError(err: unknown): boolean {
  const digest = err && typeof err === "object" && "digest" in err ? (err as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND)/.test(digest);
}

export const UPLOAD_FAILED =
  "The upload could not be sent. The file may be larger than this server accepts — try fewer or smaller files — or the connection dropped.";

/**
 * Wrap an upload server action so a transport failure (request body over the server's limit, network
 * drop) becomes a form error instead of crashing the page into the error boundary.
 */
export function withUploadErrors<T>(
  action: (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>,
): (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>> {
  return async (prev, formData) => {
    try {
      return await action(prev, formData);
    } catch (err) {
      if (isNavigationError(err)) throw err;
      return { ok: false, error: UPLOAD_FAILED };
    }
  };
}
