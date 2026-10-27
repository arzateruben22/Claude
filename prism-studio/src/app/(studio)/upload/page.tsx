import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { isReady, uploadTasks } from "@/lib/data";
import { TaskCard, TaskRow } from "@/components/TaskCard";
import { DeskPosition } from "@/components/DeskPosition";

export const metadata: Metadata = { title: "Upload Desk" };

// Approved tasks get full cards, by when they are due; tasks still waiting for an approval are compact rows under one
// "Waiting for approval" list (open when one of them is due today).
export default async function UploadDesk() {
  const v = await uploadTasks();
  const card = (t: (typeof v.due)[number]) => <TaskCard key={t.p.id} t={t} tz={v.tz} stopExternal={v.stopExternal} connected={t.connected} />;
  const due = v.due.filter(isReady), later = v.later.filter(isReady), backlog = v.backlog.filter(isReady);
  const waiting = [...v.due, ...v.later, ...v.backlog].filter((t) => !isReady(t));
  const waitingDue = v.due.some((t) => !isReady(t));
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
      <p className="lede">Each task is one exact, approved video and text for one account. Share or download it, post it in the app, then mark it uploaded. Opening, downloading or sharing never counts as posted.</p>
      {v.paused ? <div className="notice">Publishing is paused in Settings: nothing new is planned.</div> : null}
      {!due.length && !later.length && !backlog.length && !v.done.length
        ? <div className="note-row spaced"><p className="faint">{waiting.length ? "Nothing approved to post yet." : "Nothing due today or coming up."} Plan the week once episodes are approved.</p><Link href="/calendar" className="btn ghost small">Plan the week</Link></div> : null}
      {section("Due today", due)}
      {section("Done today", v.done)}
      {section("Coming up", later)}
      {section("Not scheduled", backlog, <div className="note-row spaced"><p className="muted">These have no slot yet: plan the week to give them one, or post one now.</p><Link href="/calendar" className="btn ghost small">Plan the week</Link></div>)}
      {waiting.length ? (
        <section className="section">
          <details className="waiting" open={waitingDue || undefined}>
            <summary><span className="h2">Waiting for approval</span> <span className="faint">{waiting.length} post{waiting.length === 1 ? "" : "s"}{waitingDue ? " · some due today" : ""}</span></summary>
            <div className="note-row"><p className="muted">Approve each account&apos;s exact video and text on Review; the full upload card appears here once it&apos;s approved.</p><Link href="/review" className="btn ghost small">Review</Link></div>
            <div className="card flush"><ul className="q">{waiting.map((t) => <TaskRow key={t.p.id} t={t} tz={v.tz} />)}</ul></div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
