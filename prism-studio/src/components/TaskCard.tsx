// The Upload Desk's tasks: every rendered episode that is not uploaded yet gets the full card (no approval needed): the
// account it goes to, the exact video and words (PostFields), the files, the hand-off buttons and the owner's Uploaded
// button for the platform ("Uploaded on YouTube & TikTok" / "Uploaded on Instagram"). Done tasks show the done state
// with Undo.
import Link from "next/link";
import { coverOf, isReady, thumbOf, uploadUrlFor, type UploadTask } from "@/lib/data";
import { publishNow } from "@/app/actions";
import { composePostText } from "@/domain/metadata";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, topicStyle } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { HandOff } from "./HandOff";
import { Icon } from "./Icon";
import { PostFields } from "./PostFields";
import { groupOf, UploadedControl } from "./UploadedControl";
import { VideoCleared } from "./VideoCleared";

const when = (t: UploadTask, tz: string) => (t.p.scheduledFor ? formatLocal(t.p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Not scheduled");

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
  const cleared = !!e.videoClearedAt;   // erased from the server after posting (an upload undone later): no video here
  return (
    <article id={`task-${p.id}`} data-task className="card stack" style={topicStyle(channel)}>
      <div className="row spread top">
        <div>
          <div className="kicker topic-text">{channel.label} · {platform} · {when(t, tz)}</div>
          <h3 className="h2" style={{ margin: "4px 0 0" }}>{e.title}{e.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</h3>
          <div className="faint" style={{ fontSize: 14 }}>No. {no}{version ? ` · render v${version.versionNo}` : ""}</div>
        </div>
        {done ? <span className="chip good">Uploaded</span> : <span className="chip">Not uploaded yet</span>}
      </div>

      <div className="acct">
        <span className="avatar" aria-hidden>{handle ? handle.replace("@", "").slice(0, 2).toUpperCase() : <Icon name={dest.platform} size={20} />}</span>
        <div>
          <div className="handle">{handle || accountName}</div>
          <div className="faint" style={{ fontSize: 13 }}>
            {handle ? <>{accountName} · {platform}. Check the app is signed in as {handle}.</> : <>{platform} · not set up yet: add its handle so the desk shows who to post as.</>}
          </div>
        </div>
        {!handle ? <Link href="/connections" className="btn ghost small acct-action">Add its handle</Link> : null}
      </div>

      {p.method === "api" && p.status === "handed_off" && p.note ? <div className="notice info">Uploaded by the studio: {p.note}{p.postUrl ? <> · <a href={p.postUrl} target="_blank" rel="noopener noreferrer">open</a></> : null}. Press Uploaded once it is live, or wait for the worker to confirm.</div> : null}

      {x && !done && ready ? (
        <>
          <div className="grid2 desk-media">
            {version ? (
              <div className="player-wrap">
                {cleared ? <VideoCleared /> : <video className="player" controls preload="none" playsInline poster={cover ? mediaUrl(cover) : undefined} src={mediaUrl(x.filePath)} style={{ maxHeight: 420 }} />}
              </div>
            ) : null}
            <div className="stack-sm">
              <PostFields x={x} platform={dest.platform} />
              <div className="row files">
                {cover ? <a className="btn quiet small" href={mediaUrl(cover, `${base}-cover.jpg`)} download={`${base}-cover.jpg`}><Icon name="download" size={16} /> Cover .jpg</a> : null}
                {thumb ? <a className="btn quiet small" href={mediaUrl(thumb, `${base}-thumb.jpg`)} download={`${base}-thumb.jpg`}><Icon name="download" size={16} /> Thumbnail 16:9</a> : null}
                {dest.platform === "youtube" && e.captionsSrt ? <a className="btn quiet small" href={`/api/srt/${e.id}`} download><Icon name="download" size={16} /> Captions .srt</a> : null}
                {!cleared ? <a className="btn quiet small" href={`/api/bundle/${p.id}`} download><Icon name="download" size={16} /> Bundle .zip</a> : null}
              </div>
            </div>
          </div>
          {stopExternal ? <div className="notice bad">External actions are stopped in Settings.</div> : (
            <>
              {connected && !cleared ? (
                <ActionForm action={publishNow} className="row" submit={`Publish now to ${handle || platform}`} submitClass="btn" confirm={`Upload this exact video and text to ${handle || platform} now?`}>
                  <input type="hidden" name="publicationId" value={p.id} />
                </ActionForm>
              ) : null}
              {cleared
                ? <div className="row"><a className="btn ghost" href={uploadUrlFor(dest)} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} /> Open {platform}</a></div>
                : <HandOff publicationId={p.id} videoUrl={mediaUrl(x.filePath)} fileName={`${base}.mp4`} uploadUrl={uploadUrlFor(dest)} platformLabel={platform} shareText={composePostText(x)} />}
            </>
          )}
          <UploadedControl episodeId={e.id} group={groupOf(dest.platform)} tz={tz} pubs={[p]} />
        </>
      ) : !done ? (
        <div className="notice">{!x ? `No export for ${platform} yet.` : "A newer render exists."} <Link href={`/episodes/${e.id}`}>Open the episode</Link></div>
      ) : null}

      {done ? (
        <div className="row spread">
          <span className="muted" style={{ fontSize: 14 }}>{p.postUrl ? <a href={p.postUrl} target="_blank" rel="noopener noreferrer">View the post</a> : "No link saved"}</span>
          <UploadedControl episodeId={e.id} group={groupOf(dest.platform)} tz={tz} pubs={[p]} />
        </div>
      ) : null}
    </article>
  );
}
