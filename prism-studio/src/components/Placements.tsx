// Per-account text: each destination's exact export (title, caption, hashtags, disclosures), copyable and editable,
// and the owner's two "Uploaded" buttons (YouTube & TikTok, Instagram). There is no approval step.
import Link from "next/link";
import { regenerateText, saveExport } from "@/app/actions";
import type { episodeFull } from "@/lib/data";
import { composePostText } from "@/domain/metadata";
import { PLATFORM_LABEL, qaFails } from "@/lib/format";
import { ActionForm } from "./ActionForm";
import { CopyButton } from "./CopyButton";
import { groupOf, UploadedControl } from "./UploadedControl";

type Full = NonNullable<Awaited<ReturnType<typeof episodeFull>>>;
const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];

export function Placements({ full, tz }: { full: Full; tz: string }) {
  const fails = full.current ? qaFails(full.current.qa) : null;
  const failList = fails ? ((full.current?.qa as { fails?: unknown[] } | null)?.fails ?? []).map(String) : [];
  return (
    <div className="stack" id="placements">
      {fails ? (
        <div className="notice bad">
          QA: {fails} check{fails === 1 ? "" : "s"} failed{failList.length ? ` (${failList.join("; ")})` : ""}. <Link href={`/episodes/${full.ep.id}#qa`}>See it</Link>.
        </div>
      ) : null}
      <div className="uploaded-panel stack-sm">
        <div className="label">After you post it by hand</div>
        <div className="uploaded-bar">
          {(["youtube_tiktok", "instagram"] as const).map((g) => (
            <UploadedControl key={g} episodeId={full.ep.id} group={g} tz={tz} pubs={full.placements.filter((p) => groupOf(p.dest.platform) === g).map((p) => p.publication)} />
          ))}
        </div>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>Nothing posts by itself: these buttons only record what you did.</p>
      </div>
      {full.placements.map(({ dest, export: x, publication }) => (
        <div key={dest.id} className="card flat stack-sm">
          <div className="row spread">
            <div className="acct-line">
              <span className="label">{PLATFORM_LABEL[dest.platform]}{dest.shared ? " · shared" : ""}</span>
              {dest.handle || dest.displayName ? <b>{dest.handle || dest.displayName}</b> : <Link href="/connections" className="chip warn">Account not set up</Link>}
            </div>
            {publication && POSTED.includes(publication.status) ? <span className="chip good">Uploaded</span> : <span className="chip">Not uploaded yet</span>}
          </div>
          {!x ? <p className="muted" style={{ margin: 0 }}>No {PLATFORM_LABEL[dest.platform]} export yet.</p> : (
            <>
              {dest.platform === "youtube" && x.title ? <p className="slide-title-text">{x.title}</p> : null}
              {x.caption ? <p className="slide-caption">{x.caption}</p> : null}
              <div className="row"><CopyButton text={composePostText(x)} label="Copy caption + hashtags" /></div>
              <details>
                <summary>Edit {PLATFORM_LABEL[dest.platform]} text</summary>
                <ActionForm action={saveExport} className="stack-sm" submit="Save" submitClass="btn small">
                  <input type="hidden" name="exportId" value={x.id} />
                  {dest.platform === "youtube" ? <label className="field">Title <input name="title" defaultValue={x.title} maxLength={100} /></label> : <input type="hidden" name="title" value={x.title} />}
                  <label className="field">Caption <textarea name="caption" defaultValue={x.caption} maxLength={2200} /></label>
                  <label className="field">Hashtags <input name="hashtags" defaultValue={x.hashtags} /></label>
                  <label className="field">Posting notes <textarea name="postingNotes" defaultValue={x.postingNotes} style={{ minHeight: 70 }} /></label>
                  <label className="check"><input type="checkbox" name="aiVoice" defaultChecked={!!x.disclosures?.aiVoice} /> <span>Synthetic (AI) narration</span></label>
                  <label className="check"><input type="checkbox" name="aiVisuals" defaultChecked={!!x.disclosures?.aiVisuals} /> <span>AI-generated visuals</span></label>
                  <label className="check"><input type="checkbox" name="branded" defaultChecked={!!x.disclosures?.branded} /> <span>Paid partnership / branded content</span></label>
                </ActionForm>
              </details>
            </>
          )}
        </div>
      ))}
      {full.current ? (
        <ActionForm action={regenerateText} className="row" submit="Regenerate titles, captions and hashtags from the script" submitClass="btn quiet small">
          <input type="hidden" name="episodeId" value={full.ep.id} />
        </ActionForm>
      ) : null}
    </div>
  );
}
