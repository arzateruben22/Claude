import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProviderCard } from "@/components/integrations/provider-card";
import { SyncRunsCard } from "@/components/integrations/sync-runs";
import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { readIntegrationEnv } from "@/lib/integrations/env";
import { oauthErrorMessage } from "@/lib/integrations/oauth/messages";
import { getIntegrationsOverview } from "@/lib/integrations/queries";
import { CATEGORY_LABELS, CATEGORY_ORDER, getProvider } from "@/lib/integrations/registry";

export const metadata: Metadata = { title: "Integrations" };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/integrations");
  const sp = await searchParams;
  const env = readIntegrationEnv();
  const [overview, timezone] = await Promise.all([getIntegrationsOverview(user.id, env), userTimezone(user.id)]);

  const connectedKey = first(sp.connected);
  const connected = connectedKey === "GMAIL" || connectedKey === "OUTLOOK" ? getProvider(connectedKey) : null;
  const errorMessage = oauthErrorMessage(first(sp.oauthError));
  const errorProvider = getProvider(first(sp.provider) ?? "");

  return (
    <>
      <PageHeader
        eyebrow="Connect"
        title="Integrations"
        description="How each platform's applications reach your tracker. Job boards and applicant-tracking systems offer no applicant API, so their applications arrive through confirmation emails, the Chrome extension, file imports or manual entry."
        actions={
          <Link href="/applications/import" className={buttonClasses("secondary", "md")}>
            Import files
          </Link>
        }
      />

      <div className="space-y-3 mb-6">
        {connected && (
          <Alert tone="success" title={`${connected.name} connected`}>
            Press Sync now on the {connected.name} card to import your history. Only job-related mail is processed.
          </Alert>
        )}
        {errorMessage && (
          <Alert tone="danger" title={errorProvider ? `${errorProvider.name} was not connected` : "Not connected"}>
            {errorMessage}
          </Alert>
        )}
      </div>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const items = overview.providers.filter((p) => p.entry.category === category);
          if (!items.length) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="text-sm font-semibold uppercase tracking-wide text-fg-muted mb-3">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((p) => (
                  <ProviderCard key={p.entry.key} overview={p} timezone={timezone} extension={overview.extension} />
                ))}
              </div>
            </section>
          );
        })}

        <SyncRunsCard runs={overview.recentRuns} timezone={timezone} />

        <p className="text-xs text-fg-subtle">
          Connected mailboxes sync when you press Sync now, and on the server&apos;s schedule when the operator has configured one
          (POST /api/integrations/sync with the scheduler secret). Each run reads at most 500 messages and continues where the
          previous run stopped.
        </p>
      </div>
    </>
  );
}
