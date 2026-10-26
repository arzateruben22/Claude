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
  const bits = [
    v.dueToday ? `${v.dueToday} to upload today` : "Nothing due today",
    v.reviewCount ? `${v.reviewCount} to review` : null,
    v.paused ? "Publishing paused" : null,
  ].filter(Boolean);
  return (
    <div className="home">
      <Wallpaper variant="crisp" />
      <header className="home-head">
        <h1 className="home-brand">Prism <span>Studio</span></h1>
        <p className="home-meta"><span>{day}</span><span>{bits.join(" · ")}</span></p>
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
