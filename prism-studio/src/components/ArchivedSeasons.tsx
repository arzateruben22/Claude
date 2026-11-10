// Archived seasons (src/domain/season-archive.ts): a season uploaded everywhere leaves the working views for Library →
// Archived seasons. Compact and read-only: one line per season that opens to its episodes (each opens its own page) and
// its long videos (watch, download, the YouTube post). ArchivedNote is the one-line pointer the channel screens show.
import Link from "next/link";
import type { ArchivedSeason } from "@/domain/season-archive";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { topicStyle } from "@/lib/format";
import { Icon } from "./Icon";

type Group = { channel: { id: string; slug: string; name: string; color: string; colorInk: string }; seasons: ArchivedSeason[] };

const plain = (name: string) => name.replace(/ \(name TBD\)$/, "");
/** "Forces you can see" from "Season 1: Forces you can see" (empty when the title has no subtitle). */
const subtitle = (seriesTitle: string) => seriesTitle.split(":").slice(1).join(":").trim();
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const when = (at: Date | null, tz: string) => (at ? ` · uploaded ${formatLocal(at, tz, { month: "short", day: "numeric", year: "numeric" })}` : "");

export function ArchivedSeasons({ groups, tz }: { groups: Group[]; tz: string }) {
  if (!groups.length) return null;
  return (
    <section className="section archived-seasons" id="archived" aria-labelledby="archived-seasons-h">
      <div className="section-head"><h2 id="archived-seasons-h">Archived seasons</h2><span className="faint num">{plural(groups.reduce((n, g) => n + g.seasons.length, 0), "season")}</span></div>
      <p className="muted">Every episode is uploaded on YouTube &amp; TikTok and on Instagram (and the long video, if the season has one), so these seasons are out of the working screens. Nothing is deleted and their numbers still count. To bring a season back, open an episode and undo its Uploaded button.</p>
      {groups.map(({ channel: c, seasons }) => (
        <div key={c.id} id={`archived-${c.slug}`} className="archived-group" style={topicStyle(c)}>
          <h3 className="topic-text">{plain(c.name)}</h3>
          {seasons.map((s) => (
            <details key={s.id} className="card flat archived-season">
              <summary>
                <span><b>{s.label}</b>{subtitle(s.seriesTitle) ? <span className="muted">: {subtitle(s.seriesTitle)}</span> : null}</span>
                <span className="faint num">{plural(s.episodes, "episode")}{s.lessonList.length ? ` · ${plural(s.lessonList.length, "long video")}` : ""}{when(s.uploadedAt, tz)}</span>
              </summary>
              <ol className="eps">
                {s.episodeList.map((e) => (
                  <li key={e.id}>
                    <span className="num faint">{String(e.number).padStart(3, "0")}</span>
                    <Link href={`/episodes/${e.id}`}>{e.title}</Link>
                    <span className="row">{e.isDemo ? <span className="demo-tag">DEMO</span> : null}<span className="chip good">Uploaded</span></span>
                  </li>
                ))}
              </ol>
              {s.lessonList.length ? (
                <ul className="archived-longs">
                  {s.lessonList.map((l) => (
                    <li key={l.id}>
                      <span><span className="kicker">Long video · {l.name}</span> {l.title}{l.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</span>
                      <span className="row">
                        {l.videoPath ? <a className="btn ghost small" href={mediaUrl(l.videoPath)} target="_blank" rel="noopener noreferrer">Watch</a> : null}
                        {l.videoPath ? <a className="btn ghost small" href={mediaUrl(l.videoPath, `${l.name}-16x9.mp4`)} download><Icon name="download" size={16} /> Download</a> : null}
                        {l.postUrl ? <a className="btn ghost small" href={l.postUrl} target="_blank" rel="noopener noreferrer">On YouTube</a> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}

/** One line on a channel's screens: which of its seasons are archived, linking to them in the Library. */
export function ArchivedNote({ slug, seasons, className = "" }: { slug: string; seasons: Pick<ArchivedSeason, "id" | "label" | "episodes">[]; className?: string }) {
  if (!seasons.length) return null;
  return (
    <p className={`faint archived-note ${className}`}>
      Archived (uploaded everywhere): {seasons.map((s, i) => <span key={s.id}>{i ? ", " : ""}{s.label} ({plural(s.episodes, "episode")})</span>)}.{" "}
      <Link href={`/library#archived-${slug}`}>Open in Library</Link>
    </p>
  );
}
