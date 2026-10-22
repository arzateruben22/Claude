import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getWorkshop, listLessons } from "@/lib/academy/content";
import { contentKeySchema } from "@/lib/academy/schema";
import { getWorkshopProgress } from "@/lib/academy/service";
import { toPublicWorkshop } from "@/lib/academy/workshop";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { SimulationNotice } from "@/components/academy/badges";
import { Breadcrumbs } from "@/components/academy/lesson-parts";
import { WorkshopBench } from "@/components/academy/workshop/bench";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const w = contentKeySchema.safeParse(key).success ? getWorkshop(key) : null;
  return { title: w ? `${w.title} · Workshop` : "Workshop" };
}

export default async function WorkshopBenchPage({ params }: Props) {
  const { key } = await params;
  if (!contentKeySchema.safeParse(key).success) notFound();
  const user = await requireUser(`/academy/workshop/${key}`);
  const workshop = getWorkshop(key);
  if (!workshop) notFound();
  const progress = (await getWorkshopProgress(user.id))[key];
  const lessonTitles = new Map(listLessons().map((l) => [l.key, l.title]));
  const related = workshop.relatedLessons.filter((k) => lessonTitles.has(k));

  return (
    <>
      <Breadcrumbs items={[{ href: "/academy", label: "Academy" }, { href: "/academy/workshop", label: "Workshop" }, { label: workshop.title }]} />
      <PageHeader
        eyebrow="Simulated workshop"
        title={workshop.title}
        description={workshop.description}
        actions={<SimulationNotice compact />}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge>{workshop.tasks.length} tasks</Badge>
        <Badge>About {workshop.estimatedMinutes} min</Badge>
        {progress ? (
          <Badge tone={progress.cleared ? "success" : "info"} className="tnum">
            {progress.cleared ? "Clean run achieved" : "Not cleared yet"} · best {progress.bestScore}/{progress.maxScore} · {progress.attempts} run
            {progress.attempts === 1 ? "" : "s"}
          </Badge>
        ) : (
          <Badge>No runs yet</Badge>
        )}
      </div>

      {workshop.learningGoals.length > 0 && (
        <section aria-labelledby="workshop-goals" className="glass mb-6 rounded-card p-5">
          <h2 id="workshop-goals" className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-accent" aria-hidden />
            Learning goals
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-muted">
            {workshop.learningGoals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          {related.length > 0 && (
            <p className="mt-3 text-sm text-fg-muted">
              Review first:{" "}
              {related.map((k, i) => (
                <span key={k}>
                  {i > 0 && ", "}
                  <Link href={`/academy/lessons/${k}`} className="text-accent hover:underline">
                    {lessonTitles.get(k)}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      <WorkshopBench workshop={toPublicWorkshop(workshop)} />

      <p className="mt-8 text-xs text-fg-subtle">{workshop.disclaimer} Simulation — not qualifying field experience.</p>
    </>
  );
}
