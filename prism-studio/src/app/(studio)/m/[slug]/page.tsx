// A monitor's extension: the full screen for one channel (its YouTube and TikTok) or for the shared Instagram.
// Top to bottom: the six monitors in miniature, the next post for each account, then the queue and the series
// (channels) or today's slots, the rotation and the never-repeats ledger (Instagram).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { channelBySlug, channelExtension, coverOf, instagramExtension, rigView, smallCover, type PostItem } from "@/lib/data";
import { INSTAGRAM_SLUG } from "@/lib/rig";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { PLATFORM_LABEL, PUB_LABEL, pubTone, STATE_LABEL, stateTone, topicStyle } from "@/lib/format";
import { MonitorStrip } from "@/components/MonitorStrip";
import { PostCard } from "@/components/PostCard";
import { Icon } from "@/components/Icon";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === INSTAGRAM_SLUG) return { title: "Instagram" };
  const c = await channelBySlug(slug);
  return { title: c?.name.replace(/ \(name TBD\)$/, "") ?? "Monitor" };
}

export default async function Extension({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rig = await rigView();
  if (!rig.monitors.some((m) => m.slug === slug)) notFound();
  return (
    <div className="ext">
      <MonitorStrip monitors={rig.monitors} current={slug} />
      {slug === INSTAGRAM_SLUG ? <InstagramScreen /> : <ChannelScreen slug={slug} />}
    </div>
  );
}

/** One queued post: cover, title, where, when, and only the states the row doesn't already say. On the Instagram screen
 *  the account is implied, so "where" is the channel. */
function QueueRow({ t, tz }: { t: PostItem; tz: string }) {
  const cover = smallCover(coverOf(t));
  return (
    <li className="q-row" style={topicStyle(t.channel)}>
      <span className="q-cover" aria-hidden>{cover ? <img src={mediaUrl(cover)} alt="" decoding="async" loading="lazy" /> : null}</span>
      <Link href={`/episodes/${t.e.id}`} className="q-title">{t.e.title}</Link>
      <span className="q-where">{t.dest.shared ? t.channel.label : PLATFORM_LABEL[t.dest.platform]}</span>
      <span className="q-when num">{t.p?.scheduledFor ? formatLocal(t.p.scheduledFor, tz, { weekday: "short", hour: "numeric", minute: "2-digit" }) : t.p ? "Not scheduled" : "In rotation"}</span>
      <span className="q-chips">
        {t.p && t.p.status !== "planned" ? <span className={`chip ${pubTone(t.p.status)}`}>{PUB_LABEL[t.p.status]}</span> : null}
        {t.approval ? <span className="chip good">Approved</span> : <Link href={`/episodes/${t.e.id}#placements`} className="chip warn">Needs approval</Link>}
      </span>
    </li>
  );
}

async function ChannelScreen({ slug }: { slug: string }) {
  const v = await channelExtension(slug);
  if (!v) notFound();
  const c = v.channel;
  const name = c.name.replace(/ \(name TBD\)$/, "");
  const scheduled = v.upcoming.filter((t) => t.p?.scheduledFor), unscheduled = v.upcoming.filter((t) => !t.p?.scheduledFor);
  const noEpisodes = !v.series.length && !v.loose.length;
  const unset = v.accounts.filter((a) => !a.dest.handle);
  return (
    <div style={topicStyle(c)}>
      <header className="ext-head">
        <div className="kicker topic-text">{c.label} · YouTube + TikTok{c.nameProvisional ? " · working name" : ""}</div>
        <h1>{name}</h1>
        <p className="lede">{c.tagline}</p>
        <div className="ext-links">
          <Link href={`/channels/${c.slug}`} className="btn ghost small">Channel details</Link>
          {v.reviewCount ? <Link href="/review" className="btn ghost small">{v.reviewCount} to review</Link> : null}
          <Link href="/upload" className="btn ghost small">Upload Desk</Link>
        </div>
        {v.paused ? <div className="notice">{c.paused ? "This channel is paused" : "Publishing is paused"}: nothing new is planned.</div> : null}
      </header>

      {noEpisodes ? (
        <section className="section">
          <div className="card empty-state">
            <h2>No episodes yet</h2>
            <p className="muted">{name} joins the wall when its first film is imported. Before that:</p>
            <ul className="todo">
              {unset.map((a) => <li key={a.dest.id}><Link href="/connections" className="chip warn">Add the {PLATFORM_LABEL[a.dest.platform]} handle</Link></li>)}
              <li><Link href={`/channels/${c.slug}?tab=editorial`} className="chip warn">Write the series bible</Link></li>
            </ul>
          </div>
        </section>
      ) : (
      <>
      <section className="section">
        <div className="section-head"><h2>Ready to post</h2><span className="faint num">next per account</span></div>
        <div className="posts">
          {v.accounts.map((a) => a.next
            ? <PostCard key={a.dest.id} t={a.next} tz={v.tz} stopExternal={v.stopExternal} />
            : (
              <div key={a.dest.id} className="card post-empty">
                <div className="post-state">
                  <span className="label">{PLATFORM_LABEL[a.dest.platform]}{a.dest.handle ? ` · ${a.dest.handle}` : ""}</span>
                  {!a.dest.handle ? <Link href="/connections" className="chip warn">Account not set up</Link> : null}
                </div>
                <p className="muted">Nothing waiting for {PLATFORM_LABEL[a.dest.platform]}. Rendered, approved episodes land here.</p>
                <a className="btn ghost small" href={a.uploadUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> {PLATFORM_LABEL[a.dest.platform]} upload page</a>
              </div>
            ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Queue</h2></div>
        {v.upcoming.length ? (
          <div className="card flush">
            <ul className="q">
              {scheduled.map((t) => <QueueRow key={t.p!.id} t={t} tz={v.tz} />)}
              {unscheduled.map((t) => <QueueRow key={t.p!.id} t={t} tz={v.tz} />)}
            </ul>
          </div>
        ) : <p className="muted">Nothing else queued. {v.accounts.some((a) => a.next) ? "The next posts are above." : "New renders appear here once they pass review."}</p>}
        {unscheduled.length ? <div className="note-row small-note"><p className="faint">Plan the week to give unscheduled posts a slot.</p><Link href="/calendar" className="btn ghost small">Plan the week</Link></div> : null}
      </section>

      <section className="section">
        <div className="section-head"><h2>Series</h2></div>
        {v.series.length || v.loose.length ? (
          <div className="series-grid">
            {v.series.map(({ series: x, episodes }) => (
              <div key={x.id} className="card series">
                <div className="row spread"><h3>{x.title}</h3>{x.isDemo ? <span className="demo-tag">DEMO</span> : null}</div>
                {x.objective ? <p className="muted series-obj">{x.objective}</p> : null}
                <ol className="eps">
                  {episodes.map((e) => (
                    <li key={e.id}>
                      <span className="num faint">{String(e.number).padStart(3, "0")}</span>
                      <Link href={`/episodes/${e.id}`}>{e.title}</Link>
                      {e.isDemo ? <span className="demo-tag">DEMO</span> : null}
                      <span className={`chip ${stateTone(e.state)}`}>{STATE_LABEL[e.state]}</span>
                    </li>
                  ))}
                  {!episodes.length ? <li className="faint">No episodes in this series yet.</li> : null}
                </ol>
              </div>
            ))}
            {v.loose.length ? (
              <div className="card series">
                <h3>Not in a series</h3>
                <ol className="eps">
                  {v.loose.map((e) => (
                    <li key={e.id}><span className="num faint">{String(e.number).padStart(3, "0")}</span><Link href={`/episodes/${e.id}`}>{e.title}</Link>{e.isDemo ? <span className="demo-tag">DEMO</span> : null}<span className={`chip ${stateTone(e.state)}`}>{STATE_LABEL[e.state]}</span></li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      </>
      )}
    </div>
  );
}

const SLOT_LABEL = { posted: "Posted", ready: "Ready to post", needs_approval: "Needs approval", unplanned: "Next in rotation · not planned", missed: "Missed · nothing was planned", empty: "Nothing in rotation" } as const;
const SLOT_TONE = { posted: "good", ready: "good", needs_approval: "warn", unplanned: "", missed: "", empty: "" } as const;

async function InstagramScreen() {
  const v = await instagramExtension();
  const IG = { ["--topic" as string]: "#C9CED6", ["--topic-ink" as string]: "#E4E7EC" };
  return (
    <div style={IG}>
      <header className="ext-head">
        <div className="kicker">Shared account · all five series · {v.daily} a day</div>
        <h1>Instagram</h1>
        <p className="lede">Two posts a day from any series, rotating across the channels. An episode goes up on Instagram once, never twice.</p>
        <div className="ext-links">
          <a href={v.uploadUrl} target="_blank" rel="noopener noreferrer" className="btn ghost small"><Icon name="external" size={16} /> {v.ig?.handle || "Instagram"}</a>
          <Link href="/connections" className="btn ghost small">Account</Link>
          <Link href="/calendar" className="btn ghost small">Calendar</Link>
        </div>
        {v.paused ? <div className="notice">Publishing is paused: nothing new is planned.</div> : null}
      </header>

      <section className="section">
        <div className="section-head"><h2>{v.day === "tomorrow" ? "Tomorrow" : "Today"}</h2>{v.day === "tomorrow" ? <span className="faint num">today&apos;s slots are over</span> : null}</div>
        {v.slots.length ? (
          <div className="slots">
            {v.slots.map((x, i) => (
              <div key={i} className="slot">
                <div className="slot-head">
                  <span className="slot-time num">{v.day === "tomorrow" ? "Tomorrow " : ""}{formatLocal(x.at, v.tz, { hour: "numeric", minute: "2-digit" })}</span>
                  <span className={`chip ${SLOT_TONE[x.state]}`}>{SLOT_LABEL[x.state]}</span>
                </div>
                {x.item ? <PostCard t={x.item} tz={v.tz} stopExternal={v.stopExternal} heading={x.item.channel.label} />
                  : <div className="card post-empty"><p className="muted">{x.state === "missed" ? "This slot passed with nothing planned for it." : "No episode is waiting for Instagram. New renders join the rotation automatically."}</p></div>}
              </div>
            ))}
          </div>
        ) : <div className="card"><p className="muted">{v.paused ? "Publishing is paused, so there are no slots today." : "No Instagram slots today (blackout)."}</p></div>}
        {v.slots.some((x) => x.state === "unplanned") ? <div className="note-row small-note"><p className="faint">These are the next episodes in rotation. Plan the week to put them in {v.day === "tomorrow" ? "tomorrow" : "today"}&apos;s slots; each still needs its approval.</p><Link href="/calendar" className="btn ghost small">Plan the week</Link></div> : null}
      </section>

      <section className="section">
        <div className="section-head"><h2>Rotation</h2><span className="faint num">across series</span></div>
        {v.upcoming.length || v.rotation.length ? (
          <div className="card flush">
            <ul className="q">
              {v.upcoming.map((t) => <QueueRow key={t.p!.id} t={t} tz={v.tz} />)}
              {v.rotation.map((t) => <QueueRow key={`r-${t.e.id}`} t={t} tz={v.tz} />)}
            </ul>
          </div>
        ) : <p className="muted">Nothing else in rotation.</p>}
      </section>

      <section className="section">
        <div className="section-head"><h2>Never repeats</h2><span className="faint num">{v.totals.posted} posted · {v.totals.never} not yet</span></div>
        <div className="card flush">
          <table className="t ledger">
            <caption className="sr-only">Instagram ledger by channel</caption>
            <thead><tr><th scope="col">Channel</th><th scope="col">Rendered</th><th scope="col">Posted</th><th scope="col" className="hide-sm">Planned</th><th scope="col">Not yet</th></tr></thead>
            <tbody>
              {v.ledger.map((r) => (
                <tr key={r.channel.id} style={topicStyle(r.channel)}>
                  <th scope="row"><Link href={`/m/${r.channel.slug}`}><span className="dot" aria-hidden /> {r.name}</Link></th>
                  <td className="num">{r.ready}<span className="faint"> / {r.episodes}</span></td>
                  <td className="num">{r.posted}</td>
                  <td className="num hide-sm">{r.planned}</td>
                  <td className="num">{r.never}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">All series</th><td className="num">{v.totals.ready}<span className="faint"> / {v.totals.episodes}</span></td><td className="num">{v.totals.posted}</td><td className="num hide-sm">{v.totals.planned}</td><td className="num">{v.totals.never}</td></tr></tfoot>
          </table>
        </div>
        <p className="faint small-note">Rendered: episodes with an Instagram export, out of all episodes. Planning never schedules an episode on Instagram twice; posted ones stay posted.</p>
      </section>
    </div>
  );
}
