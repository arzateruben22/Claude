// Costs: production budgets (studio-wide and per channel), spent vs budget by month, and the cost entries.
// Prism records costs; it never pays or moves money. Production budgets are separate from personal rewards.
import type { Metadata } from "next";
import Link from "next/link";
import { costsView, type CostsView } from "@/lib/data";
import type { PaidGenerationCheck, ScopeSummary } from "@/domain/costs";
import { CURRENCIES, amountOf } from "@/domain/costs";
import { dayLabel, monthLabel, moneyIn, PAID_GEN as GATE, topicStyle } from "@/lib/format";
import { addCostEntry, editCostEntry, saveBudget, voidCostEntry } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { CATEGORY_LABEL, CostFields } from "@/components/CostFields";
import { ScrollTabs } from "@/components/ScrollTabs";

export const metadata: Metadata = { title: "Costs" };

const plain = (name: string) => name.replace(/ \(name TBD\)$/, "");

function Figures({ s }: { s: ScopeSummary }) {
  const cap = s.budget?.capCents ?? null;
  return (
    <span className="budget-figs num">
      {cap == null ? <>{moneyIn(s.spentCents, s.currency)} spent <span className="faint">· no budget</span></>
        : <>{moneyIn(s.spentCents, s.currency)} <span className="faint">of {moneyIn(cap, s.currency)}</span></>}
    </span>
  );
}

function Meter({ s }: { s: ScopeSummary }) {
  const cap = s.budget?.capCents ?? null;
  if (cap == null) return <span className="budget-bar" aria-hidden />;
  const pct = cap === 0 ? (s.spentCents ? 100 : 0) : Math.min(100, (s.spentCents / cap) * 100);
  return <span className={`bar budget-bar${s.overCents ? " over" : ""}`} role="img" aria-label={`${Math.round(pct)}% of the budget spent`}><i style={{ width: `${pct}%` }} /></span>;
}

function Extra({ s }: { s: ScopeSummary }) {
  return (
    <>
      {s.budget ? (s.overCents ? <span className="chip warn">Over by {moneyIn(s.overCents, s.currency)}</span> : <span>{moneyIn(s.remainingCents, s.currency)} left</span>) : null}
      {s.estimateCents ? <span><span className="tag">ESTIMATE</span> {moneyIn(s.estimateCents, s.currency)} not counted</span> : null}
      {s.unconverted.map((u) => <span key={u.currency}>{moneyIn(u.cents, u.currency)} not converted, not counted</span>)}
    </>
  );
}

// The reason under the chip, in words (no tooltip: a phone can't hover). "Budget used" needs none: the row's figures say it.
const why = (gate: PaidGenerationCheck) => GATE[gate.code].detail && gate.code !== "no_room";

function BudgetRow({ name, href, s, gate, style, reason = true }: { name: string; href?: string; s: ScopeSummary; gate?: PaidGenerationCheck; style?: React.CSSProperties; reason?: boolean }) {
  return (
    <li className="budget" style={style} data-nobudget={!s.budget || undefined}>
      {href ? <Link href={href} className="budget-name"><span className="dot" aria-hidden /> {name}</Link> : <span className="budget-name"><span className="dot studio" aria-hidden /> {name}</span>}
      <Meter s={s} />
      <Figures s={s} />
      <span className="budget-meta">
        <Extra s={s} />
        {gate ? <span className={`chip ${GATE[gate.code].tone}`}>{GATE[gate.code].label}</span>
          : <span className="faint">{s.budget ? "the studio budget: a ceiling for every channel together" : "no studio budget (a ceiling for every channel together)"}</span>}
        {gate && reason && why(gate) ? <span className="budget-why faint">{gate.reason}</span> : null}
      </span>
    </li>
  );
}

function Entry({ e, v }: { e: CostsView["entries"][number]; v: CostsView }) {
  const ch = v.channels.find((c) => c.id === e.channelId);
  const ep = v.episodes.find((x) => x.id === e.episodeId);
  const est = e.source === "estimate", void_ = !!e.voidedAt;
  const opts = v.channels.map((c) => ({ id: c.id, name: plain(c.name) }));
  return (
    <li className="cost" data-void={void_ || undefined} style={ch ? topicStyle(ch) : undefined}>
      <span className="cost-what">{e.description}</span>
      <span className="cost-amt num">{void_ ? <span className="tag faint-tag">VOID</span> : est ? <span className="tag">ESTIMATE</span> : null} <span className="cost-sum">{moneyIn(amountOf(e), e.currency)}</span></span>
      <span className="cost-meta">
        <span>{dayLabel(e.incurredOn, e.incurredOn.slice(0, 4) !== v.today.slice(0, 4))}</span>
        <span>{CATEGORY_LABEL[e.category] ?? e.category}</span>
        <span className={ch ? "topic-text" : undefined}>{ch ? plain(ch.name) : "Studio-wide"}</span>
        {ep ? <Link href={`/episodes/${ep.id}`}>No. {String(ep.number).padStart(3, "0")} · {ep.title}</Link> : null}
        {e.provider && e.provider !== "local" ? <span>paid to {e.provider}</span> : null}
        {e.jobId ? <span>recorded by a job</span> : null}
        {void_ ? <span>void: {e.voidReason}</span> : e.note ? <span>{e.note}</span> : null}
      </span>
      {!void_ && !e.jobId ? (
        <details className="cost-change">
          <summary>Edit or void</summary>
          <div className="cost-forms">
            <ActionForm action={editCostEntry} className="stack-sm" submit="Save changes" submitClass="btn small">
              <input type="hidden" name="costId" value={e.id} />
              <CostFields channels={opts} episodes={v.episodes} today={v.today} entry={e} />
            </ActionForm>
            <ActionForm action={voidCostEntry} className="stack-sm cost-void" submit="Void this entry" submitClass="btn danger small" confirm="Void this entry? It stays on the record and stops counting.">
              <input type="hidden" name="costId" value={e.id} />
              <label className="field">Why it&apos;s void <input name="reason" required minLength={2} maxLength={300} placeholder="Entered twice, refunded…" /></label>
            </ActionForm>
          </div>
        </details>
      ) : null}
    </li>
  );
}

export default async function Costs({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const { channel } = await searchParams;
  const v = await costsView(channel);
  const opts = v.channels.map((c) => ({ id: c.id, name: plain(c.name) }));
  const focus = v.focus, focusRow = focus ? v.scopes.find((x) => x.channel.id === focus.id) : null;
  // "Studio-wide" means only the entries with no channel; the unfiltered views are "All channels" / "All entries"
  const scopeName = focus ? plain(focus.name) : "All channels";
  return (
    <div style={focus ? topicStyle(focus) : undefined}>
      <div className="kicker">Production · {focus ? `${scopeName} · ` : ""}{monthLabel(v.month)}</div>
      <h1>Costs</h1>
      <p className="lede">What making the films costs, against the budgets you set. Prism only records costs: it never pays, charges or moves money. Production budgets are separate from your personal rewards.</p>
      <ScrollTabs label="Whose costs" current={focus?.id ?? "all"}>
        <Link href="/costs" aria-current={!focus ? "page" : undefined}>All channels</Link>
        {v.channels.map((c) => <Link key={c.id} href={`/costs?channel=${c.slug}`} aria-current={focus?.id === c.id ? "page" : undefined}>{plain(c.name)}</Link>)}
      </ScrollTabs>
      {focusRow ? (
        <p className="row cost-gate">
          <span className={`chip ${GATE[focusRow.gate.code].tone}`}>{GATE[focusRow.gate.code].label}</span>
          {GATE[focusRow.gate.code].detail ? <span className="faint">{focusRow.gate.reason}</span> : null}
        </p>
      ) : null}

      <section className="section">
        <div className="section-head"><h2>This month</h2><span className="faint num">{monthLabel(v.month)}</span></div>
        <div className="card flush">
          <ul className="budgets">
            <BudgetRow name="All channels" s={v.studio} />
            {v.scopes.filter((x) => !focus || x.channel.id === focus.id).map((x) => (
              <BudgetRow key={x.channel.id} name={plain(x.channel.name)} href={`/costs?channel=${x.channel.slug}`} s={x.sum} gate={x.gate} style={topicStyle(x.channel)} reason={!focus} />
            ))}
          </ul>
        </div>
        <p className="faint small-note">Spent counts actual costs only; voided entries and estimates never count. A cost in another currency is listed, never converted, and holds back paid generation for its own channel, and for every channel while a studio budget is set. Paid generation needs Settings → Paid generation on and a channel budget with room this month (and room in the studio budget, when one is set).</p>
        <div className="note-row small-note"><p className="faint">Paid generation is {v.paidSwitch ? "on" : "off"} in Settings{v.stopExternal ? "; external actions are stopped" : ""}.</p><Link href="/settings" className="btn ghost small">Settings</Link></div>
      </section>

      <section className="section">
        <div className="section-head"><h2>By month</h2><span className="faint num">{scopeName}</span></div>
        <div className="card flush">
          <table className="t ledger">
            <caption className="sr-only">{scopeName}: spent against budget, the last six months</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Budget</th><th scope="col">Spent</th><th scope="col">Left</th></tr></thead>
            <tbody>
              {v.history.map((h) => (
                <tr key={h.month}>
                  <th scope="row">{monthLabel(h.month, true)}</th>
                  <td className="num">{h.budget ? moneyIn(h.budget.capCents, h.currency) : <span className="faint">none</span>}</td>
                  <td className="num">{moneyIn(h.spentCents, h.currency)}{h.estimateCents ? <span className="cell-note"><span className="nowrap">+ {moneyIn(h.estimateCents, h.currency)}</span> <span className="tag">ESTIMATE</span></span> : null}</td>
                  <td className="num">{h.budget ? (h.overCents ? <span className="over-text">−{moneyIn(h.overCents, h.currency)}</span> : moneyIn(h.remainingCents, h.currency)) : <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint small-note">A budget applies from the month it&apos;s set until you change it. ESTIMATE amounts are shown under what was spent; they never count.</p>
      </section>

      <section className="section">
        <div className="section-head"><h2>Budgets and costs</h2></div>
        <div className="grid2">
          <ActionForm action={saveBudget} className="card stack-sm" submit="Save budget" submitClass="btn">
            <h3>Set a monthly budget</h3>
            <label className="field">For
              <select name="scope" defaultValue={focus?.id ?? "studio"}>
                <option value="studio">Studio budget (all channels together)</option>
                {opts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="cost-pair">
              <label className="field">Each month <input name="amount" inputMode="decimal" placeholder="50.00" autoComplete="off" /></label>
              <label className="field">Currency <select name="currency" defaultValue="USD">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            </div>
            <label className="field">Starting <span className="hint">It carries on each month until you change it. Leave the amount empty to end it.</span><input name="month" type="month" required defaultValue={v.month} /></label>
          </ActionForm>
          <ActionForm action={addCostEntry} className="card stack-sm" submit="Record cost" submitClass="btn">
            <h3>Record a cost</h3>
            <p className="faint" style={{ margin: 0, fontSize: 13.5 }}>Something you paid yourself, or an estimate. Prism only writes it down.</p>
            <CostFields channels={opts} episodes={v.episodes} today={v.today} channelId={focus?.id ?? null} />
          </ActionForm>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Entries</h2><span className="faint num">{focus ? scopeName : "All entries"}{v.entries.length ? ` · ${v.entries.length}` : ""}</span></div>
        {v.entries.length ? (
          <div className="card flush"><ul className="costs">{v.entries.map((e) => <Entry key={e.id} e={e} v={v} />)}</ul></div>
        ) : <div className="card"><p className="muted" style={{ margin: 0 }}>No costs recorded{focus ? ` for ${scopeName}` : ""} yet. Rendering with the local cinema kit is free; record voices, music or services you pay for.</p></div>}
      </section>
    </div>
  );
}

