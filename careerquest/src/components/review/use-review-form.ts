"use client";

import { startTransition, useActionState, useCallback, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/ui/toast";

type Data = { message: string };
export type ReviewAction = (prev: ActionResult<Data> | null, formData: FormData) => Promise<ActionResult<Data>>;

/**
 * Form state for a review item whose buttons carry the decision (`name="decision"`). Submitting
 * through `onSubmit` keeps the clicked button's value (FormData with the submitter) and skips
 * React's automatic form reset, so typed edits survive a validation error; `action` stays on the
 * form so it still works without JavaScript. Successes and whole-form failures become toasts.
 */
export function useReviewForm(action: ReviewAction) {
  const toast = useToast();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const wrapped = useCallback<ReviewAction>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.ok) toast.push({ tone: "success", title: result.data.message });
      else if (!result.fieldErrors) toast.push({ tone: "danger", title: result.error });
      return result;
    },
    [action, toast],
  );
  const [state, formAction, pending] = useActionState(wrapped, null);
  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent).submitter;
      const formData = new FormData(e.currentTarget, submitter ?? undefined);
      const decision = formData.get("decision");
      setSubmitted(typeof decision === "string" ? decision : null);
      startTransition(() => formAction(formData));
    },
    [formAction],
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return {
    pending,
    /** The decision value of the button that was clicked last (for its spinner). */
    submitted,
    errors,
    formProps: { action: formAction, onSubmit },
  };
}
