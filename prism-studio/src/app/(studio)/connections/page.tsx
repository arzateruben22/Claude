import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { destinationsAll, onboardingView } from "@/lib/data";
import { OFFICIAL, ONBOARDING_ITEMS, SHARED_ONBOARDING } from "@/domain/catalog";
import { formatLocal } from "@/domain/time";
import { PLATFORM_LABEL, PROVENANCE_LABEL, topicStyle } from "@/lib/format";
import { saveDestination, toggleOnboarding } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { studio } from "@/lib/data";

export const metadata: Metadata = { title: "Accounts" };

export default async function Connections() {
  const [dests, onb, chans, s] = await Promise.all([destinationsAll(), onboardingView(), db().select().from(S.channels).orderBy(asc(S.channels.sort)), studio()]);
  const label = (item: string) => [...ONBOARDING_ITEMS, ...SHARED_ONBOARDING].find((o) => o.item === item)?.label ?? item;
  const groups = [...chans.map((c) => ({ key: c.id, title: c.name.replace(/ \(name TBD\)$/, ""), channel: c as typeof c | null })), { key: "shared", title: "Shared Instagram and studio", channel: null }];
  return (
    <div>
      <div className="kicker">11 destinations · manual publishing</div>
      <h1>Accounts</h1>
      <p className="lede">One YouTube channel and one TikTok account per channel, plus one Instagram for all five. Saving a handle or link here is not a connection: it tells the Upload Desk who to post as.</p>
      <div className="notice info stack-sm" style={{ marginBottom: 24 }}>
        <b>Keep accounts safe</b>
        <span>Prism never asks for or stores platform passwords, recovery codes or 2-step codes: keep them in your password manager. Give each TikTok account its own email, and don&apos;t attach one phone number to all five. Turn on 2-step verification everywhere. Only official links are accepted below (youtube.com, tiktok.com, instagram.com, facebook.com).</span>
      </div>
      <div className="stack-lg">
        {groups.map((g) => {
          const ds = dests.filter((d) => (g.channel ? d.channelId === g.channel.id : d.shared));
          const items = onb.filter((o) => (g.channel ? o.channelId === g.channel.id : o.channelId === null));
          return (
            <section key={g.key} style={g.channel ? topicStyle(g.channel) : undefined}>
              <div className="section-head"><h2 style={{ margin: 0 }}>{g.title}</h2><span className="faint num">{items.filter((i) => i.done).length}/{items.length} set up</span></div>
              <div className="grid2">
                <div className="card stack-sm">
                  <div className="kicker">Checklist</div>
                  {items.map((o) => (
                    <form key={o.id} action={toggleOnboarding} className="check" style={{ padding: "4px 0" }}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn ghost small" aria-pressed={o.done} style={{ minWidth: 44, padding: 6 }} aria-label={`${o.done ? "Done" : "Not done"}: ${label(o.item)}`}>{o.done ? "✓" : " "}</button>
                      <span style={{ textDecoration: o.done ? "line-through" : undefined, color: o.done ? "var(--ink-3)" : undefined }}>{label(o.item)}</span>
                    </form>
                  ))}
                </div>
                {ds.map((d) => (
                  <ActionForm key={d.id} action={saveDestination} className="card stack-sm" submit="Save" submitClass="btn small">
                    <div id={`dest-${d.id}`} className="row spread">
                      <h3 style={{ margin: 0 }}>{PLATFORM_LABEL[d.platform]}{d.shared ? " (shared)" : ""}</h3>
                      <span className={`chip ${d.provenance === "owner_confirmed" ? "good" : d.provenance === "unset" ? "warn" : ""}`}>{PROVENANCE_LABEL[d.provenance]}</span>
                    </div>
                    {d.lastConfirmedAt ? <div className="faint" style={{ fontSize: 13 }}>Confirmed {formatLocal(d.lastConfirmedAt, s.timezone)}</div> : null}
                    <input type="hidden" name="destinationId" value={d.id} />
                    <div className="grid2" style={{ gap: 10 }}>
                      <label className="field">Display name <input name="displayName" defaultValue={d.displayName} /></label>
                      <label className="field">Handle <input name="handle" defaultValue={d.handle} placeholder="@name" autoCapitalize="none" /></label>
                    </div>
                    {d.platform === "youtube" ? <label className="field">Channel ID <span className="hint">Starts with UC; from YouTube Studio → Settings → Channel → Advanced. Enables the channel-specific Studio link.</span><input name="platformAccountId" defaultValue={d.platformAccountId} autoCapitalize="none" /></label> : <input type="hidden" name="platformAccountId" value={d.platformAccountId} />}
                    <label className="field">Profile link <input name="profileUrl" type="url" defaultValue={d.profileUrl} placeholder={d.platform === "youtube" ? "https://www.youtube.com/@…" : d.platform === "tiktok" ? "https://www.tiktok.com/@…" : "https://www.instagram.com/…"} /></label>
                    <details>
                      <summary style={{ cursor: "pointer" }}>More links and notes</summary>
                      <div className="stack-sm" style={{ marginTop: 8 }}>
                        <label className="field">Studio link <span className="hint">Default: {OFFICIAL[d.platform].studio}</span><input name="studioUrl" type="url" defaultValue={d.studioUrl} /></label>
                        <label className="field">Upload link <span className="hint">Default: {OFFICIAL[d.platform].upload}</span><input name="uploadUrl" type="url" defaultValue={d.uploadUrl} /></label>
                        <label className="field">Account email <span className="hint">Private; shown only to you.</span><input name="email" type="email" defaultValue={d.email} autoCapitalize="none" /></label>
                        <label className="field">Note <input name="selectionNote" defaultValue={d.selectionNote} /></label>
                        <a href={OFFICIAL[d.platform].help} target="_blank" rel="noopener noreferrer" className="faint" style={{ fontSize: 13 }}>{PLATFORM_LABEL[d.platform]} help ↗</a>
                      </div>
                    </details>
                    <label className="check"><input type="checkbox" name="confirm" /> <span>I checked this is the right account</span></label>
                  </ActionForm>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
