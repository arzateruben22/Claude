import type { Metadata } from "next";
import Link from "next/link";
import { uploadTasks } from "@/lib/data";
import { TaskCard } from "@/components/TaskCard";
import { DeskPosition } from "@/components/DeskPosition";

export const metadata: Metadata = { title: "Upload Desk" };

export default async function UploadDesk() {
  const v = await uploadTasks();
  const section = (title: string, list: typeof v.due, empty?: string) => (
    <section className="section">
      <div className="section-head"><h2 style={{ margin: 0 }}>{title}</h2><span className="num faint">{list.length}</span></div>
      {list.length ? <div className="stack">{list.map((t) => <TaskCard key={t.p.id} t={t} tz={v.tz} stopExternal={v.stopExternal} />)}</div> : empty ? <p className="muted">{empty}</p> : null}
    </section>
  );
  return (
    <div>
      <DeskPosition />
      <div className="kicker">Manual publishing</div>
      <h1>Upload Desk</h1>
      <p className="lede">Each task is one exact, approved video and text for one account. Share or download it, post it in the app, then mark it uploaded. Opening, downloading or sharing never counts as posted.</p>
      {v.paused ? <div className="notice">Publishing is paused in Settings: nothing new is planned.</div> : null}
      {section("Due today", v.due, "Nothing due today. Approved episodes can be planned from the calendar.")}
      {v.done.length ? section("Done today", v.done) : null}
      {section("Coming up", v.later)}
      {v.backlog.length ? (
        <section className="section">
          <div className="section-head"><h2 style={{ margin: 0 }}>Not scheduled</h2><span className="num faint">{v.backlog.length}</span></div>
          <p className="muted">These have no slot yet. <Link href="/calendar">Plan the week</Link> to give them one, or post one now.</p>
          <div className="stack">{v.backlog.slice(0, 6).map((t) => <TaskCard key={t.p.id} t={t} tz={v.tz} stopExternal={v.stopExternal} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
