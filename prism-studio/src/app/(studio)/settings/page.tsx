import type { Metadata } from "next";
import Link from "next/link";
import { studio } from "@/lib/data";
import { saveSettings, signOut } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  const s = await studio();
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
          <label className="check"><input type="checkbox" name="stopExternalActions" defaultChecked={s.stopExternalActions} /> <span><b>Stop external actions</b><br /><span className="muted">Hides hand-off buttons and blocks any future automated publisher.</span></span></label>
          <label className="check"><input type="checkbox" name="paidGenerationEnabled" defaultChecked={s.paidGenerationEnabled} /> <span><b>Paid generation</b><br /><span className="muted">Stays off until a channel has a production budget, and only runs while that budget has room. Rendering today is local and free.</span></span></label>
          <p className="faint" style={{ margin: 0, fontSize: 13.5 }}>Production budgets and cost entries live in <Link href="/costs">Costs</Link>. Prism records costs; it never pays or moves money.</p>
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
      <section className="section">
        <form action={signOut}><button className="btn ghost">Sign out</button></form>
      </section>
    </div>
  );
}
