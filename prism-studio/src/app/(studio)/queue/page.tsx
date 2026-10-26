import type { Metadata } from "next";
import { jobsList, studio } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { cancelJob, queueJob, retryJob } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";

export const metadata: Metadata = { title: "Queue" };
const TONE: Record<string, string> = { succeeded: "good", running: "info", queued: "", failed: "warn", dead: "bad", cancelled: "", blocked: "bad" };

export default async function Queue() {
  const [jobs, s] = await Promise.all([jobsList(), studio()]);
  const running = jobs.filter((j) => j.status === "running");
  const lastBeat = running.map((j) => j.heartbeatAt).filter(Boolean).sort().at(-1);
  return (
    <div>
      <div className="kicker">Background work</div>
      <h1>Queue</h1>
      <p className="lede">Long jobs run in the worker (<span className="mono">npm run worker</span>), one at a time per channel so no channel starves the others. Failed jobs retry with growing waits, then stop in the dead-letter list for you.</p>
      <div className="grid2">
        <ActionForm action={queueJob} className="card stack-sm" submit="Queue it" submitClass="btn">
          <h3>Run a job</h3>
          <select name="type" aria-label="Job type" defaultValue="import_episodes">
            <option value="import_episodes">Import rendered episodes from the films repo</option>
            <option value="reschedule_missed">Move missed uploads to the next free day</option>
            <option value="refresh_evolution">Re-check every creation&apos;s evolution</option>
          </select>
        </ActionForm>
        <div className="card stack-sm">
          <h3>Worker</h3>
          <p className="muted" style={{ margin: 0 }}>{running.length ? `${running.length} running · last heartbeat ${formatLocal(lastBeat, s.timezone, { timeStyle: "medium" })}` : "Nothing running right now."}</p>
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>Paid generation is {s.paidGenerationEnabled ? "on" : "off"}. Rendering uses the local cinema kit (no paid services).</p>
        </div>
      </div>
      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Recent jobs</h2></div>
        {!jobs.length ? <p className="muted">No jobs yet.</p> : (
          <div className="scroll-x"><table className="t">
            <thead><tr><th>Job</th><th>Status</th><th>Tries</th><th>Updated</th><th /></tr></thead>
            <tbody>{jobs.map((j) => (
              <tr key={j.id}>
                <td><b>{j.type.replace(/_/g, " ")}</b>{j.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}<div className="faint" style={{ fontSize: 13 }}>{j.error || j.message}{j.progress != null && j.status === "running" ? ` · ${Math.round(j.progress * 100)}%` : ""}</div></td>
                <td><span className={`chip ${TONE[j.status]}`}>{j.status}</span></td>
                <td className="num">{j.attempts}/{j.maxAttempts}</td>
                <td className="num">{formatLocal(j.updatedAt, s.timezone, { dateStyle: "short", timeStyle: "short" })}</td>
                <td>
                  {["failed", "dead", "cancelled"].includes(j.status) ? <form action={retryJob}><input type="hidden" name="jobId" value={j.id} /><button className="btn ghost small">Retry</button></form> : null}
                  {["queued", "running"].includes(j.status) && !j.cancelRequested ? <form action={cancelJob}><input type="hidden" name="jobId" value={j.id} /><button className="btn danger small">Cancel</button></form> : null}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
