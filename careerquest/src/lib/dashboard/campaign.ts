/**
 * Campaign timeline math for "Operation Get Hired". Pure.
 * Phases split the campaign into thirds (days 1–30 / 31–60 / 61–90 for a 90-day campaign);
 * after the campaign length the user is "beyond" the campaign and we say so plainly.
 */
import { addDaysUtc as addUtcDays, diffDaysUtc as daysBetween } from "@/lib/goals/days";

export type PhaseSegment = { index: 1 | 2 | 3; name: string; startDay: number; endDay: number };

export type CampaignTimeline = {
  started: boolean;
  day: number;
  lengthDays: number;
  startDate: Date;
  endDate: Date;
  phase: 1 | 2 | 3 | null;
  phaseName: string | null;
  beyond: boolean;
  /** 0..1 position of today inside the campaign (1 when beyond). */
  progress: number;
  phases: PhaseSegment[];
  /** e.g. "Day 12 of 90 · Phase 1" */
  eyebrow: string;
};

export const PHASE_NAMES: Record<1 | 2 | 3, string> = { 1: "Launch", 2: "Momentum", 3: "Close" };

export function phaseSegments(lengthDays: number): PhaseSegment[] {
  const len = Math.max(3, Math.floor(lengthDays));
  const third = len / 3;
  const bounds = [Math.round(third), Math.round(third * 2), len];
  return ([1, 2, 3] as const).map((index) => ({
    index,
    name: PHASE_NAMES[index],
    startDay: index === 1 ? 1 : bounds[index - 2]! + 1,
    endDay: bounds[index - 1]!,
  }));
}

export function campaignTimeline(opts: { startDate: Date; today: Date; lengthDays: number }): CampaignTimeline {
  const lengthDays = Math.max(3, Math.floor(opts.lengthDays) || 90);
  const day = daysBetween(opts.startDate, opts.today) + 1;
  const started = day >= 1;
  const beyond = day > lengthDays;
  const phases = phaseSegments(lengthDays);
  const current = started && !beyond ? phases.find((p) => day >= p.startDay && day <= p.endDay) ?? null : null;
  const progress = !started ? 0 : beyond ? 1 : Math.min(1, Math.max(0, (day - 1) / lengthDays));
  const endDate = addUtcDays(opts.startDate, lengthDays - 1);

  let eyebrow: string;
  if (!started) eyebrow = `Campaign starts in ${1 - day} day${1 - day === 1 ? "" : "s"}`;
  else if (beyond) eyebrow = `Day ${day} · Beyond the ${lengthDays}-day campaign`;
  else eyebrow = `Day ${day} of ${lengthDays} · Phase ${current?.index ?? 1}`;

  return {
    started,
    day,
    lengthDays,
    startDate: opts.startDate,
    endDate,
    phase: current?.index ?? null,
    phaseName: current?.name ?? null,
    beyond,
    progress,
    phases,
    eyebrow,
  };
}
