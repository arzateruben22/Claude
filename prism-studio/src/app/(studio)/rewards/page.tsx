import type { Metadata } from "next";
import { rewardsView, studio } from "@/lib/data";
import { formatLocal } from "@/domain/time";
import { compact, count, money } from "@/lib/format";
import { claim, fund, release, saveCap, seeAchievements } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Badge } from "@/components/Badge";
import { Ring } from "@/components/Ring";
import { CelebrationPreview } from "@/components/CelebrationPreview";

export const metadata: Metadata = { title: "Rewards" };

const STATUS: Record<string, [string, string]> = {
  pending_funding: ["Waiting for budget", "warn"], reserved: ["Reserved for you", "good"], claimed: ["Claimed", ""], released: ["Released", ""],
};

export default async function Rewards() {
  const [v, s] = await Promise.all([rewardsView(), studio()]);
  const b = v.balances;
  const oneM = v.rules.find((r) => r.key === "1m_club")!;
  const oneMEvent = v.events.find((e) => e.ruleId === oneM?.id && !e.isDemo);
  const unseen = v.events.some((e) => !e.seenAt);
  return (
    <div>
      <div className="kicker">Personal rewards · funded by you</div>
      <h1>Rewards</h1>
      <p className="lede">Trophies for real milestones, and an optional treat budget you fund yourself. Prism never buys anything or moves money: &ldquo;claim&rdquo; records something you did. Production costs live in a separate budget.</p>

      <section className="card ink stack" style={{ ["--topic-ink" as string]: "#F2A93B" }}>
        <div className="row spread top">
          <div>
            <div className="kicker">The big one</div>
            <h2 style={{ margin: "6px 0 4px" }}>{oneM?.title}</h2>
            <p className="muted" style={{ margin: 0, maxWidth: "52ch" }}>{oneM?.description} Reward: {money(oneM?.rewardCents)}, reserved only from your funded budget within the monthly cap.</p>
          </div>
          <Ring value={v.bestViews / 1_000_000} size={96} stroke={8} label={oneMEvent ? "✓" : compact(v.bestViews)} />
        </div>
        {oneMEvent ? <p style={{ margin: 0 }}>Unlocked {formatLocal(oneMEvent.achievedAt, s.timezone, { dateStyle: "long" })}{oneMEvent.evidenceStatus === "flagged" ? " · the platform later revised the number: evidence flagged for review" : ""}.</p>
          : <p className="muted" style={{ margin: 0 }}>Best single post so far: {count(v.bestViews)} platform-reported views.</p>}
        <CelebrationPreview title={oneM?.title ?? "1M Club"} />
      </section>

      <section className="section grid2">
        <div className="card stack-sm">
          <div className="kicker">Treat budget · {b.month}</div>
          <div className="grid2" style={{ gap: 10 }}>
            <div><div className="h2" style={{ margin: 0 }}>{money(b.availableCents)}</div><div className="faint" style={{ fontSize: 13 }}>available</div></div>
            <div><div className="h2" style={{ margin: 0 }}>{b.configured ? money(b.remainingMonthlyCents) : "—"}</div><div className="faint" style={{ fontSize: 13 }}>left under this month&apos;s cap</div></div>
          </div>
          <div className="faint num">Funded {money(b.fundedCents)} · reserved {money(b.reservedCents)} · claimed {money(b.claimedCents)}</div>
          {!b.configured ? <div className="notice">Set a monthly cap to turn reservations on. Until then, unlocked rewards wait.</div> : null}
          <ActionForm action={saveCap} className="row" submit="Save cap" submitClass="btn ghost small">
            <label className="field" style={{ flex: 1 }}>Monthly cap (USD) <input name="cap" inputMode="decimal" defaultValue={b.capCents != null ? String(b.capCents / 100) : ""} placeholder="e.g. 250 (empty = off)" /></label>
          </ActionForm>
          <ActionForm action={fund} className="stack-sm" submit="Record money set aside" submitClass="btn small">
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <label className="field" style={{ flex: 1 }}>Amount (USD) <input name="amount" inputMode="decimal" required placeholder="200" /></label>
              <label className="field" style={{ flex: 2 }}>Note <input name="note" placeholder="Moved to my savings pot" /></label>
            </div>
          </ActionForm>
        </div>
        <div className="card stack-sm">
          <div className="kicker">Rewards</div>
          {!v.rewards.length ? <p className="muted" style={{ margin: 0 }}>None yet. The 1M Club unlocks the first one.</p> : null}
          {v.rewards.map((r) => (
            <div key={r.id} className="card flat stack-sm">
              <div className="row spread"><b>{money(r.amountCents)}</b><span className={`chip ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></div>
              {r.description ? <div>{r.description}</div> : null}
              {r.status === "reserved" ? (
                <div className="grid2" style={{ gap: 8 }}>
                  <ActionForm action={claim} className="stack-sm" submit="I used it" submitClass="btn small">
                    <input type="hidden" name="rewardId" value={r.id} />
                    <input name="description" placeholder="What you treated yourself to" aria-label="What you treated yourself to" />
                  </ActionForm>
                  <ActionForm action={release} submit="Release" submitClass="btn ghost small" confirm="Release this reward back to the budget?"><input type="hidden" name="rewardId" value={r.id} /></ActionForm>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ margin: 0 }}>Trophy shelf</h2>{unseen ? <form action={seeAchievements}><button className="btn ghost small">Mark all seen</button></form> : null}</div>
        <div className="grid2">
          {v.rules.map((rule) => {
            const ev = v.events.find((e) => e.ruleId === rule.id && !e.isDemo), demo = v.events.find((e) => e.ruleId === rule.id && e.isDemo);
            return (
              <div key={rule.id} className="card trophy">
                <Badge kind={rule.badge} earned={!!ev || !!demo} demo={!ev && !!demo} />
                <div>
                  <h3 style={{ margin: 0 }}>{rule.title} {!ev && demo ? <span className="demo-tag">DEMO</span> : null}</h3>
                  <div className="muted" style={{ fontSize: 14 }}>{rule.description}</div>
                  <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
                    {ev ? `Earned ${formatLocal(ev.achievedAt, s.timezone, { dateStyle: "medium" })}` : rule.threshold ? `${count(Math.min(v.bestViews, rule.threshold))} / ${count(rule.threshold)} views` : "Not yet"}
                    {rule.xp ? ` · ${rule.xp} XP` : ""}{rule.rewardCents ? ` · ${money(rule.rewardCents)} reward` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {v.ledger.length ? (
        <section className="section">
          <div className="section-head"><h2 style={{ margin: 0 }}>Ledger</h2></div>
          <div className="scroll-x"><table className="t"><thead><tr><th>When</th><th>Kind</th><th>Amount</th><th>Note</th></tr></thead>
            <tbody>{v.ledger.map((l) => <tr key={l.id}><td className="num">{formatLocal(l.createdAt, s.timezone, { dateStyle: "short", timeStyle: "short" })}</td><td>{l.kind}</td><td className="num">{money(l.amountCents)}</td><td>{l.note}</td></tr>)}</tbody></table></div>
        </section>
      ) : null}
    </div>
  );
}
