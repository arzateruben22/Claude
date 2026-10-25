// Per-account approval: each destination approves one exact export (video file + title, caption, hashtags,
// cover and disclosures). Editing any of it withdraws the approval; a newer render supersedes it.
import { approveExport, saveExport, withdrawApproval } from "@/app/actions";
import type { episodeFull } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { PLATFORM_LABEL, PUB_LABEL, pubTone } from "@/lib/format";
import { ActionForm } from "./ActionForm";

type Full = NonNullable<Awaited<ReturnType<typeof episodeFull>>>;

export function Placements({ full, tz }: { full: Full; tz: string }) {
  return (
    <div className="stack" id="placements">
      {full.placements.map(({ dest, export: x, approval, lastRevoked, publication }) => (
        <div key={dest.id} className="card flat stack-sm">
          <div className="row spread">
            <div>
              <div className="kicker">{PLATFORM_LABEL[dest.platform]}{dest.shared ? " · shared" : ""}</div>
              <div style={{ fontWeight: 650 }}>{dest.handle || dest.displayName || <span className="muted">Account not set up</span>}</div>
            </div>
            <div className="row">
              {publication ? <span className={`chip ${pubTone(publication.status)}`}>{PUB_LABEL[publication.status]}</span> : null}
              {approval ? <span className="chip good">Approved · {approval.contentHash.slice(0, 8)}</span> : <span className="chip warn">Not approved</span>}
            </div>
          </div>
          {!x ? <p className="muted" style={{ margin: 0 }}>No {PLATFORM_LABEL[dest.platform]} export yet.</p> : (
            <>
              {!approval && lastRevoked ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>Last approval withdrawn {formatLocal(lastRevoked.revokedAt, tz)}: {lastRevoked.revokedReason}.</p> : null}
              <div className="row">
                {approval
                  ? <ActionForm action={withdrawApproval} submit="Withdraw approval" submitClass="btn ghost small"><input type="hidden" name="approvalId" value={approval.id} /></ActionForm>
                  : <ActionForm action={approveExport} submit={`Approve for ${dest.handle || PLATFORM_LABEL[dest.platform]}`} submitClass="btn topic small">
                      <input type="hidden" name="exportId" value={x.id} /><input type="hidden" name="destinationId" value={dest.id} />
                    </ActionForm>}
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Edit {PLATFORM_LABEL[dest.platform]} text{approval ? " (withdraws the approval)" : ""}</summary>
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
    </div>
  );
}
