import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInTz } from "@/lib/applications/time";
import { INFO_CODES } from "@/lib/integrations/adapters/types";
import { getProvider } from "@/lib/integrations/registry";
import type { SyncRunView } from "@/lib/integrations/sync";
import { RunStatusBadge } from "./status-badges";

/** The last sync runs across the user's connections, newest first. */
export function SyncRunsCard({ runs, timezone }: { runs: SyncRunView[]; timezone: string }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recent syncs</CardTitle>
          <CardDescription>The last {runs.length || 10} runs across your connected mailboxes.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center text-center py-6">
            <History className="h-6 w-6 text-fg-subtle mb-2" aria-hidden />
            <p className="font-medium text-sm">No syncs yet</p>
            <p className="mt-1 text-sm text-fg-muted max-w-md">
              Connect Gmail or Outlook and press Sync now. Each run is listed here with what it found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Recent sync runs</caption>
              <thead>
                <tr className="text-left text-xs text-fg-muted border-b border-line">
                  <th scope="col" className="py-2 px-1 font-medium">Started</th>
                  <th scope="col" className="py-2 px-1 font-medium">Account</th>
                  <th scope="col" className="py-2 px-1 font-medium">Result</th>
                  <th scope="col" className="py-2 px-1 font-medium text-right">Checked</th>
                  <th scope="col" className="py-2 px-1 font-medium text-right">Matched</th>
                  <th scope="col" className="py-2 px-1 font-medium text-right">New</th>
                  <th scope="col" className="py-2 px-1 font-medium text-right">Updated</th>
                  <th scope="col" className="py-2 px-1 font-medium">Problems</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const problems = r.issues.filter((i) => !INFO_CODES.has(i.code));
                  const notes = r.issues.filter((i) => INFO_CODES.has(i.code));
                  return (
                    <tr key={r.id} className="border-b border-line last:border-0 align-top">
                      <td className="py-2 px-1 whitespace-nowrap">{formatInTz(r.startedAt, timezone, "datetime")}</td>
                      <td className="py-2 px-1">
                        <span className="block">{getProvider(r.provider)?.name ?? r.provider}</span>
                        {r.accountEmail && <span className="block text-xs text-fg-muted break-all">{r.accountEmail}</span>}
                      </td>
                      <td className="py-2 px-1">
                        <RunStatusBadge status={r.status} />
                      </td>
                      <td className="py-2 px-1 text-right tnum">{r.scanned}</td>
                      <td className="py-2 px-1 text-right tnum">{r.matched}</td>
                      <td className="py-2 px-1 text-right tnum">{r.created}</td>
                      <td className="py-2 px-1 text-right tnum">{r.updated}</td>
                      <td className="py-2 px-1 text-xs">
                        {problems.length === 0 && notes.length === 0 ? (
                          <span className="text-fg-muted">None</span>
                        ) : (
                          <details>
                            <summary className="cursor-pointer">
                              {problems.length > 0 ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : "Notes"}
                            </summary>
                            <ul className="mt-1 space-y-1 text-fg-muted max-w-xs">
                              {[...problems, ...notes].slice(0, 20).map((i, idx) => (
                                <li key={idx}>{i.message}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
