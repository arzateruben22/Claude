"use client";

import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import { SKILL_BRANCHES, type RequirementView, type SkillMetrics, type SkillView } from "@/lib/skills/catalog";
import { LevelPips } from "./skill-branch";

const fmt = (r: RequirementView, v: number) => (r.format === "percent" ? `${Math.round(v)}%` : Math.floor(v).toLocaleString("en-US"));

function checkedOn(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "an unknown date";
  return formatDate(new Date(`${date}T12:00:00Z`), { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** How to level up a skill: current values, the next threshold, every level's thresholds and links. */
export function SkillDetail({
  skill,
  unlockedAt,
  fieldGoal,
  onSelect,
}: {
  skill: SkillView;
  unlockedAt: string | null;
  fieldGoal: SkillMetrics["fieldHoursGoal"];
  onSelect: (key: string) => void;
}) {
  const branch = SKILL_BRANCHES.find((b) => b.key === skill.branch);
  const h = (s: string) => `skill-${skill.key.replace(/\./g, "-")}-${s}`;
  return (
    <article aria-labelledby={h("title")} className="glass rounded-card p-5 space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-fg-subtle">{branch?.label} skill</p>
        <h2 id={h("title")} tabIndex={-1} className="mt-1 text-lg font-semibold tracking-tight focus:outline-none">
          {skill.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={skill.level >= skill.maxLevel ? "gold" : skill.level > 0 ? "accent" : "neutral"}>
            Level {skill.level} of {skill.maxLevel}
          </Badge>
          {skill.locked && <Badge tone="neutral">Start a prerequisite first</Badge>}
          {skill.unavailable && <Badge tone="warning">Unavailable</Badge>}
          {unlockedAt && <span className="text-xs text-fg-subtle">First reached level 1 on {formatDate(unlockedAt)}</span>}
        </div>
        <LevelPips level={skill.level} max={skill.maxLevel} className="mt-3 max-w-56" />
        <p className="mt-3 text-sm text-fg-muted">{skill.description}</p>
      </header>

      {skill.unavailable && <p className="rounded-ctl border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-fg">{skill.unavailable}</p>}

      <section aria-labelledby={h("next")}>
        <h3 id={h("next")} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          How to level up
        </h3>
        {skill.next ? (
          <div className="mt-2 rounded-ctl border border-line bg-surface p-3">
            <p className="text-sm font-medium text-fg">
              Level {skill.next.level}: {skill.next.mode === "any" ? "any one of" : skill.next.requirements.length > 1 ? "all of" : ""}
            </p>
            <ul className="mt-2 space-y-2.5">
              {skill.next.requirements.map((r) => (
                <li key={r.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-fg-muted">{r.label}</span>
                    <span className="shrink-0 text-xs text-fg-subtle tnum">
                      {fmt(r, r.current)} / {fmt(r, r.target)}
                    </span>
                  </div>
                  <ProgressBar value={Math.min(r.current, r.target)} max={r.target} tone={r.met ? "success" : "accent"} className="mt-1" label={`${r.label}: ${fmt(r, r.current)} of ${fmt(r, r.target)}`} />
                </li>
              ))}
            </ul>
          </div>
        ) : skill.level >= skill.maxLevel ? (
          <p className="mt-2 text-sm text-fg-muted">You reached the top level. Keep it up — levels follow your data, so they drop if the activity behind them is removed.</p>
        ) : (
          <p className="mt-2 text-sm text-fg-muted">This skill cannot level up until the issue above is resolved.</p>
        )}
        <p className="mt-2 text-xs text-fg-subtle">
          <span className="font-medium text-fg-muted">What earns progress:</span> {skill.earns}
        </p>
        {skill.branch === "field" && fieldGoal && (
          <p className="mt-1 text-xs text-fg-subtle">
            Brackets are ⅛, ¼, ½ and all of the {fieldGoal.hours.toLocaleString("en-US")} hours DIR lists for {fieldGoal.name} (last checked {checkedOn(fieldGoal.verifiedOn)}
            {fieldGoal.sources[0] ? (
              <>
                ,{" "}
                <a href={fieldGoal.sources[0]} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  source
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
            ).
          </p>
        )}
      </section>

      <section aria-labelledby={h("current")}>
        <h3 id={h("current")} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          Your activity
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          {skill.current.map((c) => (
            <div key={c.label} className="rounded-ctl border border-line px-3 py-2">
              <dt className="text-xs text-fg-subtle">{c.label}</dt>
              <dd className="text-sm font-medium text-fg tnum">{c.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={h("levels")}>
        <h3 id={h("levels")} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          All levels
        </h3>
        <ol className="mt-2 space-y-2">
          {skill.levels.map((l) => (
            <li key={l.level} className="flex items-start gap-2.5 text-sm">
              <span
                className={l.met && l.level <= skill.level ? "mt-0.5 text-success" : "mt-0.5 text-fg-subtle"}
                aria-label={l.met && l.level <= skill.level ? "Reached" : "Not reached"}
              >
                {l.met && l.level <= skill.level ? <Check className="h-4 w-4" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
              </span>
              <span>
                <span className="font-medium text-fg">Level {l.level}</span>
                <span className="text-fg-muted">
                  {" — "}
                  {l.requirements.map((r) => r.label).join(l.mode === "any" ? " or " : "; ")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {skill.prerequisites.length > 0 && (
        <section aria-labelledby={h("prereqs")}>
          <h3 id={h("prereqs")} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            Builds on
          </h3>
          <ul className="mt-2 space-y-1.5">
            {skill.prerequisites.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-2 text-sm">
                <button type="button" onClick={() => onSelect(p.key)} className="text-left text-accent hover:underline">
                  {p.title}
                </button>
                <span className="text-xs text-fg-subtle tnum">Level {p.level}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-fg-subtle">Prerequisites are a suggested order; activity always counts toward this skill.</p>
        </section>
      )}

      <section aria-labelledby={h("links")}>
        <h3 id={h("links")} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          Where to work on it
        </h3>
        <ul className="mt-2 space-y-1.5">
          {skill.links.map((l) => (
            <li key={l.href}>
              {/^https?:/.test(l.href) ? (
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  {l.label}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                <Link href={l.href} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  {l.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="border-t border-line pt-3 text-xs text-fg-subtle">Levels reflect your activity in CareerQuest. They are not a credential, license or certification.</p>
    </article>
  );
}
