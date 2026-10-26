import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { channelBySlug, studio, worldView } from "@/lib/data";
import { Creation } from "@/creations/Creation";
import { CREATIONS } from "@/creations/meta";
import type { CreationKey, Form } from "@/creations/types";
import { count, topicStyle } from "@/lib/format";
import { evolveNow, finishChallenge, toggleQuest } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { RevealOnce } from "@/components/RevealOnce";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await channelBySlug((await params).slug);
  return { title: c ? `${CREATIONS[(await db().select().from(S.creations).where(eq(S.creations.channelId, c.id)))[0].creationKey as CreationKey].name}` : "Evolution" };
}

const TIER: Record<string, string> = { intro: "Form 2", series: "Form 3", advanced: "Form 4", masterwork: "Form 5", optional: "Optional quest" };
const OPENS_AT: Record<string, number> = { intro: 1, series: 2, advanced: 3, masterwork: 4 };   // a challenge opens once the form before it is reached

export default async function Evolution({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const c = await channelBySlug(slug);
  if (!c) notFound();
  const [w, s] = await Promise.all([worldView(c.id), studio()]);
  const cr = w.creation, key = cr.creationKey as CreationKey, meta = CREATIONS[key];
  const branch = (cr.branch as "a" | "b" | null) ?? null;
  const motion = s.lowPowerArt ? "static" : "full";
  const eligible = w.evolutions.find((e) => e.toForm === cr.form + 1 && !e.evolvedAt);
  const ascendReady = w.evolutions.find((e) => e.toForm === 6 && !e.evolvedAt);
  const [unseen] = await db().select().from(S.evolutions).where(and(eq(S.evolutions.channelId, c.id), isNotNull(S.evolutions.evolvedAt), isNull(S.evolutions.seenAt)));
  const main = w.challenges.filter((x) => x.tier !== "optional").sort((a, b) => ["intro", "series", "advanced", "masterwork"].indexOf(a.tier) - ["intro", "series", "advanced", "masterwork"].indexOf(b.tier));
  const quests = w.challenges.filter((x) => x.tier === "optional");
  return (
    <div style={topicStyle(c)}>
      {unseen ? <RevealOnce evolutionId={unseen.id} creation={key} from={Math.max(1, Math.min(5, unseen.toForm === 6 ? cr.form : unseen.toForm - 1)) as Form} to={Math.min(5, unseen.toForm === 6 ? cr.form : unseen.toForm) as Form} branch={branch} ascended={unseen.toForm === 6} title={unseen.toForm === 6 ? `${meta.name} ascended` : `${meta.forms[Math.min(5, unseen.toForm) - 1]}`} /> : null}
      <Link href={`/channels/${slug}`} className="kicker" style={{ color: "var(--topic-ink)", textDecoration: "none" }}>← {c.name.replace(/ \(name TBD\)$/, "")}</Link>
      <h1>{meta.name}</h1>
      <p className="lede">It grows from real, reviewed work and real audiences. Nothing evolves by itself: when a form is earned, you press Evolve. XP and levels are separate, and none of this involves money.</p>

      <section className="grid2">
        <div className="card topic stack-sm" style={{ justifyItems: "center", textAlign: "center" }}>
          <Creation creation={key} form={cr.form as Form} branch={branch} ascended={cr.ascended} size={300} motion={motion} activity={eligible ? "celebrating" : "idle"} />
          <div className="h2" style={{ margin: 0 }}>{meta.forms[cr.form - 1]}{cr.ascended ? " · ascended" : ""}</div>
          <div className="muted">Form {cr.form} of 5{branch ? ` · ${meta.branches[branch].name}` : ""} · level {w.xp.level}, {count(w.xp.xp)} XP</div>
        </div>
        <div className="card stack-sm">
          {w.next ? (
            <>
              <div className="kicker">Next: form {w.next}</div>
              <h2 style={{ margin: 0 }}>{meta.forms[w.next - 1]}</h2>
              <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {w.reqs.map((r) => (
                  <li key={r.label} className="row spread top">
                    <span><b>{r.met ? "✓ " : "○ "}</b>{r.label}<div className="faint" style={{ fontSize: 13 }}>{r.detail}{!r.met && r.action ? ` · ${r.action}` : ""}</div></span>
                  </li>
                ))}
              </ul>
              {eligible ? (
                <ActionForm action={evolveNow} className="stack-sm" submit={`Evolve into ${meta.forms[w.next - 1]}`} submitClass="btn topic">
                  <input type="hidden" name="channelId" value={c.id} />
                  {w.next === 3 && !branch ? (
                    <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend style={{ fontWeight: 650, marginBottom: 6 }}>Choose its path (cosmetic, permanent)</legend>
                      <div className="grid2" style={{ gap: 10 }}>
                        {(["a", "b"] as const).map((b) => (
                          <label key={b} className="card flat stack-sm" style={{ cursor: "pointer", justifyItems: "center", textAlign: "center" }}>
                            <Creation creation={key} form={3} branch={b} size={140} motion="reduced" />
                            <span><input type="radio" name="branch" value={b} required defaultChecked={b === "a"} /> <b>{meta.branches[b].name}</b></span>
                            <span className="faint" style={{ fontSize: 13 }}>{meta.branches[b].blurb}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                </ActionForm>
              ) : <p className="faint" style={{ margin: 0 }}>Evolve unlocks when every line above is ticked.</p>}
            </>
          ) : <h2>Every form earned.</h2>}
          {!cr.ascended ? (
            <div className="card flat stack-sm">
              <div className="kicker">Ascended appearance</div>
              <div className="muted" style={{ fontSize: 14 }}>{w.ascendReqs[0]?.label} · {w.ascendReqs[0]?.detail}</div>
              {ascendReady ? <ActionForm action={evolveNow} submit="Ascend" submitClass="btn topic small"><input type="hidden" name="channelId" value={c.id} /><input type="hidden" name="ascend" value="1" /></ActionForm> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>The five forms</h2><Link href={`/evolution/${slug}?preview=${preview ? "" : "1"}`} className="btn ghost small">{preview ? "Hide preview" : <>Preview every form <span className="demo-tag">DEMO</span></>}</Link></div>
        <div className="tree" role="list">
          {meta.forms.map((name, i) => {
            const f = (i + 1) as Form, have = f <= cr.form;
            return (
              <div key={name} role="listitem" className={`node${f === cr.form ? " current" : ""}`}>
                <div className="art"><Creation creation={key} form={f} branch={branch ?? "a"} size={120} motion="reduced" locked={!have && !preview} /></div>
                <div style={{ marginTop: 6 }}>{name}</div>
              </div>
            );
          })}
        </div>
        {preview ? <p className="faint" style={{ fontSize: 13 }}><span className="demo-tag">DEMO</span> Previewing locked forms: this changes nothing.</p> : null}
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Challenges</h2></div>
        <div className="grid2">
          {main.map((x) => (
            <div key={x.id} className="card stack-sm">
              <div className="row spread"><span className="kicker">{TIER[x.tier]}</span><span className={`chip ${x.status === "completed" ? "good" : ""}`}>{x.status === "completed" ? "Complete" : cr.form >= OPENS_AT[x.tier] ? "Open" : `Opens at form ${OPENS_AT[x.tier]}`}</span></div>
              <h3 style={{ margin: 0 }}>{x.title}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>{x.description}</p>
              {x.status !== "completed" && cr.form >= OPENS_AT[x.tier] ? (
                <ActionForm action={finishChallenge} className="stack-sm" submit={x.requirement.check === "owner_confirm" ? "Mark complete" : "Check now"} submitClass="btn ghost small">
                  <input type="hidden" name="challengeId" value={x.id} />
                  {x.requirement.check === "owner_confirm" ? <label className="field">Evidence <span className="hint">What you did and where (a link helps).</span><input name="note" required /></label> : <p className="faint" style={{ margin: 0, fontSize: 13 }}>Checked automatically from your published episodes.</p>}
                </ActionForm>
              ) : x.evidence?.note || x.evidence?.detail ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>{String(x.evidence.note || x.evidence.detail)}</p> : null}
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 24 }}>Optional quests</h3>
        <div className="grid2">
          {quests.map((q) => (
            <div key={q.id} className="card flat stack-sm">
              <div className="row spread"><b>{q.title}</b><span className={`chip ${q.status === "completed" ? "good" : q.activeOptional ? "info" : ""}`}>{q.status === "completed" ? "Done" : q.activeOptional ? "Active" : "Available"}</span></div>
              <span className="muted" style={{ fontSize: 14 }}>{q.description}</span>
              {q.status !== "completed" ? (
                <div className="row">
                  <form action={toggleQuest}><input type="hidden" name="challengeId" value={q.id} /><button className="btn ghost small">{q.activeOptional ? "Set aside" : "Take it on"}</button></form>
                  {q.activeOptional ? <ActionForm action={finishChallenge} className="row" submit="Done" submitClass="btn small"><input type="hidden" name="challengeId" value={q.id} /><input name="note" placeholder="What you did" aria-label="Evidence" required style={{ width: "auto", flex: 1 }} /></ActionForm> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
