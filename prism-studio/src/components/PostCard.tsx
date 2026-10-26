// One account's next post on a monitor extension: the cover (download), the exact title, caption and hashtags with
// copy buttons, the account's official upload link, the approval state and, when the account is connected, Publish
// now. It reuses the desk's pieces (HandOff, CopyButton, the publishNow / reportUploaded actions): opening,
// downloading or copying never counts as posted; only "Mark uploaded" or a verified integration does.
import Link from "next/link";
import { publishNow, reportUploaded } from "@/app/actions";
import { coverOf, isReady, uploadUrlFor, type PostItem } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, PUB_LABEL, topicStyle } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { CopyButton } from "./CopyButton";
import { HandOff } from "./HandOff";
import { Icon } from "./Icon";

export function PostCard({ t, tz, stopExternal, heading }: { t: PostItem; tz: string; stopExternal: boolean; heading?: string }) {
  const { p, e, dest, x, approval, version, channel } = t;
  const platform = PLATFORM_LABEL[dest.platform];
  const handle = dest.handle || "";
  const account = handle || (dest.shared ? "Shared Instagram" : `${channel.name.replace(/ \(name TBD\)$/, "")} ${platform}`);
  const cover = coverOf(t);
  const no = String(e.number).padStart(3, "0");
  const coverName = `${channel.slug}-${no}-${dest.platform}-cover.jpg`;
  const fileName = `${channel.slug}-${no}-${dest.platform}.mp4`;
  const caption = x ? [x.caption, x.hashtags].filter(Boolean).join("\n\n") : "";
  const ready = isReady(t);
  const uploadUrl = uploadUrlFor(dest);
  return (
    <article className="post" style={topicStyle(channel)} id={p ? `post-${p.id}` : undefined}>
      <div className="post-cover">
        {cover ? (
          <a href={mediaUrl(cover, coverName)} download={coverName} className="post-thumb" aria-label={`Download the cover for ${e.title}`}>
            <img src={mediaUrl(cover)} alt="" decoding="async" />
            <span className="post-dl"><Icon name="download" size={16} /> Cover</span>
          </a>
        ) : <div className="post-thumb" data-empty><span className="faint">No cover yet</span></div>}
      </div>

      <header className="post-head">
        <div>
          <div className="kicker">{heading ? `${heading} · ` : ""}{platform} · {handle || (dest.shared ? "shared account" : "account not set up")}</div>
          <h3 className="post-title"><Link href={`/episodes/${e.id}`}>{e.title}</Link></h3>
          <div className="post-when">
            {channel.label} No. {no}
            {" · "}
            {p?.scheduledFor ? formatLocal(p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })
              : p ? <>not scheduled · <Link href="/calendar">plan the week</Link></>
              : <>not planned yet · <Link href="/calendar">plan the week</Link></>}
          </div>
        </div>
        <div className="post-state">
          {!x ? <span className="chip">No export yet</span>
            : version?.superseded ? <span className="chip warn">Newer render: approve again</span>
            : approval ? <span className="chip good">Approved for {handle || platform}</span>
            : <Link href={`/episodes/${e.id}#placements`} className="chip warn">Needs approval</Link>}
          {p && p.status !== "planned" ? <span className="chip">{PUB_LABEL[p.status]}</span> : null}
        </div>
      </header>

      {x ? (
        <div className="post-fields">
          {dest.platform === "youtube" ? (
            <div className="copy-field">
              <div className="kicker">Title</div>
              <p className="copy-text strong">{x.title}</p>
              <CopyButton text={x.title} label="Copy title" />
            </div>
          ) : null}
          <div className="copy-field">
            <div className="kicker">{dest.platform === "youtube" ? "Description" : "Caption"}</div>
            <p className="copy-text">{x.caption}</p>
            <CopyButton text={caption} label={x.hashtags ? "Copy with hashtags" : "Copy caption"} />
          </div>
          {x.hashtags ? (
            <div className="copy-field">
              <div className="kicker">Hashtags</div>
              <p className="copy-text tags">{x.hashtags}</p>
              <CopyButton text={x.hashtags} label="Copy hashtags" />
            </div>
          ) : null}
          {x.disclosures?.aiVoice || x.disclosures?.aiVisuals ? <p className="post-note">Turn on the platform&apos;s AI / synthetic content label when posting.</p> : null}
        </div>
      ) : <p className="muted post-fields">Nothing rendered for {platform} yet.</p>}

      {x && !stopExternal ? (
        <div className="post-actions">
          {t.connected && p ? (
            <ActionForm action={publishNow} className="row" submit={`Publish now to ${handle || platform}`} submitClass="btn topic" confirm={`Upload this exact video and text to ${handle || platform} now?`}>
              <input type="hidden" name="publicationId" value={p.id} />
              {!ready ? <span className="faint" style={{ fontSize: 13 }}>Needs the approval first.</span> : null}
            </ActionForm>
          ) : null}
          {p ? (
            <HandOff publicationId={p.id} videoUrl={mediaUrl(x.filePath)} fileName={fileName} uploadUrl={uploadUrl} platformLabel={platform} shareText={caption} disabled={!ready} />
          ) : ready ? (
            <a className="btn ghost" href={uploadUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} /> Open {platform}</a>
          ) : null}
          {!ready ? <p className="faint post-note">Approve this exact video and text for {account} before uploading. <Link href={`/episodes/${e.id}#placements`}>Review and approve</Link></p> : null}
          {p && ready ? (
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
          ) : null}
        </div>
      ) : x && stopExternal ? <div className="notice bad post-actions">External actions are stopped in Settings.</div> : null}
    </article>
  );
}
