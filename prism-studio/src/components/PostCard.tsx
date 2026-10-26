// One account's next post on a monitor extension: the cover (download), the exact words with copy buttons (PostFields),
// then what to do next. Approved: Download / Share and the account's official upload page (and Publish now when the
// account is connected), then "Mark uploaded". Not approved: the reason and "Review and approve", with no download link.
// Every account (YouTube, TikTok and the shared Instagram) gets the same rows. Opening, downloading or copying never
// counts as posted; only "Mark uploaded" or a verified integration does.
import Link from "next/link";
import { publishNow, reportUploaded } from "@/app/actions";
import { coverOf, isReady, thumbOf, uploadUrlFor, type PostItem } from "@/lib/data";
import { composePostText } from "@/domain/metadata";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, PUB_LABEL, topicStyle } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { HandOff } from "./HandOff";
import { Icon } from "./Icon";
import { PostFields } from "./PostFields";

export function PostCard({ t, tz, stopExternal, heading }: { t: PostItem; tz: string; stopExternal: boolean; heading?: string }) {
  const { p, e, dest, x, approval, version, channel } = t;
  const platform = PLATFORM_LABEL[dest.platform];
  const handle = dest.handle || "";
  const account = handle || (dest.shared ? "the shared Instagram" : `${channel.name.replace(/ \(name TBD\)$/, "")} ${platform}`);
  const cover = coverOf(t);
  const no = String(e.number).padStart(3, "0");
  const base = `${channel.slug}-${no}-${dest.platform}`;
  const thumb = dest.platform === "youtube" ? thumbOf(t) : null;
  const ready = isReady(t);
  const uploadUrl = uploadUrlFor(dest);
  const reviewHref = `/episodes/${e.id}#placements`;
  const noteId = `why-${p?.id ?? `${e.id}-${dest.id}`}`;
  return (
    <article className="post" style={topicStyle(channel)} id={p ? `post-${p.id}` : undefined}>
      <div className="post-cover">
        {cover ? (
          <a href={mediaUrl(cover, `${base}-cover.jpg`)} download={`${base}-cover.jpg`} className="post-thumb" aria-label={`Download the cover for ${e.title}`}>
            <img src={mediaUrl(cover)} alt="" decoding="async" loading="lazy" />
            <span className="post-dl"><Icon name="download" size={16} /> Cover</span>
          </a>
        ) : <div className="post-thumb" data-empty><span className="faint">No cover yet</span></div>}
      </div>

      <header className="post-head">
        <div>
          <div className="kicker topic-text">{heading ? `${heading} · ` : ""}{platform}{handle ? ` · ${handle}` : ""}</div>
          <h3 className="post-title"><Link href={`/episodes/${e.id}`}>{e.title}</Link></h3>
          <div className="post-when">
            No. {no}
            {" · "}
            {p?.scheduledFor ? formatLocal(p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })
              : <>{p ? "not scheduled" : "not planned yet"} · <Link href="/calendar">plan the week</Link></>}
          </div>
        </div>
        <div className="post-state">
          {!x ? <span className="chip">No export yet</span>
            : version?.superseded ? <Link href={reviewHref} className="chip warn">Newer render: approve again</Link>
            : approval ? <span className="chip good">Approved</span>
            : <Link href={reviewHref} className="chip warn">Needs approval</Link>}
          {!handle && !dest.shared ? <Link href="/connections" className="chip warn">Account not set up</Link> : null}
          {p && p.status !== "planned" ? <span className="chip">{PUB_LABEL[p.status]}</span> : null}
        </div>
      </header>

      {x ? <PostFields x={x} platform={dest.platform} thumb={thumb ? { url: mediaUrl(thumb, `${base}-thumb.jpg`), name: `${base}-thumb.jpg` } : null} />
        : <p className="muted post-fields">Nothing rendered for {platform} yet.</p>}

      {x && stopExternal ? <div className="notice bad post-actions">External actions are stopped in Settings.</div>
        : x && ready ? (
          <div className="post-actions">
            {t.connected && p ? (
              <ActionForm action={publishNow} className="row" submit={`Publish now to ${handle || platform}`} submitClass="btn" confirm={`Upload this exact video and text to ${handle || platform} now?`}>
                <input type="hidden" name="publicationId" value={p.id} />
              </ActionForm>
            ) : null}
            {p ? (
              <HandOff publicationId={p.id} videoUrl={mediaUrl(x.filePath)} fileName={`${base}.mp4`} uploadUrl={uploadUrl} platformLabel={platform} shareText={composePostText(x)} />
            ) : (
              <div className="row">
                <a className="btn" href={mediaUrl(x.filePath, `${base}.mp4`)} download={`${base}.mp4`}><Icon name="download" size={18} /> Download</a>
                <a className="btn ghost" href={uploadUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} /> Open {platform}</a>
              </div>
            )}
            {p ? (
              <details className="post-report">
                <summary>I&apos;ve posted it: mark uploaded</summary>
                <ActionForm action={reportUploaded} className="stack-sm" submit="Mark uploaded" submitClass="btn">
                  <input type="hidden" name="publicationId" value={p.id} />
                  <label className="field">Post link <span className="hint">Optional, from {platform}&apos;s share button.</span>
                    <input name="postUrl" type="url" inputMode="url" placeholder={dest.platform === "youtube" ? "https://youtube.com/shorts/…" : dest.platform === "tiktok" ? "https://www.tiktok.com/@…/video/…" : "https://www.instagram.com/reel/…"} />
                  </label>
                  <label className="field">Scheduled on the platform instead? <span className="hint">Leave empty if it&apos;s live now.</span>
                    <input name="scheduledAt" type="datetime-local" />
                  </label>
                  <label className="check"><input type="checkbox" name="confirmAccount" /> <span>I posted it to <b>{account}</b> on {platform}.</span></label>
                </ActionForm>
              </details>
            ) : <p className="faint post-note">Not planned yet: <Link href="/calendar">plan the week</Link> to give it a slot, then mark it uploaded from the Upload Desk.</p>}
          </div>
        ) : x ? (
          <div className="post-actions">
            <p className="post-note" id={noteId}>
              {version?.superseded ? "A newer render replaced this one. Approve the new version" : `Approve this exact video and text for ${account}`} first: Download and Open {platform} appear once it&apos;s approved.
            </p>
            <div className="row"><Link className="btn" href={reviewHref} aria-describedby={noteId}>Review and approve</Link></div>
          </div>
        ) : null}
    </article>
  );
}
