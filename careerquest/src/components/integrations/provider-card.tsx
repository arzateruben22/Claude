import Link from "next/link";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatInTz } from "@/lib/applications/time";
import type { ConnectionView } from "@/lib/integrations/connections";
import type { ProviderOverview } from "@/lib/integrations/queries";
import { CATEGORY_LABELS, type OAuthKey } from "@/lib/integrations/registry";
import { CapabilityMatrix } from "./capability-matrix";
import { ConnectDialog } from "./connect-dialog";
import { DisconnectButton, SyncNowButton, SyncScheduleToggle } from "./connection-controls";
import { ConnectionStatusBadge, IntegrationStatusBadge } from "./status-badges";

export type ExtensionInfo = { activeTokens: number; lastUsedAt: string | null };

export function ProviderCard({ overview, timezone, extension }: { overview: ProviderOverview; timezone: string; extension?: ExtensionInfo }) {
  const { entry, status, reason, connections, canConnect } = overview;
  const isOAuth = entry.key === "GMAIL" || entry.key === "OUTLOOK";
  const hasConnected = connections.some((c) => c.status === "CONNECTED");
  return (
    <Card className="flex flex-col" data-provider={entry.key}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="text-base">{entry.name}</CardTitle>
          <CardDescription>{CATEGORY_LABELS[entry.category]}</CardDescription>
        </div>
        <IntegrationStatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <p className="text-sm">
          <span className="sr-only">Status: {status}. </span>
          {reason}
        </p>
        <p className="text-sm text-fg-muted">{entry.description}</p>

        {entry.verificationNote && (
          <p className="flex items-start gap-2 text-xs text-fg-subtle">
            <FlaskConical className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-fg-muted">Not live-verified. </span>
              {entry.verificationNote}
            </span>
          </p>
        )}

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-fg hover:text-accent">How applications get captured</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-fg-muted">
            {entry.capture.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>

        <div>
          <p className="text-xs font-medium text-fg-muted mb-1.5">Capabilities</p>
          <CapabilityMatrix capabilities={entry.capabilities} providerName={entry.name} />
        </div>

        {isOAuth && connections.length > 0 && (
          <ul className="space-y-3" aria-label={`${entry.name} accounts`}>
            {connections.map((c) => (
              <ConnectionRow key={c.id} connection={c} providerName={entry.name} provider={entry.key as OAuthKey} canConnect={canConnect} timezone={timezone} />
            ))}
          </ul>
        )}

        {entry.key === "CHROME_EXTENSION" && <ExtensionSetup extension={extension} timezone={timezone} />}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {isOAuth && canConnect && (
            <ConnectDialog provider={entry.key as OAuthKey} label={hasConnected ? "Connect another account" : `Connect ${entry.name}`} variant={hasConnected ? "secondary" : "primary"} />
          )}
          {entry.importLinks.map((l) => (
            <Link key={l.href + l.label} href={l.href} className={buttonClasses("outline", "sm")}>
              {l.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionRow({
  connection: c,
  providerName,
  provider,
  canConnect,
  timezone,
}: {
  connection: ConnectionView;
  providerName: string;
  provider: OAuthKey;
  canConnect: boolean;
  timezone: string;
}) {
  return (
    <li className="rounded-ctl border border-line bg-surface px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium break-all">{c.accountEmail ?? "Account"}</p>
        <ConnectionStatusBadge status={c.status} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-fg-muted">Last sync</dt>
        <dd>{c.lastSyncAt ? formatInTz(c.lastSyncAt, timezone, "datetime") : "Never — press Sync now"}</dd>
        <dt className="text-fg-muted">History range</dt>
        <dd>Last {c.historyDays} days</dd>
        {c.lastError && (
          <>
            <dt className="text-danger">Last error</dt>
            <dd className="text-danger flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
              <span>{c.lastError}</span>
            </dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-1.5">
        {c.status === "CONNECTED" && canConnect && <SyncNowButton connectionId={c.id} label={c.accountEmail ?? providerName} />}
        {c.status === "CONNECTED" && <SyncScheduleToggle connectionId={c.id} enabled={c.syncEnabled} />}
        {c.status !== "CONNECTED" && canConnect && <ConnectDialog provider={provider} label="Reconnect" />}
        <DisconnectButton connectionId={c.id} providerName={providerName} accountEmail={c.accountEmail} />
      </div>
    </li>
  );
}

function ExtensionSetup({ extension, timezone }: { extension?: ExtensionInfo; timezone: string }) {
  return (
    <div className="rounded-ctl border border-line bg-surface px-3 py-3 space-y-2 text-sm">
      <p className="font-medium">Set up</p>
      <ol className="list-decimal pl-5 space-y-1 text-fg-muted">
        <li>
          Create a token in{" "}
          <Link href="/settings/tokens" className="text-accent hover:underline">
            Settings → Developer tokens
          </Link>{" "}
          (shown once — copy it).
        </li>
        <li>
          In Chrome open <code className="text-xs text-fg">chrome://extensions</code>, turn on Developer mode, choose Load unpacked and select the{" "}
          <code className="text-xs text-fg">extension/</code> folder (see <code className="text-xs text-fg">extension/README.md</code>).
        </li>
        <li>Open the extension&apos;s settings, enter this site&apos;s address and the token, then Test connection.</li>
      </ol>
      <p className="text-xs text-fg-subtle">
        {extension && extension.activeTokens > 0
          ? `${extension.activeTokens} active token${extension.activeTokens === 1 ? "" : "s"}; last used ${
              extension.lastUsedAt ? formatInTz(extension.lastUsedAt, timezone, "datetime") : "never"
            }.`
          : "No active developer tokens yet."}
      </p>
    </div>
  );
}
