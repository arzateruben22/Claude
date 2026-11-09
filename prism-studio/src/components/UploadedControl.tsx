// The owner's "Uploaded" buttons. The owner posts by hand, then presses the one that matches where it went:
// "Uploaded on YouTube & TikTok" or "Uploaded on Instagram". That records owner-reported posts (audit-logged, undoable);
// nothing posts by itself. Once pressed, the control shows "✓ Uploaded on … · date" with a small Undo.
import { undoUploadedAction, uploadedAction } from "@/app/actions";
import { formatLocal } from "@/domain/time";
import type { UploadGroup } from "@/domain/publications";
import { ActionForm } from "./ActionForm";

export const GROUP_LABEL: Record<UploadGroup, string> = { youtube_tiktok: "YouTube & TikTok", instagram: "Instagram" };
export const groupOf = (platform: string): UploadGroup => (platform === "instagram" ? "instagram" : "youtube_tiktok");
const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];
type PubLite = { status: string; reportedAt: Date | null; simulated?: boolean } | null | undefined;

/** Uploaded for a group = it has real rows and every one of them is reported. Returns the latest report date. */
export function uploadedState(pubs: PubLite[]): { done: boolean; at: Date | null } {
  const real = pubs.filter((p): p is NonNullable<PubLite> => !!p && !p.simulated);
  const done = real.length > 0 && real.every((p) => POSTED.includes(p.status));
  const at = real.map((p) => p.reportedAt).filter((x): x is Date => !!x).sort((a, b) => +b - +a)[0] ?? null;
  return { done, at };
}

export function UploadedControl({ episodeId, group, pubs, tz }: { episodeId: string; group: UploadGroup; pubs: PubLite[]; tz: string }) {
  const label = GROUP_LABEL[group];
  const { done, at } = uploadedState(pubs);
  if (done) {
    return (
      <div className="row uploaded-done">
        <span className="btn approved" role="status"><span aria-hidden>✓</span> Uploaded on {label}{at ? ` · ${formatLocal(at, tz, { month: "short", day: "numeric" })}` : ""}</span>
        <ActionForm action={undoUploadedAction} submit="Undo" submitClass="btn quiet small">
          <input type="hidden" name="episodeId" value={episodeId} /><input type="hidden" name="group" value={group} />
        </ActionForm>
      </div>
    );
  }
  return (
    <ActionForm action={uploadedAction} submit={`Uploaded on ${label}`} submitClass="btn block">
      <input type="hidden" name="episodeId" value={episodeId} /><input type="hidden" name="group" value={group} />
    </ActionForm>
  );
}
