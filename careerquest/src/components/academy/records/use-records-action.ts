"use client";

import { useActionState, useCallback } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/ui/toast";

type Action<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

function isFrameworkError(err: unknown): boolean {
  const digest = typeof err === "object" && err !== null && "digest" in err ? (err as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * `useActionState` + a toast when the action settles. Field errors stay inline; whole-form failures
 * and successes become toasts. When `transportErrorMessage` is set (forms that upload files), a
 * request that never reaches the action — e.g. a body over the server's upload limit — becomes a
 * friendly error instead of an error boundary.
 */
export function useRecordsAction<T extends { message: string }>(
  action: Action<T>,
  opts: { onSuccess?: (data: T) => void; transportErrorMessage?: string } = {},
) {
  const toast = useToast();
  const { onSuccess, transportErrorMessage } = opts;
  const wrapped = useCallback<Action<T>>(
    async (prev, formData) => {
      let result: ActionResult<T>;
      try {
        result = await action(prev, formData);
      } catch (err) {
        if (!transportErrorMessage || isFrameworkError(err)) throw err;
        result = { ok: false, error: transportErrorMessage };
      }
      if (result.ok) {
        toast.push({ tone: "success", title: result.data.message });
        onSuccess?.(result.data);
      } else if (!result.fieldErrors) {
        toast.push({ tone: "danger", title: result.error });
      }
      return result;
    },
    [action, toast, onSuccess, transportErrorMessage],
  );
  return useActionState(wrapped, null);
}

export const UPLOAD_TRANSPORT_ERROR = "The upload could not be sent. Check your connection and keep files at 10 MB or less.";
