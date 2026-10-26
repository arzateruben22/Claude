// The exact words for one post, each with its copy button: the YouTube title (and its 16:9 thumbnail), the description or
// caption, the hashtags, the pinned / first comment with the sources and, when they don't fit one comment, each reply
// ("Copy reply 1" …, posted under it in order), YouTube's keyword tags, and a short checklist for the upload screen. Shared by the monitor screens' post cards and the Upload Desk. The caption shows without its trailing
// hashtag line (the tags have their own box); "Copy caption + hashtags" copies the exact stored text (composePostText),
// so the tags are pasted once.
import type { ReactNode } from "react";
import type { PostItem } from "@/lib/data";
import { captionBody, composePostText, FIRST_COMMENT, parsePostingNotes } from "@/domain/metadata";
import { CopyButton } from "./CopyButton";

type Export = NonNullable<PostItem["x"]>;
type Platform = "youtube" | "tiktok" | "instagram";

/** Long text: the first paragraphs in view, the rest behind a "Show …" disclosure (no scroll boxes). */
function LongText({ text, more, className = "copy-text" }: { text: string; more: string; className?: string }) {
  const paras = text.split(/\n{2,}/);
  let head = 0, len = 0;
  while (head < paras.length && (head === 0 || len + paras[head].length <= 420)) len += paras[head++].length;
  if (text.length <= 560 || head >= paras.length) return <div className={className}>{text}</div>;
  return (
    <div className={className}>
      {paras.slice(0, head).join("\n\n")}
      <details className="more-text"><summary>{more}</summary>{paras.slice(head).join("\n\n")}</details>
    </div>
  );
}

function Field({ label, children, actions }: { label: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="copy-field">
      <div className="label">{label}</div>
      <div className="copy-actions">{actions}</div>
      {children}
    </div>
  );
}

/** One comment of the sources thread: short ones in full, long ones (a numbered source list) behind "Show the N sources". */
function CommentText({ text }: { text: string }) {
  const sources = (text.match(/^\d+\./gm) ?? []).length;
  return text.length > 280
    ? <div className="copy-text notes"><details className="more-text flush"><summary>{sources ? `Show the ${sources} source${sources === 1 ? "" : "s"}` : "Show the comment"}</summary>{text}</details></div>
    : <p className="copy-text notes">{text}</p>;
}

export function PostFields({ x, platform, thumb }: { x: Export; platform: Platform; thumb?: { url: string; name: string } | null }) {
  const notes = parsePostingNotes(x.postingNotes);
  const body = captionBody(x), full = composePostText(x);
  const first = FIRST_COMMENT[platform], replies = notes.comment ? notes.replies : [], n = replies.length + 1;
  const ai = notes.aiLabel || !!x.disclosures?.aiVoice || !!x.disclosures?.aiVisuals;
  return (
    <div className="post-fields">
      {platform === "youtube" ? (
        <Field label="Title" actions={<>
          <CopyButton text={x.title} label="Copy title" />
          {thumb ? <a className="btn quiet small" href={thumb.url} download={thumb.name}>Thumbnail 16:9</a> : null}
        </>}>
          <p className="copy-text strong">{x.title}</p>
        </Field>
      ) : null}
      <Field label={platform === "youtube" ? "Description" : "Caption"} actions={<CopyButton text={full} label={x.hashtags.trim() ? `Copy ${platform === "youtube" ? "description" : "caption"} + hashtags` : `Copy ${platform === "youtube" ? "description" : "caption"}`} />}>
        <LongText text={body} more="Show full description" />
      </Field>
      {x.hashtags.trim() ? (
        <Field label="Hashtags" actions={<CopyButton text={x.hashtags.trim()} label="Copy hashtags" />}>
          <p className="copy-text tags">{x.hashtags.trim()}</p>
        </Field>
      ) : null}
      {notes.comment ? (
        <Field label={n > 1 ? `${first} · 1 of ${n}` : first} actions={<CopyButton text={notes.comment} label="Copy comment" />}>
          <CommentText text={notes.comment} />
        </Field>
      ) : null}
      {replies.map((r, k) => (
        <Field key={k} label={`Reply ${k + 1} · ${k + 2} of ${n}`} actions={<CopyButton text={r} label={`Copy reply ${k + 1}`} />}>
          <CommentText text={r} />
        </Field>
      ))}
      {platform === "youtube" && notes.tags ? (
        <Field label="Tags" actions={<CopyButton text={notes.tags} label="Copy tags" />}>
          <p className="copy-text tags">{notes.tags}</p>
        </Field>
      ) : null}
      {ai || notes.captionsOff || replies.length || notes.checks.length || notes.other.length ? (
        <ul className="checklist">
          {ai ? <li>Turn on the AI / synthetic content label</li> : null}
          {replies.length ? <li>{platform === "instagram" ? "Post the first comment" : "Post and pin the comment"}, then reply to it with {replies.length === 1 ? "reply 1" : `replies 1–${replies.length}`}, in order</li> : null}
          {notes.captionsOff ? <li>Leave auto-captions off: the captions are burned in</li> : null}
          {notes.checks.map((c) => <li key={c} className="warn">Check: {c}</li>)}
          {notes.other.map((o) => <li key={o} className="plain">{o}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
