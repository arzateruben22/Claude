// The owner's "Uploaded" buttons. The owner posts by hand, then presses the one that matches where it went:
// "Uploaded on YouTube & TikTok" or "Uploaded on Instagram" for an episode, "Uploaded on YouTube" for a long video.
// That records owner-reported posts (audit-logged, undoable); nothing posts by itself. Once pressed, the control shows
// "✓ Uploaded on … · date" with a small Undo. One render (UploadedButton) for both, so they look and work alike.
import type { ReactNode } from "react";
import { lessonUploadedAction, undoLessonUploadedAction, undoUploadedAction, uploadedAction } from "@/app/actions";
import { formatLocal } from "@/domain/time";
import { allPosted, type UploadGroup } from "@/domain/publications";
import { lessonUploadBlocker } from "@/domain/lessons";
import { lessonUploaded } from "@/domain/season-archive";
import { ActionForm } from "./ActionForm";

export const GROUP_LABEL: Record<UploadGroup, string> = { youtube_tiktok: "YouTube & TikTok", instagram: "Instagram" };
export const groupOf = (platform: string): UploadGroup => (platform === "instagram" ? "instagram" : "youtube_tiktok");
type PubLite = { status: string; reportedAt: Date | null; simulated?: boolean } | null | undefined;

/** Uploaded for a group = it has real rows and every one of them is reported (allPosted, the domain's one test).
 *  Returns the latest report date. */
export function uploadedState(pubs: PubLite[]): { done: boolean; at: Date | null } {
  const real = pubs.filter((p): p is NonNullable<PubLite> => !!p && !p.simulated);
  const done = allPosted(real);
  const at = real.map((p) => p.reportedAt).filter((x): x is Date => !!x).sort((a, b) => +b - +a)[0] ?? null;
  return { done, at };
}

/** The button, or once pressed "✓ Uploaded on … · date" with Undo. `fields` are the hidden inputs both forms send. */
function UploadedButton({ label, done, at, tz, mark, undo, fields }: {
  label: string; done: boolean; at: Date | null; tz: string; mark: typeof uploadedAction; undo: typeof undoUploadedAction; fields: ReactNode;
}) {
  if (done) {
    return (
      <div className="row uploaded-done">
        <span className="btn approved" role="status"><span aria-hidden>✓</span> Uploaded on {label}{at ? ` · ${formatLocal(at, tz, { month: "short", day: "numeric" })}` : ""}</span>
        <ActionForm action={undo} submit="Undo" submitClass="btn quiet small">{fields}</ActionForm>
      </div>
    );
  }
  return <ActionForm action={mark} submit={`Uploaded on ${label}`} submitClass="btn block">{fields}</ActionForm>;
}

export function UploadedControl({ episodeId, group, pubs, tz }: { episodeId: string; group: UploadGroup; pubs: PubLite[]; tz: string }) {
  const { done, at } = uploadedState(pubs);
  return (
    <UploadedButton label={GROUP_LABEL[group]} done={done} at={at} tz={tz} mark={uploadedAction} undo={undoUploadedAction}
      fields={<><input type="hidden" name="episodeId" value={episodeId} /><input type="hidden" name="group" value={group} /></>} />
  );
}

/** A long video's "Uploaded on YouTube" (markLessonUploaded): uploaded = the owner pressed it (state published).
 *  Any real, built long video gets it, whatever its approval; a demo or unbuilt one gets none. */
export function LessonUploadedControl({ lesson: l, tz }: { lesson: { id: string; state: string; reportedAt: Date | null; isDemo: boolean; isTestFixture: boolean; videoPath: string }; tz: string }) {
  if (lessonUploadBlocker(l)) return null;
  return (
    <UploadedButton label="YouTube" done={lessonUploaded(l)} at={l.reportedAt} tz={tz} mark={lessonUploadedAction} undo={undoLessonUploadedAction}
      fields={<input type="hidden" name="lessonId" value={l.id} />} />
  );
}

/** The long video's button with the episodes' panel around it ("After you post it … by hand", "Nothing posts by
 *  itself"), for the Lessons tab and the long-video cards. */
export function LessonUploadedPanel({ lesson, tz, account }: { lesson: Parameters<typeof LessonUploadedControl>[0]["lesson"]; tz: string; account?: string }) {
  if (lessonUploadBlocker(lesson)) return null;
  return (
    <div className="uploaded-panel stack-sm">
      <div className="label">After you post it on {account || "YouTube"} by hand</div>
      <div className="uploaded-bar"><LessonUploadedControl lesson={lesson} tz={tz} /></div>
      <p className="faint" style={{ margin: 0, fontSize: 13 }}>As a regular video (not Shorts), with the AI label on and the chapters in the description. Nothing posts by itself: this button only records what you did.</p>
    </div>
  );
}
