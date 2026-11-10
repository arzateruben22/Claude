import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { OFFICIAL, youtubeStudioFor } from "@/domain/catalog";
import { activeChannels } from "@/domain/channels";
import { accountSnapshotsByDestination, attentionItems, earnProgress, EARN_RULES, METRIC_LABEL, METRICS_BY_PLATFORM, type EarnPlatform, type Progress, type Req, type Tier } from "@/domain/earn";
import { addAccountMetrics } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { count, PLATFORM_LABEL, topicStyle } from "@/lib/format";

export const metadata: Metadata = { title: "Get paid" };
export const dynamic = "force-dynamic";

const PILL: Record<Progress["status"], string> = { not_started: "", on_the_way: "info", close: "warn", eligible: "good" };

function ReqBar({ r }: { r: Req }) {
  const pct = r.percent == null ? 0 : Math.floor(r.percent);
  return (
    <div className="earn-req">
      <div className="row spread"><span>{r.label}</span><span className="num">{r.value == null ? "not logged" : `${count(r.value)} / ${count(r.target)}`}</span></div>
      <div className="bar" role="progressbar" aria-label={r.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent == null ? undefined : pct} aria-valuetext={r.value == null ? "No number logged yet" : `${count(r.value)} of ${count(r.target)}`}><i style={{ width: `${pct}%` }} /></div>
      <div className="faint earn-left">{r.value == null ? "Log this number to see how close you are" : r.met ? "Done" : `${count(Math.ceil(r.left!))} to go`}</div>
    </div>
  );
}

function TierBlock({ t }: { t: Tier }) {
  const shared = t.route ? t.reqs.slice(0, -1) : t.reqs;
  return (
    <div className="stack-sm">
      <div className="earn-tier"><b>{t.name}</b> <span className="faint">{t.unlocks}{t.met ? " · requirements met" : ""}</span></div>
      {shared.map((r) => <ReqBar key={r.metric} r={r} />)}
      {t.route ? <>
        <ReqBar r={t.route} />
        {t.otherRoute ? (
          <details className="earn-or">
            <summary>or {t.otherRoute.label.toLowerCase()}</summary>
            <ReqBar r={t.otherRoute} />
          </details>
        ) : null}
      </> : null}
    </div>
  );
}

function Row({ platform, p, dest }: { platform: EarnPlatform; p: Progress; dest: typeof S.destinations.$inferSelect }) {
  const [main, ...rest] = p.tiers;
  const link = platform === "youtube"
    ? (dest.platformAccountId ? youtubeStudioFor(dest.platformAccountId) : OFFICIAL.youtube.studio)
    : OFFICIAL.tiktok.studio;
  return (
    <section className="earn-row stack-sm" aria-label={PLATFORM_LABEL[platform]}>
      <div className="row spread">
        <h3 className="row" style={{ margin: 0, gap: 8 }}><Icon name={platform} size={20} /> {PLATFORM_LABEL[platform]}</h3>
        <span className={`earn-pill ${PILL[p.status]}`}>{p.statusLabel}</span>
      </div>
      {p.hasNumbers && p.ageLine ? <p className={p.stale ? "earn-stale" : "faint"} style={{ margin: 0, fontSize: 13 }}>{p.stale ? "Time to refresh: " : "Your "}{p.ageLine}.</p> : null}
      {p.ignored ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>{p.ignored} estimated or demo number{p.ignored === 1 ? " is" : "s are"} not counted.</p> : null}
      <TierBlock t={main} />
      {rest.map((t) => (
        <details key={t.id} className="earn-or">
          <summary>{t.name}: {t.unlocks}</summary>
          <TierBlock t={t} />
        </details>
      ))}
      {platform === "tiktok" ? <ul className="earn-notes faint">{p.notes.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      <details>
        <summary>Log numbers</summary>
        <ActionForm action={addAccountMetrics} className="stack-sm" submit="Save numbers" submitClass="btn small">
          <input type="hidden" name="destinationId" value={dest.id} />
          <p className="hint faint" style={{ margin: 0, fontSize: 13 }}>{platform === "youtube" ? "Read them in YouTube Studio → Earn." : "Read them in TikTok Studio."} Leave a box empty if you don&apos;t know it.</p>
          {METRICS_BY_PLATFORM[platform].map((m) => (
            <label key={m} className="field">{METRIC_LABEL[m]} <input name={m} inputMode="numeric" placeholder="not logged" /></label>
          ))}
          <label className="field">Where it came from
            <select name="source" defaultValue="manual"><option value="manual">I read it in the platform (counts)</option><option value="estimate">My estimate (never counts)</option><option value="demo">DEMO number (never counts)</option></select>
          </label>
        </ActionForm>
      </details>
      <a className="btn ghost small" href={link} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> {platform === "youtube" ? "Open YouTube Studio Earn" : "Open TikTok Studio"}</a>
    </section>
  );
}

export default async function Earn() {
  const d = db();
  const chans = (await activeChannels(d)).filter((c) => !c.paused);
  const dests = chans.length ? await d.select().from(S.destinations).where(inArray(S.destinations.channelId, chans.map((c) => c.id))) : [];
  const snaps = await accountSnapshotsByDestination(d);
  const now = new Date();
  const cards = chans.map((c) => ({
    c,
    rows: (["youtube", "tiktok"] as const).flatMap((platform) => {
      const dest = dests.find((x) => x.channelId === c.id && x.platform === platform);
      return dest ? [{ platform, dest, progress: earnProgress(platform, snaps.get(dest.id) ?? [], now) }] : [];
    }),
  }));
  const attention = attentionItems(cards.map((x) => ({ channel: x.c.name, rows: x.rows })));
  return (
    <div>
      <div className="kicker">YouTube and TikTok payouts</div>
      <h1>Get paid</h1>
      <p className="lede">How close each channel is to earning. Only numbers you read from the platform count; estimates and demo numbers never do, and a number you haven&apos;t logged stays blank.</p>

      <section className="card stack-sm" aria-labelledby="attn">
        <h2 id="attn" style={{ margin: 0 }}>What needs your attention</h2>
        {attention.length ? <ul className="earn-attn">{attention.map((a) => <li key={a.text} className={a.kind === "eligible" ? "good" : undefined}>{a.text}</li>)}</ul> : <p className="muted" style={{ margin: 0 }}>Nothing right now.</p>}
      </section>

      <div className="stack section">
        {cards.map(({ c, rows }) => (
          <article key={c.id} className="card topic stack" style={topicStyle(c)}>
            <h2 style={{ margin: 0, color: "var(--topic-ink)" }}>{c.name}</h2>
            {rows.map((r) => <Row key={r.platform} platform={r.platform} p={r.progress} dest={r.dest} />)}
            {!rows.length ? <p className="muted">No YouTube or TikTok account is set up for this channel.</p> : null}
          </article>
        ))}
        {!cards.length ? <div className="card"><p className="muted">No active channels.</p></div> : null}
      </div>

      <section className="section card stack-sm">
        <h2 style={{ margin: 0 }}>How to read your numbers</h2>
        <ul className="earn-notes">
          <li><b>YouTube:</b> open YouTube Studio → Earn for subscribers and the progress toward each route. Public watch hours (last 12 months) and valid Shorts views (last 90 days) are shown there; uploads (90 days) are in Content, filtered to Public.</li>
          <li><b>TikTok:</b> open TikTok Studio → Analytics. Followers are under Followers; the last 30 days of views are under Overview.</li>
        </ul>
        <p className="faint" style={{ margin: 0 }}>{EARN_RULES.disclaimer} Sources: <a href={EARN_RULES.youtube.sourceUrl} target="_blank" rel="noopener noreferrer">{EARN_RULES.youtube.sourceLabel}</a>, <a href={EARN_RULES.tiktok.sourceUrl} target="_blank" rel="noopener noreferrer">{EARN_RULES.tiktok.sourceLabel}</a>.</p>
        <p className="faint" style={{ margin: 0 }}>{EARN_RULES.youtube.note}</p>
      </section>
    </div>
  );
}
