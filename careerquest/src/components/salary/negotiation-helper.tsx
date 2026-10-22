"use client";

import { useId, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import type { SalaryPeriod } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { AnnualizedOffer } from "@/lib/offers/math";
import type { MarketReference } from "@/lib/salary/reference";
import { WEEKS_PER_YEAR } from "@/lib/salary/pay";
import { dayKeyLabel, usd, usdRate } from "./format";

export type NegotiationOffer = {
  company: string;
  title: string;
  period: SalaryPeriod;
  baseAmount: number;
  hoursPerWeek: number;
  overtimeHours: number;
  annual: AnnualizedOffer;
  /** Already formatted in the user's timezone, or null. */
  decisionDueLabel: string | null;
};

const EXTRA_ASKS = [
  { key: "overtime", text: "How overtime is assigned and paid, and how many overtime hours are typical (I understand it is not guaranteed)." },
  { key: "review", text: "When the first pay review happens and how raises are decided." },
  { key: "training", text: "Whether training, certification fees or tools are paid by the company." },
  { key: "start", text: "Flexibility on the start date." },
  { key: "pto", text: "Paid time off and when benefits start." },
  { key: "signing", text: "Whether a signing bonus is possible." },
] as const;

const STATUS_BADGE = {
  verified: { tone: "success" as const, text: "Verified source" },
  partial: { tone: "warning" as const, text: "Partially verified" },
  unverified: { tone: "warning" as const, text: "Unverified" },
};

function refSentence(ref: MarketReference): string {
  const median = ref.points.find((p) => p.label === "Median") ?? ref.points.find((p) => p.label === "Mean") ?? ref.points[0]!;
  const p25 = ref.points.find((p) => p.label === "25th percentile");
  const p75 = ref.points.find((p) => p.label === "75th percentile");
  const fmt = (p: { annual: number | null; hourly: number | null }) => (p.hourly !== null ? `${usdRate(p.hourly)}/hour` : usd(p.annual));
  const range = p25 && p75 ? `; middle half ${fmt(p25)} to ${fmt(p75)}` : "";
  const flag = ref.status === "verified" ? "" : ", not yet confirmed against the official table";
  return `For reference, electricians in ${ref.areaLabel} had ${median.label === "Mean" ? "a mean" : "a median"} pay of ${fmt(median)} (${ref.period}${range}; ${ref.citeAs}${flag}).`;
}

/**
 * Builds talking points from the user's own offer numbers. Market references come only from the cited
 * research (electricians, SOC 47-2111) and are shown with source, verification status and date;
 * otherwise the user enters their own research.
 */
export function NegotiationHelper({ offer, market, occupation }: { offer: NegotiationOffer; market: MarketReference[]; occupation: string }) {
  const id = useId();
  const toast = useToast();
  const [counter, setCounter] = useState("");
  const [refKey, setRefKey] = useState<string>("own");
  const [ownLow, setOwnLow] = useState("");
  const [ownHigh, setOwnHigh] = useState("");
  const [ownSource, setOwnSource] = useState("");
  const [asks, setAsks] = useState<Record<string, boolean>>({ overtime: true, review: true });

  const hourly = offer.period === "HOURLY";
  const counterNum = Number(counter.replace(/[$,\s]/g, ""));
  const counterOk = counter.trim() !== "" && Number.isFinite(counterNum) && counterNum > 0;
  const counterAnnual = counterOk ? (hourly ? counterNum * offer.hoursPerWeek * WEEKS_PER_YEAR : counterNum) : null;
  const counterPct = counterOk ? (counterNum / offer.baseAmount - 1) * 100 : null;
  const reference = market.find((m) => m.key === refKey) ?? null;
  const fmtAmount = (n: number) => (hourly ? `${usdRate(n)}/hour` : `${usd(n)} a year`);

  const lines: string[] = [];
  lines.push("Hi [name],", "");
  lines.push(`Thank you for the offer for the ${offer.title} position at ${offer.company}. I'm excited about the role and would like to make it work.`, "");
  lines.push(
    `The offer is ${fmtAmount(offer.baseAmount)}${hourly ? ` (${usd(offer.annual.annualBase)} a year at ${offer.hoursPerWeek} hours a week)` : ""}.` +
      (counterOk ? ` I'd like to ask for ${fmtAmount(counterNum)}.` : " I'd like to discuss the base pay. [State the number you are asking for.]"),
  );
  if (reference) lines.push(refSentence(reference));
  if (refKey === "own" && ownLow.trim() && ownHigh.trim()) {
    lines.push(`My research${ownSource.trim() ? ` (${ownSource.trim()})` : ""} shows about ${ownLow.trim()} to ${ownHigh.trim()} for similar roles in this area.`);
  }
  lines.push("[Add one or two specifics you bring: certifications, years of experience, tools, licenses, safety record.]", "");
  const chosen = EXTRA_ASKS.filter((a) => asks[a.key]);
  if (chosen.length) {
    lines.push("I'd also like to confirm:");
    for (const a of chosen) lines.push(`- ${a.text}`);
    lines.push("");
  }
  if (offer.decisionDueLabel) lines.push(`I'll get back to you by ${offer.decisionDueLabel}.`);
  lines.push("Thank you again. I look forward to finding something that works for both of us.");
  const template = lines.join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(template);
      toast.push({ tone: "success", title: "Talking points copied" });
    } catch {
      toast.push({ tone: "danger", title: "Could not copy", description: "Select the text and copy it manually." });
    }
  };

  return (
    <Card data-testid="negotiation-helper">
      <CardHeader>
        <div>
          <CardTitle>Negotiation helper</CardTitle>
          <CardDescription>A starting script built from your offer. Edit it before you use it; nothing is sent for you.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={hourly ? "Your counter: hourly rate (USD)" : "Your counter: annual salary (USD)"} htmlFor={`${id}-counter`}>
            <Input id={`${id}-counter`} inputMode="decimal" value={counter} onChange={(e) => setCounter(e.target.value)} placeholder={hourly ? "e.g. 36.00" : "e.g. 90000"} />
          </Field>
          <div className="text-sm self-end pb-2 text-fg-muted" aria-live="polite">
            {counterOk && counterAnnual !== null && counterPct !== null ? (
              <>
                {counterPct >= 0 ? "+" : "−"}
                {Math.abs(counterPct).toFixed(1)}% vs the offer · {usd(counterAnnual)} a year base
              </>
            ) : (
              "Enter the number you plan to ask for."
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Market reference" htmlFor={`${id}-ref`} hint="Only cited data is offered here; it covers electricians only.">
            <Select id={`${id}-ref`} value={refKey} onChange={(e) => setRefKey(e.target.value)}>
              <option value="own">My own research (enter below)</option>
              {market.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                  {m.status === "verified" ? "" : " (unverified)"}
                </option>
              ))}
            </Select>
          </Field>
          {reference ? (
            <div className="rounded-ctl border border-line bg-surface p-3 text-sm" data-testid="negotiation-reference">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_BADGE[reference.status].tone}>{STATUS_BADGE[reference.status].text}</Badge>
                <span className="text-xs text-fg-muted">
                  {occupation} · last checked {dayKeyLabel(reference.checkedOn)}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs tnum">
                {reference.points.map((p) => (
                  <div key={p.label}>
                    <dt className="text-fg-muted">{p.label}</dt>
                    <dd className="font-medium">
                      {p.annual !== null ? usd(p.annual) : "—"}
                      {p.hourly !== null && <span className="text-fg-muted font-normal"> · {usdRate(p.hourly)}/h</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] text-fg-muted break-words">Source: {reference.source}</p>
              {reference.statusNote && <p className="mt-1 text-[11px] text-fg-muted break-words">{reference.statusNote}</p>}
              {reference.sourceUrls[0] && (
                <a href={reference.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-accent hover:underline">
                  <span className="truncate">{reference.sourceUrls[0].replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
              <p className="mt-2 text-[11px] text-fg-muted">
                A regional average for the whole occupation, not a quote for this employer, role level or schedule. Use it only if this offer is an
                electrician role in that area.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Low end you found" htmlFor={`${id}-low`}>
                <Input id={`${id}-low`} value={ownLow} onChange={(e) => setOwnLow(e.target.value)} placeholder={hourly ? "$32/hour" : "$75,000"} />
              </Field>
              <Field label="High end you found" htmlFor={`${id}-high`}>
                <Input id={`${id}-high`} value={ownHigh} onChange={(e) => setOwnHigh(e.target.value)} placeholder={hourly ? "$40/hour" : "$95,000"} />
              </Field>
              <Field label="Where it comes from" htmlFor={`${id}-src`}>
                <Input id={`${id}-src`} value={ownSource} onChange={(e) => setOwnSource(e.target.value)} placeholder="e.g. 3 postings in Orange County" />
              </Field>
              <p className="sm:col-span-3 text-xs text-fg-muted">
                Enter ranges from your own research (job postings, union wage sheets, people in the trade). They are used only in your script.
              </p>
            </div>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-fg-muted">Also ask about</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXTRA_ASKS.map((a) => (
              <Checkbox key={a.key} label={a.text} checked={!!asks[a.key]} onChange={(e) => setAsks((s) => ({ ...s, [a.key]: e.target.checked }))} className="items-start" />
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-medium text-fg-muted" id={`${id}-tpl-label`}>
              Talking points
            </p>
            <Button variant="secondary" size="sm" onClick={copy}>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy
            </Button>
          </div>
          <pre
            aria-labelledby={`${id}-tpl-label`}
            className="whitespace-pre-wrap break-words rounded-ctl border border-line bg-bg-elevated p-3 text-sm font-sans text-fg"
            data-testid="negotiation-template"
          >
            {template}
          </pre>
        </div>

        <div className="text-xs text-fg-muted space-y-1">
          <p className="font-medium text-fg">Before you reply</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Get the full offer in writing: base pay, hours, overtime policy, bonus terms and when benefits start.</li>
            <li>Decide your walk-away number first; the comparison table shows how this offer sits against your targets.</li>
            <li>Ask once, with a reason, and treat overtime as a possibility rather than part of your pay.</li>
            <li>Do not accept verbally until you have read the written terms.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
