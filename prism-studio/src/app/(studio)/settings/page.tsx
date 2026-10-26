import type { Metadata } from "next";
import Link from "next/link";
import { notificationsView, studio } from "@/lib/data";
import { resetPushKeys, saveSettings, sendTestPush, signOut } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PushDevices } from "@/components/PushDevices";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  const [s, push] = await Promise.all([studio(), notificationsView()]);
  const canUse = push.status.canSeal && push.status.keys !== "unreadable";
  return (
    <div>
      <div className="kicker">Studio</div>
      <h1>Settings</h1>
      <ActionForm action={saveSettings} className="stack-lg" submit="Save settings" submitClass="btn">
        <section className="card stack-sm">
          <h3>Schedule</h3>
          <label className="field">Timezone <span className="hint">Every time in the app is shown in this zone (stored in UTC).</span><input name="timezone" defaultValue={s.timezone} /></label>
          <div className="grid3">
            <label className="field">Shorts per channel a day <input name="shortsPerChannelDaily" type="number" min={0} max={3} defaultValue={s.shortsPerChannelDaily} /></label>
            <label className="field">Instagram posts a day <input name="instagramDaily" type="number" min={0} max={3} defaultValue={s.instagramDaily} /></label>
            <label className="field">Buffer days <input name="bufferDays" type="number" min={0} max={30} defaultValue={s.bufferDays} /></label>
          </div>
        </section>
        <section className="card stack-sm">
          <h3>Safety switches</h3>
          <label className="check"><input type="checkbox" name="globalPause" defaultChecked={s.globalPause} /> <span><b>Pause publishing</b><br /><span className="muted">Nothing new is planned; the desk stays usable.</span></span></label>
          <label className="check"><input type="checkbox" name="stopExternalActions" defaultChecked={s.stopExternalActions} /> <span><b>Stop external actions</b><br /><span className="muted">Hides hand-off buttons, blocks automated publishing and pauses analytics pulls from the platforms.</span></span></label>
          <label className="check"><input type="checkbox" name="paidGenerationEnabled" defaultChecked={s.paidGenerationEnabled} /> <span><b>Paid generation</b><br /><span className="muted">Stays off until a channel has a production budget, and only runs while that budget has room. Rendering today is local and free.</span></span></label>
          <div className="row">
            <Link href="/costs" className="btn ghost small">Budgets and costs</Link>
            <span className="faint" style={{ fontSize: 13.5 }}>Prism records costs; it never pays or moves money.</span>
          </div>
        </section>
        <section className="card stack-sm">
          <h3>Demo data</h3>
          <label className="check"><input type="checkbox" name="showDemo" defaultChecked={s.showDemo} /> <span><b>Show demo data</b><br /><span className="muted">Off: demo episodes are hidden. On: they appear, always labelled DEMO, and still never count toward progress, rewards, XP, achievements or analytics totals.</span></span></label>
        </section>
        <section className="card stack-sm">
          <h3>Feel</h3>
          <label className="check"><input type="checkbox" name="celebrationSound" defaultChecked={s.celebrationSound} /> <span>Play a soft sound on unlocks and evolutions</span></label>
          <label className="check"><input type="checkbox" name="lowPowerArt" defaultChecked={s.lowPowerArt} /> <span>Still creations (saves battery; reduced-motion is always respected)</span></label>
        </section>
      </ActionForm>
      <section id="notifications" className="card stack push-card" aria-labelledby="push-h">
        <div className="stack-sm">
          <h3 id="push-h">Notifications</h3>
          <p className="muted" style={{ margin: 0 }}>Prism notifies the devices you turn on here when an upload is due (30 minutes before a manual slot whose post is approved and ready), when a scheduled automatic publish fails or needs you to finish it, and when an Instagram slot passes with nothing planned. Each event notifies once; demo posts never do.</p>
        </div>
        {push.status.problem ? <div className={`notice${push.status.keys === "unreadable" ? " bad" : ""}`}>{push.status.problem}</div> : null}
        {push.status.keys === "unreadable" ? (
          <ActionForm action={resetPushKeys} className="row" submit="Reset notifications" submitClass="btn danger small" confirm="Make a new signing key and remove every device? Each one then turns notifications on again.">
            <span className="faint" style={{ fontSize: 13.5 }}>Makes a new key; every device turns notifications on again.</span>
          </ActionForm>
        ) : null}
        <PushDevices devices={push.devices} canUse={canUse} />
        {push.devices.length && canUse ? (
          <ActionForm action={sendTestPush} className="push-test" submit="Send a test notification" submitClass="btn ghost small" />
        ) : null}
        {push.recent.length ? (
          <div className="stack-sm">
            <div className="label">Recent notifications</div>
            <ul className="push-log">
              {push.recent.map((e) => (
                <li key={e.id}>
                  <span className="push-log-title">{e.title}</span>
                  <span className="faint num">{e.at} · {e.sent ? `${e.sent} delivered` : "not delivered"}{e.failed ? ` · ${e.failed} failed` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section className="section">
        <form action={signOut}><button className="btn ghost">Sign out</button></form>
      </section>
    </div>
  );
}
