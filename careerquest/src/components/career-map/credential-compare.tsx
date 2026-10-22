import Link from "next/link";
import { ArrowRight, Award, Building2, GraduationCap } from "lucide-react";
import type { CareerMapView, MapFact } from "@/lib/career-map/types";
import { checkedOn, FactSources } from "./fact-list";
import { FactFlagBadge } from "./status-meta";

const ICONS = [GraduationCap, Award, Building2];

/** Apprenticeship completion vs DIR certification vs CSLB C-10 license, from the researched seed. */
export function CredentialCompare({ facts }: { facts: MapFact[] }) {
  return (
    <section aria-labelledby="cm-credentials" className="glass rounded-card p-5">
      <h2 id="cm-credentials" className="text-base font-semibold tracking-tight">
        Three different credentials
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Finishing a union or merit-shop apprenticeship, holding California (DIR) electrician certification and holding a CSLB C-10 contractor
        license are separate things. <strong className="text-fg">None of them automatically grants the others.</strong>
      </p>
      {facts.length > 0 ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {facts.map((f, i) => {
            const Icon = ICONS[i] ?? Award;
            return (
              <li key={f.label} className="rounded-ctl border border-line bg-surface p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  <Icon className="h-4 w-4 text-accent" aria-hidden />
                  {f.label}
                  <FactFlagBadge flag={f.flag} />
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.value}</p>
                <FactSources fact={f} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-warning">The researched comparison could not be loaded. See the certification roadmap for details.</p>
      )}
      <Link href="/academy/roadmap" className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
        Full certification roadmap
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

/** How the figures on the map were researched and when they were last checked. */
export function ResearchNote({ seed }: { seed: CareerMapView["seed"] }) {
  return (
    <section aria-labelledby="cm-research" className="rounded-card border border-line p-4 text-xs text-fg-muted">
      <h2 id="cm-research" className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        About the figures on this map
      </h2>
      <p className="mt-2">
        Electrician-path hours, fees and durations come only from CareerQuest&apos;s research files
        {seed.verifiedOn ? `, last checked ${checkedOn(seed.verifiedOn)}` : ""}. Each figure links to its sources; items marked Unverified or
        Conflicting need confirming on the official site before you act on them
        {seed.unverifiedCount ? ` (${seed.unverifiedCount} open research items)` : ""}. Side branches show descriptions only. Durations are
        estimates. Rules and fees change — verify on the official site before acting.
      </p>
      {seed.verificationMethod && <p className="mt-2 text-fg-subtle">{seed.verificationMethod}</p>}
    </section>
  );
}
