// Home: the monitor wall. The New York night behind six monitors: Instagram in the middle, a monitor per channel
// around it. Each monitor shows the next thing to post and opens its extension (/m/[slug]).
import Link from "next/link";
import { rigView } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { MonitorRig } from "@/components/MonitorRig";
import { Wallpaper } from "@/components/Wallpaper";

export default async function Home() {
  const v = await rigView();
  const day = formatLocal(new Date(), v.tz, { weekday: "long", month: "long", day: "numeric" });
  const dayShort = formatLocal(new Date(), v.tz, { month: "short", day: "numeric" });
  // the day's one line, from the same data as the monitors: uploads due, then Instagram slots still to plan (the two
  // a day), and "Nothing due today" only when neither is waiting
  const ig = v.instagram, slots = `${ig.toPlan} Instagram slot${ig.toPlan === 1 ? "" : "s"} to plan${ig.day === "tomorrow" ? " for tomorrow" : ""}`;
  const first = v.dueToday ? <span>{v.dueToday} to upload today</span>
    : ig.toPlan ? <span><Link href="/calendar">{slots}</Link></span>
    : <span className="quiet-bit">Nothing due today</span>;
  return (
    <div className="home">
      <Wallpaper variant="crisp" />
      <header className="home-head">
        <h1 className="home-brand">Prism <span>Studio</span></h1>
        <p className="home-meta">
          <span><span className="day-long">{day}</span><span className="day-short">{dayShort}</span></span>
          {first}
          {v.reviewCount ? <span><Link href="/review">{v.reviewCount} to review</Link></span> : null}
          {v.longToApprove.length ? <span><Link href={`/m/${v.longToApprove[0].slug}#long-video`}>{v.longToApprove.length} long video{v.longToApprove.length === 1 ? "" : "s"} to approve</Link></span> : null}
          {v.paused ? <span>Publishing paused</span> : null}
        </p>
      </header>
      {v.unseenEvolutions.length || v.unseenAchievements.length ? (
        <p className="home-note">
          {v.unseenEvolutions.length ? <>A creation evolved: <Link href={`/evolution/${v.unseenEvolutions[0].slug}`}>see it</Link>. </> : null}
          {v.unseenAchievements.length ? <>Unlocked {v.unseenAchievements.map((a) => a.title + (a.demo ? " (demo)" : "")).join(", ")}: <Link href="/rewards">trophy shelf</Link>.</> : null}
        </p>
      ) : null}
      <MonitorRig v={v} />
    </div>
  );
}
