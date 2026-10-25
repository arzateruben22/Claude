import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { destinationsAll, onboardingView } from "@/lib/data";
import { OFFICIAL, ONBOARDING_ITEMS, SHARED_ONBOARDING } from "@/domain/catalog";
import { formatLocal } from "@/domain/time";
import { PLATFORM_LABEL, PROVENANCE_LABEL, topicStyle } from "@/lib/format";
import { disconnectDestination, saveDestination, setAutomationCaps, toggleOnboarding } from "@/app/actions";
import { connectionSummary } from "@/domain/connections";
import { connectorFor } from "@/integrations";
import { integrationsConfigured } from "@/lib/crypto";
import { ActionForm } from "@/components/ActionForm";
import { studio } from "@/lib/data";

export const metadata: Metadata = { title: "Accounts" };

export default async function Connections({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const [dests, onb, chans, s, conns, q] = await Promise.all([destinationsAll(), onboardingView(), db().select().from(S.channels).orderBy(asc(S.channels.sort)), studio(), connectionSummary(db()), searchParams]);
  const keyOk = integrationsConfigured();
  const label = (item: string) => [...ONBOARDING_ITEMS, ...SHARED_ONBOARDING].find((o) => o.item === item)?.label ?? item;
  const groups = [...chans.map((c) => ({ key: c.id, title: c.name.replace(/ \(name TBD\)$/, ""), channel: c as typeof c | null })), { key: "shared", title: "Shared Instagram and studio", channel: null }];
  return (
    <div>
      <div className="kicker">11 destinations · manual publishing</div>
      <h1>Accounts</h1>
      <p className="lede">One YouTube channel and one TikTok account per channel, plus one Instagram for all five. Saving a handle or link here is not a connection: it tells the Upload Desk who to post as.</p>
      {q.connected ? <div className="notice good" style={{ marginBottom: 16 }}>Connected {q.connected}. Approved episodes on this account can now be published by the worker.</div> : null}
      {q.error ? <div className="notice bad" style={{ marginBottom: 16 }}>{q.error}</div> : null}
      <div className="card stack-sm" style={{ marginBottom: 16 }}>
        <div className="kicker">Automated publishing</div>
        <p style={{ margin: 0 }}>Connect an account and the studio can upload approved episodes itself, at their scheduled time (channel automation set to &ldquo;Approved&rdquo;) or when you press <b>Publish now</b> on the desk. Each platform&apos;s conditions are shown on its card. Nothing posts without a live approval of that exact video and text.</p>
        {!keyOk ? <p className="muted" style={{ margin: 0 }}>Set <span className="mono">INTEGRATIONS_KEY</span> and <span className="mono">PUBLIC_ORIGIN</span> in <span className="mono">.env.local</span> to turn Connect on. See INTEGRATIONS.md.</p> : null}
      </div>
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
                    {(() => {
                      const conn = conns.get(d.id), connector = connectorFor(d.platform);
                      if (!connector) return <p className="faint" style={{ margin: 0, fontSize: 13 }}>No connector for {PLATFORM_LABEL[d.platform]} yet: manual publishing.</p>;
                      return (
                        <div className="card flat stack-sm" style={{ padding: 12 }}>
                          <div className="row spread">
                            <b>Connection</b>
                            {conn ? <span className={`chip ${conn.status === "connected" ? "good" : "bad"}`}>{conn.status}{conn.expiresAt ? ` · token to ${formatLocal(conn.expiresAt, s.timezone, { dateStyle: "medium" })}` : ""}</span> : <span className="chip">not connected</span>}
                          </div>
                          <p className="faint" style={{ margin: 0, fontSize: 13 }}>{connector.capabilities.conditions}</p>
                          <div className="row">
                            {keyOk && connector.configured() ? <a className="btn topic small" href={`/api/auth/${d.platform}/start?destination=${d.id}`}>{conn ? "Reconnect" : "Connect"} {PLATFORM_LABEL[d.platform]}</a>
                              : <span className="chip warn">needs {connector.envVars.join(", ")}{keyOk ? "" : " and INTEGRATIONS_KEY"}</span>}
                            {conn ? <ActionForm action={disconnectDestination} submit="Disconnect" submitClass="btn danger small" confirm="Disconnect this account? Publishing goes back to manual."><input type="hidden" name="destinationId" value={d.id} /></ActionForm> : null}
                          </div>
                          {conn && d.platform === "tiktok" ? (
                            <ActionForm action={setAutomationCaps} className="row" submit="Save" submitClass="btn ghost small">
                              <input type="hidden" name="destinationId" value={d.id} />
                              <label className="check" style={{ padding: 0 }}><input type="checkbox" name="audited" defaultChecked={!!(conn.capabilities as { audited?: boolean }).audited} /> <span>TikTok audited this app (direct public posts allowed)</span></label>
                              <input type="hidden" name="privacy" value="public" />
                            </ActionForm>
                          ) : null}
                        </div>
                      );
                    })()}
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
