import type { ReactNode } from "react";
import { Award, Building2, ExternalLink, GraduationCap } from "lucide-react";
import type { Fact, RoadmapData, SourcedSection } from "@/lib/academy/roadmap";
import { formatDate } from "@/lib/format";
import { FlagBadge } from "./badges";

function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? decodeURIComponent(u.pathname).replace(/\/$/, "") : "";
    const short = path.length > 48 ? `${path.slice(0, 45)}…` : path;
    return `${u.hostname.replace(/^www\./, "")}${short}`;
  } catch {
    return url;
  }
}

/** "2026-10-21" → "Oct 21, 2026" without timezone drift. */
export function checkedOn(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? "unknown date";
  return formatDate(new Date(`${date}T12:00:00Z`), { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function SourceLinks({ urls, verifiedOn }: { urls: string[]; verifiedOn: string | null }) {
  if (!urls.length && !verifiedOn) return null;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs text-fg-subtle">
        Sources{verifiedOn ? ` · last checked ${checkedOn(verifiedOn)}` : ""}
      </p>
      {urls.length > 0 ? (
        <ul className="mt-1.5 space-y-1 text-xs">
          {urls.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 break-all text-accent hover:underline">
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {linkLabel(u)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-warning">No source link recorded for this section — treat it as unverified.</p>
      )}
    </div>
  );
}

export function FactList({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <dl className="space-y-3">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">
            {f.label}
            <FlagBadge flag={f.flag} />
          </dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-fg-muted">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FactCard({ id, title, section, children }: { id: string; title: string; section: SourcedSection | null; children?: ReactNode }) {
  if (!section) return null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="glass scroll-mt-24 rounded-card p-5">
      <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-4">
        <FactList facts={section.facts} />
        {children}
      </div>
      <SourceLinks urls={section.sources} verifiedOn={section.verifiedOn} />
    </section>
  );
}

export function CredentialComparison({ distinction }: { distinction: NonNullable<RoadmapData["distinction"]> }) {
  const cards = [
    { title: "Apprenticeship completion", issuer: "Your DAS-registered training program", body: distinction.apprenticeship, Icon: GraduationCap },
    { title: "DIR electrician certification", issuer: "California DIR / DLSE (Labor Commissioner)", body: distinction.certification, Icon: Award },
    { title: "CSLB C-10 contractor license", issuer: "Contractors State License Board", body: distinction.license, Icon: Building2 },
  ];
  return (
    <section aria-labelledby="credential-comparison" className="space-y-3">
      <div>
        <h2 id="credential-comparison" className="text-lg font-semibold tracking-tight">
          Apprenticeship completion vs DIR electrician certification vs CSLB C-10 contractor license
        </h2>
        <p className="mt-1 text-sm font-medium text-gold">Three different credentials — none automatically grants the others.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {cards.map(({ title, issuer, body, Icon }) => (
          <article key={title} className="glass rounded-card p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-xs text-fg-subtle">{issuer}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{body ?? "Not described in the researched facts."}</p>
          </article>
        ))}
      </div>
      {distinction.summary && <p className="rounded-ctl border border-line bg-surface px-4 py-3 text-sm text-fg-muted">{distinction.summary}</p>}
    </section>
  );
}
