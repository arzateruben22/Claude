"use client";
import { useActionState } from "react";
import { makeOwnerHash } from "./actions";
import { CopyButton } from "@/components/CopyButton";

export function SetupForm({ secrets }: { secrets: string }) {
  const [state, act, pending] = useActionState(makeOwnerHash, null);
  const block = state?.hash ? `${secrets}\nOWNER_PASSWORD_HASH=${state.hash}` : null;
  return (
    <>
      <form action={act} className="card stack">
        <label className="field">Choose a passphrase
          <span className="hint">12 characters or more. Save it in your password manager first; Prism can't show it again.</span>
          <input name="passphrase" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
        </label>
        <label className="field">Type it again
          <input name="again" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
        </label>
        <button className="btn block" disabled={pending}>{pending ? "Working…" : "Make my variables"}</button>
        <p role="status" aria-live="polite" className="status-line" style={state && !state.ok ? { color: "var(--bad)", fontWeight: 600 } : undefined}>{state?.message ?? ""}</p>
      </form>
      {block ? (
        <section className="card stack-sm" aria-label="Your variables">
          <div className="row spread"><h2 style={{ margin: 0 }}>Your variables</h2><CopyButton text={block} label="Copy all" /></div>
          <pre className="setup-block">{block}</pre>
          <p className="faint" style={{ margin: 0, fontSize: 13.5 }}>Railway → your service → Variables → Raw Editor: paste this below what's there, then Update Variables. The service restarts and this page closes for good.</p>
        </section>
      ) : null}
    </>
  );
}
