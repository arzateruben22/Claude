import { TRACK_KEYS, type TrackKey } from "./constants";

/** Display metadata for the six learning tracks (UI copy, not lesson content). */
export const TRACK_META: Record<TrackKey, { label: string; description: string }> = {
  FUNDAMENTALS: {
    label: "Electrical fundamentals",
    description: "Voltage, current and resistance, Ohm's law, series and parallel circuits, power, AC/DC and magnetism.",
  },
  SAFETY: {
    label: "Safety",
    description: "Shock and arc-flash hazards, lockout/tagout, grounding and bonding, meters and emergency response.",
  },
  INSTALLATION: {
    label: "Installation",
    description: "Conduit, wiring methods and boxes, conductors and ampacity, plan reading and circuit layout.",
  },
  SYSTEMS: {
    label: "Systems",
    description: "Transformers, three-phase power, motors and controls, lighting systems and troubleshooting.",
  },
  CODE: {
    label: "NEC fundamentals",
    description: "How the National Electrical Code is organized and how its main chapters apply on the job.",
  },
  EXAM_PREP: {
    label: "Exam prep",
    description: "The California certification exam process, code look-up speed, exam math and a full practice exam.",
  },
};

export function trackLabel(track: TrackKey): string {
  return TRACK_META[track]?.label ?? track;
}

export function trackIndex(track: TrackKey): number {
  return TRACK_KEYS.indexOf(track);
}
