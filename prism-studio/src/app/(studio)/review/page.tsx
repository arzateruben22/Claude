import type { Metadata } from "next";
import Link from "next/link";
import { reviewQueue, studio } from "@/lib/data";
import { mediaUrl } from "@/lib/media";
import { qaFails, STATE_LABEL, stateTone, topicStyle } from "@/lib/format";
import { Placements } from "@/components/Placements";

export const metadata: Metadata = { title: "Review" };

export default async function Review() {
  const [queue, s] = await Promise.all([reviewQueue(), studio()]);
  return (
    <div>
      <div className="kicker">Approvals · per account, per exact version</div>
      <h1>Review</h1>
      <p className="lede">Watch it, check the sources, then approve each account&apos;s video and text. A new render or any text edit needs a fresh approval.</p>
      {!queue.length ? <div className="card"><p className="muted" style={{ margin: 0 }}>Nothing waiting. Episodes arrive here when their final render passes quality checks.</p></div> : null}
      <div className="stack-lg">
        {queue.map((f) => {
          const unchecked = f.sources.filter((x) => x.status !== "ok").length;
          const fails = f.current ? qaFails(f.current.qa) : null;
          const facts = [
            `${f.sources.length} sourced claim${f.sources.length === 1 ? "" : "s"}`,
            unchecked ? null : "all resolved",
            f.current ? (fails === null ? "QA not run" : fails ? null : "QA passed") : null,
            f.ep.durationS ? `${f.ep.durationS.toFixed(1)} s` : null,
          ].filter(Boolean);
          return (
            <article key={f.ep.id} className="card stack" style={topicStyle(f.channel)}>
              <div className="row spread top">
                <div>
                  <div className="kicker topic-text">{f.channel.label} · No. {String(f.ep.number).padStart(3, "0")}</div>
                  <h2 style={{ margin: "4px 0 0" }}><Link href={`/episodes/${f.ep.id}`} style={{ textDecoration: "none" }}>{f.ep.title}</Link></h2>
                </div>
                {f.ep.state !== "ready_for_review" ? <span className={`chip ${stateTone(f.ep.state)}`}>{STATE_LABEL[f.ep.state]}</span> : null}
              </div>
              <div className="review-grid">
                {f.current ? (
                  <div className="player-wrap"><video className="player" controls preload="metadata" playsInline poster={f.current.posterPath ? mediaUrl(f.current.posterPath) : undefined} src={mediaUrl(f.current.videoPath)} style={{ maxHeight: 520 }} /></div>
                ) : <div className="notice">No render yet.</div>}
                <div className="stack">
                  <div className="row">
                    <p className="faint" style={{ margin: 0 }}>{facts.join(" · ")}</p>
                    {unchecked ? <span className="chip bad">{unchecked} unresolved</span> : null}
                    {fails ? <span className="chip bad">QA: {fails} failed</span> : null}
                  </div>
                  <Placements full={f} tz={s.timezone} />
                  <Link href={`/episodes/${f.ep.id}`} className="btn quiet small" style={{ justifySelf: "start" }}>Script, sources and notes</Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
