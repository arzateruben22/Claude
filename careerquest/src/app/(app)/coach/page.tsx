import { requireUser } from "@/lib/auth/current-user";
import { getCoachSnapshot } from "@/lib/coach/metrics";
import { evaluateRules, weeklyPriorities } from "@/lib/coach/rules";
import { citeMetrics } from "@/lib/coach/snapshot";
import { listApplicationChoices, listCoachMessages } from "@/lib/coach/service";
import { llmConfigured } from "@/lib/coach/anthropic";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { CoachTabs } from "@/components/coach/coach-tabs";
import { PrioritiesCard } from "@/components/coach/priorities-card";
import { MetricsCard } from "@/components/coach/metrics-card";
import { ChatPanel } from "@/components/coach/chat-panel";
import { metricsById } from "@/components/coach/rich-text";

export const metadata = { title: "Career Advisor · CareerQuest" };

export default async function CoachPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser("/coach"), searchParams]);
  const [snapshot, messages, applications] = await Promise.all([getCoachSnapshot(user.id), listCoachMessages(user.id), listApplicationChoices(user.id)]);
  const recommendations = evaluateRules(snapshot);
  const priorities = weeklyPriorities(recommendations, 3);
  const prioritySet = new Set(priorities.map((p) => p.id));
  const others = recommendations.filter((r) => !prioritySet.has(r.id));
  const cited = metricsById(citeMetrics(snapshot.byId, recommendations.flatMap((r) => r.citations)));
  const askRaw = Array.isArray(sp.ask) ? sp.ask[0] : sp.ask;
  const initialText = askRaw ? askRaw.slice(0, 500) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Grounded in your tracker data"
        title="Career Advisor"
        description="Personal guidance computed from your own applications, training and goals. Every number links to its source; drafts are never sent for you, and nothing here predicts a hiring decision."
        actions={
          <Link href="/analytics/reports" className={buttonClasses("secondary", "sm")}>
            <CalendarRange className="h-4 w-4" aria-hidden />
            Weekly reports
          </Link>
        }
      />
      <CoachTabs />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <PrioritiesCard priorities={priorities} others={others} metrics={cited} />
          <MetricsCard metrics={snapshot.metrics} />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <ChatPanel key={initialText ?? "chat"} messages={messages} applications={applications} llmEnabled={llmConfigured()} timeZone={snapshot.facts.timezone} initialText={initialText} />
        </div>
      </div>
    </>
  );
}
