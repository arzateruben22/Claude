import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { episodeFull, studio } from "@/lib/data";
import { canTransition, PIPELINE, SIDE_STATES, type EpisodeState } from "@/domain/episodes";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { qaFails, STATE_LABEL, stateTone, topicStyle } from "@/lib/format";
import { addNote, moveEpisode, resolveNote, toggleSource } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Placements } from "@/components/Placements";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const f = /^[0-9a-f-]{36}$/.test((await params).id) ? await episodeFull((await params).id) : null;
  return { title: f?.ep.title ?? "Episode" };
}

export default async function Episode({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [f, s] = await Promise.all([episodeFull(id), studio()]);
  if (!f) notFound();
  const { ep, channel, current } = f;
  const moves = ([...PIPELINE, ...SIDE_STATES] as EpisodeState[]).filter((to) => canTransition(ep.state as EpisodeState, to));
  const step = PIPELINE.indexOf(ep.state as (typeof PIPELINE)[number]);
  const fails = current ? qaFails(current.qa) : null;
  return (
    <div style={topicStyle(channel)}>
      <Link href={`/channels/${channel.slug}?tab=episodes`} className="kicker" style={{ color: "var(--topic-ink)", textDecoration: "none" }}>← {channel.name.replace(/ \(name TBD\)$/, "")} · No. {String(ep.number).padStart(3, "0")}</Link>
      <h1>{ep.title}</h1>
      {ep.question ? <p className="lede">{ep.question}</p> : null}
      <div className="row" style={{ marginBottom: 18 }}>
        <span className={`chip ${stateTone(ep.state)}`}>{STATE_LABEL[ep.state]}</span>
        {f.series ? <span className="chip topic">{f.series.title}{ep.seriesOrder ? ` · part ${ep.seriesOrder}` : ""}</span> : null}
        {ep.durationS ? <span className="chip">{ep.durationS.toFixed(1)} s</span> : null}
        {ep.isDemo ? <span className="demo-tag">DEMO</span> : null}
      </div>
      {step >= 0 ? (
        <div className="bar" aria-label={`Production step ${step + 1} of ${PIPELINE.length}`} style={{ marginBottom: 24 }}><i style={{ width: `${((step + 1) / PIPELINE.length) * 100}%` }} /></div>
      ) : null}

      <div className="grid2">
        <section className="stack">
          {current ? (
            <div className="player-wrap"><video className="player" controls preload="metadata" playsInline poster={current.posterPath ? mediaUrl(current.posterPath) : undefined} src={mediaUrl(current.videoPath)} /></div>
          ) : <div className="card"><p className="muted" style={{ margin: 0 }}>No render yet{ep.filmsPath ? `: the film lives in ${ep.filmsPath}` : ""}.</p></div>}
          {current ? (
            <div className="row">
              <span className="chip">render v{current.versionNo}</span>
              {fails === null ? <span className="chip">QA not attached</span> : fails ? <span className="chip bad">QA: {fails} failed</span> : <span className="chip good">QA passed</span>}
              <span className="chip mono" title={current.sha256}>{current.sha256.slice(0, 10)}</span>
              {ep.captionsSrt ? <a className="btn ghost small" href={`/api/srt/${ep.id}`} download>Captions .srt</a> : null}
            </div>
          ) : null}
          <div className="card stack-sm">
            <h3>Move this episode</h3>
            <ActionForm action={moveEpisode} className="row" submit="Move" submitClass="btn small">
              <input type="hidden" name="episodeId" value={ep.id} />
              <select name="to" aria-label="New stage" style={{ width: "auto", flex: 1 }}>
                {moves.map((m) => <option key={m} value={m}>{STATE_LABEL[m]}</option>)}
              </select>
            </ActionForm>
            <p className="faint" style={{ fontSize: 13, margin: 0 }}>Moving an approved episode back to an earlier step withdraws its approvals.</p>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Accounts</h2>
          <Placements full={f} tz={s.timezone} />
        </section>
      </div>

      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Sources</h2><span className="num faint">{f.sources.filter((x) => x.reviewerOk).length}/{f.sources.length} checked by you</span></div>
        {f.sources.length ? (
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th>Claim</th><th>Source</th><th>Status</th><th>You</th></tr></thead>
              <tbody>
                {f.sources.map((x) => (
                  <tr key={x.id}>
                    <td style={{ minWidth: 240 }}><span className="mono faint">{x.claimKey}</span> {x.claim}{x.uncertainty ? <div className="faint" style={{ fontSize: 13 }}>{x.uncertainty}</div> : null}</td>
                    <td style={{ minWidth: 160 }}>{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">{x.publisher || "link"}</a> : "—"}<div className="faint" style={{ fontSize: 12 }}>{x.verifiedVia ? `via ${x.verifiedVia}` : ""}{x.retrievedAt ? ` · ${x.retrievedAt}` : ""}</div></td>
                    <td><span className={`chip ${x.status === "ok" ? "good" : "bad"}`}>{x.status}</span></td>
                    <td><form action={toggleSource}><input type="hidden" name="sourceId" value={x.id} /><button className="btn ghost small" aria-pressed={x.reviewerOk}>{x.reviewerOk ? "✓ Checked" : "Check"}</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No sources recorded yet.</p>}
      </section>

      <section className="section grid2">
        <div className="stack-sm">
          <div className="section-head" style={{ borderTop: 0, paddingTop: 0 }}><h2 style={{ margin: 0 }}>Script</h2></div>
          {ep.script ? <div className="card" style={{ whiteSpace: "pre-wrap", fontSize: 15.5, lineHeight: 1.6 }}>{ep.script}</div> : <p className="muted">No script yet.</p>}
        </div>
        <div className="stack-sm">
          <div className="section-head" style={{ borderTop: 0, paddingTop: 0 }}><h2 style={{ margin: 0 }}>Notes</h2></div>
          <ActionForm action={addNote} className="card stack-sm" submit="Add note" submitClass="btn small">
            <input type="hidden" name="episodeId" value={ep.id} />
            <label className="field">Kind
              <select name="kind" defaultValue="edit_request"><option value="edit_request">Edit request</option><option value="note">Note</option><option value="hold">Hold (blocks the episode)</option></select>
            </label>
            <label className="field">Note <textarea name="body" required style={{ minHeight: 80 }} /></label>
          </ActionForm>
          {f.notes.map((n) => (
            <div key={n.id} className="card flat" style={{ opacity: n.resolved ? 0.55 : 1 }}>
              <div className="row spread"><span className="chip">{n.kind.replace("_", " ")}</span><span className="faint num">{formatLocal(n.createdAt, s.timezone)}</span></div>
              <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
              {!n.resolved ? <form action={resolveNote}><input type="hidden" name="noteId" value={n.id} /><button className="btn ghost small">Resolve</button></form> : <span className="faint">Resolved</span>}
            </div>
          ))}
        </div>
      </section>

      {f.versions.length > 1 ? (
        <section className="section">
          <div className="section-head"><h2 style={{ margin: 0 }}>Versions</h2></div>
          <ul className="list" style={{ listStyle: "none", padding: 0 }}>
            {f.versions.map((v) => <li key={v.id} className="row spread"><span>v{v.versionNo} · {v.label}</span><span className="faint num">{formatLocal(v.createdAt, s.timezone)}{v.superseded ? " · superseded" : " · current"}</span></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
