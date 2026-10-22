"use client";

import { useActionState, useCallback } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/ui/toast";

type Action<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/**
 * `useActionState` plus a toast when the action settles. Field errors stay inline in the form;
 * whole-form failures and successes become toasts.
 */
export function useGameAction<T extends { message: string }>(action: Action<T>, onSuccess?: (data: T) => void) {
  const toast = useToast();
  const wrapped = useCallback<Action<T>>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.ok) {
        toast.push({ tone: "success", title: result.data.message });
        onSuccess?.(result.data);
      } else if (!result.fieldErrors) {
        toast.push({ tone: "danger", title: result.error });
      }
      return result;
    },
    [action, toast, onSuccess],
  );
  return useActionState(wrapped, null);
}
