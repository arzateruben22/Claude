import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat-tile";
import { formatNumber, formatPercent } from "@/lib/format";
import { plainText } from "@/lib/coach/format";
import { BASIS_LABELS } from "@/lib/coach/types";
import { formatDelta, pointChange, weekLabel } from "@/lib/reports/week";
import { SECTION_LABELS, type CumulativeFunnel, type ReportRow, type ReportSection, type WeeklyReportData } from "@/lib/reports/types";

const ROW_BASIS: Record<ReportRow["basis"], string> = { observed: "Observed", self_reported: "Self-reported", verified: "Verified" };
const SECTIONS: ReportSection[] = ["applications", "funnel", "followups", "progress", "learning", "hours"];

function value(r: ReportRow, v: number): string {
  return r.unit === "hours" ? `${formatNumber(v)} h` : formatNumber(v);
}

function find(data: WeeklyReportData, key: string): ReportRow | undefined {
  return data.rows.find((r) => r.key === key);
}

function DeltaHint({ r }: { r: ReportRow | undefined }) {
  if (!r) return null;
  return (
    <span className="tnum">
      {formatDelta(r.delta)} vs prior week ({value(r, r.priorWeek)})
    </span>
  );
}

function rateText(c: CumulativeFunnel, which: "responseRate" | "interviewRate"): string {
  const r = c[which];
  if (r.value === null) return "No applications yet";
  return `${formatPercent(r.value, 1)} (${r.successes} of ${r.n})${r.interval ? `, 95% interval ${formatPercent(r.interval.low, 0)}–${formatPercent(r.interval.high, 0)}` : ""}`;
}

/** "Oct 21, 2026, 4:05 PM" in the report's timezone. */
export function generatedAtText(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

export function reportStatus(data: WeeklyReportData, isCurrentWeek: boolean): { tone: "info" | "success" | "warning"; text: string } {
  const at = generatedAtText(data.generatedAt, data.timezone);
  if (isCurrentWeek) return { tone: "info", text: `Current week: recomputed each time you open it (last ${at}).` };
  if (data.complete) return { tone: "success", text: `Complete: frozen snapshot generated ${at}. Regenerate to recompute it from today's data.` };
  return { tone: "warning", text: `Generated mid-week (${at}), so it may miss the end of the week. Regenerate to include all seven days.` };
}

export function ReportView({ data, isCurrentWeek }: { data: WeeklyReportData; isCurrentWeek: boolean }) {
  const applied = find(data, "applications.applied");
  const responses = find(data, "funnel.responses");
  const interviews = find(data, "funnel.interviews");
  const offers = find(data, "funnel.offers");
  const c = data.cumulative;
  const respPts = pointChange(c.thisWeek.responseRate, c.priorWeek.responseRate);
  const intPts = pointChange(c.thisWeek.interviewRate, c.priorWeek.interviewRate);

  return (
    <div className="space-y-4" data-testid="weekly-report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Applications vs target"
          value={
            <>
              {formatNumber(applied?.thisWeek ?? 0)}
              <span className="text-base text-fg-muted"> / {formatNumber(data.target.weekly)}</span>
            </>
          }
          hint={
            <>
              <ProgressBar value={applied?.thisWeek ?? 0} max={Math.max(1, data.target.weekly)} label="Applications toward the weekly target" className="my-1.5 print:hidden" />
              <DeltaHint r={applied} />
            </>
          }
        />
        <StatTile label="Employer responses" value={formatNumber(responses?.thisWeek ?? 0)} hint={<DeltaHint r={responses} />} />
        <StatTile label="Reached interview stage" value={formatNumber(interviews?.thisWeek ?? 0)} hint={<DeltaHint r={interviews} />} />
        <StatTile label="Offers" value={formatNumber(offers?.thisWeek ?? 0)} hint={<DeltaHint r={offers} />} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>This week vs the week before</CardTitle>
            <CardDescription>
              {weekLabel(data.weekStart)} compared with {weekLabel(data.priorWeekStart)}. All counts are observed from your records in {data.timezone}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm" data-testid="report-table">
              <caption className="sr-only">Weekly metrics compared with the prior week</caption>
              <thead className="text-xs text-fg-subtle">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">This week</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Prior week</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Change</th>
                  <th scope="col" className="py-2 font-medium">Basis</th>
                </tr>
              </thead>
              {SECTIONS.map((section) => {
                const rows = data.rows.filter((r) => r.section === section);
                if (!rows.length) return null;
                return (
                  <tbody key={section}>
                    <tr>
                      <th scope="rowgroup" colSpan={5} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                        {SECTION_LABELS[section]}
                      </th>
                    </tr>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-line/60 align-top" data-row={r.key}>
                        <th scope="row" className="py-2 pr-3 font-normal text-fg">
                          {r.label}
                          {r.note && <span className="block text-xs text-fg-subtle">{r.note}</span>}
                        </th>
                        <td className="py-2 pr-3 text-right tnum">{value(r, r.thisWeek)}</td>
                        <td className="py-2 pr-3 text-right tnum text-fg-muted">{value(r, r.priorWeek)}</td>
                        <td className="py-2 pr-3 text-right tnum text-fg-muted">{formatDelta(r.delta)}</td>
                        <td className="py-2 text-xs">
                          <Badge tone={r.basis === "verified" ? "success" : r.basis === "self_reported" ? "warning" : "neutral"}>{ROW_BASIS[r.basis]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
          {data.quizAverage.thisWeek !== null && (
            <p className="mt-3 text-xs text-fg-muted">
              Average score across this week&apos;s attempts: {data.quizAverage.thisWeek}%{data.quizAverage.priorWeek !== null ? ` (prior week ${data.quizAverage.priorWeek}%)` : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Funnel at the end of each week</CardTitle>
              <CardDescription>Cumulative totals counting only what had happened by that Sunday. Intervals are estimates.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid gap-2">
              <div>
                <dt className="text-xs text-fg-subtle">Applications submitted (total)</dt>
                <dd className="tnum">
                  {formatNumber(c.thisWeek.applied)} <span className="text-fg-muted">(prior week {formatNumber(c.priorWeek.applied)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Response rate</dt>
                <dd className="tnum">
                  {rateText(c.thisWeek, "responseRate")}
                  {respPts !== null && <span className="block text-xs text-fg-muted">{respPts >= 0 ? "+" : "−"}{Math.abs(respPts).toFixed(1)} percentage points vs prior week ({rateText(c.priorWeek, "responseRate")})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">Interview rate</dt>
                <dd className="tnum">
                  {rateText(c.thisWeek, "interviewRate")}
                  {intPts !== null && <span className="block text-xs text-fg-muted">{intPts >= 0 ? "+" : "−"}{Math.abs(intPts).toFixed(1)} percentage points vs prior week</span>}
                </dd>
              </div>
            </dl>
            {c.thisWeek.applied < 10 && c.thisWeek.applied > 0 && <p className="text-xs text-warning">Fewer than 10 applications: these rates can swing a lot from one reply.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Missions completed this week</CardTitle>
              <CardDescription>Game progress from real actions.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.missionsCompleted.length === 0 ? (
              <p className="text-sm text-fg-muted">No missions were completed this week.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {data.missionsCompleted.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Top recommendations</CardTitle>
            <CardDescription>
              From the Advisor&apos;s rules engine when this report was generated ({generatedAtText(data.generatedAt, data.timezone)}); they reflect your data at that moment.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {data.recommendations.length === 0 ? (
            <p className="text-sm text-fg-muted">No recommendations were active when this report was generated.</p>
          ) : (
            <ol className="space-y-3">
              {data.recommendations.map((r, i) => (
                <li key={r.id} className="rounded-ctl border border-line bg-surface p-3">
                  <p className="font-medium">
                    {i + 1}. {r.title}
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">{plainText(r.body)}</p>
                  {r.citations.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-fg-subtle">
                      {r.citations.map((m) => (
                        <li key={m.id}>
                          Based on {m.label}: <span className="text-fg-muted tnum">{m.display}</span> ({BASIS_LABELS[m.basis]})
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={r.action.href} className="mt-2 inline-block text-xs text-accent hover:underline print:hidden">
                    {r.action.label}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-fg-subtle">
        Definitions: applications count by the day they were applied, archived records included. Responses, interview stage and offers count applications whose first
        signal of that stage fell in the week. Hours count by the day worked; self-reported hours are not verified.{" "}
        {isCurrentWeek ? "This week is still in progress." : ""}
      </p>
    </div>
  );
}
