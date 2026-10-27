// The library: every finished video at full quality, per channel, with its covers, captions and posting text. The same
// files the upload tasks hand off; downloading here never marks anything published.
import type { Metadata } from "next";
import Link from "next/link";
import { libraryView } from "@/lib/data";
import { mediaUrl } from "@/lib/media";
import { topicStyle } from "@/lib/format";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Library" };

const mb = (n: number) => `${Math.round(n / 1e6)} MB`;
const len = (s: number | null) => (s == null ? "" : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)} s`);
const plain = (name: string) => name.replace(/ \(name TBD\)$/, "");

export default async function Library() {
  const v = await libraryView();
  const shown = v.channels.filter((c) => c.episodes.length || c.longs.length);
  return (
    <div>
      <div className="kicker">Every finished video</div>
      <h1>Library</h1>
      <p className="lede">{v.count} video{v.count === 1 ? "" : "s"}, {mb(v.bytes)}. <b>Download</b> gets the full-quality file (on iPhone: Files → Downloads, then Share → Save Video). The episode page has each platform&apos;s title, caption and sources. Downloading never marks anything as posted.</p>
      {shown.length ? shown.map(({ channel: c, episodes, longs }) => (
        <section key={c.id} className="section lib-channel" style={topicStyle(c)}>
          <div className="section-head"><h2>{plain(c.name)}</h2><span className="faint num">{episodes.length} short{episodes.length === 1 ? "" : "s"}{longs.length ? ` · ${longs.length} long` : ""}</span></div>
          {longs.map((l) => (
            <article key={l.id} className="card lib-card wide">
              {l.thumbnailPath ? <img src={mediaUrl(l.thumbnailPath)} alt="" loading="lazy" /> : null}
              <div className="lib-body">
                <span className="kicker">Long video · YouTube · 16:9{l.isDemo ? " · " : ""}{l.isDemo ? <span className="demo-tag">DEMO</span> : null}</span>
                <h3>{l.title}</h3>
                <p className="faint num">{l.name} · {len(l.durationS)} · {mb(l.bytes)}</p>
                <div className="row">
                  <a className="btn small" href={mediaUrl(l.videoPath, `${l.name}-16x9.mp4`)} download><Icon name="download" size={16} /> Download</a>
                  {l.thumbnailPath ? <a className="btn ghost small" href={mediaUrl(l.thumbnailPath, `${l.name}-thumbnail.jpg`)} download>Thumbnail</a> : null}
                  <Link className="btn ghost small" href={`/channels/${c.slug}?tab=lessons`}>Chapters and text</Link>
                </div>
              </div>
            </article>
          ))}
          <div className="lib-grid">
            {episodes.map((e) => (
              <article key={e.id} className="card lib-card">
                {e.small ? <img src={mediaUrl(e.small)} alt="" loading="lazy" /> : null}
                <div className="lib-body">
                  <span className="kicker">No. {String(e.number).padStart(3, "0")} · {len(e.durationS)} · {mb(e.bytes)}{e.isDemo ? " · " : ""}{e.isDemo ? <span className="demo-tag">DEMO</span> : null}</span>
                  <h3>{e.title}</h3>
                  <div className="row">
                    <a className="btn small" href={mediaUrl(e.videoPath, e.fileName)} download><Icon name="download" size={16} /> Download</a>
                    {e.cover ? <a className="btn ghost small" href={mediaUrl(e.cover, e.fileName.replace(/-9x16\.mp4$/, "-cover.jpg"))} download>Cover</a> : null}
                    {e.thumb ? <a className="btn ghost small" href={mediaUrl(e.thumb, e.fileName.replace(/-9x16\.mp4$/, "-thumb.jpg"))} download>Thumbnail</a> : null}
                    {e.hasSrt ? <a className="btn ghost small" href={`/api/srt/${e.id}`} download>Captions</a> : null}
                    <Link className="btn ghost small" href={`/episodes/${e.id}`}>Posting text</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )) : <p className="muted">No finished videos yet. Rendered episodes appear here once they&apos;re imported (Queue → Import rendered episodes).</p>}
    </div>
  );
}
