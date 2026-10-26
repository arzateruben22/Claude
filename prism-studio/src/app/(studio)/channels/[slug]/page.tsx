import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { channelBySlug, episodesFor, studio, worldView } from "@/lib/data";
import { Creation } from "@/creations/Creation";
import { CREATIONS } from "@/creations/meta";
import type { CreationKey, Form } from "@/creations/types";
import { count, PLATFORM_LABEL, PROVENANCE_LABEL, STATE_LABEL, stateTone, topicStyle } from "@/lib/format";
import { saveChannel } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Lessons } from "@/components/Lessons";
import { availableForLesson } from "@/domain/lessons";

const TABS = [["overview", "Overview"], ["episodes", "Episodes"], ["lessons", "Lessons"], ["series", "Series"], ["accounts", "Accounts"], ["editorial", "Editorial"]] as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await channelBySlug((await params).slug);
  return { title: c?.name.replace(/ \(name TBD\)$/, "") ?? "Channel" };
}

export default async function ChannelPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab = "overview" }] = await Promise.all([params, searchParams]);
  const c = await channelBySlug(slug);
  if (!c) notFound();
  const [eps, w, s, dests, ser, lessonRows, available] = await Promise.all([
    episodesFor(c.id), worldView(c.id), studio(),
    db().select().from(S.destinations).where(eq(S.destinations.channelId, c.id)),
    db().select().from(S.series).where(eq(S.series.channelId, c.id)).orderBy(asc(S.series.sort)),
    db().select().from(S.lessons).where(and(eq(S.lessons.channelId, c.id), eq(S.lessons.isTestFixture, false))).orderBy(desc(S.lessons.createdAt)),
    availableForLesson(db(), c.id),
  ]);
  const lessonParts = lessonRows.length ? (await db().select({ le: S.lessonEpisodes, episode: S.episodes }).from(S.lessonEpisodes).innerJoin(S.episodes, eq(S.episodes.id, S.lessonEpisodes.episodeId))
    .where(inArray(S.lessonEpisodes.lessonId, lessonRows.map((l) => l.id)))).map((r) => ({ ...r.le, episode: r.episode })) : [];
  const key = w.creation.creationKey as CreationKey, meta = CREATIONS[key];
  const name = c.name.replace(/ \(name TBD\)$/, "");
  const pct = (w.xp.xp - w.xp.levelStart) / Math.max(1, w.xp.next - w.xp.levelStart);
  const firstOpen = w.reqs.find((r) => !r.met);
  return (
    <div style={topicStyle(c)}>
      <div className="kicker" style={{ color: "var(--topic-ink)" }}>{c.label}{c.nameProvisional ? " · working name" : ""}</div>
      <h1>{name}</h1>
      <p className="lede">{c.tagline}</p>
      <nav className="tabs" aria-label="Channel sections">
        {TABS.map(([k, label]) => <Link key={k} href={`/channels/${slug}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
      </nav>

      {tab === "overview" ? (
        <div className="grid2">
          <Link href={`/evolution/${slug}`} className="card topic stack-sm" style={{ textDecoration: "none", justifyItems: "center", textAlign: "center" }}>
            <Creation creation={key} form={w.creation.form as Form} branch={(w.creation.branch as "a" | "b" | null) ?? null} ascended={w.creation.ascended} size={240} motion={s.lowPowerArt ? "static" : "full"} />
            <div className="h2" style={{ margin: 0 }}>{meta.forms[w.creation.form - 1]}</div>
            <div className="muted">{meta.name} · form {w.creation.form} of 5{w.creation.ascended ? " · ascended" : ""}</div>
            <div className="bar" style={{ width: "100%" }}><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>
            <div className="num">Level {w.xp.level} · {count(w.xp.xp)} XP</div>
          </Link>
          <div className="stack">
            <div className="card stack-sm">
              <div className="kicker">Next for {meta.name}</div>
              {w.next ? (
                <>
                  <h3>Form {w.next}: {meta.forms[w.next - 1]}</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{w.reqs.map((r) => <li key={r.label}>{r.met ? "✓ " : ""}{r.label} <span className="faint">({r.detail})</span></li>)}</ul>
                  {firstOpen?.action ? <p className="muted" style={{ margin: 0 }}>Next step: {firstOpen.action}.</p> : null}
                </>
              ) : <p className="muted">Every form earned.</p>}
              <Link href={`/evolution/${slug}`} className="btn ghost small" style={{ justifySelf: "start" }}>Evolution and challenges</Link>
            </div>
            <div className="card stack-sm">
              <div className="kicker">Episodes</div>
              <div className="row">{Object.entries(eps.reduce<Record<string, number>>((a, e) => ({ ...a, [e.state]: (a[e.state] ?? 0) + 1 }), {})).map(([st, n]) => <span key={st} className={`chip ${stateTone(st)}`}>{n} {STATE_LABEL[st].toLowerCase()}</span>)}</div>
              <Link href={`/channels/${slug}?tab=episodes`} className="btn ghost small" style={{ justifySelf: "start" }}>All episodes</Link>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "episodes" ? (
        <div className="card">
          <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {eps.map((e) => (
              <li key={e.id} className="row spread">
                <Link href={`/episodes/${e.id}`} style={{ textDecoration: "none" }}><span className="num faint">No. {String(e.number).padStart(3, "0")}</span> <b>{e.title}</b>{e.isDemo ? <> <span className="demo-tag">DEMO</span></> : null}</Link>
                <span className={`chip ${stateTone(e.state)}`}>{STATE_LABEL[e.state]}</span>
              </li>
            ))}
          </ul>
          {!eps.length ? <p className="muted">No episodes yet.</p> : null}
        </div>
      ) : null}

      {tab === "lessons" ? (
        <Lessons channelId={c.id} channelName={name} ytHandle={dests.find((d) => d.platform === "youtube")?.handle ?? ""} lessons={lessonRows} parts={lessonParts} available={available} tz={s.timezone} />
      ) : null}

      {tab === "series" ? (
        <div className="stack">
          {ser.map((x) => {
            const parts = eps.filter((e) => e.seriesId === x.id);
            const done = parts.filter((e) => ["published", "analytics"].includes(e.state)).length;
            return (
              <div key={x.id} className="card topic stack-sm">
                <div className="row spread"><h3 style={{ margin: 0 }}>{x.title}</h3><span className="chip">{x.status}</span></div>
                <p className="muted" style={{ margin: 0 }}>{x.objective}</p>
                <div className="bar"><i style={{ width: `${(done / Math.max(1, s.lessonBundleSize)) * 100}%` }} /></div>
                <div className="faint num">{done}/{s.lessonBundleSize} published · the lesson is built from all {s.lessonBundleSize}</div>
                <ol style={{ margin: 0, paddingLeft: 20 }}>{parts.sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)).map((e) => <li key={e.id}><Link href={`/episodes/${e.id}`}>{e.title}</Link> <span className="faint">· {STATE_LABEL[e.state]}</span></li>)}</ol>
              </div>
            );
          })}
          {!ser.length ? <p className="muted">No series yet.</p> : null}
        </div>
      ) : null}

      {tab === "accounts" ? (
        <div className="grid2">
          {dests.map((d) => (
            <div key={d.id} className="card stack-sm">
              <div className="kicker">{PLATFORM_LABEL[d.platform]}</div>
              <div className="h2" style={{ margin: 0 }}>{d.handle || <span className="muted">Not set up</span>}</div>
              <span className={`chip ${d.provenance === "owner_confirmed" ? "good" : d.provenance === "unset" ? "warn" : ""}`} style={{ justifySelf: "start" }}>{PROVENANCE_LABEL[d.provenance]}</span>
              <Link href={`/connections#dest-${d.id}`} className="btn ghost small" style={{ justifySelf: "start" }}>Edit in Accounts</Link>
            </div>
          ))}
          <div className="card flat"><p className="muted" style={{ margin: 0 }}>Instagram is one shared account for all five channels: set it up in <Link href="/connections">Accounts</Link>.</p></div>
        </div>
      ) : null}

      {tab === "editorial" ? (
        <div className="grid2">
          <div className="card stack-sm">
            {([["Audience", c.editorial.audience], ["Tone", c.editorial.tone], ["Visual grammar", c.editorial.visualGrammar], ["Claim standards", c.editorial.claimStandards]] as const).map(([k, v]) => (
              <div key={k}><div className="kicker">{k}</div><p style={{ margin: "4px 0 10px" }}>{v}</p></div>
            ))}
            <div className="kicker">Avoid</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{c.editorial.avoid.map((a) => <li key={a}>{a}</li>)}</ul>
            <div className="kicker" style={{ marginTop: 10 }}>Narrator</div>
            <p style={{ margin: 0 }}>{c.voice.narrator} <span className="faint">({c.voice.provider})</span></p>
          </div>
          <ActionForm action={saveChannel} className="card stack-sm" submit="Save" submitClass="btn">
            <input type="hidden" name="channelId" value={c.id} />
            <label className="field">Channel name <input name="name" defaultValue={c.name} required /></label>
            <label className="check"><input type="checkbox" name="final" defaultChecked={!c.nameProvisional} /> <span>This name is final</span></label>
            <label className="field">Tagline <input name="tagline" defaultValue={c.tagline} /></label>
            <label className="field">Automation
              <select name="automationMode" defaultValue={c.automationMode}>
                <option value="draft">Draft: nothing moves without you</option>
                <option value="approved">Approved: plan approved episodes automatically</option>
                <option value="autopilot" disabled>Autopilot (needs a verified integration)</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" name="paused" defaultChecked={c.paused} /> <span>Pause this channel (nothing is planned)</span></label>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
