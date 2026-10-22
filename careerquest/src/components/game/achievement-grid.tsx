"use client";

import { motion } from "motion/react";
import { Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/game/achievement-catalog";
import type { AchievementCardView } from "@/lib/game/views";
import { ACHIEVEMENT_ICONS, TIER_STYLES } from "./icons";
import { useShouldReduceMotion } from "./use-motion-preference";
import { formatInstantDay } from "./format";

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

function AchievementTile({ card, index, timezone, reduce }: { card: AchievementCardView; index: number; timezone: string; reduce: boolean }) {
  const Icon = ACHIEVEMENT_ICONS[card.icon];
  const tier = TIER_STYLES[card.tier];
  const titleId = `ach-${card.key}`;
  const animateIn = card.unlocked && !reduce;
  return (
    <motion.article
      aria-labelledby={titleId}
      data-testid="achievement-card"
      data-achievement-key={card.key}
      data-unlocked={card.unlocked ? "true" : "false"}
      initial={animateIn ? { opacity: 0, y: 10, scale: card.fresh ? 0.85 : 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={animateIn ? { delay: Math.min(index, 12) * 0.04, type: "spring", stiffness: 260, damping: 20 } : { duration: 0 }}
      className={cn(
        "relative overflow-hidden rounded-card border p-4 min-w-0 h-full",
        card.unlocked ? cn("bg-bg-elevated/60", tier.ring) : "border-line bg-surface/60",
        card.fresh && "shadow-glow",
      )}
    >
      {card.fresh && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-fg/10 to-transparent"
          initial={{ x: "0%" }}
          animate={{ x: "300%" }}
          transition={{ duration: 1.4, delay: 0.3 + Math.min(index, 12) * 0.04, ease: "easeInOut" }}
        />
      )}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            card.unlocked ? tier.icon : "bg-surface-strong text-fg-subtle",
          )}
        >
          {card.unlocked ? <Icon className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 id={titleId} className={cn("text-sm font-semibold", !card.unlocked && "text-fg-muted")}>
              {card.title}
            </h3>
            {card.fresh && (
              <Badge tone="gold">
                <Sparkles className="h-3 w-3" aria-hidden />
                New
              </Badge>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", card.unlocked ? tier.chip : "bg-surface-strong text-fg-subtle")}>
              {TIER_LABELS[card.tier]}
            </span>
            {card.label && <span className="text-[10px] text-fg-subtle">{card.label}</span>}
          </p>
          {card.unlocked ? (
            <>
              <p className="mt-2 text-xs text-fg-muted">{card.description}</p>
              <p className="mt-2 text-[11px] text-success" data-testid="achievement-status">
                Unlocked {card.unlockedAt ? formatInstantDay(card.unlockedAt, timezone) : ""}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs text-fg-muted">{card.condition}</p>
              <ProgressBar value={card.current} max={card.target} tone="info" className="mt-2 h-1.5" label={`${card.title}: ${fmt(card.current)} of ${fmt(card.target)}`} />
              <p className="mt-1 text-[11px] text-fg-subtle tnum" data-testid="achievement-status">
                Locked · {fmt(card.current)} / {fmt(card.target)}
              </p>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/** Unlocked (with date) and locked (with progress toward the condition) achievements. */
export function AchievementGrid({ cards, timezone }: { cards: AchievementCardView[]; timezone: string }) {
  const reduce = useShouldReduceMotion();
  const unlocked = cards.filter((c) => c.unlocked).sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
  const locked = cards.filter((c) => !c.unlocked).sort((a, b) => b.current / b.target - a.current / a.target);
  return (
    <div className="space-y-6">
      <section aria-labelledby="unlocked-title">
        <h2 id="unlocked-title" className="text-sm font-medium tracking-tight">
          Unlocked <span className="text-fg-subtle tnum">({unlocked.length})</span>
        </h2>
        {unlocked.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">Nothing unlocked yet. Your first application unlocks the first one.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unlocked.map((c, i) => (
              <li key={c.key}>
                <AchievementTile card={c} index={i} timezone={timezone} reduce={reduce} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="locked-title">
        <h2 id="locked-title" className="text-sm font-medium tracking-tight">
          Locked <span className="text-fg-subtle tnum">({locked.length})</span>
        </h2>
        {locked.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">You have unlocked every achievement.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {locked.map((c, i) => (
              <li key={c.key}>
                <AchievementTile card={c} index={i} timezone={timezone} reduce={reduce} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
