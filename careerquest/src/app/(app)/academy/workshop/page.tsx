import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Hammer, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listLessons, listWorkshops } from "@/lib/academy/content";
import { getWorkshopProgress } from "@/lib/academy/service";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { SimulationNotice } from "@/components/academy/badges";

export const metadata: Metadata = { title: "Simulated workshop · Academy" };

const DIFFICULTY = ["", "Intro", "Intermediate", "Advanced", "Expert", "Expert"];

export default async function WorkshopIndexPage() {
  const user = await requireUser("/academy/workshop");
  const [workshops, progress] = [listWorkshops(), await getWorkshopProgress(user.id)];
  const lessonTitles = new Map(listLessons().map((l) => [l.key, l.title]));

  return (
    <>
      <PageHeader
        eyebrow="Electrician Academy"
        title="Simulated workshop"
        description="Predict meter readings on a virtual bench, then measure. Series, parallel and series-parallel circuits, plus open and shorted faults."
      />
      <AcademyTabs />
      <div className="space-y-6">
        <SimulationNotice />
        {workshops.length === 0 ? (
          <EmptyState
            icon={<Hammer className="h-6 w-6" aria-hidden />}
            title="No bench exercises are available right now"
            description="The workshop library could not be loaded. Lessons and the practice exam are still available."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workshops.map((w) => {
              const p = progress[w.key];
              return (
                <li key={w.key}>
                  <Link
                    href={`/academy/workshop/${w.key}`}
                    className="glass flex h-full flex-col rounded-card p-4 transition-colors hover:bg-surface-hover"
                    data-testid={`workshop-card-${w.key}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug">{w.title}</p>
                      {p?.cleared ? (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Clean run
                        </Badge>
                      ) : p ? (
                        <Badge tone="info">Attempted</Badge>
                      ) : (
                        <Badge>Not tried</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm text-fg-muted">{w.description}</p>
                    {w.relatedLessons.length > 0 && (
                      <p className="mt-2 text-xs text-fg-subtle">Goes with: {w.relatedLessons.map((k) => lessonTitles.get(k) ?? k).join(", ")}</p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                      <Badge>{DIFFICULTY[w.difficulty] ?? `Level ${w.difficulty}`}</Badge>
                      <Badge>{w.taskCount} tasks</Badge>
                      <Badge>{w.estimatedMinutes} min</Badge>
                      {w.hasFault && (
                        <Badge tone="warning">
                          <Zap className="h-3 w-3" aria-hidden />
                          Fault finding
                        </Badge>
                      )}
                      {p && (
                        <Badge className="tnum">
                          Best {p.bestScore}/{p.maxScore} · {p.attempts} run{p.attempts === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-fg-subtle">
          Bench runs are saved to your history and count toward Academy quiz missions when every task is correct and predicted before
          measuring. They never award XP and are never counted as training hours.
        </p>
      </div>
    </>
  );
}
