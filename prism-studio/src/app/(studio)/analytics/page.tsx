import type { Metadata } from "next";
import Link from "next/link";
import { analyticsRows, studio } from "@/lib/data";
import { db } from "@/db/client";
import { analyticsTotals } from "@/domain/analytics";
import { formatLocal } from "@/domain/time";
import { count, PLATFORM_LABEL, topicStyle } from "@/lib/format";
import { addMetric, importCsv } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { MetricChips, MetricHistory, PullLine, ViewsFigure } from "@/components/PostNumbers";

export const metadata: Metadata = { title: "Analytics" };

export default async function Analytics() {
  const [rows, s, totals] = await Promise.all([analyticsRows(), studio(), analyticsTotals(db())]);
  return (
    <div>
      <div className="kicker">Platform-reported numbers only</div>
      <h1>Analytics</h1>
      <p className="lede">Posts the platform verified on a connected account are read through its API: daily for a post&apos;s first 30 days, then weekly. For the rest, log numbers from each app&apos;s analytics or paste a CSV export. A missing number stays blank, never 0. Every number is tagged with where it came from; only API, CSV and owner-confirmed (MANUAL) views count toward milestones, never estimates or demo numbers.</p>
      {rows.length ? (
        <p className="row totals" aria-label="Totals">
          <span><b className="num">{count(totals.posts)}</b> <span className="faint">post{totals.posts === 1 ? "" : "s"}</span></span>
          <span><b className="num">{count(totals.views)}</b> <span className="faint">views, platform-reported ({totals.measured} of {totals.posts} measured)</span></span>
          <span className="faint">Demo, simulated and estimated numbers are never in these totals.</span>
        </p>
      ) : null}
      {!rows.length ? <div className="card"><p className="muted" style={{ margin: 0 }}>No posts yet. Once you mark an upload done on the <Link href="/upload">Upload Desk</Link>, it shows up here.</p></div> : null}
      <div className="stack">
        {rows.map((r) => (
          <article key={r.p.id} className="card topic stack-sm" style={topicStyle(r.channel)}>
            <div className="row spread top">
              <div>
                <div className="kicker" style={{ color: "var(--topic-ink)" }}>{r.channel.label} · {PLATFORM_LABEL[r.dest.platform]}{r.p.simulated ? " · " : ""}{r.p.simulated ? <span className="sim-tag">SIMULATED</span> : null}{r.e.isDemo ? " · " : ""}{r.e.isDemo ? <span className="demo-tag">DEMO</span> : null}</div>
                <h3 style={{ margin: "4px 0 0" }}><Link href={`/episodes/${r.e.id}`}>{r.e.title}</Link></h3>
                <div className="faint" style={{ fontSize: 13 }}>Posted {formatLocal(r.p.reportedAt, s.timezone)}{r.p.postUrl ? <> · <a href={r.p.postUrl} target="_blank" rel="noopener noreferrer">open post</a></> : null}</div>
              </div>
              <ViewsFigure snap={r.latest.views} tz={s.timezone} />
            </div>
            <MetricChips latest={r.latest} />
            <PullLine publicationId={r.p.id} platform={r.dest.platform} pull={r.pull} tz={s.timezone} />
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Log a number</summary>
              <ActionForm action={addMetric} className="stack-sm" submit="Log it" submitClass="btn small">
                <input type="hidden" name="publicationId" value={r.p.id} />
                <div className="grid2" style={{ gap: 10 }}>
                  <label className="field">Metric
                    <select name="metric" defaultValue="views"><option value="views">Views</option><option value="avg_view_duration_s">Average view duration (s)</option><option value="likes">Likes</option><option value="comments">Comments</option><option value="shares">Shares</option><option value="followers_gained">Followers gained</option></select>
                  </label>
                  <label className="field">Value <input name="value" inputMode="numeric" required placeholder="12,400" /></label>
                </div>
                <label className="field">Where it came from
                  <select name="source" defaultValue="manual"><option value="manual">From the platform&apos;s analytics (owner-confirmed)</option><option value="estimate">My estimate (never unlocks anything)</option><option value="demo">DEMO number (preview only)</option></select>
                </label>
              </ActionForm>
            </details>
            <MetricHistory history={r.history} tz={s.timezone} />
          </article>
        ))}
      </div>
      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Import a CSV</h2></div>
        <ActionForm action={importCsv} className="card stack-sm" submit="Import" submitClass="btn">
          <label className="field">CSV <span className="hint">Header row: post_url (or publication_id), metric, value. Rows are matched to posts by their saved link.</span>
            <textarea name="csv" placeholder={"post_url,metric,value\nhttps://youtube.com/shorts/abc123,views,15400"} style={{ fontFamily: "var(--mono)", fontSize: 13 }} />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
