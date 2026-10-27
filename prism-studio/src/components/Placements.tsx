// Per-account approval: each destination approves one exact export (video file + title, caption, hashtags,
// cover and disclosures). Editing any of it withdraws the approval; a newer render supersedes it.
import Link from "next/link";
import { approveExport, regenerateText, saveExport, withdrawApproval } from "@/app/actions";
import type { episodeFull } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { PLATFORM_LABEL, PUB_LABEL, pubTone, qaFails } from "@/lib/format";
import { ActionForm } from "./ActionForm";

type Full = NonNullable<Awaited<ReturnType<typeof episodeFull>>>;

export function Placements({ full, tz }: { full: Full; tz: string }) {
  const fails = full.current ? qaFails(full.current.qa) : null;
  const failList = fails ? ((full.current?.qa as { fails?: unknown[] } | null)?.fails ?? []).map(String) : [];
  return (
    <div className="stack" id="placements">
      {fails ? (
        <div className="notice bad">
          QA: {fails} check{fails === 1 ? "" : "s"} failed{failList.length ? ` (${failList.join("; ")})` : ""}. <Link href={`/episodes/${full.ep.id}#qa`}>See it</Link> before approving.
        </div>
      ) : null}
      {full.placements.map(({ dest, export: x, approval, lastRevoked, publication }) => (
        <div key={dest.id} className="card flat stack-sm">
          <div className="row spread">
            <div className="acct-line">
              <span className="label">{PLATFORM_LABEL[dest.platform]}{dest.shared ? " · shared" : ""}</span>
              {dest.handle || dest.displayName ? <b>{dest.handle || dest.displayName}</b> : <Link href="/connections" className="chip warn">Account not set up</Link>}
            </div>
            <div className="row">
              {publication && publication.status !== "planned" ? <span className={`chip ${pubTone(publication.status)}`}>{PUB_LABEL[publication.status]}</span> : null}
              {approval ? <span className="chip good">Approved · <span className="mono">{approval.contentHash.slice(0, 8)}</span></span> : null}
            </div>
          </div>
          {!x ? <p className="muted" style={{ margin: 0 }}>No {PLATFORM_LABEL[dest.platform]} export yet.</p> : (
            <>
              {!approval && lastRevoked ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>Last approval withdrawn {formatLocal(lastRevoked.revokedAt, tz)}: {lastRevoked.revokedReason}.</p> : null}
              <div className="row">
                {approval
                  ? <ActionForm action={withdrawApproval} submit="Withdraw approval" submitClass="btn quiet small"><input type="hidden" name="approvalId" value={approval.id} /></ActionForm>
                  : <ActionForm action={approveExport} submit={`Approve for ${dest.handle || PLATFORM_LABEL[dest.platform]}`} submitClass="btn small"
                      confirm={fails ? `QA reported ${fails} failed check${fails === 1 ? "" : "s"} on this render. Approve it for ${dest.handle || PLATFORM_LABEL[dest.platform]} anyway?` : undefined}>
                      <input type="hidden" name="exportId" value={x.id} /><input type="hidden" name="destinationId" value={dest.id} />
                    </ActionForm>}
              </div>
              <details>
                <summary>Edit {PLATFORM_LABEL[dest.platform]} text{approval ? " (withdraws the approval)" : ""}</summary>
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
