"use client";
// A form bound to a server action: shows pending state and the action's message in a live region.
// (Unlocks are celebrated by the layout's CelebrationHost, from the database.)
// With JavaScript the submit is dispatched by hand, so a refused submit keeps everything the owner typed (React resets
// a form after its `action` prop runs, whatever the answer); the fields are cleared only when the action succeeded.
// Without JavaScript the form still posts to the action through its `action` prop.
import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { Result } from "@/app/actions";

export function ActionForm({ action, children, className, submit, submitClass = "btn", confirm }: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  children?: ReactNode; className?: string; submit?: string; submitClass?: string; confirm?: string;
}) {
  const [state, act, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);   // a new answer each time, so this runs per submit
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || (confirm && !window.confirm(confirm))) return;
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => act(fd));
  };
  return (
    <form ref={form} action={act} className={className} onSubmit={onSubmit}>
      {children}
      {submit ? <button className={submitClass} disabled={pending}>{pending ? "Working…" : submit}</button> : null}
      <p role="status" aria-live="polite" className={state ? (state.ok ? "muted" : "") : "sr-only"} style={state && !state.ok ? { color: "var(--bad)", fontWeight: 600 } : undefined}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}
