/** Notification preferences stored in UserProfile.notificationPrefs (JSON). Pure — safe for client use. */
export type NotificationPrefs = {
  followUps: boolean;
  interviews: boolean;
  certification: boolean;
  weeklyReport: boolean;
  /** Evening nudge when no applications were logged on a workday. Off by default: no nagging. */
  dailyNudge: boolean;
  /** Deliver reminders as web push to devices where the user enabled it. */
  push: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  followUps: true,
  interviews: true,
  certification: true,
  weeklyReport: true,
  dailyNudge: false,
  push: false,
};

export const PREF_LABELS: Record<keyof NotificationPrefs, { label: string; hint: string }> = {
  followUps: { label: "Follow-ups due", hint: "When an application's follow-up date arrives." },
  interviews: { label: "Upcoming interviews", hint: "About 24 hours before a scheduled interview." },
  certification: { label: "Trainee & certification renewals", hint: "30 days before a trainee card or certificate expires." },
  weeklyReport: { label: "Weekly report ready", hint: "When last week's report has been generated." },
  dailyNudge: { label: "Evening nudge", hint: "A gentle reminder after 6 pm on workdays with no applications logged. Off by default." },
  push: { label: "Push to this device", hint: "Requires enabling push below; reminders still appear in the app." },
};

export function parsePrefs(raw: unknown): NotificationPrefs {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_PREFS };
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) {
    if (typeof obj[key] === "boolean") out[key] = obj[key] as boolean;
  }
  return out;
}
