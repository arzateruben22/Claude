// One episode in Review, phone-first: on a phone it fills the screen as a vertical player (the video, then a sticky
// thumb bar with the platform switches, Hold and Approve, then the title, the chosen platform's text and the sources
// below); on a desktop it is a card with the video beside the same parts. The switches are radio inputs and the
// panels follow them in CSS (:has), so it works without JavaScript and in the static preview. Approve and Hold call
// the same actions as everywhere else (approveExport per account, a "hold" note), nothing new.
import Link from "next/link";
import type { ReactNode } from "react";
import { addNote, approveExport, withdrawApproval } from "@/app/actions";
import type { episodeFull } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, PUB_LABEL, pubTone, qaFails, topicStyle } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { Icon } from "./Icon";

type Full = NonNullable<Awaited<ReturnType<typeof episodeFull>>>;
type Step = { href: string; label: string } | null;

export function ReviewSlide({ full, tz, head, prev, next, position, back, sources = true, preload = "metadata", single = false }: {
  full: Full; tz: string; head: ReactNode; prev: Step; next: Step; back?: { href: string; label: string };
  position?: { n: number; of: number }; sources?: boolean; preload?: "metadata" | "none"; single?: boolean;
}) {
  const { ep, channel, current, placements } = full;
  const fails = current ? qaFails(current.qa) : null;
  const unchecked = full.sources.filter((x) => x.status !== "ok").length;
  // the switch starts on the first account still waiting for an approval (else the first account)
  const start = placements.find((p) => p.export && !p.approval) ?? placements[0];
  const group = `pf-${ep.id}`;
  const facts = [
    `${full.sources.length} sourced claim${full.sources.length === 1 ? "" : "s"}`,
    unchecked ? null : "all resolved",
    current ? (fails === null ? "QA not run" : fails ? null : "QA passed") : null,
    ep.durationS ? `${ep.durationS.toFixed(1)} s` : null,
  ].filter(Boolean);
  const kicker = `${channel.label} · No. ${String(ep.number).padStart(3, "0")}`;
  return (
    <article id={`ep-${ep.id}`} data-channel={channel.id} className={`slide${single ? " single" : ""}`} style={topicStyle(channel)} aria-label={`${ep.title}, ${kicker}`}>
      <div className="slide-top">
        {back
          ? <Link href={back.href} className="kicker topic-text">← {back.label} · No. {String(ep.number).padStart(3, "0")}</Link>
          : <span className="kicker topic-text">{kicker}</span>}
        <span className="slide-top-title" aria-hidden>{ep.title}</span>
        {position ? <span className="num slide-count">{single ? `${position.n} of ${position.of} in review` : `${position.n} / ${position.of}`}</span> : null}
      </div>

      <div className="slide-media">
        {current
          ? <video className="slide-video" controls preload={preload} playsInline poster={current.posterPath ? mediaUrl(current.posterPath) : undefined} src={mediaUrl(current.videoPath)} />
          : <p className="slide-empty muted">No render yet{ep.filmsPath ? `: the film lives in ${ep.filmsPath}` : ""}.</p>}
      </div>

      <div className="slide-head">{head}</div>

      <div className="slide-bar">
        {placements.length > 1 ? (
          <fieldset className="pf-switch">
            <legend className="sr-only">Platform version</legend>
            {placements.map(({ dest, approval }) => (
              <label key={dest.id} data-approved={approval ? "" : undefined}>
                <input type="radio" name={group} value={dest.platform} data-pf={dest.platform} defaultChecked={dest.id === start?.dest.id} />
                <Icon name={dest.platform} size={16} />
                <span>{PLATFORM_LABEL[dest.platform]}</span>
                {approval ? <span className="sr-only"> (approved)</span> : null}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="bar-actions">
          {prev ? <a href={prev.href} className="btn ghost step" data-step="prev" aria-label={`Previous: ${prev.label}`}><Icon name="back" /></a> : <span className="btn ghost step" data-step="prev" aria-disabled="true" aria-hidden><Icon name="back" /></span>}
          <details className="hold">
            <summary className="btn ghost">Hold</summary>
            <div className="hold-sheet">
              <ActionForm action={addNote} className="stack-sm" submit="Hold this episode" submitClass="btn block">
                <input type="hidden" name="episodeId" value={ep.id} />
                <input type="hidden" name="kind" value="hold" />
                <label className="field">What needs fixing? <textarea name="body" required minLength={2} placeholder="It goes back to production until you move it on." style={{ minHeight: 88 }} /></label>
              </ActionForm>
            </div>
          </details>
          <div className="approve">
            {placements.map(({ dest, export: x, approval }) => (
              <div key={dest.id} data-for={dest.platform}>
                {approval ? <span className="btn approved"><Icon name="check" size={18} /> Approved · {PLATFORM_LABEL[dest.platform]}</span>
                  : !x ? <span className="btn" aria-disabled="true">No {PLATFORM_LABEL[dest.platform]} export</span>
                  : <ActionForm action={approveExport} submit={<span className="approve-label">Approve<span className="approve-where"> · {PLATFORM_LABEL[dest.platform]}</span></span>} submitClass="btn block"
                      confirm={fails ? `QA reported ${fails} failed check${fails === 1 ? "" : "s"} on this render. Approve it for ${dest.handle || PLATFORM_LABEL[dest.platform]} anyway?` : undefined}>
                      <input type="hidden" name="exportId" value={x.id} /><input type="hidden" name="destinationId" value={dest.id} />
                    </ActionForm>}
              </div>
            ))}
          </div>
          {next ? <a href={next.href} className="btn ghost step" data-step="next" aria-label={`Next: ${next.label}`}><Icon name="back" /></a> : <span className="btn ghost step" data-step="next" aria-disabled="true" aria-hidden><Icon name="back" /></span>}
        </div>
      </div>
      <div className="slide-info">
        <div className="row">
          <p className="faint" style={{ margin: 0 }}>{facts.join(" · ")}</p>
          {unchecked ? <span className="chip bad">{unchecked} unresolved</span> : null}
        </div>
        {fails ? <div className="notice bad">QA: {fails} check{fails === 1 ? "" : "s"} failed. <Link href={`/episodes/${ep.id}#qa`}>See it</Link> before approving.</div> : null}

        {placements.map(({ dest, export: x, approval, lastRevoked, publication }) => (
          <section key={dest.id} className="pf-panel stack-sm" data-for={dest.platform} aria-label={`${PLATFORM_LABEL[dest.platform]} version`}>
            <div className="acct-line">
              <span className="label">{PLATFORM_LABEL[dest.platform]}{dest.shared ? " · shared" : ""}</span>
              {dest.handle || dest.displayName ? <b>{dest.handle || dest.displayName}</b> : <Link href="/connections" className="chip warn">Account not set up</Link>}
              {publication && publication.status !== "planned" ? <span className={`chip ${pubTone(publication.status)}`}>{PUB_LABEL[publication.status]}</span> : null}
              {approval ? <span className="chip good">Approved · <span className="mono">{approval.contentHash.slice(0, 8)}</span></span> : null}
            </div>
            {!x ? <p className="muted" style={{ margin: 0 }}>No {PLATFORM_LABEL[dest.platform]} export yet.</p> : (
              <>
                {!approval && lastRevoked ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>Last approval withdrawn {formatLocal(lastRevoked.revokedAt, tz)}: {lastRevoked.revokedReason}.</p> : null}
                {dest.platform === "youtube" && x.title ? <p className="slide-title-text">{x.title}</p> : null}
                {x.caption ? <p className="slide-caption">{x.caption}</p> : null}
                {x.hashtags && !x.caption.includes(x.hashtags.trim()) ? <p className="slide-tags">{x.hashtags}</p> : null}
                <div className="row">
                  <Link href={`/episodes/${ep.id}#placements`} className="btn ghost small">Edit {PLATFORM_LABEL[dest.platform]} text</Link>
                  {approval ? <ActionForm action={withdrawApproval} submit="Withdraw approval" submitClass="btn quiet small"><input type="hidden" name="approvalId" value={approval.id} /></ActionForm> : null}
                </div>
              </>
            )}
          </section>
        ))}

        {sources && full.sources.length ? (
          <section className="slide-sources" aria-label="Sources">
            <h3>Sources</h3>
            <ol>
              {full.sources.map((s) => (
                <li key={s.id}>
                  <span>{s.claim}</span>{" "}
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher || "source"}</a> : <span className="faint">{s.publisher || "no link"}</span>}
                  {s.status !== "ok" ? <> <span className="chip bad">{s.status}</span></> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {!single ? <Link href={`/episodes/${ep.id}`} className="btn quiet small" style={{ justifySelf: "start" }}>Script, sources and notes</Link> : null}
      </div>

    </article>
  );
}
