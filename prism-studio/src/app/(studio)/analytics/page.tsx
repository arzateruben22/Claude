import type { Metadata } from "next";
import Link from "next/link";
import { analyticsRows, studio } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { count, PLATFORM_LABEL, topicStyle } from "@/lib/format";
import { addMetric, importCsv } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";

export const metadata: Metadata = { title: "Analytics" };

const SOURCE_LABEL: Record<string, string> = { api: "API", csv: "CSV", manual: "owner-confirmed", estimate: "estimate", demo: "DEMO" };

export default async function Analytics() {
  const [rows, s] = await Promise.all([analyticsRows(), studio()]);
  return (
    <div>
      <div className="kicker">Platform-reported numbers only</div>
      <h1>Analytics</h1>
      <p className="lede">Until the platforms are connected, log numbers from each app&apos;s analytics (or paste a CSV export). A missing number stays blank, never 0. Only API, CSV and owner-confirmed views count toward milestones; estimates and demo numbers never do.</p>
      {!rows.length ? <div className="card"><p className="muted" style={{ margin: 0 }}>No posts yet. Once you mark an upload done on the <Link href="/upload">Upload Desk</Link>, it shows up here.</p></div> : null}
      <div className="stack">
        {rows.map((r) => (
          <article key={r.p.id} className="card topic stack-sm" style={topicStyle(r.channel)}>
            <div className="row spread top">
              <div>
                <div className="kicker" style={{ color: "var(--topic-ink)" }}>{r.channel.label} · {PLATFORM_LABEL[r.dest.platform]}{r.p.simulated ? " · " : ""}{r.p.simulated ? <span className="sim-tag">SIMULATED</span> : null}</div>
                <h3 style={{ margin: "4px 0 0" }}><Link href={`/episodes/${r.e.id}`}>{r.e.title}</Link></h3>
                <div className="faint" style={{ fontSize: 13 }}>Posted {formatLocal(r.p.reportedAt, s.timezone)}{r.p.postUrl ? <> · <a href={r.p.postUrl} target="_blank" rel="noopener noreferrer">open post</a></> : null}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="h2" style={{ margin: 0 }}>{r.latest.views ? count(r.latest.views.value) : "—"}</div>
                <div className="faint" style={{ fontSize: 12 }}>views{r.latest.views ? ` · ${SOURCE_LABEL[r.latest.views.source]}${r.latest.views.status === "revised" ? " · revised down" : ""}` : ""}</div>
              </div>
            </div>
            <div className="row">
              {(["avg_view_duration_s", "likes", "shares", "followers_gained"] as const).map((m) => (
                <span key={m} className="chip">{m.replace(/_/g, " ").replace(" s", " (s)")}: {r.latest[m] ? count(r.latest[m]!.value) : "—"}</span>
              ))}
            </div>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Log a number</summary>
              <ActionForm action={addMetric} className="stack-sm" submit="Log it" submitClass="btn small">
                <input type="hidden" name="publicationId" value={r.p.id} />
                <div className="grid2" style={{ gap: 10 }}>
                  <label className="field">Metric
                    <select name="metric" defaultValue="views"><option value="views">Views</option><option value="avg_view_duration_s">Average view duration (s)</option><option value="likes">Likes</option><option value="shares">Shares</option><option value="followers_gained">Followers gained</option></select>
                  </label>
                  <label className="field">Value <input name="value" inputMode="numeric" required placeholder="12,400" /></label>
                </div>
                <label className="field">Where it came from
                  <select name="source" defaultValue="manual"><option value="manual">From the platform&apos;s analytics (owner-confirmed)</option><option value="estimate">My estimate (never unlocks anything)</option><option value="demo">DEMO number (preview only)</option></select>
                </label>
              </ActionForm>
            </details>
            {r.history.length ? (
              <details><summary style={{ cursor: "pointer" }}>History</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14 }}>{r.history.map((h) => <li key={h.id}>{h.metric}: {count(h.value)} <span className="faint">· {SOURCE_LABEL[h.source]} · {formatLocal(h.retrievedAt, s.timezone)}{h.status !== "ok" ? ` · ${h.status}` : ""}</span></li>)}</ul>
              </details>
            ) : null}
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
