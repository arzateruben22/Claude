"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { createTokenAction, revokeTokenAction } from "@/lib/account/actions";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input } from "@/components/ui";
import { useSettingsAction } from "./use-settings-action";

export type TokenRow = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy} aria-label={copied ? "Copied" : "Copy token"}>
      {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function RevokeButton({ token }: { token: TokenRow }) {
  const [, action, pending] = useSettingsAction(revokeTokenAction);
  return (
    <form action={action}>
      <input type="hidden" name="tokenId" value={token.id} />
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`Revoke token ${token.name}`}>
        Revoke
      </Button>
    </form>
  );
}

export function TokensPanel({ tokens }: { tokens: TokenRow[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createTokenAction>> | null, formData: FormData) => {
      const r = await createTokenAction(prev, formData);
      if (r.ok) formRef.current?.reset();
      return r;
    },
    null,
  );
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const active = tokens.filter((t) => !t.revokedAt);
  const revoked = tokens.filter((t) => t.revokedAt);

  return (
    <div className="space-y-4">
      <Alert tone="info" title="What these are for">
        Personal access tokens let the CareerQuest Chrome extension (Phase 3) and mobile capture send job pages and confirmations to
        your tracker. Paste a token into the extension once; it is scoped to capture writes and application reads.
      </Alert>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Create a token</CardTitle>
            <CardDescription>The secret is shown once, right after creation. Store it somewhere safe.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}
          {state?.ok && (
            <Alert tone="success" title={`Token "${state.data.name}" created — copy it now`}>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="block break-all rounded-ctl bg-bg-elevated border border-line px-2.5 py-1.5 text-xs text-fg tnum flex-1" data-testid="token-plaintext">
                  {state.data.plaintext}
                </code>
                <CopyButton value={state.data.plaintext} />
              </div>
              <p className="mt-2 text-xs">
                Paste it into the CareerQuest Chrome extension or the mobile capture setup. You will not be able to see it again; create a new
                one if you lose it.
              </p>
            </Alert>
          )}
          <form ref={formRef} action={action} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Token name" htmlFor="token-name" errors={fe?.name} className="flex-1">
              <Input id="token-name" name="name" placeholder="e.g. Chrome on my laptop" maxLength={60} required autoComplete="off" />
            </Field>
            <Button type="submit" loading={pending}>
              <Plus className="h-4 w-4" aria-hidden />
              Create token
            </Button>
          </form>
        </CardContent>
      </Card>

      {tokens.length === 0 ? (
        <EmptyState icon={<KeyRound className="h-8 w-8" aria-hidden />} title="No tokens yet" description="Create one above when you install the extension or set up mobile capture." />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your tokens</CardTitle>
              <CardDescription>
                {active.length} active · {revoked.length} revoked
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line" aria-label="API tokens">
              {[...active, ...revoked].map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{t.name}</span>
                      {t.revokedAt ? <Badge tone="neutral">Revoked</Badge> : <Badge tone="success">Active</Badge>}
                    </p>
                    <p className="text-xs text-fg-muted mt-0.5">
                      Created {formatDateTime(t.createdAt)} · {t.lastUsedAt ? `last used ${formatRelative(t.lastUsedAt)}` : "never used"}
                      {t.revokedAt && ` · revoked ${formatDateTime(t.revokedAt)}`}
                    </p>
                    <p className="text-[11px] text-fg-subtle mt-0.5 tnum">{t.scopes.join(", ")}</p>
                  </div>
                  {!t.revokedAt && <RevokeButton token={t} />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
