// One account's next post on a monitor extension: the cover (download), the exact words with copy buttons (PostFields),
// then what to do next: Download / Share and the account's official upload page (and Publish now when the account is
// connected), then the owner's Uploaded button for this card's platform ("Uploaded on YouTube & TikTok" or "Uploaded on
// Instagram"). No approval is needed. Opening, downloading or copying never counts as posted; only the owner's Uploaded
// button or a verified integration does.
import Link from "next/link";
import { publishNow } from "@/app/actions";
import { coverOf, isReady, uploadUrlFor, type PostItem } from "@/lib/data";
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

const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];

export function PostCard({ t, tz, stopExternal, heading }: { t: PostItem; tz: string; stopExternal: boolean; heading?: string }) {
  const { p, e, dest, x, version, channel } = t;
  const platform = PLATFORM_LABEL[dest.platform];
  const handle = dest.handle || "";
  const cover = coverOf(t);
  const no = String(e.number).padStart(3, "0");
  const base = `${channel.slug}-${no}-${dest.platform}`;
  // the file name says its resolution: the YouTube 1440p version or the 1080p master
  const res = x && /-youtube\.mp4$/.test(x.filePath) ? "-1440p" : "-1080p";
  const ready = isReady(t);
  const uploadUrl = uploadUrlFor(dest);
  const cleared = !!e.videoClearedAt;   // erased from the server after posting: no video to download, share or publish
  return (
    <article className="post" style={topicStyle(channel)} id={p ? `post-${p.id}` : undefined}>
      <div className="post-cover">
        {cover ? (
          <a href={mediaUrl(cover, `${base}-cover.jpg`)} download={`${base}-cover.jpg`} className="post-thumb" aria-label={`Download the cover and thumbnail for ${e.title}`}>
            <img src={mediaUrl(cover)} alt="" decoding="async" loading="lazy" />
            <span className="post-dl"><Icon name="download" size={16} /> Cover &amp; thumbnail</span>
          </a>
        ) : <div className="post-thumb" data-empty><span className="faint">No cover yet</span></div>}
      </div>

      <header className="post-head">
        <div>
          <div className="kicker topic-text">{heading ? `${heading} · ` : ""}{platform}{handle ? ` · ${handle}` : ""}</div>
          <h3 className="post-title"><Link href={`/episodes/${e.id}`}>{e.title}</Link>{e.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</h3>
          <div className="post-when">
            No. {no}
            {" · "}
            {p?.scheduledFor ? formatLocal(p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })
              : <>{p ? "not scheduled" : "not planned yet"}</>}
          </div>
        </div>
        <div className="post-state">
          {!x ? <span className="chip">No export yet</span>
            : version?.superseded ? <Link href={`/episodes/${e.id}`} className="chip warn">Newer render exists</Link>
            : p && POSTED.includes(p.status) ? <span className="chip good">Uploaded</span>
            : <span className="chip">Not uploaded yet</span>}
          {!handle && !dest.shared ? <Link href="/connections" className="chip warn">Account not set up</Link> : null}
        </div>
      </header>

      {x ? <PostFields x={x} platform={dest.platform} />
        : <p className="muted post-fields">Nothing rendered for {platform} yet.</p>}

      {x && stopExternal ? <div className="notice bad post-actions">External actions are stopped in Settings.</div>
        : x && ready ? (
          <div className="post-actions">
            {t.connected && p && !cleared ? (
              <ActionForm action={publishNow} className="row" submit={`Publish now to ${handle || platform}`} submitClass="btn" confirm={`Upload this exact video and text to ${handle || platform} now?`}>
                <input type="hidden" name="publicationId" value={p.id} />
              </ActionForm>
            ) : null}
            {cleared ? (
              <div className="stack-sm">
                <VideoCleared />
                <div className="row"><a className="btn ghost" href={uploadUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} /> Open {platform}</a></div>
              </div>
            ) : p ? (
              <HandOff publicationId={p.id} videoUrl={mediaUrl(x.filePath)} fileName={`${base}${res}.mp4`} uploadUrl={uploadUrl} platformLabel={platform} shareText={composePostText(x)} />
            ) : (
              <div className="row">
                <a className="btn" href={mediaUrl(x.filePath, `${base}${res}.mp4`)} download={`${base}${res}.mp4`}><Icon name="download" size={18} /> Download</a>
                <a className="btn ghost" href={uploadUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} /> Open {platform}</a>
              </div>
            )}
            <UploadedControl episodeId={e.id} group={groupOf(dest.platform)} tz={tz} pubs={[p]} />
          </div>
        ) : x ? (
          <div className="post-actions">
            <p className="post-note">A newer render replaced this one. Open <Link href={`/episodes/${e.id}`}>the episode</Link> for the current version.</p>
          </div>
        ) : null}
    </article>
  );
}
