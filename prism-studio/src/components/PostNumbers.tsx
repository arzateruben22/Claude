// One post's numbers: each metric's latest value with where it came from (API / CSV / MANUAL, plus ESTIMATE and DEMO)
// and when, the API pull state, and "Refresh now" when the platform can be asked. Used by Analytics and the episode page.
import Link from "next/link";
import type { metricSnapshots } from "@/db/schema";
import type { PullState } from "@/domain/api-analytics";
import { formatLocal } from "@/domain/time";
import { count, PLATFORM_LABEL } from "@/lib/format";
import { refreshMetrics } from "@/app/actions";
import { ActionForm } from "./ActionForm";

type Snap = typeof metricSnapshots.$inferSelect;
type Latest = Record<string, Snap | null>;

const TAG: Record<string, { label: string; title: string }> = {
  api: { label: "API", title: "Read from the platform's API" },
  csv: { label: "CSV", title: "Imported from a platform CSV export" },
  manual: { label: "MANUAL", title: "Owner-confirmed from the platform's analytics" },
  estimate: { label: "ESTIMATE", title: "Your estimate: never counts toward anything" },
  demo: { label: "DEMO", title: "Demo number: a preview that never counts" },
};

export const METRIC_LABEL: Record<string, string> = {
  views: "views", likes: "likes", comments: "comments", shares: "shares",
  avg_view_duration_s: "avg view", watch_time_s: "watch time", followers_gained: "followers gained",
};

/** The value as people read it: whole counts with separators, durations in seconds with one decimal. */
export function metricValue(metric: string, v: number | null | undefined) {
  if (v == null) return "—";
  if (metric === "avg_view_duration_s") return `${v.toFixed(1)} s`;
  if (metric === "watch_time_s") return v >= 3600 ? `${(v / 3600).toFixed(1)} h` : `${count(v)} s`;
  return count(v);
}

export function SourceTag({ source }: { source: string }) {
  const t = TAG[source] ?? { label: source.toUpperCase(), title: source };
  return <span className={source === "demo" ? "demo-tag" : `src-tag${source === "estimate" ? " est" : ""}`} title={t.title}>{t.label}</span>;
}

/** "pulled Oct 26, 2026, 9:05 AM" for API rows, "imported …" for CSV, "logged …" for the rest (studio timezone). */
export const whenLabel = (s: Snap, tz: string) => `${s.source === "api" ? "pulled" : s.source === "csv" ? "imported" : "logged"} ${formatLocal(s.retrievedAt, tz)}`;

export function ViewsFigure({ snap, tz }: { snap: Snap | null; tz: string }) {
  return (
    <div className="views-fig">
      <div className="h2 num-display">{snap ? count(snap.value) : "—"}</div>
      <div className="faint views-meta">
        <span>views</span>
        {snap ? <> <SourceTag source={snap.source} />{snap.status === "revised" ? <span> · revised down</span> : null}</> : null}
      </div>
      {snap ? <div className="faint views-meta">{whenLabel(snap, tz)}</div> : null}
    </div>
  );
}

/** Likes, comments, shares, average view (and watch time / followers when reported), each with its source. */
export function MetricChips({ latest }: { latest: Latest }) {
  const shown = ["likes", "comments", "shares", "avg_view_duration_s", "watch_time_s", "followers_gained"].filter((m) => m !== "watch_time_s" || latest[m]);
  return (
    <div className="row metric-chips">
      {shown.map((m) => {
        const s = latest[m];
        return <span key={m} className="metric-chip"><span className="faint">{METRIC_LABEL[m]}</span> <b className="num">{metricValue(m, s?.value)}</b>{s ? <> <SourceTag source={s.source} /></> : null}</span>;
      })}
    </div>
  );
}

/** The API pull state for a post on a connected account, with "Refresh now". Manual-only posts show nothing. */
export function PullLine({ publicationId, platform, pull, tz }: { publicationId: string; platform: keyof typeof PLATFORM_LABEL; pull: PullState | null; tz: string }) {
  if (!pull) return null;
  const b = pull.blocked;
  if (b && b.code !== "needs_reconnect" && b.code !== "stopped") return null;   // not an API post: log numbers by hand or CSV
  const name = PLATFORM_LABEL[platform];
  const status = b?.code === "needs_reconnect" ? <span className="chip bad">{name} connection needs reconnecting: <Link href="/connections">Accounts</Link></span>
    : b?.code === "stopped" ? <span className="chip warn">API pulls paused: external actions are stopped</span>
    : pull.queued ? <span className="chip info">Pull queued</span>
    : pull.lastOutcome === "failed" ? <span className="chip warn">Last pull failed; the next one is on schedule</span>
    : <span className="chip good">API pulls {pull.cadenceDays === 1 ? `daily until ${formatLocal(pull.weeklyFrom, tz, { dateStyle: "medium" })}, then weekly` : "weekly"}</span>;
  const last = pull.lastAttemptAt
    ? `Last asked ${formatLocal(pull.lastAttemptAt, tz)}${pull.lastOutcome === "empty" ? `: ${name} had no numbers yet` : pull.lastError && pull.lastOutcome !== "ok" ? `: ${pull.lastError}` : ""}`
    : `${name} hasn't been asked yet`;
  return (
    <div className="pull-line">
      <div className="pull-state">
        {status}
        <span className="faint pull-last">{last}</span>
      </div>
      {!b && !pull.queued ? (
        <ActionForm action={refreshMetrics} className="pull-refresh" submit="Refresh now" submitClass="btn quiet small">
          <input type="hidden" name="publicationId" value={publicationId} />
        </ActionForm>
      ) : null}
    </div>
  );
}

export function MetricHistory({ history, tz }: { history: Snap[]; tz: string }) {
  if (!history.length) return null;
  return (
    <details>
      <summary style={{ cursor: "pointer" }}>History</summary>
      <ul className="metric-history">
        {history.map((h) => (
          <li key={h.id}>
            <span>{METRIC_LABEL[h.metric] ?? h.metric.replace(/_/g, " ")} <b className="num">{metricValue(h.metric, h.value)}</b></span>
            <SourceTag source={h.source} />
            <span className="faint">{whenLabel(h, tz)}{h.status !== "ok" ? ` · ${h.status}` : ""}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
