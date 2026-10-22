"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONSENT, DEFAULT_HISTORY_DAYS, HISTORY_DAY_OPTIONS, type OAuthKey } from "@/lib/integrations/registry";

const START_PATH: Record<OAuthKey, string> = { GMAIL: "/api/oauth/google/start", OUTLOOK: "/api/oauth/microsoft/start" };
const PROVIDER_LABEL: Record<OAuthKey, string> = { GMAIL: "Google", OUTLOOK: "Microsoft" };

/**
 * Consent first: the dialog states exactly what is read, the scopes requested, what is stored, how long,
 * and how to disconnect, and lets the user pick the history range. "Continue" posts to the OAuth start
 * route, which redirects to the provider's own consent screen.
 */
export function ConnectDialog({ provider, label = "Connect", variant = "primary" }: { provider: OAuthKey; label?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const copy = CONSENT[provider];

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={copy.title} description="Read this before you continue." size="lg">
        <form method="post" action={START_PATH[provider]} onSubmit={() => setSubmitting(true)} className="space-y-4 text-sm">
          <ConsentSection title="What CareerQuest reads" items={copy.reads} />
          <section>
            <h3 className="font-medium mb-1.5">Permissions requested</h3>
            <ul className="space-y-1.5">
              {copy.scopes.map((s) => (
                <li key={s.scope} className="text-fg-muted">
                  <code className="text-xs text-fg break-all">{s.scope}</code> — {s.meaning}
                </li>
              ))}
            </ul>
          </section>
          <ConsentSection title="What is stored" items={copy.stores} />
          <ConsentSection title="Retention" items={copy.retention} />
          <ConsentSection title="How to disconnect" items={copy.disconnect} />

          <fieldset>
            <legend className="font-medium mb-1.5">
              History to import on the first sync
            </legend>
            <div className="flex flex-wrap gap-2">
              {HISTORY_DAY_OPTIONS.map((d) => (
                <label
                  key={d}
                  className="inline-flex items-center gap-2 rounded-ctl border border-line px-3 py-2 cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                >
                  <input type="radio" name="historyDays" value={d} defaultChecked={d === DEFAULT_HISTORY_DAYS} className="accent-[var(--accent)]" />
                  <span>Last {d} days</span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-fg-subtle">Later syncs only look at mail received since the previous sync.</p>
          </fieldset>

          <p className="flex items-start gap-2 text-xs text-fg-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
            Nothing is ever sent, deleted or changed in your mailbox. Applications are never submitted on your behalf.
          </p>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Continue to {PROVIDER_LABEL[provider]}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ConsentSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="font-medium mb-1.5">{title}</h3>
      <ul className="list-disc pl-5 space-y-1 text-fg-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}
