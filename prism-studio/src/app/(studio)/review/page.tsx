import type { Metadata } from "next";
import Link from "next/link";
import { reviewQueue, studio } from "@/lib/data";
import { STATE_LABEL, stateTone } from "@/lib/format";
import { ReviewSlide } from "@/components/ReviewSlide";
import { ReelNav } from "@/components/ReelNav";
import { ChannelSwitch } from "@/components/ChannelSwitch";
import { channelJumps } from "@/lib/channel-jump";

export const metadata: Metadata = { title: "Review" };

// On a phone, Review is a full-screen reel: one episode at a time, swipe or tap to step, the Uploaded buttons at the
// thumb. On a desktop the same slides stack as cards (video beside the accounts).
export default async function Review() {
  const [queue, s] = await Promise.all([reviewQueue(), studio()]);
  const step = (i: number) => (queue[i] ? { href: `#ep-${queue[i].ep.id}`, label: queue[i].ep.title } : null);
  const jumps = channelJumps(queue);
  return (
    <div className={queue.length ? "reel-page" : undefined}>
      <header className="reel-intro">
        <div className="kicker">Watch, then post by hand</div>
        <h1>Review</h1>
        <p className="lede">Watch it, check the sources, post it by hand, then press the Uploaded button for where you posted it. Nothing posts by itself.</p>
      </header>
      {jumps.length ? <ChannelSwitch channels={jumps} /> : null}
      {!queue.length ? <div className="card"><p className="muted" style={{ margin: 0 }}>Nothing waiting. Episodes arrive here when their final render passes quality checks.</p></div> : (
        <div className="reel" id="reel">
          {queue.map((f, i) => (
            <ReviewSlide key={f.ep.id} full={f} tz={s.timezone} prev={step(i - 1)} next={step(i + 1)} position={{ n: i + 1, of: queue.length }} preload={i < 2 ? "metadata" : "none"}
              head={<>
                <h2 className="slide-title"><Link href={`/episodes/${f.ep.id}`}>{f.ep.title}</Link>{f.ep.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</h2>
                {f.ep.state !== "ready_for_review" ? <span className={`chip ${stateTone(f.ep.state)}`}>{STATE_LABEL[f.ep.state]}</span> : null}
              </>} />
          ))}
          <ReelNav id="reel" />
        </div>
      )}
    </div>
  );
}
