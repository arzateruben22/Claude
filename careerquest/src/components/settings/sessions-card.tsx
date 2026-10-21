import { MonitorSmartphone } from "lucide-react";
import type { SessionView } from "@/lib/account/service";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { SignOutOthersButton } from "./sign-out-others-button";

/** Readable device summary from a user-agent string. Pure. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  if (!os && !browser) return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
  return [browser, os].filter(Boolean).join(" on ");
}

export function SessionsCard({ sessions }: { sessions: SessionView[] }) {
  const others = sessions.filter((s) => !s.current).length;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently signed in to your account. Sessions expire 30 days after their last use.</CardDescription>
        </div>
        <SignOutOthersButton othersCount={others} />
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-fg-muted">No active sessions were found.</p>
        ) : (
          <ul className="divide-y divide-line" aria-label="Active sessions">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <MonitorSmartphone className="h-4 w-4 mt-0.5 text-fg-subtle shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg flex flex-wrap items-center gap-2">
                    <span className="truncate" title={s.userAgent ?? undefined}>
                      {describeUserAgent(s.userAgent)}
                    </span>
                    <code className="text-[11px] text-fg-subtle tnum">{s.idPrefix}</code>
                    {s.current && <Badge tone="accent">This device</Badge>}
                  </p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Signed in {formatDateTime(s.createdAt)} · last seen {formatRelative(s.lastSeenAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
