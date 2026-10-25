"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/game/achievement-catalog";
import { markAchievementsSeenAction } from "@/lib/game/actions";
import type { UnseenAchievement } from "@/lib/game/views";
import { ACHIEVEMENT_ICONS, TIER_STYLES } from "./icons";
import { useShouldReduceMotion } from "./use-motion-preference";

const BURST = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  return { x: Math.cos(angle) * 46, y: Math.sin(angle) * 46, tone: i % 3 === 0 ? "bg-gold" : i % 3 === 1 ? "bg-accent" : "bg-success" };
});

/**
 * Dismissible celebration for newly unlocked achievements. Non-blocking (a live region, not a
 * modal); dismissing marks them seen on the server. Reduced motion: no burst, a plain fade.
 */
export function CelebrationOverlay({ items }: { items: UnseenAchievement[] }) {
  const reduce = useShouldReduceMotion();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  const current = items[index];

  const dismiss = () => {
    setOpen(false);
    const ids = items.map((i) => i.id);
    startTransition(async () => {
      await markAchievementsSeenAction(ids);
    });
  };

  if (!current) return null;
  const Icon = ACHIEVEMENT_ICONS[current.icon];
  const tier = TIER_STYLES[current.tier];
  const last = index >= items.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="celebration"
          role="status"
          aria-live="polite"
          aria-labelledby="celebration-title"
          data-testid="achievement-celebration"
          onKeyDown={(e) => {
            if (e.key === "Escape") dismiss();
          }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
          transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 24 }}
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm lg:bottom-8"
        >
          <div className={cn("glass-solid relative overflow-hidden rounded-card p-5", tier.ring)}>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss achievement celebration"
              className="absolute right-3 top-3 rounded-ctl p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold">Achievement unlocked</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0">
                {!reduce &&
                  BURST.map((b, i) => (
                    <motion.span
                      key={`${current.id}-${i}`}
                      aria-hidden
                      className={cn("absolute left-1/2 top-1/2 h-1.5 w-1.5 -ml-[3px] -mt-[3px] rounded-full", b.tone)}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{ x: b.x, y: b.y, opacity: 0, scale: 0.4 }}
                      transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
                    />
                  ))}
                <motion.span
                  key={current.id}
                  className={cn("absolute inset-0 inline-flex items-center justify-center rounded-full", tier.icon)}
                  initial={reduce ? false : { scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 14 }}
                >
                  <Icon className="h-7 w-7" aria-hidden />
                </motion.span>
              </div>
              <div className="min-w-0">
                <p id="celebration-title" className="text-base font-semibold">
                  {current.title}
                </p>
                <p className="text-[11px] text-fg-subtle">{TIER_LABELS[current.tier]}</p>
                <p className="mt-1 text-xs text-fg-muted">{current.description}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-fg-subtle tnum">{items.length > 1 ? `${index + 1} of ${items.length}` : ""}</p>
              <div className="flex gap-2">
                <Link href="/missions/achievements" onClick={dismiss} className={buttonClasses("ghost", "sm")}>
                  View all
                </Link>
                {last ? (
                  <Button size="sm" variant="gold" onClick={dismiss}>
                    Nice!
                  </Button>
                ) : (
                  <Button size="sm" variant="gold" onClick={() => setIndex((i) => i + 1)}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
