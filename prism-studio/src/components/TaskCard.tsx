// The Upload Desk's tasks. An approved (or already posted) task gets the full card: the account it must go to, the
// exact video and words (PostFields), the files, the hand-off buttons and the owner's confirmation. A task still waiting
// for its approval is one compact row (TaskRow) that links to the approval: nothing on it could be posted yet.
import Link from "next/link";
import { coverOf, isReady, smallCover, thumbOf, uploadUrlFor, type UploadTask } from "@/lib/data";
import { publishNow, reportUploaded, undoReport } from "@/app/actions";
import { composePostText } from "@/domain/metadata";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, PUB_LABEL, pubTone, topicStyle } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { HandOff } from "./HandOff";
import { Icon } from "./Icon";
import { PostFields } from "./PostFields";

const when = (t: UploadTask, tz: string) => (t.p.scheduledFor ? formatLocal(t.p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Not scheduled");

/** A task waiting for its approval: cover, when, account, title and the link to approve it. */
export function TaskRow({ t, tz }: { t: UploadTask; tz: string }) {
  const { e, dest, x, version, channel } = t;
  const cover = smallCover(coverOf(t));
  return (
    <li className="q-row" style={topicStyle(channel)}>
      <span className="q-cover" aria-hidden>{cover ? <img src={mediaUrl(cover)} alt="" decoding="async" loading="lazy" /> : null}</span>
      <Link href={`/episodes/${e.id}`} className="q-title">{e.title}{e.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</Link>
      <span className="q-where">{channel.label} · {PLATFORM_LABEL[dest.platform]}{dest.handle ? ` · ${dest.handle}` : ""}</span>
      <span className="q-when num">{when(t, tz)}</span>
      <span className="q-chips">
        {!x ? <span className="chip">No export yet</span>
          : <Link href={`/episodes/${e.id}#placements`} className="chip warn">{version?.superseded ? "Newer render: approve again" : "Needs approval"}</Link>}
      </span>
    </li>
  );
}

export function TaskCard({ t, tz, stopExternal, connected }: { t: UploadTask; tz: string; stopExternal: boolean; connected?: boolean }) {
  const { p, e, dest, x, version, channel } = t;
  const platform = PLATFORM_LABEL[dest.platform];
  const done = ["owner_reported", "scheduled_on_platform"].includes(p.status);
  const handle = dest.handle || "";
  const accountName = dest.displayName || (dest.shared ? "Shared Instagram" : `${channel.name.replace(/ \(name TBD\)$/, "")} ${platform}`);
  const no = String(e.number).padStart(3, "0");
  const base = `${channel.slug}-${no}-${dest.platform}`;
  const ready = isReady(t);
  const cover = coverOf(t), thumb = dest.platform === "youtube" ? thumbOf(t) : null;
  return (
    <article id={`task-${p.id}`} data-task className="card stack" style={topicStyle(channel)}>
      <div className="row spread top">
        <div>
          <div className="kicker topic-text">{channel.label} · {platform} · {when(t, tz)}</div>
          <h3 className="h2" style={{ margin: "4px 0 0" }}>{e.title}{e.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</h3>
          <div className="faint" style={{ fontSize: 14 }}>No. {no}{version ? ` · render v${version.versionNo}` : ""}</div>
        </div>
        {p.status !== "planned" ? <span className={`chip ${pubTone(p.status)}`}>{PUB_LABEL[p.status]}</span> : null}
      </div>

      <div className="acct">
        <span className="avatar" aria-hidden>{handle ? handle.replace("@", "").slice(0, 2).toUpperCase() : <Icon name={dest.platform} size={20} />}</span>
        <div>
          <div className="handle">{handle || accountName}</div>
          <div className="faint" style={{ fontSize: 13 }}>
            {handle ? <>{accountName} · {platform}. Check the app is signed in as {handle}.</> : <>{platform} · not set up: <Link href="/connections">add its handle</Link> so the desk shows who to post as.</>}
          </div>
        </div>
      </div>

      {p.method === "api" && p.status === "handed_off" && p.note ? <div className="notice info">Uploaded by the studio: {p.note}{p.postUrl ? <> · <a href={p.postUrl} target="_blank" rel="noopener noreferrer">open</a></> : null}. Mark uploaded once it is live, or wait for the worker to confirm.</div> : null}

      {x && !done && ready ? (
        <>
          <div className="grid2">
            {version ? (
              <div className="player-wrap">
                <video className="player" controls preload="none" playsInline poster={cover ? mediaUrl(cover) : undefined} src={mediaUrl(x.filePath)} style={{ maxHeight: 420 }} />
              </div>
            ) : null}
            <div className="stack-sm">
              <PostFields x={x} platform={dest.platform} />
              <div className="row files">
                {cover ? <a className="btn quiet small" href={mediaUrl(cover, `${base}-cover.jpg`)} download={`${base}-cover.jpg`}><Icon name="download" size={16} /> Cover .jpg</a> : null}
                {thumb ? <a className="btn quiet small" href={mediaUrl(thumb, `${base}-thumb.jpg`)} download={`${base}-thumb.jpg`}><Icon name="download" size={16} /> Thumbnail 16:9</a> : null}
                {dest.platform === "youtube" && e.captionsSrt ? <a className="btn quiet small" href={`/api/srt/${e.id}`} download><Icon name="download" size={16} /> Captions .srt</a> : null}
                <a className="btn quiet small" href={`/api/bundle/${p.id}`} download><Icon name="download" size={16} /> Bundle .zip</a>
              </div>
            </div>
          </div>
          {stopExternal ? <div className="notice bad">External actions are stopped in Settings.</div> : (
            <>
              {connected ? (
                <ActionForm action={publishNow} className="row" submit={`Publish now to ${handle || platform}`} submitClass="btn" confirm={`Upload this exact video and text to ${handle || platform} now?`}>
                  <input type="hidden" name="publicationId" value={p.id} />
                </ActionForm>
              ) : null}
              <HandOff publicationId={p.id} videoUrl={mediaUrl(x.filePath)} fileName={`${base}.mp4`} uploadUrl={uploadUrlFor(dest)} platformLabel={platform} shareText={composePostText(x)} />
            </>
          )}
          <details className="post-report">
            <summary>I&apos;ve posted it: mark uploaded</summary>
            <ActionForm action={reportUploaded} className="stack-sm" submit="Mark uploaded" submitClass="btn">
              <input type="hidden" name="publicationId" value={p.id} />
              <label className="field">Post link <span className="hint">Optional, from the platform&apos;s share button. Checked against {platform}{dest.platform === "tiktok" && handle ? ` and ${handle}` : ""}.</span>
                <input name="postUrl" type="url" inputMode="url" placeholder={dest.platform === "youtube" ? "https://youtube.com/shorts/…" : dest.platform === "tiktok" ? "https://www.tiktok.com/@…/video/…" : "https://www.instagram.com/reel/…"} />
              </label>
              <label className="field">Scheduled on the platform instead? <span className="hint">Leave empty if it&apos;s live now.</span>
                <input name="scheduledAt" type="datetime-local" />
              </label>
              <label className="check"><input type="checkbox" name="confirmAccount" /> <span>I posted it to <b>{handle || accountName}</b> on {platform}.</span></label>
            </ActionForm>
          </details>
        </>
      ) : !done ? (
        <div className="notice">{!x ? `No export for ${platform} yet.` : version?.superseded ? "A newer render exists." : "Not approved for this account yet."} <Link href={`/episodes/${e.id}#placements`}>Review and approve</Link></div>
      ) : null}

      {done ? (
        <div className="row spread">
          <span className="muted" style={{ fontSize: 14 }}>{p.postUrl ? <a href={p.postUrl} target="_blank" rel="noopener noreferrer">View the post</a> : "No link saved"} · reported {formatLocal(p.reportedAt, tz, { timeStyle: "short" })}</span>
          <ActionForm action={undoReport} submit="Undo" submitClass="btn ghost small"><input type="hidden" name="publicationId" value={p.id} /></ActionForm>
        </div>
      ) : null}
    </article>
  );
}
