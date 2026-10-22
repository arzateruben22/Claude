import { Check, Minus, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekDayView } from "@/lib/game/views";

const fmt = (n: number) => n.toLocaleString("en-US");

function dayState(d: WeekDayView): { label: string; tone: string } {
  if (d.restDay) return { label: "Rest day", tone: "text-info" };
  if (d.active) return { label: "Active", tone: "text-success" };
  if (d.isFuture) return { label: "Upcoming", tone: "text-fg-subtle" };
  if (d.isToday) return { label: "Today", tone: "text-accent" };
  if (!d.workday) return { label: "Day off", tone: "text-fg-subtle" };
  return { label: "No activity", tone: "text-fg-subtle" };
}

/** 7-day activity strip (Monday–Sunday) plus a readable per-day breakdown. */
export function WeekStrip({ days }: { days: WeekDayView[] }) {
  return (
    <section aria-labelledby="week-strip-title" className="glass rounded-card p-5">
      <h2 id="week-strip-title" className="text-sm font-medium tracking-tight">
        This week&apos;s activity
      </h2>
      <ol className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Days of this week">
        {days.map((d) => {
          const s = dayState(d);
          return (
            <li
              key={d.key}
              aria-current={d.isToday ? "date" : undefined}
              data-testid="week-day"
              data-active={d.active ? "true" : "false"}
              className={cn(
                "flex flex-col items-center rounded-ctl border px-1 py-2 text-center min-w-0",
                d.isToday ? "border-accent/60 bg-accent-soft" : "border-line bg-bg-elevated/40",
                !d.workday && !d.active && "opacity-70",
              )}
            >
              <span className="text-[11px] text-fg-muted">{d.weekday}</span>
              <span className="text-xs font-medium tnum">{d.dateLabel.split(" ")[1]}</span>
              <span
                className={cn(
                  "mt-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full",
                  d.restDay ? "bg-info-soft text-info" : d.active ? "bg-success-soft text-success" : "bg-surface-strong text-fg-subtle",
                )}
                aria-hidden
              >
                {d.restDay ? <Moon className="h-3.5 w-3.5" /> : d.active ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              </span>
              <span className="sr-only">{s.label}</span>
              <span className="mt-1 text-[11px] tnum text-fg-muted" title="Applications">
                {d.applications}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-fg-subtle">Number under each day: applications logged that day.</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-xs">
          <caption className="sr-only">Activity by day</caption>
          <thead>
            <tr className="text-left text-fg-subtle">
              <th scope="col" className="py-1.5 pr-2 font-medium">
                Day
              </th>
              <th scope="col" className="py-1.5 pr-2 font-medium">
                Status
              </th>
              <th scope="col" className="py-1.5 pr-2 font-medium text-right">
                Applications
              </th>
              <th scope="col" className="py-1.5 pr-2 font-medium text-right">
                Follow-ups
              </th>
              <th scope="col" className="py-1.5 pr-2 font-medium text-right">
                Lessons
              </th>
              <th scope="col" className="py-1.5 font-medium text-right">
                XP
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const s = dayState(d);
              return (
                <tr key={d.key} className={cn("border-t border-line", d.isToday && "bg-accent-soft/40")}>
                  <th scope="row" className="py-1.5 pr-2 font-normal text-fg">
                    {d.weekday} {d.dateLabel}
                  </th>
                  <td className={cn("py-1.5 pr-2", s.tone)}>{s.label}</td>
                  <td className="py-1.5 pr-2 text-right tnum">{fmt(d.applications)}</td>
                  <td className="py-1.5 pr-2 text-right tnum">{fmt(d.followUps)}</td>
                  <td className="py-1.5 pr-2 text-right tnum">{fmt(d.lessons)}</td>
                  <td className="py-1.5 text-right tnum">{fmt(d.xp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
