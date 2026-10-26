// One upload task on the desk: the account it must go to, the exact approved video and text, the hand-off
// buttons, and the owner's confirmation.
import Link from "next/link";
import type { UploadTask } from "@/lib/data";
import { publishNow, reportUploaded, undoReport } from "@/app/actions";
import { OFFICIAL, youtubeStudioFor } from "@/domain/catalog";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, PUB_LABEL, pubTone, topicStyle } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { CopyButton } from "./CopyButton";
import { HandOff } from "./HandOff";

export function TaskCard({ t, tz, stopExternal, connected }: { t: UploadTask; tz: string; stopExternal: boolean; connected?: boolean }) {
  const { p, e, dest, x, approval, version, channel } = t;
  const platform = PLATFORM_LABEL[dest.platform];
  const done = ["owner_reported", "scheduled_on_platform"].includes(p.status);
  const handle = dest.handle || "";
  const accountName = dest.displayName || (dest.shared ? "Shared Instagram" : `${channel.name.replace(/ \(name TBD\)$/, "")} ${platform}`);
  const uploadUrl = dest.uploadUrl || (dest.platform === "youtube" && dest.platformAccountId ? youtubeStudioFor(dest.platformAccountId) : OFFICIAL[dest.platform].upload);
  const fullCaption = x ? [x.caption, x.hashtags].filter(Boolean).join("\n\n") : "";
  const fileName = `${channel.slug}-${String(e.number).padStart(3, "0")}-${dest.platform}.mp4`;
  const ready = !!approval && !!x && !version?.superseded;
  return (
    <article id={`task-${p.id}`} data-task className="card topic stack" style={topicStyle(channel)}>
      <div className="row spread top">
        <div>
          <div className="kicker" style={{ color: "var(--topic-ink)" }}>{channel.label} · {platform}{p.scheduledFor ? ` · ${formatLocal(p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : " · not scheduled"}</div>
          <h3 className="h2" style={{ margin: "4px 0 0" }}>{e.title}</h3>
          <div className="muted" style={{ fontSize: 14 }}>No. {String(e.number).padStart(3, "0")}{version ? ` · render v${version.versionNo}` : ""}</div>
        </div>
        <span className={`chip ${pubTone(p.status)}`}>{PUB_LABEL[p.status]}</span>
      </div>

      <div className="acct card flat" style={{ padding: 12 }}>
        <div className="who">
          <span className="avatar" style={{ background: "var(--topic-ink)" }}>{(handle.replace("@", "") || platform).slice(0, 2).toUpperCase()}</span>
          <div>
            <div className="handle">{handle || accountName}</div>
            <div className="muted" style={{ fontSize: 13 }}>{handle ? accountName : "Account not set up yet"} · {platform}</div>
          </div>
        </div>
        {handle
          ? <div className="confirm">Before posting, check the {platform} app is signed in as {handle}.</div>
          : <div className="confirm">Add this account&apos;s handle in <Link href="/connections">Accounts</Link> so the desk can show who to post as.</div>}
      </div>

      {p.method === "api" && p.status === "handed_off" && p.note ? <div className="notice info">Uploaded by the studio: {p.note}{p.postUrl ? <> · <a href={p.postUrl} target="_blank" rel="noopener noreferrer">open</a></> : null}. Mark uploaded once it is live, or wait for the worker to confirm.</div> : null}
      {!x ? <div className="notice">No export for {platform} yet: this episode has no rendered version.</div>
        : version?.superseded ? <div className="notice">A newer render exists. Open the episode and approve the new version.</div>
        : !approval ? <div className="notice">Not approved for this account yet. <Link href={`/episodes/${e.id}#placements`}>Review and approve</Link></div> : null}

      {x && !done ? (
        <>
          <div className="grid2">
            {version ? (
              <div className="player-wrap">
                <video className="player" controls preload="none" playsInline poster={version.posterPath ? mediaUrl(version.posterPath) : undefined} src={mediaUrl(x.filePath)} style={{ maxHeight: 360 }} />
              </div>
            ) : null}
            <div className="stack-sm">
              {dest.platform === "youtube" ? (
                <div className="stack-sm"><div className="kicker">Title</div><div style={{ fontWeight: 650 }}>{x.title}</div><div><CopyButton text={x.title} label="Copy title" /></div></div>
              ) : null}
              <div className="kicker">Caption</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5, background: "var(--ivory)", borderRadius: 12, padding: 12, maxHeight: 180, overflow: "auto" }}>{fullCaption}</div>
              <div className="row"><CopyButton text={fullCaption} label="Copy caption" />
                {x.coverPath ? <a className="btn ghost small" href={mediaUrl(x.coverPath, fileName.replace(/\.mp4$/, "-cover.jpg"))} download={fileName.replace(/\.mp4$/, "-cover.jpg")}>Cover .jpg</a> : null}
                {dest.platform === "youtube" && e.captionsSrt ? <a className="btn ghost small" href={`/api/srt/${e.id}`} download>Captions .srt</a> : null}
                <a className="btn ghost small" href={`/api/bundle/${p.id}`} download>Bundle .zip</a></div>
              {x.postingNotes ? <p className="faint" style={{ fontSize: 13, margin: 0 }}>{x.postingNotes}</p> : null}
              {x.disclosures?.aiVoice || x.disclosures?.aiVisuals ? <p className="chip info" style={{ justifySelf: "start", margin: 0 }}>Turn on the AI / synthetic content label</p> : null}
            </div>
          </div>
          {stopExternal ? <div className="notice bad">External actions are stopped in Settings.</div> : (
            <>
              {connected ? (
                <ActionForm action={publishNow} className="row" submit={`Publish now to ${handle || platform}`} submitClass="btn topic" confirm={`Upload this exact video and text to ${handle || platform} now?`}>
                  <input type="hidden" name="publicationId" value={p.id} />
                  {!ready ? <span className="faint" style={{ fontSize: 13 }}>Needs the approval first.</span> : null}
                </ActionForm>
              ) : null}
              <HandOff publicationId={p.id} videoUrl={mediaUrl(x.filePath)} fileName={fileName} uploadUrl={uploadUrl} platformLabel={platform} shareText={fullCaption} disabled={!ready} />
            </>
          )}
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 650 }}>I&apos;ve posted it: mark uploaded</summary>
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
