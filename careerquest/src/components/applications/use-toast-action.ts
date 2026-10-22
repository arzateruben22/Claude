"use client";

import { startTransition, useActionState, useCallback, useRef } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/ui/toast";

type Action<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/**
 * `useActionState` plus a toast on completion. Field-level validation errors are left to the form
 * to render inline; only whole-form failures and successes become toasts.
 */
export function useToastAction<T extends { message: string }>(action: Action<T>, onSuccess?: (data: T) => void) {
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

/**
 * `useToastAction` for forms with uncontrolled fields. React resets uncontrolled fields after a
 * form action resolves, even when the server answered with validation errors, which would wipe
 * what the user typed. Submitting through `onSubmit` + a transition skips that automatic reset;
 * the form is cleared only after a successful save (unless `resetOnSuccess` is false). `action`
 * stays on the form so it still submits without JavaScript.
 */
export function useToastForm<T extends { message: string }>(
  action: Action<T>,
  opts: { onSuccess?: (data: T) => void; resetOnSuccess?: boolean } = {},
) {
  const { onSuccess, resetOnSuccess = true } = opts;
  const formRef = useRef<HTMLFormElement>(null);
  const handleSuccess = useCallback(
    (data: T) => {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(data);
    },
    [onSuccess, resetOnSuccess],
  );
  const [state, formAction, pending] = useToastAction(action, handleSuccess);
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      startTransition(() => formAction(formData));
    },
    [formAction],
  );
  return { state, pending, formProps: { ref: formRef, action: formAction, onSubmit } };
}
