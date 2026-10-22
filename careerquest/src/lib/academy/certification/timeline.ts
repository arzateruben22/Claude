/**
 * Certification tracker timeline, reminders and the eligibility estimate. Pure; every date is a
 * "YYYY-MM-DD" calendar key in the user's timezone. All inputs are self-reported, and derived dates
 * (renewal due, exam window) are flagged `estimated`.
 */
import { addUtcDays, dateFromKey, dateKey, daysBetween } from "@/lib/dates";
import {
  CERT_CE_HOURS,
  CERT_RENEWAL_URGENT_DAYS,
  CERT_RENEWAL_WINDOW_DAYS,
  CERT_RENEWAL_YEARS,
  EXAM_ELIGIBILITY_WINDOW_DAYS,
  EXAM_WINDOW_REMINDER_DAYS,
  TRAINEE_REMINDER_DAYS,
} from "./constants";

export type CertDates = {
  traineeRegisteredAt: string | null;
  traineeExpiresAt: string | null;
  schoolEnrolled: string | null;
  examApplicationAt: string | null;
  examEligibleAt: string | null;
  examScheduledAt: string | null;
  examPassedAt: string | null;
  certifiedAt: string | null;
  certificateExpiresAt: string | null;
};

export const EMPTY_CERT_DATES: CertDates = {
  traineeRegisteredAt: null,
  traineeExpiresAt: null,
  schoolEnrolled: null,
  examApplicationAt: null,
  examEligibleAt: null,
  examScheduledAt: null,
  examPassedAt: null,
  certifiedAt: null,
  certificateExpiresAt: null,
};

export type StepState = "done" | "scheduled" | "pending" | "due-soon" | "overdue";

export type TimelineStep = {
  key: string;
  title: string;
  dateKey: string | null;
  /** True when the date is derived (e.g. registration + 1 year), not entered. */
  estimated: boolean;
  state: StepState;
  detail: string;
};

export type Reminder = { key: string; tone: "info" | "warning" | "danger"; title: string; body: string };

/** Same calendar day `years` later (Feb 29 → Feb 28). */
export function addYearsKey(key: string, years: number): string {
  const d = dateFromKey(key);
  const y = d.getUTCFullYear() + years;
  const m = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  return dateKey(new Date(Date.UTC(y, m, day)));
}

function daysUntil(key: string, todayKey: string): number {
  return daysBetween(dateFromKey(todayKey), dateFromKey(key));
}

function deadlineState(key: string, todayKey: string, soonDays: number): StepState {
  const left = daysUntil(key, todayKey);
  if (left < 0) return "overdue";
  if (left <= soonDays) return "due-soon";
  return "scheduled";
}

export function traineeRenewalDue(d: CertDates): { dateKey: string; estimated: boolean } | null {
  if (d.traineeExpiresAt) return { dateKey: d.traineeExpiresAt, estimated: false };
  if (d.traineeRegisteredAt) return { dateKey: addYearsKey(d.traineeRegisteredAt, 1), estimated: true };
  return null;
}

export function certificationRenewalDue(d: CertDates): { dateKey: string; estimated: boolean } | null {
  if (d.certificateExpiresAt) return { dateKey: d.certificateExpiresAt, estimated: false };
  if (d.certifiedAt) return { dateKey: addYearsKey(d.certifiedAt, CERT_RENEWAL_YEARS), estimated: true };
  return null;
}

export function examWindowCloses(d: CertDates): string | null {
  return d.examEligibleAt ? dateKey(addUtcDays(dateFromKey(d.examEligibleAt), EXAM_ELIGIBILITY_WINDOW_DAYS)) : null;
}

export function buildCertificationTimeline(d: CertDates, todayKey: string): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const certified = Boolean(d.certifiedAt);
  const passed = Boolean(d.examPassedAt);

  steps.push({
    key: "trainee",
    title: "Electrician Trainee registration",
    dateKey: d.traineeRegisteredAt,
    estimated: false,
    state: d.traineeRegisteredAt ? "done" : certified ? "done" : "pending",
    detail: d.traineeRegisteredAt
      ? "Registered (self-reported)."
      : certified
        ? "Not recorded — not needed once certified."
        : "Required to do electrical work for a C-10 contractor while you are neither certified nor a registered apprentice.",
  });

  const traineeDue = traineeRenewalDue(d);
  if (traineeDue && !certified) {
    steps.push({
      key: "trainee-renewal",
      title: "Trainee registration renewal",
      dateKey: traineeDue.dateKey,
      estimated: traineeDue.estimated,
      state: deadlineState(traineeDue.dateKey, todayKey, TRAINEE_REMINDER_DAYS),
      detail: "Renews every year until you are certified, with current proof of school enrollment.",
    });
  }

  steps.push({
    key: "school",
    title: "Approved school / curriculum",
    dateKey: null,
    estimated: false,
    state: d.schoolEnrolled ? "done" : certified ? "done" : "pending",
    detail: d.schoolEnrolled ? d.schoolEnrolled : "Trainees must be enrolled in a curriculum at a DIR-approved school.",
  });

  steps.push({
    key: "exam-application",
    title: "Exam application submitted",
    dateKey: d.examApplicationAt,
    estimated: false,
    state: d.examApplicationAt || passed || certified ? "done" : "pending",
    detail: d.examApplicationAt ? "Submitted (self-reported)." : "Apply to DIR once your hours or apprenticeship qualify you.",
  });

  steps.push({
    key: "exam-eligible",
    title: "Eligible to test (notice received)",
    dateKey: d.examEligibleAt,
    estimated: false,
    state: d.examEligibleAt || passed || certified ? "done" : "pending",
    detail: d.examEligibleAt ? "Eligibility notice received (self-reported)." : "DIR reviews the application and sends an eligibility notice.",
  });

  const windowCloses = examWindowCloses(d);
  if (windowCloses && !passed && !certified) {
    steps.push({
      key: "exam-window",
      title: "Exam eligibility window closes",
      dateKey: windowCloses,
      estimated: true,
      state: deadlineState(windowCloses, todayKey, EXAM_WINDOW_REMINDER_DAYS),
      detail: "The exam must be taken within one year of the eligibility notice, or you re-apply and pay again.",
    });
  }

  const scheduledState: StepState = passed || certified ? "done" : d.examScheduledAt ? (d.examScheduledAt > todayKey ? "scheduled" : "pending") : "pending";
  steps.push({
    key: "exam-scheduled",
    title: "Exam scheduled",
    dateKey: d.examScheduledAt,
    estimated: false,
    state: scheduledState,
    detail:
      d.examScheduledAt && !passed && !certified && d.examScheduledAt <= todayKey
        ? "The exam date has passed. Record the result when you have it."
        : d.examScheduledAt
          ? "Scheduled (self-reported)."
          : "Schedule the exam after the eligibility notice.",
  });

  steps.push({
    key: "exam-passed",
    title: "Exam passed",
    dateKey: d.examPassedAt,
    estimated: false,
    state: passed || certified ? "done" : "pending",
    detail: passed ? "Passed (self-reported)." : "A passing result is required for certification.",
  });

  steps.push({
    key: "certified",
    title: "Certified",
    dateKey: d.certifiedAt,
    estimated: false,
    state: certified ? "done" : "pending",
    detail: certified ? "Certification date recorded (self-reported)." : "Recorded when your certification card is issued.",
  });

  const renewal = certificationRenewalDue(d);
  if (renewal) {
    steps.push({
      key: "renewal",
      title: "Certification renewal due",
      dateKey: renewal.dateKey,
      estimated: renewal.estimated,
      state: deadlineState(renewal.dateKey, todayKey, CERT_RENEWAL_URGENT_DAYS),
      detail: `Renew every ${CERT_RENEWAL_YEARS} years with ${CERT_CE_HOURS} hours of continuing education from a DIR-approved provider.`,
    });
  }
  return steps;
}

export function certificationReminders(d: CertDates, todayKey: string): Reminder[] {
  const out: Reminder[] = [];
  const certified = Boolean(d.certifiedAt);
  const traineeDue = traineeRenewalDue(d);
  if (traineeDue && !certified) {
    const left = daysUntil(traineeDue.dateKey, todayKey);
    const when = traineeDue.estimated ? "about one year after registration (estimate)" : "on the expiry date you entered";
    if (left < 0) {
      out.push({ key: "trainee-overdue", tone: "danger", title: "Trainee registration may have lapsed", body: `Renewal was due ${when}, ${-left} day${left === -1 ? "" : "s"} ago. Check with DIR before working as a trainee.` });
    } else if (left <= TRAINEE_REMINDER_DAYS) {
      out.push({ key: "trainee-soon", tone: "warning", title: `Trainee renewal due in ${left} day${left === 1 ? "" : "s"}`, body: `Annual renewal is due ${when}. It needs current proof of enrollment and a transcript of last year's courses.` });
    }
  }
  const windowCloses = examWindowCloses(d);
  if (windowCloses && !d.examPassedAt && !certified) {
    const left = daysUntil(windowCloses, todayKey);
    if (left < 0) {
      out.push({ key: "exam-window-closed", tone: "danger", title: "Exam eligibility window may have closed", body: "The exam must be taken within one year of the eligibility notice (estimate from the date you entered). You may need to re-apply." });
    } else if (left <= EXAM_WINDOW_REMINDER_DAYS) {
      out.push({ key: "exam-window-soon", tone: "warning", title: `Exam window closes in about ${left} day${left === 1 ? "" : "s"}`, body: "Schedule the exam before one year from your eligibility notice (estimate)." });
    }
  }
  const renewal = certificationRenewalDue(d);
  if (renewal) {
    const left = daysUntil(renewal.dateKey, todayKey);
    const est = renewal.estimated ? " (estimated from your certification date + 3 years)" : "";
    if (left < 0) {
      out.push({ key: "cert-overdue", tone: "danger", title: "Certification renewal is past due", body: `The renewal date${est} has passed. Contact the DIR Electrician Certification Unit; lapsed rules are conflicting in official guidance.` });
    } else if (left <= CERT_RENEWAL_URGENT_DAYS) {
      out.push({ key: "cert-urgent", tone: "warning", title: `Certification renewal due in ${left} day${left === 1 ? "" : "s"}`, body: `Finish ${CERT_CE_HOURS} hours of continuing education from a DIR-approved provider and submit the renewal${est}.` });
    } else if (left <= CERT_RENEWAL_WINDOW_DAYS) {
      out.push({ key: "cert-window", tone: "info", title: "Renewal window is open", body: `Renewal is due ${renewal.dateKey}${est}. Plan your ${CERT_CE_HOURS} hours of continuing education now.` });
    }
  }
  return out;
}

export type EligibilityEstimate = {
  required: number;
  verified: number;
  selfReported: number;
  /** min(verified, required) / required. */
  ratio: number;
  remaining: number;
  met: boolean;
  /** For GENERAL: verified hours after the per-area caps. */
  countableVerified: number | null;
  countableRatio: number | null;
};

/** Verified hours vs the classification's requirement. An estimate — DIR decides eligibility. */
export function eligibilityEstimate(input: { required: number; verified: number; selfReported: number; countableVerified?: number | null }): EligibilityEstimate {
  const required = Math.max(0, input.required);
  const verified = Math.max(0, input.verified);
  const ratio = required > 0 ? Math.min(1, verified / required) : 0;
  const countable = input.countableVerified ?? null;
  return {
    required,
    verified,
    selfReported: Math.max(0, input.selfReported),
    ratio,
    remaining: Math.max(0, Math.round((required - verified) * 100) / 100),
    met: required > 0 && verified >= required && (countable === null || countable >= required),
    countableVerified: countable,
    countableRatio: countable === null || required <= 0 ? null : Math.min(1, countable / required),
  };
}
