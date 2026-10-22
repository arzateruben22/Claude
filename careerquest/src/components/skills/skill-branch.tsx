"use client";

import { Lock } from "lucide-react";
import type { SkillView } from "@/lib/skills/catalog";
import { cn } from "@/lib/utils";

/** Row height and card height (px) of the tree grid; edges are drawn in the same units. */
const ROW = 132;
const CARD = 108;
const TOP = ((ROW - CARD) / 2 / ROW) * 100;
const BOTTOM = 100 - TOP;

export function LevelPips({ level, max, className }: { level: number; max: number; className?: string }) {
  return (
    <span className={cn("flex gap-1", className)} aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn("h-1.5 w-full rounded-full", i < level ? "bg-gold" : "bg-surface-strong")} />
      ))}
    </span>
  );
}

/** One branch of the tree: skills on a tier grid with connectors to their prerequisites. */
export function SkillBranchTree({
  skills,
  selectedKey,
  onSelect,
  external,
}: {
  skills: SkillView[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Titles of prerequisites that live in another branch, keyed by skill. */
  external: Map<string, string[]>;
}) {
  const cols = Math.max(1, ...skills.map((s) => s.col + 1));
  const rows = Math.max(1, ...skills.map((s) => s.tier + 1));
  const inBranch = new Map(skills.map((s) => [s.key, s]));
  const x = (col: number) => ((col + 0.5) / cols) * 100;

  return (
    <div className="relative" style={{ height: rows * ROW }}>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 100 ${rows * 100}`}
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
      >
        {skills.flatMap((s) =>
          s.prerequisites
            .filter((p) => inBranch.has(p.key))
            .map((p) => {
              const from = inBranch.get(p.key)!;
              const x1 = x(from.col);
              const y1 = from.tier * 100 + BOTTOM;
              const x2 = x(s.col);
              const y2 = s.tier * 100 + TOP;
              const my = (y1 + y2) / 2;
              const active = p.level > 0;
              const touches = s.key === selectedKey || p.key === selectedKey;
              return (
                <path
                  key={`${p.key}-${s.key}`}
                  d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                  fill="none"
                  stroke={active ? "var(--accent)" : "var(--line-strong)"}
                  strokeWidth={touches ? 2.5 : 1.5}
                  strokeDasharray={active ? undefined : "4 4"}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }),
        )}
      </svg>
      {skills.map((s) => {
        const selected = s.key === selectedKey;
        const ext = external.get(s.key) ?? [];
        return (
          <div
            key={s.key}
            className="absolute px-1.5"
            style={{ left: `${(s.col / cols) * 100}%`, width: `${100 / cols}%`, top: s.tier * ROW + (ROW - CARD) / 2, height: CARD }}
          >
            <button
              type="button"
              aria-pressed={selected}
              data-skill-key={s.key}
              onClick={() => onSelect(s.key)}
              className={cn(
                "flex h-full w-full cursor-pointer flex-col rounded-ctl border px-3 py-2.5 text-left transition-colors hover:border-accent/70",
                s.level >= s.maxLevel ? "border-gold/50 bg-gold-soft" : s.level > 0 ? "border-accent/40 bg-accent-soft" : "border-line bg-bg-elevated",
                selected && "ring-2 ring-accent",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-fg">{s.title}</span>
                {s.locked && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />}
              </span>
              <span className="mt-auto">
                <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                  <span className="font-semibold text-fg tnum">
                    Level {s.level} <span className="font-normal text-fg-subtle">of {s.maxLevel}</span>
                  </span>
                  {s.unavailable ? (
                    <span className="text-warning">Unavailable</span>
                  ) : s.level < s.maxLevel ? (
                    <span className="text-fg-subtle tnum">{Math.round(s.progressToNext * 100)}% to {s.level + 1}</span>
                  ) : (
                    <span className="text-gold">Max level</span>
                  )}
                </span>
                <LevelPips level={s.level} max={s.maxLevel} className="mt-1.5" />
                {(s.locked || ext.length > 0) && (
                  <span className="mt-1 block truncate text-[11px] text-fg-subtle">
                    {s.locked ? `Start with ${s.prerequisites.filter((p) => p.level === 0).map((p) => p.title).join(", ")}` : `Builds on ${ext.join(", ")}`}
                  </span>
                )}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
