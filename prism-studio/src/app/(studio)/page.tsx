// Home: the monitor wall. The New York night behind six monitors: Instagram in the middle, a monitor per channel
// around it. Each monitor shows the next thing to post and opens its extension (/m/[slug]). Long videos not yet
// recorded as uploaded get a small card above the wall with their "Uploaded on YouTube" buttons, newest season first;
// one just recorded stays below them with its Undo for 24 hours, then moves to its channel's Published tab.
import Link from "next/link";
import { rigView, type RigView } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { topicStyle } from "@/lib/format";
import { LessonUploadedControl } from "@/components/UploadedControl";
import { MonitorRig } from "@/components/MonitorRig";
import { Wallpaper } from "@/components/Wallpaper";

/** One long video on the Home card: "Skin Sense · S3" (or "Vol 1" when its season isn't known), its title and its button. */
function LongRow({ x: { lesson: l, channel: c, label }, tz }: { x: RigView["longVideos"][number]; tz: string }) {
  return (
    <li style={topicStyle(c)}>
      <span className="home-long-title"><span className="kicker topic-text">{c.label} · {label}</span><Link href={`/m/${c.slug}#long-video`}>{l.title}</Link></span>
      <span className="uploaded-bar"><LessonUploadedControl lesson={l} tz={tz} /></span>
    </li>
  );
}

export default async function Home() {
  const v = await rigView();
  const day = formatLocal(new Date(), v.tz, { weekday: "long", month: "long", day: "numeric" });
  const dayShort = formatLocal(new Date(), v.tz, { month: "short", day: "numeric" });
  // the day's one line, from the same data as the monitors: uploads due, then Instagram slots still to plan (the two
  // a day), and "Nothing due today" only when neither is waiting
  const ig = v.instagram, slots = `${ig.toPlan} Instagram slot${ig.toPlan === 1 ? "" : "s"} to plan${ig.day === "tomorrow" ? " for tomorrow" : ""}`;
  const first = v.dueToday ? <span>{v.dueToday} to upload today</span>
    : ig.toPlan ? <span><Link href="/m/instagram">{slots}</Link></span>
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
          {v.longToUpload.length ? <span><a href="#long-videos">{v.longToUpload.length} long video{v.longToUpload.length === 1 ? "" : "s"} to upload</a></span> : null}
          {v.paused ? <span>Publishing paused</span> : null}
        </p>
      </header>
      {v.unseenEvolutions.length || v.unseenAchievements.length ? (
        <p className="home-note">
          {v.unseenEvolutions.length ? <>A creation evolved: <Link href={`/evolution/${v.unseenEvolutions[0].slug}`}>see it</Link>. </> : null}
          {v.unseenAchievements.length ? <>Unlocked {v.unseenAchievements.map((a) => a.title + (a.demo ? " (demo)" : "")).join(", ")}: <Link href="/rewards">trophy shelf</Link>.</> : null}
        </p>
      ) : null}
      {v.longVideos.length ? (
        <section id="long-videos" className="card home-longs" aria-labelledby="home-longs-h">
          <div className="home-longs-head"><h2 id="home-longs-h">Long videos</h2><span className="faint">YouTube · a regular video, not Shorts</span></div>
          {v.longToUpload.length ? <ul>{v.longToUpload.map((x) => <LongRow key={x.lesson.id} x={x} tz={v.tz} />)}</ul> : null}
          {v.longToUpload.length ? <p className="faint">Post it on YouTube by hand, then press its button. Nothing posts by itself: the button only records what you did.</p> : null}
          {v.longJustUploaded.length ? (
            <div className="home-longs-done">
              <div className="kicker">Just uploaded · moves to Published after 24 h</div>
              <ul>{v.longJustUploaded.map((x) => <LongRow key={x.lesson.id} x={x} tz={v.tz} />)}</ul>
            </div>
          ) : null}
        </section>
      ) : null}
      <MonitorRig v={v} />
    </div>
  );
}
