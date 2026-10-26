import Link from "next/link";
import { homeView, studio } from "@/lib/data";
import { formatLocal, zonedParts } from "@/domain/time";
import { Creation } from "@/creations/Creation";
import { CREATIONS } from "@/creations/meta";
import type { CreationKey, Form } from "@/creations/types";
import { compact, count, money, PLATFORM_LABEL, topicStyle } from "@/lib/format";
import { Ring } from "@/components/Ring";

export default async function Home() {
  const [v, s] = await Promise.all([homeView(), studio()]);
  const hour = zonedParts(new Date(), s.timezone).h;
  const hello = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const due = v.tasks.due, review = v.reviewCount;
  const oneM = v.rewards.rules.find((r) => r.key === "1m_club");
  const oneMDone = v.rewards.events.some((e) => e.ruleId === oneM?.id && !e.isDemo);
  return (
    <div className="stack-lg">
      <header>
        <div className="kicker">{formatLocal(new Date(), s.timezone, { weekday: "long", month: "long", day: "numeric" })}</div>
        <h1>{hello}.</h1>
        <p className="lede">
          {due.length ? `${due.length} upload${due.length > 1 ? "s" : ""} due today` : "Nothing due to upload today"}
          {review ? ` · ${review} episode${review > 1 ? "s" : ""} waiting for your review` : ""}.
          {s.globalPause ? " Publishing is paused." : ""}
        </p>
      </header>

      {v.unseenEvolutions.length ? (
        <div className="notice good">A creation evolved and hasn&apos;t been revealed yet. <Link href={`/evolution/${v.worlds.find((w) => w.id === v.unseenEvolutions[0].channelId)?.slug}`}>See it</Link></div>
      ) : null}
      {v.unseenAchievements.length ? (
        <div className="notice good">Unlocked: {v.unseenAchievements.map((a) => a.rule.title + (a.ev.isDemo ? " (demo)" : "")).join(", ")}. <Link href="/rewards">Open the trophy shelf</Link></div>
      ) : null}

      <section className="grid2">
        <div className="card ink stack-sm">
          <div className="kicker">Today&apos;s upload desk</div>
          {due.length ? (
            <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {due.slice(0, 5).map((t) => (
                <li key={t.p.id} className="row spread" style={{ borderColor: "rgba(246,241,231,.14)" }}>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="rail-dot" style={{ width: 10, height: 10, borderRadius: 3, transform: "rotate(45deg)", background: t.channel.color, display: "inline-block" }} aria-hidden />
                    <span>{t.e.title}</span>
                  </span>
                  <span className="num" style={{ opacity: .75 }}>{PLATFORM_LABEL[t.dest.platform]} · {formatLocal(t.p.scheduledFor, s.timezone, { timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted" style={{ margin: 0 }}>All clear. Plan the week from the calendar when episodes are approved.</p>}
          <div className="row"><Link className="btn" style={{ background: "var(--ivory)", color: "var(--ink)" }} href="/upload">Open the Upload Desk</Link>
            {review ? <Link className="btn ghost" style={{ color: "var(--ivory)", borderColor: "rgba(246,241,231,.3)" }} href="/review">Review {review}</Link> : null}</div>
        </div>
        <div className="card stack-sm" style={topicStyle({ color: "#F2A93B", colorInk: "#8A5A00" })}>
          <div className="kicker">1M Club: Our First Million</div>
          <div className="row" style={{ gap: 16 }}>
            <Ring value={v.rewards.bestViews / 1_000_000} size={72} label={oneMDone ? "✓" : `${Math.floor((v.rewards.bestViews / 1_000_000) * 100)}%`} />
            <div>
              <div className="h2" style={{ margin: 0 }}>{compact(v.rewards.bestViews)} <span className="muted" style={{ fontSize: 18 }}>/ 1M</span></div>
              <div className="muted" style={{ fontSize: 14 }}>Best single post, platform-reported. Reward {money(oneM?.rewardCents)} from your own budget{v.rewards.balances.configured ? "" : " (budget not set up yet)"}.</div>
            </div>
          </div>
          <Link href="/rewards" className="btn ghost small" style={{ justifySelf: "start" }}>Trophies and budget</Link>
        </div>
      </section>

      <section>
        <div className="section-head"><h2 style={{ margin: 0 }}>The five worlds</h2><span className="faint num">{v.onboarding.done}/{v.onboarding.total} setup steps</span></div>
        <div className="worlds">
          {v.worlds.map((w) => {
            const key = w.creation.creationKey as CreationKey, meta = CREATIONS[key];
            const inReview = w.byState.ready_for_review ?? 0, published = (w.byState.published ?? 0) + (w.byState.analytics ?? 0);
            const total = Object.values(w.byState).reduce((a, b) => a + b, 0);
            const pct = (w.xp.xp - w.xp.levelStart) / Math.max(1, w.xp.next - w.xp.levelStart);
            return (
              <Link key={w.id} href={`/channels/${w.slug}`} className="world" style={topicStyle(w)}>
                <span className="art"><Creation creation={key} form={w.creation.form as Form} branch={(w.creation.branch as "a" | "b" | null) ?? null} ascended={w.creation.ascended} size={112} motion={s.lowPowerArt ? "static" : "full"} activity={inReview ? "preparing" : "idle"} /></span>
                <span>
                  <span className="label">{w.label}</span>
                  <span className="name" style={{ display: "block" }}>{w.name.replace(/ \(name TBD\)$/, "")}{w.nameProvisional ? <span className="faint" style={{ fontSize: 14 }}> · working name</span> : null}</span>
                  <span className="form" style={{ display: "block" }}>{meta.name} · form {w.creation.form}: {meta.forms[w.creation.form - 1]}{w.creation.ascended ? " · ascended" : ""}</span>
                  <span className="bar" style={{ display: "block", marginTop: 10 }} aria-label={`Level ${w.xp.level}`}><i style={{ width: `${Math.round(pct * 100)}%` }} /></span>
                  <span className="status">
                    <span className="chip">Lv {w.xp.level} · {count(w.xp.xp)} XP</span>
                    <span className="chip">{published}/{total} published</span>
                    {inReview ? <span className="chip warn">{inReview} to review</span> : null}
                    {w.canEvolve ? <span className="chip good">Ready to evolve</span> : null}
                    {w.paused ? <span className="chip bad">Paused</span> : null}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
