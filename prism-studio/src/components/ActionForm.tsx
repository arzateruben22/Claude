"use client";
// A form bound to a server action: shows pending state and the action's message in a live region.
// (Unlocks are celebrated by the layout's CelebrationHost, from the database.)
import { useActionState, type ReactNode } from "react";
import type { Result } from "@/app/actions";

export function ActionForm({ action, children, className, submit, submitClass = "btn", confirm }: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  children?: ReactNode; className?: string; submit?: string; submitClass?: string; confirm?: string;
}) {
  const [state, act, pending] = useActionState(action, null);
  return (
    <form
      action={act}
      className={className}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {children}
      {submit ? <button className={submitClass} disabled={pending}>{pending ? "Working…" : submit}</button> : null}
      <p role="status" aria-live="polite" className={state ? (state.ok ? "muted" : "") : "sr-only"} style={state && !state.ok ? { color: "var(--bad)", fontWeight: 600 } : undefined}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}
