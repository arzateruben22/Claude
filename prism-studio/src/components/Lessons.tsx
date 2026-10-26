// The channel's lessons: build one from 4–6 rendered shorts, review the result, approve, hand off, mark uploaded.
import type { lessons as lessonsTable, lessonEpisodes as leTable, episodes as epTable } from "@/db/schema";
import { approveLessonAction, dissolveLessonAction, newLesson, reportLessonUploaded, saveLesson } from "@/app/actions";
import { LESSON_MAX, LESSON_MIN, lessonHash } from "@/domain/lessons";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { qaFails, STATE_LABEL, stateTone } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { CopyButton } from "./CopyButton";

type Lesson = typeof lessonsTable.$inferSelect;
type Part = typeof leTable.$inferSelect & { episode: typeof epTable.$inferSelect };
type Avail = { id: string; number: number; title: string; durationS: number | null };

export function Lessons({ channelId, channelName, ytHandle, lessons, parts, available, tz }: {
  channelId: string; channelName: string; ytHandle: string; lessons: Lesson[]; parts: Part[]; available: Avail[]; tz: string;
}) {
  const total = available.reduce((a, e) => a + (e.durationS ?? 0), 0);
  return (
    <div className="stack-lg">
      <section className="card stack-sm">
        <div className="kicker">New lesson</div>
        <h3 style={{ margin: 0 }}>Pile {LESSON_MIN}–{LESSON_MAX} shorts into one YouTube video</h3>
        <p className="muted" style={{ margin: 0 }}>Each short plays whole, full height, inside a 16:9 frame in the channel&apos;s theme, with an intro card, chapters and an outro. Nothing is re-rendered. {available.length} rendered short{available.length === 1 ? "" : "s"} available ({Math.round(total / 60)} min).</p>
        {available.length >= LESSON_MIN ? (
          <ActionForm action={newLesson} className="stack-sm" submit="Build it" submitClass="btn topic">
            <input type="hidden" name="channelId" value={channelId} />
            <div className="stack-sm" style={{ gap: 2 }}>
              {available.map((e, i) => (
                <label key={e.id} className="check" style={{ padding: "6px 0" }}>
                  <input type="checkbox" name="episodeIds" value={e.id} defaultChecked={i < LESSON_MAX} />
                  <span><span className="num faint">No. {String(e.number).padStart(3, "0")}</span> {e.title} <span className="faint">· {e.durationS ? `${Math.round(e.durationS)} s` : ""}</span></span>
                </label>
              ))}
            </div>
            <label className="field">Title <span className="hint">YouTube, up to 100 characters.</span>
              <input name="title" maxLength={100} required defaultValue={`${channelName}: ${available.slice(0, 2).map((e) => e.title).join(", ")}${available.length > 2 ? " and more" : ""}`} />
            </label>
          </ActionForm>
        ) : <p className="faint" style={{ margin: 0 }}>Render {LESSON_MIN - available.length} more short{LESSON_MIN - available.length === 1 ? "" : "s"} to build the next lesson.</p>}
      </section>

      {lessons.map((l) => {
        const mine = parts.filter((p) => p.lessonId === l.id).sort((a, b) => a.position - b.position);
        const approved = !!l.approvedHash && l.approvedHash === lessonHash(l);
        const fails = qaFails(l.qa);
        const qa = l.qa as { dur?: number; lufs?: number; true_peak_db?: number } | null;
        return (
          <article key={l.id} className="card topic stack-sm">
            <div className="row spread top">
              <div>
                <div className="kicker" style={{ color: "var(--topic-ink)" }}>{l.name} · {mine.length} episodes{l.isDemo ? " · " : ""}{l.isDemo ? <span className="demo-tag">DEMO</span> : null}</div>
                <h3 className="h2" style={{ margin: "4px 0 0" }}>{l.title}</h3>
              </div>
              <div className="row">
                <span className={`chip ${stateTone(l.state)}`}>{STATE_LABEL[l.state]}</span>
                {l.videoPath ? (approved ? <span className="chip good">Approved</span> : <span className="chip warn">Not approved</span>) : null}
              </div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>{mine.map((p) => <li key={p.episodeId}>{p.episode.title}</li>)}</ol>
            {!l.videoPath ? <p className="muted" style={{ margin: 0 }}>{l.state === "render" ? "Building in the worker (see Queue)." : "Not built yet."}</p> : (
              <>
                <div className="row">
                  {fails === null ? <span className="chip">QA not attached</span> : fails ? <span className="chip bad">QA: {fails} failed</span> : <span className="chip good">QA passed</span>}
                  {qa?.dur ? <span className="chip">{Math.floor(qa.dur / 60)}:{String(Math.round(qa.dur % 60)).padStart(2, "0")}</span> : null}
                  {qa?.lufs != null ? <span className="chip">{qa.lufs} LUFS</span> : null}
                </div>
                <div style={{ background: "#000", borderRadius: 16, overflow: "hidden" }}>
                  <video controls preload="none" playsInline poster={l.thumbnailPath ? mediaUrl(l.thumbnailPath) : undefined} src={mediaUrl(l.videoPath)} style={{ width: "100%", aspectRatio: "16 / 9", display: "block" }} />
                </div>
                {l.state !== "published" ? (
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 650 }}>Title and description{approved ? " (editing withdraws the approval)" : ""}</summary>
                    <ActionForm action={saveLesson} className="stack-sm" submit="Save" submitClass="btn small">
                      <input type="hidden" name="lessonId" value={l.id} />
                      <label className="field">Title <input name="title" defaultValue={l.title} maxLength={100} /></label>
                      <label className="field">Description <span className="hint">Chapters, every episode&apos;s sources, the AI-voice label.</span><textarea name="description" defaultValue={l.description} maxLength={5000} style={{ minHeight: 220, fontFamily: "var(--mono)", fontSize: 13 }} /></label>
                    </ActionForm>
                  </details>
                ) : null}
                <div className="row">
                  {!approved && l.state !== "published" ? <ActionForm action={approveLessonAction} submit="Approve for YouTube" submitClass="btn topic small"><input type="hidden" name="lessonId" value={l.id} /></ActionForm> : null}
                  <CopyButton text={l.title} label="Copy title" />
                  <CopyButton text={l.description} label="Copy description" />
                  <a className="btn ghost small" href={`${mediaUrl(l.videoPath)}&dl=${encodeURIComponent(`${l.name}-16x9.mp4`)}`} download>Download video</a>
                  {l.thumbnailPath ? <a className="btn ghost small" href={`${mediaUrl(l.thumbnailPath)}&dl=${encodeURIComponent(`${l.name}-thumbnail.jpg`)}`} download>Thumbnail</a> : null}
                </div>
                {approved && l.state !== "published" ? (
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 650 }}>I&apos;ve uploaded it to YouTube: mark uploaded</summary>
                    <ActionForm action={reportLessonUploaded} className="stack-sm" submit="Mark uploaded" submitClass="btn">
                      <input type="hidden" name="lessonId" value={l.id} />
                      <label className="field">Video link <span className="hint">Optional.</span><input name="postUrl" type="url" inputMode="url" placeholder="https://youtu.be/…" /></label>
                      <label className="check"><input type="checkbox" name="confirmAccount" /> <span>I uploaded it to <b>{ytHandle || `${channelName} YouTube`}</b> as a regular (not Shorts) video, with the AI label on and the chapters in the description.</span></label>
                    </ActionForm>
                  </details>
                ) : null}
                {l.state === "published" ? <p className="muted" style={{ margin: 0 }}>Uploaded {formatLocal(l.reportedAt, tz)}{l.postUrl ? <> · <a href={l.postUrl} target="_blank" rel="noopener noreferrer">watch</a></> : null}</p> : null}
              </>
            )}
            {l.state !== "published" ? <ActionForm action={dissolveLessonAction} submit="Dissolve" submitClass="btn danger small" confirm="Dissolve this lesson? Its episodes become available again; the built video stays on disk."><input type="hidden" name="lessonId" value={l.id} /></ActionForm> : null}
          </article>
        );
      })}
    </div>
  );
}
