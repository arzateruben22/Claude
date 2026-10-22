"use client";

import { startTransition, useActionState, useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { DiscoveryActionData, DiscoveryActionResult } from "@/lib/discovery/actions";

export type DiscoveryAction = (prev: DiscoveryActionResult | null, formData: FormData) => Promise<DiscoveryActionResult>;

/**
 * Form state for Job Discovery / share actions. Submitting through `onSubmit` keeps the clicked
 * button's name/value (FormData with the submitter) and skips React's automatic reset of
 * uncontrolled fields, so typed input survives validation errors; `action` stays on the form so it
 * still submits without JavaScript. Results become toasts: success (green) or info (nothing new
 * stored / a choice is needed); field errors stay inline.
 */
export function useDiscoveryForm(action: DiscoveryAction, opts: { resetOnSuccess?: boolean; onSuccess?: (data: DiscoveryActionData) => void } = {}) {
  const { resetOnSuccess = false, onSuccess } = opts;
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitter, setSubmitter] = useState<string | null>(null);
  const wrapped = useCallback<DiscoveryAction>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.ok) {
        toast.push({ tone: result.data.tone === "info" ? "info" : "success", title: result.data.message });
        if (result.data.tone === "success") {
          if (resetOnSuccess) formRef.current?.reset();
          onSuccess?.(result.data);
        }
      } else if (!result.fieldErrors) {
        toast.push({ tone: "danger", title: result.error });
      }
      return result;
    },
    [action, toast, resetOnSuccess, onSuccess],
  );
  const [state, formAction, pending] = useActionState(wrapped, null);
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const by = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const formData = new FormData(e.currentTarget, by ?? undefined);
      setSubmitter(by?.value || by?.name || null);
      startTransition(() => formAction(formData));
    },
    [formAction],
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const data = state && state.ok ? state.data : null;
  return { state, data, errors, pending, submitter, formProps: { ref: formRef, action: formAction, onSubmit } };
}
