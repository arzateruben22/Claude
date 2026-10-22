import {
  Award,
  BadgeCheck,
  CalendarCheck,
  Clock,
  Crown,
  Flame,
  Gem,
  HardHat,
  Layers,
  MessageSquare,
  Mic,
  Rocket,
  Send,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AchievementIcon, AchievementTier } from "@/lib/game/achievement-catalog";

export const ACHIEVEMENT_ICONS: Record<AchievementIcon, LucideIcon> = {
  send: Send,
  layers: Layers,
  rocket: Rocket,
  trophy: Trophy,
  crown: Crown,
  message: MessageSquare,
  mic: Mic,
  "badge-check": BadgeCheck,
  wallet: Wallet,
  "hard-hat": HardHat,
  clock: Clock,
  zap: Zap,
  award: Award,
  "trending-up": TrendingUp,
  gem: Gem,
  "calendar-check": CalendarCheck,
  flame: Flame,
};

/** Semantic token classes per tier (no raw colors). */
export const TIER_STYLES: Record<AchievementTier, { ring: string; chip: string; icon: string }> = {
  bronze: { ring: "border-warning/40", chip: "bg-warning-soft text-warning", icon: "bg-warning-soft text-warning" },
  silver: { ring: "border-info/40", chip: "bg-info-soft text-info", icon: "bg-info-soft text-info" },
  gold: { ring: "border-gold/50", chip: "bg-gold-soft text-gold", icon: "bg-gold-soft text-gold" },
  platinum: { ring: "border-accent/50", chip: "bg-accent-soft text-accent", icon: "bg-accent-soft text-accent" },
};
