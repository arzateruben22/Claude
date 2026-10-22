/**
 * Intent matching for the rules provider. Pure, ordered pattern matching on the user's message:
 * the first matching intent wins, so specific tools ("draft a follow-up email") are checked before
 * broad questions ("what should I do").
 */

export const COACH_INTENTS = [
  "mock_interview",
  "follow_up",
  "cover_letter",
  "tailor",
  "resume_alignment",
  "skill_gaps",
  "programs",
  "salary",
  "bottleneck",
  "roles",
  "today",
  "status",
  "help",
  "unknown",
] as const;

export type CoachIntent = (typeof COACH_INTENTS)[number];

/** Lowercase, strip accents (résumé → resume), collapse whitespace. */
export function normalizeMessage(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const PATTERNS: Array<[CoachIntent, RegExp]> = [
  ["mock_interview", /\b(mock interview|practice interview|interview practice|practice (?:an |some |my )?interview|rehearse (?:an |my )?interview|interview me|quiz me for (?:an |my )?interview)\b/],
  ["follow_up", /\b(follow[- ]?up (?:email|e-mail|message|note|letter)|draft (?:a |an )?follow[- ]?up|write (?:a |an )?follow[- ]?up|follow[- ]?up with|thank[- ]you (?:email|note))\b/],
  ["cover_letter", /\bcover letter\b/],
  ["tailor", /\b(tailor|customi[sz]e|adapt)\b.*\bresume\b|\bresume\b.*\b(for|to match)\b.*\b(application|job|posting|role|position)\b|\bresume for\b/],
  ["resume_alignment", /\bresume\b.*\b(alignment|align|fit|match|matches|review|gap|gaps|keywords?|evaluate|score|strong|good)\b|\b(evaluate|review|check|score)\b.*\bresume\b/],
  ["skill_gaps", /\b(skill gaps?|skills? gaps?|technical gaps?|skills? (?:am i |i'm |i am )?missing|missing skills|what skills|which skills|what should i learn|learn next|what to study)\b/],
  ["programs", /\b(apprenticeships?|jatc|ibew|weca|union program|training program|trust program)\b|\bcompare (?:the )?programs\b/],
  ["salary", /\b(salary|salaries|wage|wages|pay progression|pay scale|how much (?:will|could|can|would) i (?:make|earn)|earning|earnings|journeyman pay|raise|compensation)\b/],
  ["bottleneck", /\b(bottlenecks?|where am i (?:stuck|losing|failing)|where (?:do|does) (?:it|my applications?) (?:stall|stop|drop)|drop[- ]?off|stall(?:ing)?|conversion|funnel)\b/],
  ["roles", /\b(better[- ]fit(?:ting)?|best[- ]fit|which roles|what roles|what jobs|which jobs|best roles|roles? (?:should|to) (?:i )?(?:target|apply)|what (?:kind|type) of (?:jobs|roles)|recommend(?:ed)? (?:roles|jobs)|where (?:do i|should i) get (?:the most )?responses)\b/],
  ["today", /\b(what should i (?:do|work on|focus on)|what do i do|today|this week|priorit(?:y|ies|ize)|next steps?|to-?do|plan for|where should i start)\b/],
  ["status", /\b(how am i doing|how'?s it going|how is it going|my progress|progress|status|stats|statistics|numbers|performance|summary|summari[sz]e|recap|overview|update me|so far)\b/],
  ["help", /^(help|\?|what can you do|commands|menu|hi|hello|hey)\b/],
];

export function detectIntent(text: string): CoachIntent {
  const t = normalizeMessage(text);
  if (!t) return "help";
  for (const [intent, re] of PATTERNS) if (re.test(t)) return intent;
  return "unknown";
}

// ---------------------------------------------------------------------------
// Mock-interview roles
// ---------------------------------------------------------------------------

export const INTERVIEW_ROLES = ["apprentice-electrician", "construction-coordinator", "maintenance-technician"] as const;
export type InterviewRole = (typeof INTERVIEW_ROLES)[number];

export const INTERVIEW_ROLE_LABELS: Record<InterviewRole, string> = {
  "apprentice-electrician": "Apprentice electrician",
  "construction-coordinator": "Construction coordinator",
  "maintenance-technician": "Maintenance technician",
};

export function isInterviewRole(v: unknown): v is InterviewRole {
  return typeof v === "string" && (INTERVIEW_ROLES as readonly string[]).includes(v);
}

/** Role named in free text, if any. */
export function detectInterviewRole(text: string): InterviewRole | null {
  const t = normalizeMessage(text);
  if (/\b(electrician|electrical|wireman|apprentice(?:ship)?|ibew|jatc)\b/.test(t)) return "apprentice-electrician";
  if (/\b(construction|coordinator|project (?:coordinator|assistant|engineer)|assistant project manager|apm|estimator|office)\b/.test(t)) return "construction-coordinator";
  if (/\b(maintenance|technician|tech|facilities|building engineer|hvac|mechanic|industrial)\b/.test(t)) return "maintenance-technician";
  return null;
}

/** Commands understood while a mock interview is running. */
export function interviewCommand(text: string): "stop" | "skip" | null {
  const t = normalizeMessage(text);
  if (/^(stop|end|quit|exit|cancel|finish|done)\b|\b(end|stop|quit) (?:the )?(?:mock )?interview\b/.test(t)) return "stop";
  if (/^(skip|next|pass)\b|\bskip (?:this|the) question\b/.test(t)) return "skip";
  return null;
}
