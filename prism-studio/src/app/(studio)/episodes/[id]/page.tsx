import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { analyticsRows, coverOf, episodeFull, packagingThumb, reviewOrder, studio, thumbOf } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { canTransition, PIPELINE, SIDE_STATES, type EpisodeState } from "@/domain/episodes";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, qaFails, STATE_LABEL, stateTone, topicStyle } from "@/lib/format";
import { addNote, moveEpisode, resolveNote, toggleSource } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Placements } from "@/components/Placements";
import { ReviewSlide } from "@/components/ReviewSlide";
import { ReelNav } from "@/components/ReelNav";
import { MetricChips, MetricHistory, PullLine, ViewsFigure } from "@/components/PostNumbers";
import { PackagingCard } from "@/components/PackagingCard";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const f = /^[0-9a-f-]{36}$/.test((await params).id) ? await episodeFull((await params).id) : null;
  return { title: f ? (f.ep.isDemo ? "Demo episode" : f.ep.title) : "Episode" };
}

export default async function Episode({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [f, s, numbers, order] = await Promise.all([episodeFull(id), studio(), analyticsRows({ episodeId: id }), reviewOrder()]);
  if (!f) notFound();
  const { ep, channel, current, archived } = f;
  if (ep.isDemo && !s.showDemo) return (
    <div style={topicStyle(channel)}>
      <Link href={`/channels/${channel.slug}?tab=episodes`} className="kicker" style={{ color: "var(--topic-ink)", textDecoration: "none" }}>← {channel.name.replace(/ \(name TBD\)$/, "")}</Link>
      <h1>Demo episode hidden</h1>
      <p className="lede"><span className="demo-tag">DEMO</span> This is demo data. Demo data is hidden; turn on <Link href="/settings">Settings → Show demo data</Link> to see it. It never counts toward progress either way.</p>
    </div>
  );
  const moves = ([...PIPELINE, ...SIDE_STATES] as EpisodeState[]).filter((to) => canTransition(ep.state as EpisodeState, to));
  const pipeStep = PIPELINE.indexOf(ep.state as (typeof PIPELINE)[number]);
  const fails = current ? qaFails(current.qa) : null;
  // in review, Previous / Next step through the review queue (the same order as the Review reel)
  const at = order.findIndex((o) => o.id === ep.id);
  const step = (o: (typeof order)[number] | undefined) => (at >= 0 && o ? { href: `/episodes/${o.id}`, label: o.title } : null);
  // downloads for the current render: the 1080p master (TikTok, Instagram), YouTube's 1440p version, the designed cover and
  // the YouTube thumbnail. Downloading never marks anything as posted; the Uploaded buttons record where you posted.
  const ytX = f.exports.find((x) => x.platform === "youtube") ?? null;
  const dlBase = `${channel.slug}-${String(ep.number).padStart(3, "0")}`;
  const dlCover = current ? coverOf({ x: ytX, version: current }) : null;
  const dlThumb = current ? thumbOf({ x: ytX, version: current }) : null;
  // once the video was cleared from the server after posting (the player shows a note), only the files that stay are offered
  const cleared = !!ep.videoClearedAt;
  const dl1440 = !cleared && ytX && current && ytX.filePath !== current.videoPath ? ytX.filePath : null;
  return (
    <div style={topicStyle(channel)}>
      <div id="player">
      <ReviewSlide full={f} tz={s.timezone} single sources={false} prev={step(order[at - 1])} next={step(order[at + 1])}
        position={at >= 0 ? { n: at + 1, of: order.length } : undefined}
        back={archived ? { href: `/library#archived-${channel.slug}`, label: "Archived seasons" } : { href: `/channels/${channel.slug}?tab=episodes`, label: channel.name.replace(/ \(name TBD\)$/, "") }}
        head={<>
          {archived ? (
            <div className="notice info" role="note">
              <b>{archived.label} is archived:</b> every episode is uploaded on YouTube &amp; TikTok and Instagram, so it&apos;s out of the working screens and kept in <Link href={`/library#archived-${channel.slug}`}>Library → Archived seasons</Link>. Undo an Uploaded button below to bring the season back.
            </div>
          ) : null}
          <h1 className="slide-title">{ep.title}</h1>
          {ep.question ? <p className="lede" style={{ margin: 0 }}>{ep.question}</p> : null}
          <div className="row">
            <span className={`chip ${stateTone(ep.state)}`}>{STATE_LABEL[ep.state]}</span>
            {f.series ? <span className="chip topic">{f.series.title}{ep.seriesOrder ? ` · part ${ep.seriesOrder}` : ""}</span> : null}
            {ep.durationS ? <span className="chip">{ep.durationS.toFixed(1)} s</span> : null}
            {ep.isDemo ? <span className="demo-tag">DEMO</span> : null}
          </div>
          {current ? (
            <div className="row" aria-label="Downloads">
              {!cleared ? <a className="btn small" href={mediaUrl(current.videoPath, `${dlBase}-1080p.mp4`)} download><Icon name="download" size={16} /> Download 1080p</a> : null}
              {dl1440 ? <a className="btn ghost small" href={mediaUrl(dl1440, `${dlBase}-1440p.mp4`)} download>YouTube 1440p</a> : null}
              {dlCover ? <a className="btn ghost small" href={mediaUrl(dlCover, `${dlBase}-cover.jpg`)} download>Cover</a> : null}
              {dlThumb ? <a className="btn ghost small" href={mediaUrl(dlThumb, `${dlBase}-thumb.jpg`)} download>Thumbnail</a> : null}
              {ep.captionsSrt ? <a className="btn ghost small" href={`/api/srt/${ep.id}`} download>Captions</a> : null}
            </div>
          ) : null}
          {pipeStep >= 0 ? (
            <div className="bar" aria-label={`Production step ${pipeStep + 1} of ${PIPELINE.length}`} style={{ width: "100%", maxWidth: 520 }}><i style={{ width: `${((pipeStep + 1) / PIPELINE.length) * 100}%` }} /></div>
          ) : null}
        </>} />
        <ReelNav id="player" />
      </div>

      <div className="grid2 section">
        <section className="stack">
          {current ? (
            <div className="row" id="qa">
              <span className="chip">render v{current.versionNo}</span>
              {fails === null ? <span className="chip">QA not attached</span> : fails ? <span className="chip bad">QA: {fails} failed · {((current.qa as { fails?: unknown[] }).fails ?? []).map(String).join("; ")}</span> : <span className="chip good">QA passed</span>}
              <span className="chip mono" title={current.sha256}>{current.sha256.slice(0, 10)}</span>
              {ep.captionsSrt ? <a className="btn ghost small" href={`/api/srt/${ep.id}`} download>Captions .srt</a> : null}
            </div>
          ) : null}
          {archived ? null : <div className="card stack-sm">
            <h3>Move this episode</h3>
            <ActionForm action={moveEpisode} className="row" submit="Move" submitClass="btn small">
              <input type="hidden" name="episodeId" value={ep.id} />
              <select name="to" aria-label="New stage" style={{ width: "auto", flex: 1 }}>
                {moves.map((m) => <option key={m} value={m}>{STATE_LABEL[m]}</option>)}
              </select>
            </ActionForm>
          </div>}
        </section>

        <section className="stack">
          <h2 style={{ margin: 0 }}>Accounts and text</h2>
          <Placements full={f} tz={s.timezone} />
        </section>
      </div>

      {ep.packaging ? (
        <div className="section">
          <PackagingCard p={ep.packaging} thumb={packagingThumb(ep.filmsPath ? `films:${ep.filmsPath}/out` : null, ep.packaging)} download={`${dlBase}-thumbnail.jpg`} />
        </div>
      ) : null}

      {numbers.length ? (
        <section className="section" id="numbers">
          <div className="section-head"><h2 style={{ margin: 0 }}>Numbers</h2><Link href="/analytics" className="btn ghost small">All analytics</Link></div>
          <div className="grid2">
            {numbers.map((r) => (
              <article key={r.p.id} className="card flat stack-sm">
                <div className="row spread top">
                  <div>
                    <div className="label">{PLATFORM_LABEL[r.dest.platform]}{r.dest.shared ? " · shared" : ""}{r.p.simulated ? <> · <span className="sim-tag">SIMULATED</span></> : null}</div>
                    <div className="faint" style={{ fontSize: 13 }}>Posted {formatLocal(r.p.reportedAt, s.timezone)}{r.p.postUrl ? <> · <a href={r.p.postUrl} target="_blank" rel="noopener noreferrer">open post</a></> : null}</div>
                  </div>
                  <ViewsFigure snap={r.latest.views} tz={s.timezone} />
                </div>
                <MetricChips latest={r.latest} />
                <PullLine publicationId={r.p.id} platform={r.dest.platform} pull={r.pull} tz={s.timezone} />
                <MetricHistory history={r.history} tz={s.timezone} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
              <select name="kind" defaultValue="edit_request"><option value="edit_request">Edit request</option><option value="note">Note</option></select>
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
