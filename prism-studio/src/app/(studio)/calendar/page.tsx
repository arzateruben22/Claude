import type { Metadata } from "next";
import Link from "next/link";
import { calendar } from "@/lib/data";
import { formatLocal, localDate, zonedTimeToUtc } from "@/domain/time";
import { DEFAULT_WINDOWS } from "@/domain/schedule";
import { PLATFORM_LABEL, PUB_LABEL, pubTone, topicStyle } from "@/lib/format";
import { addBlackout, planWeek, unplan } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";

export const metadata: Metadata = { title: "Calendar" };

export default async function Calendar() {
  const v = await calendar(7);
  return (
    <div>
      <div className="kicker">Times in {v.tz.replace("_", " ")}</div>
      <h1>Calendar</h1>
      <p className="lede">One Short per channel a day on YouTube and TikTok, staggered so uploads don&apos;t pile up, and {v.settings.instagramDaily} a day on the shared Instagram. A missed upload moves to the next free day: never a catch-up burst.</p>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <ActionForm action={planWeek} className="card stack-sm" submit="Plan the next 7 days" submitClass="btn">
          <input type="hidden" name="days" value="7" />
          <h3>Plan the week</h3>
          <p className="muted" style={{ margin: 0 }}>{v.backlog} unscheduled task{v.backlog === 1 ? "" : "s"} in the backlog. Planning fills open slots in episode order; each still needs its approval before you can mark it uploaded.</p>
        </ActionForm>
        <ActionForm action={addBlackout} className="card stack-sm" submit="Add blackout" submitClass="btn ghost">
          <h3>Blackout days</h3>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 1 }}>From <input type="date" name="from" required /></label>
            <label className="field" style={{ flex: 1 }}>To <input type="date" name="to" required /></label>
          </div>
          <label className="field">Note <input name="note" placeholder="Travel, holiday…" /></label>
          {v.blackouts.length ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>{v.blackouts.map((b) => `${formatLocal(b.startsAt, v.tz, { dateStyle: "medium" })} → ${formatLocal(new Date(+b.endsAt - 1), v.tz, { dateStyle: "medium" })}${b.note ? ` (${b.note})` : ""}`).join(" · ")}</p> : null}
        </ActionForm>
      </div>
      <div className="stack">
        {v.days.map((day) => {
          const rows = v.rows.filter((r) => r.p.scheduledFor && localDate(r.p.scheduledFor, v.tz) === day);
          const dark = v.blackouts.some((b) => b.startsAt <= zonedTimeToUtc(day, "12:00", v.tz) && b.endsAt > zonedTimeToUtc(day, "12:00", v.tz));
          return (
            <section key={day} className="card stack-sm" aria-label={day}>
              <div className="row spread">
                <h3 style={{ margin: 0 }}>{day === v.today ? "Today" : formatLocal(zonedTimeToUtc(day, "12:00", v.tz), v.tz, { weekday: "long", month: "short", day: "numeric" })}</h3>
                <span className="faint num">{dark ? "blackout" : `${rows.length} task${rows.length === 1 ? "" : "s"}`}</span>
              </div>
              {rows.length ? (
                <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {rows.map((r) => (
                    <li key={r.p.id} className="row spread" style={topicStyle(r.channel)}>
                      <span className="row" style={{ gap: 10 }}>
                        <span className="num" style={{ minWidth: 64 }}>{formatLocal(r.p.scheduledFor, v.tz, { timeStyle: "short" })}</span>
                        <span className="chip topic">{r.dest.shared ? "IG" : r.channel.label} · {PLATFORM_LABEL[r.dest.platform]}</span>
                        <Link href={`/episodes/${r.e.id}`}>{r.e.title}</Link>{r.e.isDemo ? <span className="demo-tag">DEMO</span> : null}
                      </span>
                      <span className="row">
                        <span className={`chip ${pubTone(r.p.status)}`}>{PUB_LABEL[r.p.status]}</span>
                        {["planned", "ready", "handed_off"].includes(r.p.status) ? <form action={unplan}><input type="hidden" name="publicationId" value={r.p.id} /><button className="btn ghost small">Unplan</button></form> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="faint" style={{ margin: 0 }}>{dark ? "Nothing is planned during a blackout." : "Open."}</p>}
            </section>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 13, marginTop: 18 }}>Default windows (provisional, not claimed to be optimal): YouTube {DEFAULT_WINDOWS.youtube.join(", ")}, TikTok {DEFAULT_WINDOWS.tiktok.join(", ")}, Instagram {DEFAULT_WINDOWS.instagram.slice(0, v.settings.instagramDaily).join(", ")}; channels stagger by 20 minutes. Analytics will tell us better times.</p>
    </div>
  );
}
