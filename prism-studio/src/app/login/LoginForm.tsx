"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, act, pending] = useActionState(signIn, null);
  return (
    <form action={act} className="card stack">
      <input type="hidden" name="next" value={next} />
      <label className="field">Passphrase
        <input name="passphrase" type="password" autoComplete="current-password" required autoFocus />
      </label>
      <button className="btn block" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
      <p role="status" aria-live="polite" style={{ color: "var(--bad)", fontWeight: 600, margin: 0, minHeight: "1.5em" }}>{state && !state.ok ? state.message : ""}</p>
    </form>
  );
}
