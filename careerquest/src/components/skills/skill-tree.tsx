"use client";

import { useMemo, useRef, useState } from "react";
import { SKILL_BRANCHES, type SkillMetrics, type SkillView } from "@/lib/skills/catalog";
import { SkillBranchTree } from "./skill-branch";
import { SkillDetail } from "./skill-detail";

function reducedMotion(): boolean {
  return document.documentElement.dataset.reducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The skill tree: three branches (Electrical, Field, Job search) with prerequisite edges, and a
 * detail panel for the selected skill. Selection is mirrored to `?skill=` for linking.
 */
export function SkillTreeExplorer({
  skills,
  unlockedAt,
  fieldGoal,
  initialKey,
}: {
  skills: SkillView[];
  unlockedAt: Record<string, string | null>;
  fieldGoal: SkillMetrics["fieldHoursGoal"];
  initialKey?: string | null;
}) {
  const byKey = useMemo(() => new Map(skills.map((s) => [s.key, s])), [skills]);
  const fallback = useMemo(() => {
    // Default to the skill closest to its next level among started ones, else the first skill.
    const started = skills.filter((s) => s.level > 0 && s.level < s.maxLevel).sort((a, b) => b.progressToNext - a.progressToNext);
    return started[0]?.key ?? skills[0]?.key ?? "";
  }, [skills]);
  const [selectedKey, setSelectedKey] = useState(initialKey && byKey.has(initialKey) ? initialKey : fallback);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selected = byKey.get(selectedKey) ?? byKey.get(fallback) ?? null;

  const external = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const s of skills) {
      const titles = s.prerequisites.filter((p) => byKey.get(p.key)?.branch !== s.branch).map((p) => p.title);
      if (titles.length) out.set(s.key, titles);
    }
    return out;
  }, [skills, byKey]);

  function select(key: string) {
    if (!byKey.has(key)) return;
    setSelectedKey(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("skill", key);
      window.history.replaceState(null, "", url);
    } catch {
      // URL sync is a convenience only.
    }
    const panel = panelRef.current;
    if (panel && !window.matchMedia("(min-width: 1024px)").matches) {
      panel.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }

  if (!selected) return null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
      <div className="@container min-w-0" data-testid="skill-tree">
        <div className="grid gap-4 @3xl:grid-cols-2">
          {SKILL_BRANCHES.map((b) => {
            const inBranch = skills.filter((s) => s.branch === b.key);
            if (!inBranch.length) return null;
            const levels = inBranch.reduce((a, s) => a + s.level, 0);
            const max = inBranch.reduce((a, s) => a + s.maxLevel, 0);
            return (
              <section
                key={b.key}
                aria-labelledby={`skills-${b.key}`}
                className={b.key === "electrical" ? "glass rounded-card p-4 @3xl:row-span-2" : "glass rounded-card p-4"}
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 id={`skills-${b.key}`} className="text-sm font-semibold">
                    {b.label}
                  </h2>
                  <span className="text-xs text-fg-subtle tnum">
                    {levels} / {max} levels
                  </span>
                </div>
                <p className="mb-3 text-xs text-fg-muted">{b.description}</p>
                <SkillBranchTree skills={inBranch} selectedKey={selected.key} onSelect={select} external={external} />
              </section>
            );
          })}
        </div>
      </div>
      <div ref={panelRef} className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain">
        <SkillDetail skill={selected} unlockedAt={unlockedAt[selected.key] ?? null} fieldGoal={fieldGoal} onSelect={select} />
      </div>
      <p className="sr-only" aria-live="polite">{`${selected.title}: level ${selected.level} of ${selected.maxLevel}.`}</p>
    </div>
  );
}
