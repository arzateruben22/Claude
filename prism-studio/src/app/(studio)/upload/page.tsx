import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isReady, uploadTasks } from "@/lib/data";
import { TaskCard } from "@/components/TaskCard";
import { DeskPosition } from "@/components/DeskPosition";
import { PlanWeek } from "@/components/PlanWeek";

export const metadata: Metadata = { title: "Upload Desk" };

// Every rendered episode that is not uploaded yet gets a full card, by when it is due (no approval step). You post it by
// hand, then press "Uploaded on YouTube & TikTok" or "Uploaded on Instagram". A task with no current render is not listed.
export default async function UploadDesk() {
  const v = await uploadTasks();
  const card = (t: (typeof v.due)[number]) => <TaskCard key={t.p.id} t={t} tz={v.tz} stopExternal={v.stopExternal} connected={t.connected} />;
  const due = v.due.filter(isReady), later = v.later.filter(isReady), backlog = v.backlog.filter(isReady);
  const section = (title: string, list: typeof v.due, note?: ReactNode) => list.length ? (
    <section className="section">
      <div className="section-head"><h2>{title}</h2></div>
      {note}
      <div className="stack">{list.map(card)}</div>
    </section>
  ) : null;
  return (
    <div>
      <DeskPosition />
      <div className="kicker">Manual publishing</div>
      <h1>Upload Desk</h1>
      <p className="lede">Each task is one rendered video and its text for one account. Share or download it, post it in the app, then press the Uploaded button for where you posted it. Nothing posts by itself, and opening, downloading or sharing never counts as posted.</p>
      {v.paused ? <div className="notice">Publishing is paused in Settings: nothing new is planned.</div> : null}
      {!due.length && !later.length && !backlog.length && !v.done.length
        ? <div className="note-row spaced"><p className="faint">Nothing rendered is waiting to be uploaded. Plan the week once episodes are rendered.</p><PlanWeek /></div> : null}
      {section("Due today", due)}
      {section("Done today", v.done)}
      {section("Coming up", later)}
      {section("Not scheduled", backlog, <div className="note-row spaced"><p className="muted">These have no slot yet: plan the week to give them one, or post one now.</p><PlanWeek /></div>)}
    </div>
  );
}
