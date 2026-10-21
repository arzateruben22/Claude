/**
 * Rule-based "next best action". Pure and ordered: the first matching rule wins.
 * Order: overdue follow-ups → no applications ever → today's target unmet → interview within 48h
 *        → onboarding incomplete → academy lesson.
 * ("No applications ever" is checked before "target unmet" because the latter would otherwise
 * always shadow it.)
 */
export type NextActionKey = "follow-up" | "first-application" | "apply" | "interview-prep" | "onboarding" | "academy";

export type NextActionInput = {
  overdueFollowUps: number;
  firstOverdueApplicationId: string | null;
  todaySubmitted: number;
  dailyTarget: number;
  totalApplications: number;
  totalSubmitted: number;
  nextInterview: { scheduledAt: Date; applicationId: string; companyName: string } | null;
  onboardingComplete: boolean;
  now: Date;
};

export type NextAction = {
  key: NextActionKey;
  title: string;
  description: string;
  href: string;
  cta: string;
};

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

export function recommendNextAction(input: NextActionInput): NextAction {
  if (input.overdueFollowUps > 0) {
    const n = input.overdueFollowUps;
    return {
      key: "follow-up",
      title: n === 1 ? "Send your overdue follow-up" : `Send ${n} overdue follow-ups`,
      description:
        n === 1
          ? "One application has a follow-up date that has passed. A short, polite check-in keeps the record moving."
          : `${n} applications have follow-up dates that have passed. Work through them oldest first.`,
      href: n === 1 && input.firstOverdueApplicationId ? `/applications/${input.firstOverdueApplicationId}` : "/applications",
      cta: n === 1 ? "Open application" : "Open tracker",
    };
  }

  if (input.totalApplications === 0) {
    return {
      key: "first-application",
      title: "Log your first application",
      description: "Everything on this dashboard is computed from your real applications. Add the first one to start the numbers game.",
      href: "/applications/new",
      cta: "Add application",
    };
  }

  if (input.dailyTarget > 0 && input.todaySubmitted < input.dailyTarget) {
    const left = input.dailyTarget - input.todaySubmitted;
    return {
      key: "apply",
      title: `Submit ${left} more application${left === 1 ? "" : "s"} today`,
      description: `You have logged ${input.todaySubmitted} of ${input.dailyTarget} today. Hitting the daily target is what moves the campaign goal.`,
      href: "/applications/new",
      cta: "Log an application",
    };
  }

  const iv = input.nextInterview;
  if (iv && iv.scheduledAt.getTime() >= input.now.getTime() && iv.scheduledAt.getTime() - input.now.getTime() <= FORTY_EIGHT_HOURS) {
    const hours = Math.max(1, Math.round((iv.scheduledAt.getTime() - input.now.getTime()) / 3600000));
    return {
      key: "interview-prep",
      title: `Prepare for your ${iv.companyName} interview`,
      description: `It is in about ${hours} hour${hours === 1 ? "" : "s"}. Review the posting, your application notes and your questions for them.`,
      href: `/applications/${iv.applicationId}`,
      cta: "Open application",
    };
  }

  if (!input.onboardingComplete) {
    return {
      key: "onboarding",
      title: "Finish setting up your profile",
      description: "Targets, regions and eligibility filters shape every recommendation here. Completing setup takes a couple of minutes.",
      href: "/settings",
      cta: "Finish setup",
    };
  }

  return {
    key: "academy",
    title: "Today's target is met — study a lesson",
    description: "Applications are done for today. Use the time on an Electrical Academy lesson to keep the $150K path moving.",
    href: "/academy",
    cta: "Open Academy",
  };
}
