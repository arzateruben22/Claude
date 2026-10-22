/**
 * Mock interviews: question banks for three target roles and STAR-based heuristic feedback. Pure.
 *
 * The feedback is a keyword heuristic. It checks whether an answer *shows* the parts of a STAR story
 * (Situation, Task, Action, Result) and touches the points a strong answer usually covers; it does
 * not judge truth or predict a hiring decision, and the UI says so on every piece of feedback.
 */
import { INTERVIEW_ROLE_LABELS, type InterviewRole } from "./intents";

export type QuestionKind = "behavioral" | "situational" | "technical";

export type InterviewQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  /** Points a strong answer usually touches, each matched by any of its keyword patterns. */
  keyPoints: Array<{ label: string; patterns: RegExp[] }>;
  tip: string;
};

const p = (label: string, ...patterns: RegExp[]) => ({ label, patterns });

export const QUESTION_BANK: Record<InterviewRole, InterviewQuestion[]> = {
  "apprentice-electrician": [
    {
      id: "ae-why",
      kind: "behavioral",
      text: "Why do you want to become an electrician, and what have you done so far to prepare?",
      keyPoints: [p("a specific reason for the trade", /\b(because|reason|interest|enjoy|like working|hands[- ]on|always)\b/), p("concrete preparation (classes, math, tools, practice)", /\b(class|course|algebra|math|academy|lesson|studied|practic|tools?|helper|volunteer|worked)\b/), p("commitment to the long training path", /\b(years?|apprentice(?:ship)?|commit|long[- ]term|career|school at night|night school)\b/)],
      tip: "Name one real moment that got you interested, then two concrete things you've done since.",
    },
    {
      id: "ae-safety",
      kind: "behavioral",
      text: "Tell me about a time you noticed something unsafe at work or school. What did you do?",
      keyPoints: [p("you stopped or paused the work", /\b(stop|stopped|paused|halt|didn'?t continue|refused)\b/), p("you reported it to someone responsible", /\b(report|reported|told|supervisor|foreman|manager|lead|teacher)\b/), p("the specific hazard", /\b(hazard|wire|cord|ladder|ppe|gloves|glasses|live|energized|spill|trip|guard|lockout|tagout|loto)\b/), p("what changed afterwards", /\b(fixed|replaced|changed|after that|since then|result|nobody got hurt|no one got hurt)\b/)],
      tip: "Safety answers land best when you clearly stopped, reported, and followed up.",
    },
    {
      id: "ae-ohms",
      kind: "technical",
      text: "In your own words, what does Ohm's law describe, and when would you use it on the job?",
      keyPoints: [p("voltage", /\bvolt(?:age|s)?\b/), p("current", /\b(current|amps?|amperage)\b/), p("resistance", /\b(resistance|ohms?)\b/), p("the relationship (V = I × R)", /\bv\s*=\s*i\s*[x×*]?\s*r\b|\bi\s*=\s*v\s*\/\s*r\b|\bmultipl|\bdivid|\bproportional\b/), p("a practical use (sizing, troubleshooting, checking a reading)", /\b(troubleshoot|calculate|figure out|check|measure|meter|size|sizing|load|breaker|wire)\b/)],
      tip: "Define the three quantities, state the relationship, then give one job-site example.",
    },
    {
      id: "ae-untrained",
      kind: "situational",
      text: "Your journeyman asks you to do a task you haven't been trained on. What do you do?",
      keyPoints: [p("you say honestly that you haven't done it", /\b(honest|tell (?:him|her|them)|let (?:him|her|them) know|haven'?t done|not trained|never done|admit)\b/), p("you ask to be shown or supervised", /\b(ask|show me|watch|supervis|walk me through|guidance|learn)\b/), p("safety comes first", /\b(safe|safety|de-?energi[sz]ed|lockout|tagout|loto|ppe)\b/)],
      tip: "Interviewers want to hear that you'd ask rather than guess, especially around energized work.",
    },
    {
      id: "ae-learning",
      kind: "behavioral",
      text: "Tell me about a time you had to learn something difficult quickly.",
      keyPoints: [p("what made it difficult", /\b(difficult|hard|new|never|challeng|confus)\b/), p("how you learned it", /\b(practic|studied|asked|watched|notes|repeat|step by step|broke it down)\b/), p("the outcome", /\b(passed|finished|learned|could|able to|result|now i)\b/)],
      tip: "Show your learning method; apprenticeships are mostly learning on the job.",
    },
    {
      id: "ae-reliability",
      kind: "behavioral",
      text: "Apprenticeships mean early starts and classes at night. Tell me about a time you balanced work with another big commitment.",
      keyPoints: [p("both commitments", /\b(work|job|school|class|family|kids?|second job)\b/), p("how you organized your time", /\b(schedul|plan|calendar|routine|early|organi[sz]|prioriti)\b/), p("reliability (showing up on time)", /\b(on time|never missed|showed up|attendance|reliable|dependable)\b/)],
      tip: "Reliability is a top hiring factor for apprentices; give evidence such as attendance.",
    },
  ],
  "construction-coordinator": [
    {
      id: "cc-schedule",
      kind: "behavioral",
      text: "Tell me about a time you kept a project or schedule on track when something changed.",
      keyPoints: [p("what changed", /\b(changed|delay|late|moved|weather|shortage|issue|problem)\b/), p("who you communicated with", /\b(called|emailed|told|updated|team|super(?:intendent)?|pm|project manager|sub(?:contractor)?s?|client|owner)\b/), p("how you re-planned", /\b(re-?schedul|re-?plan|adjust|resequence|priorit|look-?ahead|updated the schedule)\b/), p("the outcome", /\b(on time|on schedule|finished|saved|avoided|result|met the deadline)\b/)],
      tip: "Coordinators are judged on communication; say who you told, when, and how.",
    },
    {
      id: "cc-docs",
      kind: "technical",
      text: "How do you keep track of documents like RFIs, submittals and change orders?",
      keyPoints: [p("a log or tracking system", /\b(log|tracker|spreadsheet|list|register|system)\b/), p("the tools you've used", /\b(procore|excel|sheets|bluebeam|smartsheet|plangrid|autodesk|software)\b/), p("due dates and follow-up", /\b(due|deadline|follow[- ]?up|remind|status|aging)\b/), p("version control / filing", /\b(version|revision|filed|folder|naming|latest)\b/)],
      tip: "Describe a system: what you log, where, how you track due dates and chase overdue items. Only name tools you have actually used.",
    },
    {
      id: "cc-conflict",
      kind: "behavioral",
      text: "Describe a time you handled a disagreement between two people you worked with.",
      keyPoints: [p("both sides' views", /\b(both|each side|their side|perspective|point of view|listened)\b/), p("what you did to resolve it", /\b(met|talked|sat down|suggested|proposed|compromise|agreed|mediat)\b/), p("the result", /\b(resolved|agreed|worked|result|after that|since then)\b/)],
      tip: "Stay neutral in the story and focus on the steps you took.",
    },
    {
      id: "cc-missing-doc",
      kind: "situational",
      text: "A subcontractor hasn't returned a required document and the deadline is tomorrow. What do you do?",
      keyPoints: [p("contact them directly today", /\b(call|called|phone|text|email|contact|reach out)\b/), p("escalate to the right person", /\b(escalat|pm|project manager|super(?:intendent)?|let (?:my )?(?:boss|manager) know)\b/), p("document the communication", /\b(document|record|note|in writing|paper trail|log)\b/), p("a backup plan", /\b(backup|plan b|extension|alternative|partial)\b/)],
      tip: "Show urgency, escalation and a paper trail.",
    },
    {
      id: "cc-mistake",
      kind: "behavioral",
      text: "Tell me about a time you made a mistake in paperwork or data. How did you catch and fix it?",
      keyPoints: [p("owning the mistake", /\b(my mistake|i made|i missed|i entered|i forgot|my fault|i realized)\b/), p("how you caught it", /\b(caught|noticed|double[- ]check|review|audit|found)\b/), p("the fix and prevention", /\b(fixed|corrected|checklist|now i|since then|process|prevent)\b/)],
      tip: "Owning it plus a prevention step is what makes this answer strong.",
    },
    {
      id: "cc-tools",
      kind: "technical",
      text: "What tools or software have you used to track tasks, costs or schedules?",
      keyPoints: [p("specific tools", /\b(excel|sheets|procore|ms project|microsoft project|primavera|p6|smartsheet|bluebeam|quickbooks|trello|asana|outlook)\b/), p("what you used them for", /\b(track|schedul|budget|cost|invoice|log|report)\b/), p("how proficient you are", /\b(daily|every day|advanced|basic|formulas?|pivot|templates?|learning)\b/)],
      tip: "Be precise about your level with each tool; it's fine to say you're learning one.",
    },
  ],
  "maintenance-technician": [
    {
      id: "mt-troubleshoot",
      kind: "technical",
      text: "Walk me through how you troubleshoot a piece of equipment that stopped working.",
      keyPoints: [p("safety first (lockout/tagout)", /\b(lockout|tagout|loto|de-?energi[sz]|safe|safety|ppe)\b/), p("gather information (operator, symptoms, history)", /\b(ask|operator|symptom|history|log|what happened|manual)\b/), p("check the basics (power, fuses, breakers)", /\b(power|fuse|breaker|plug|switch|supply|voltage)\b/), p("isolate and test", /\b(isolat|test|meter|measure|one at a time|narrow)\b/), p("document the repair", /\b(document|record|log|work order|cmms|note)\b/)],
      tip: "A step-by-step method beats a list of fixes; start with safety and end with documentation.",
    },
    {
      id: "mt-loto",
      kind: "behavioral",
      text: "Describe a time you followed lockout/tagout or another safety procedure even though it slowed you down.",
      keyPoints: [p("the procedure", /\b(lockout|tagout|loto|permit|procedure|ppe|confined)\b/), p("the pressure to skip it", /\b(rush|hurry|pressure|faster|behind|wanted it done|downtime)\b/), p("you followed it anyway", /\b(followed|still|anyway|didn'?t skip|refused|insisted)\b/), p("the outcome", /\b(safe|nobody|no one|result|after|ended)\b/)],
      tip: "Make it clear the procedure won, and how you handled the pressure respectfully.",
    },
    {
      id: "mt-priorities",
      kind: "behavioral",
      text: "Tell me about a time you had several urgent repair requests at once. How did you prioritize?",
      keyPoints: [p("how you ranked them (safety, production, people affected)", /\b(safety|production|downtime|critical|impact|most people|first)\b/), p("communication with requesters", /\b(told|called|updated|let .* know|communicat|eta)\b/), p("the result", /\b(finished|fixed|all|result|by the end)\b/)],
      tip: "Name your ranking rule (safety, then production impact) and how you kept people informed.",
    },
    {
      id: "mt-pm",
      kind: "technical",
      text: "What preventive maintenance have you done, and why does it matter?",
      keyPoints: [p("specific PM tasks", /\b(filter|lubricat|grease|belt|inspect|clean|calibrat|check|tighten|oil)\b/), p("a schedule or system", /\b(schedul|weekly|monthly|checklist|cmms|work orders?)\b/), p("why it matters (downtime, cost, safety)", /\b(downtime|breakdown|cost|safety|life|longer|prevent)\b/)],
      tip: "Name tasks you've really done; if you haven't, say what you've learned and how you'd approach it.",
    },
    {
      id: "mt-explain",
      kind: "behavioral",
      text: "Tell me about a time you explained a technical problem to someone without a technical background.",
      keyPoints: [p("who the audience was", /\b(tenant|customer|manager|operator|resident|client|coworker)\b/), p("how you simplified it", /\b(simple|plain|example|compar|showed|drew|analogy)\b/), p("the result", /\b(understood|agreed|approved|result|happy|after)\b/)],
      tip: "Show empathy and a simple analogy or demonstration.",
    },
    {
      id: "mt-breaker",
      kind: "technical",
      text: "A machine keeps tripping its breaker. What are the first things you check?",
      keyPoints: [p("lock out before opening anything", /\b(lockout|tagout|loto|de-?energi[sz]|safe)\b/), p("overload (too much load, jammed motor)", /\b(overload|load|jam|bind|amps?|current draw|clamp meter)\b/), p("short circuit or ground fault", /\b(short|ground fault|grounded|insulation|megger|continuity)\b/), p("the breaker itself and its rating", /\b(breaker (?:rating|size)|weak breaker|bad breaker|rated|sizing)\b/), p("document and escalate if needed", /\b(document|record|report|electrician|escalat)\b/)],
      tip: "Overload, short, ground fault, or a failing breaker: show you'd check each safely, and escalate to a qualified electrician when it is beyond your role.",
    },
  ],
};

export type StarPart = "situation" | "task" | "action" | "result";

export const STAR_LABELS: Record<StarPart, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };

const STAR_PATTERNS: Record<StarPart, RegExp[]> = {
  situation: [/\b(when i|while i|at my (?:last |previous |old )?(?:job|work|school|shift)|last (?:year|month|week|summer|spring|fall|winter)|during|one (?:time|day)|on (?:a|one) (?:job|project|site|shift)|there was|we had|the situation|a few (?:months|years) ago|back in)\b/],
  task: [/\b(my (?:job|role|task|responsibility|goal) (?:was|is)|i was (?:responsible|asked|assigned|in charge|tasked|supposed)|i needed to|i had to|the goal was|we needed to|i was trying to|it was my job)\b/],
  action: [/\bi (?:\w+ed|made|took|went|built|ran|led|set|told|wrote|spoke|called|checked|asked|got|put|kept|began|chose|found|gave|did|fixed|tested|organi[sz]ed|scheduled|reported|stopped|showed|taught|brought|sent|followed|double-checked|reached out|sat down|met)\b/g],
  result: [/\b(as a result|the result|resulted|in the end|ended up|we finished|i finished|so that|which (?:meant|led|helped|saved)|the outcome|saved|reduced|improved|on time|ahead of schedule|passed|nobody got hurt|no one got hurt|since then|now i|after that|i learned|we learned)\b/, /\b\d+(?:\.\d+)?\s?(?:%|percent|hours?|days?|weeks?|dollars|\$)/],
};

export type AnswerFeedback = {
  questionId: string;
  words: number;
  star: Record<StarPart, boolean>;
  /** Number of first-person action statements found. */
  actionStatements: number;
  usesNumbers: boolean;
  /** "we" statements outnumber "I" statements. */
  weHeavy: boolean;
  keyPointsCovered: string[];
  keyPointsMissed: string[];
  rating: "strong" | "developing" | "needs_work";
  strengths: string[];
  improvements: string[];
};

function countMatches(text: string, re: RegExp): number {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...text.matchAll(new RegExp(re.source, flags))].length;
}

export function evaluateAnswer(question: InterviewQuestion, answer: string): AnswerFeedback {
  const text = answer
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'");
  const words = (text.match(/[a-z0-9']+/g) ?? []).length;
  const actionStatements = countMatches(text, STAR_PATTERNS.action[0]!);
  const star: Record<StarPart, boolean> = {
    situation: STAR_PATTERNS.situation.some((re) => re.test(text)),
    task: STAR_PATTERNS.task.some((re) => re.test(text)),
    action: actionStatements >= 2,
    result: STAR_PATTERNS.result.some((re) => new RegExp(re.source).test(text)),
  };
  const usesNumbers = /\b\d/.test(text);
  const iCount = countMatches(text, /\bi\b/);
  const weCount = countMatches(text, /\bwe\b/);
  const weHeavy = weCount > iCount && weCount >= 2;
  const covered: string[] = [];
  const missed: string[] = [];
  for (const kp of question.keyPoints) (kp.patterns.some((re) => re.test(text)) ? covered : missed).push(kp.label);

  const starCount = Object.values(star).filter(Boolean).length;
  const coverage = question.keyPoints.length ? covered.length / question.keyPoints.length : 1;
  let rating: AnswerFeedback["rating"];
  if (words < 25) rating = "needs_work";
  else if (question.kind === "technical") rating = coverage >= 0.6 ? "strong" : coverage >= 0.3 ? "developing" : "needs_work";
  else if (starCount >= 3 && coverage >= 0.5) rating = "strong";
  else if (starCount >= 2 || coverage >= 0.5) rating = "developing";
  else rating = "needs_work";

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (question.kind !== "technical") {
    const present = (Object.keys(star) as StarPart[]).filter((k) => star[k]).map((k) => STAR_LABELS[k]);
    const absent = (Object.keys(star) as StarPart[]).filter((k) => !star[k]);
    if (present.length) strengths.push(`Your answer shows ${present.join(", ")}.`);
    for (const part of absent) {
      if (part === "situation") improvements.push("Open with the situation: where you were and when, in one sentence.");
      if (part === "task") improvements.push("Say what you were responsible for (\"My job was to…\").");
      if (part === "action") improvements.push("Describe at least two concrete things you did yourself, in the first person (\"I called…\", \"I checked…\").");
      if (part === "result") improvements.push("Finish with the result: what changed, ideally with a number (time, count, cost) you can stand behind.");
    }
    if (weHeavy) improvements.push("You say \"we\" more than \"I\"; interviewers want to hear your own part.");
  }
  if (covered.length) strengths.push(`It touches: ${covered.join("; ")}.`);
  if (missed.length) improvements.push(`Strong answers to this question usually also cover: ${missed.join("; ")}.`);
  if (usesNumbers) strengths.push("You used specific numbers, which makes a story concrete.");
  if (words < 40) improvements.push(`At ${words} words this is short; aim for about 150–300 words (one to two minutes spoken).`);
  else if (words > 400) improvements.push(`At ${words} words this is long; aim for about 150–300 words so the key point isn't lost.`);
  improvements.push(question.tip);

  return { questionId: question.id, words, star, actionStatements, usesNumbers, weHeavy, keyPointsCovered: covered, keyPointsMissed: missed, rating, strengths, improvements };
}

export const RATING_LABELS: Record<AnswerFeedback["rating"], string> = { strong: "Strong", developing: "Developing", needs_work: "Needs work" };

// ---------------------------------------------------------------------------
// Session state (stored on the assistant message that asked the question)
// ---------------------------------------------------------------------------

export type InterviewResult = { questionId: string; rating: AnswerFeedback["rating"] | "skipped"; star: number };

export type InterviewState = {
  role: InterviewRole;
  /** Index of the question that is waiting for an answer. */
  index: number;
  total: number;
  active: boolean;
  results: InterviewResult[];
};

export function questionsFor(role: InterviewRole): InterviewQuestion[] {
  return QUESTION_BANK[role];
}

export function startInterviewState(role: InterviewRole): InterviewState {
  return { role, index: 0, total: QUESTION_BANK[role].length, active: true, results: [] };
}

export function isInterviewState(v: unknown): v is InterviewState {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<InterviewState>;
  return (
    typeof s.role === "string" &&
    s.role in QUESTION_BANK &&
    typeof s.index === "number" &&
    typeof s.total === "number" &&
    typeof s.active === "boolean" &&
    Array.isArray(s.results)
  );
}

export function questionPrompt(state: InterviewState): string {
  const q = QUESTION_BANK[state.role][state.index];
  if (!q) return "";
  const kind = q.kind === "technical" ? "Technical" : q.kind === "situational" ? "Situational" : "Behavioral";
  return `**Question ${state.index + 1} of ${state.total}** (${kind}, ${INTERVIEW_ROLE_LABELS[state.role]})\n\n${q.text}\n\nType your answer as you would say it. Reply "skip" to move on or "stop" to end the interview.`;
}

export function feedbackText(fb: AnswerFeedback, question: InterviewQuestion): string {
  const lines: string[] = [];
  lines.push(`**Feedback: ${RATING_LABELS[fb.rating]}** (keyword-based heuristic, not a hiring prediction)`);
  if (question.kind !== "technical") {
    lines.push(
      `STAR check: ${(Object.keys(fb.star) as StarPart[]).map((k) => `${STAR_LABELS[k]} ${fb.star[k] ? "present" : "missing"}`).join(" · ")}`,
    );
  } else {
    lines.push(`Key points covered: ${fb.keyPointsCovered.length} of ${fb.keyPointsCovered.length + fb.keyPointsMissed.length}`);
  }
  if (fb.strengths.length) lines.push(["What worked:", ...fb.strengths.map((s) => `- ${s}`)].join("\n"));
  if (fb.improvements.length) lines.push(["To improve:", ...fb.improvements.map((s) => `- ${s}`)].join("\n"));
  return lines.join("\n\n");
}

export type InterviewTurn = { content: string; state: InterviewState };

/** Advance a running interview with the user's message. */
export function continueInterview(state: InterviewState, message: string, command: "stop" | "skip" | null): InterviewTurn {
  const questions = QUESTION_BANK[state.role];
  const question = questions[state.index];
  if (!question || !state.active) return finishInterview({ ...state, active: false }, "");

  if (command === "stop") return finishInterview({ ...state, active: false }, "Interview ended.");

  let head: string;
  let results: InterviewResult[];
  if (command === "skip") {
    head = `Skipped question ${state.index + 1}.`;
    results = [...state.results, { questionId: question.id, rating: "skipped", star: 0 }];
  } else {
    const fb = evaluateAnswer(question, message);
    head = feedbackText(fb, question);
    results = [...state.results, { questionId: question.id, rating: fb.rating, star: Object.values(fb.star).filter(Boolean).length }];
  }
  const next: InterviewState = { ...state, index: state.index + 1, results };
  if (next.index >= questions.length) return finishInterview({ ...next, active: false }, head);
  return { content: `${head}\n\n${questionPrompt(next)}`, state: next };
}

function finishInterview(state: InterviewState, head: string): InterviewTurn {
  const answered = state.results.filter((r) => r.rating !== "skipped");
  const counts = { strong: 0, developing: 0, needs_work: 0 };
  for (const r of answered) counts[r.rating as keyof typeof counts]++;
  const summary = answered.length
    ? `**Mock interview summary (${INTERVIEW_ROLE_LABELS[state.role]})**\n\nYou answered ${answered.length} of ${state.total} questions: ${counts.strong} strong, ${counts.developing} developing, ${counts.needs_work} needing work (heuristic ratings). Practise the weakest answers out loud, and keep each story true; only describe things you actually did.`
    : `**Mock interview ended (${INTERVIEW_ROLE_LABELS[state.role]})**\n\nNo answers were rated. Start another mock interview whenever you're ready.`;
  return { content: head ? `${head}\n\n${summary}` : summary, state };
}
