/** Client-safe display labels for Career Map statuses and evidence. */
import type { CareerNodeStatus, EvidenceLabel, NodeKind } from "./types";

export const STATUS_LABELS: Record<CareerNodeStatus, string> = {
  LOCKED: "Locked",
  AVAILABLE: "Available",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/** What a user-set mark is called in the UI ("Not started" reads better than "Available"). */
export const MARK_LABELS: Record<CareerNodeStatus, string> = {
  LOCKED: "Locked",
  AVAILABLE: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const STATUS_DESCRIPTIONS: Record<CareerNodeStatus, string> = {
  COMPLETED: "Your data (or your own mark) shows this stop is done.",
  IN_PROGRESS: "Your data shows activity on this stop.",
  AVAILABLE: "Nothing blocks this stop; you can start it.",
  LOCKED: "A required earlier stop is not done yet.",
};

export const KIND_LABELS: Record<NodeKind, string> = {
  start: "Start",
  stage: "Stage",
  credential: "Credential",
  role: "Role",
  entry: "Entry route",
};

export const EVIDENCE_DESCRIPTIONS: Record<EvidenceLabel, string> = {
  Verified: "Employer-verified or official records",
  "Self-reported": "Entered by you; not checked by anyone",
  Observed: "Seen in your CareerQuest activity",
  Estimate: "Calculated from your data; will change",
  "Marked by you": "Your own mark on the map",
};
