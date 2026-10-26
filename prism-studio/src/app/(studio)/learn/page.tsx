import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { studio } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { topicStyle } from "@/lib/format";
import { addExperiment, addLearning, setExperimentStatus } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";

export const metadata: Metadata = { title: "Learn" };

const STATUS_TONE: Record<string, string> = { proposed: "", running: "info", retained: "good", revised: "warn", discarded: "" };
const NEXT: Record<string, string[]> = { proposed: ["running", "discarded"], running: ["retained", "revised", "discarded"], retained: [], revised: ["running"], discarded: ["proposed"] };

export default async function Learn({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const { channel } = await searchParams;
  const d = db();
  const [chans, s] = await Promise.all([d.select().from(S.channels).orderBy(asc(S.channels.sort)), studio()]);
  const cur = chans.find((c) => c.slug === channel) ?? chans[0];
  const [exps, learns, posted] = await Promise.all([
    d.select().from(S.experiments).where(eq(S.experiments.channelId, cur.id)).orderBy(desc(S.experiments.createdAt)),
    d.select().from(S.learnings).where(eq(S.learnings.channelId, cur.id)).orderBy(desc(S.learnings.createdAt)),
    d.select({ n: S.publications.id }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
      .where(eq(S.episodes.channelId, cur.id)),
  ]);
  return (
    <div style={topicStyle(cur)}>
      <div className="kicker">Experiments and learnings</div>
      <h1>Learn</h1>
      <p className="lede">One change at a time, judged on platform-reported numbers after a minimum sample. A learning records what held, how sure we are, and what we decided. Six posts is the smallest sample worth a conclusion.</p>
      <nav className="tabs" aria-label="Channel">
        {chans.map((c) => <Link key={c.id} href={`/learn?channel=${c.slug}`} aria-current={c.id === cur.id ? "page" : undefined}>{c.name.replace(/ \(name TBD\)$/, "")}</Link>)}
      </nav>

      <section className="grid2">
        <ActionForm action={addExperiment} className="card stack-sm" submit="Propose" submitClass="btn topic small">
          <input type="hidden" name="channelId" value={cur.id} />
          <h3 style={{ margin: 0 }}>New experiment</h3>
          <label className="field">Hypothesis <input name="hypothesis" required placeholder="A question in the first second lifts average view duration" /></label>
          <label className="field">The one change <input name="change" required placeholder="Open with the question instead of the title card" /></label>
          <div className="grid2" style={{ gap: 10 }}>
            <label className="field">Metric
              <select name="metric" defaultValue="avg_view_duration_s"><option value="avg_view_duration_s">Average view duration</option><option value="views">Views</option><option value="likes">Likes</option><option value="shares">Shares</option><option value="followers_gained">Followers gained</option></select>
            </label>
            <label className="field">Minimum sample <input name="minSample" type="number" min={2} max={60} defaultValue={6} /></label>
          </div>
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>{posted.length} post{posted.length === 1 ? "" : "s"} so far on this channel.</p>
        </ActionForm>
        <ActionForm action={addLearning} className="card stack-sm" submit="Record" submitClass="btn small">
          <input type="hidden" name="channelId" value={cur.id} />
          <h3 style={{ margin: 0 }}>New learning</h3>
          <label className="field">Finding <input name="finding" required placeholder="Episodes under 65 s keep more of the audience" /></label>
          <div className="grid2" style={{ gap: 10 }}>
            <label className="field">Confidence
              <select name="confidence" defaultValue="low"><option value="low">Low (one series)</option><option value="medium">Medium (repeated)</option><option value="high">High (held across months)</option></select>
            </label>
            <label className="field">Decision <input name="decision" placeholder="Keep scripts under 65 s" /></label>
          </div>
          <label className="field">Evidence <input name="evidence" placeholder="Posts 3–8: AVD 41 s vs 33 s" /></label>
          <label className="field">Counter-examples <input name="counterexamples" placeholder="No. 004 was 72 s and did fine" /></label>
        </ActionForm>
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Experiments</h2><span className="faint num">{exps.length}</span></div>
        {!exps.length ? <p className="muted">None yet.</p> : (
          <div className="stack">
            {exps.map((x) => (
              <div key={x.id} className="card flat stack-sm">
                <div className="row spread"><b>{x.hypothesis}</b><span className={`chip ${STATUS_TONE[x.status]}`}>{x.status}</span></div>
                <div className="muted" style={{ fontSize: 14 }}>Change: {x.change} · metric: {x.metric.replace(/_/g, " ")} · at least {x.minSample} posts · {formatLocal(x.createdAt, s.timezone, { dateStyle: "medium" })}</div>
                {NEXT[x.status]?.length ? (
                  <ActionForm action={setExperimentStatus} className="row" submit="Update" submitClass="btn ghost small">
                    <input type="hidden" name="experimentId" value={x.id} />
                    <select name="status" aria-label="New status" style={{ width: "auto" }}>{NEXT[x.status].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    <input name="note" placeholder="What the numbers said" aria-label="Evidence note" style={{ width: "auto", flex: 1 }} />
                  </ActionForm>
                ) : null}
                {Object.keys(x.evidence ?? {}).length ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>{Object.entries(x.evidence).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Learnings</h2><span className="faint num">{learns.length}</span></div>
        {!learns.length ? <p className="muted">None yet.</p> : (
          <div className="stack">
            {learns.map((l) => (
              <div key={l.id} className="card flat stack-sm">
                <div className="row spread"><b>{l.finding}</b><span className={`chip ${l.confidence === "high" ? "good" : l.confidence === "medium" ? "info" : ""}`}>{l.confidence} confidence</span></div>
                {l.decision ? <div>Decision: {l.decision}</div> : null}
                <div className="faint" style={{ fontSize: 13 }}>{l.evidence ? `Evidence: ${l.evidence}` : ""}{l.counterexamples ? ` · Against: ${l.counterexamples}` : ""} · {formatLocal(l.createdAt, s.timezone, { dateStyle: "medium" })}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
