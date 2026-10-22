import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, Clock, Eye } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getLesson } from "@/lib/academy/content";
import { contentKeySchema } from "@/lib/academy/schema";
import { getLessonPageData, markLessonOpened } from "@/lib/academy/service";
import { trackLabel } from "@/lib/academy/tracks";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LessonStateBadge } from "@/components/academy/badges";
import { LessonSections } from "@/components/academy/lesson-sections";
import { PracticePanel } from "@/components/academy/practice-panel";
import { Breadcrumbs, LockedLessonPanel, Objectives, SourcesList, TrackNav } from "@/components/academy/lesson-parts";

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const lesson = contentKeySchema.safeParse(key).success ? getLesson(key) : null;
  return { title: lesson ? `${lesson.title} · Academy` : "Lesson" };
}

export default async function LessonPage({ params, searchParams }: Props) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  if (!contentKeySchema.safeParse(key).success) notFound();
  const user = await requireUser(`/academy/lessons/${key}`);
  const data = await getLessonPageData(user.id, key);
  if (!data) notFound();
  const { lesson, view, trackLessons } = data;

  const locked = view.state === "LOCKED";
  const preview = locked && sp.preview === "1";
  // Opening an unlocked lesson starts it (idempotent; a completed lesson stays completed).
  const state = locked ? view.state : ((await markLessonOpened(user.id, key)) ?? view.state);
  const position = trackLessons.findIndex((l) => l.key === key) + 1;

  return (
    <>
      <Breadcrumbs items={[{ href: "/academy", label: "Academy" }, { href: `/academy#track-${lesson.track.toLowerCase()}`, label: trackLabel(lesson.track) }, { label: lesson.title }]} />
      <PageHeader
        eyebrow={`${trackLabel(lesson.track)} · Lesson ${position} of ${trackLessons.length}`}
        title={lesson.title}
        description={lesson.summary}
        actions={<LessonStateBadge state={state} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <Badge>
          <Clock className="h-3 w-3" aria-hidden />
          About {lesson.estimatedMinutes} min
        </Badge>
        <Badge>{lesson.practice.length} practice problems</Badge>
        <Badge>
          {lesson.quiz.questions.length}-question quiz · pass at {lesson.quiz.passingScore}%
        </Badge>
        {view.bestScore !== null && <Badge tone={view.bestScore >= lesson.quiz.passingScore ? "success" : "warning"}>Best score {view.bestScore}%</Badge>}
        {view.attempts > 0 && <Badge>{view.attempts} quiz attempt{view.attempts === 1 ? "" : "s"}</Badge>}
      </div>

      {locked && !preview ? (
        <div className="space-y-6">
          <Objectives objectives={lesson.objectives} />
          <LockedLessonPanel lessonKey={lesson.key} missing={view.missing} />
        </div>
      ) : (
        <div className="space-y-8">
          {preview && (
            <Alert tone="info" title="Preview">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" aria-hidden /> You are previewing a locked lesson.
              </span>{" "}
              Complete {view.missing.map((m) => m.title).join(", ")} to start it and unlock its quiz.
            </Alert>
          )}
          <Objectives objectives={lesson.objectives} />
          <article className="max-w-3xl">
            <LessonSections lessonKey={lesson.key} sections={lesson.sections} />
          </article>
          <div className="max-w-3xl">
            <PracticePanel lessonKey={lesson.key} items={lesson.practice} />
          </div>

          <section aria-labelledby="quiz-cta" className="glass max-w-3xl rounded-card p-5">
            <h2 id="quiz-cta" className="flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="h-4 w-4 text-accent" aria-hidden />
              {state === "COMPLETED" ? "Lesson completed" : "Ready to complete this lesson?"}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {state === "COMPLETED"
                ? "You passed this quiz. Retake it any time for practice; lesson XP is earned once."
                : `Score ${lesson.quiz.passingScore}% or better on the ${lesson.quiz.questions.length}-question quiz to complete the lesson. Answers are graded on the server and you see explanations after you submit.`}
            </p>
            <div className="mt-4">
              {locked ? (
                <p className="text-sm text-fg-subtle">The quiz unlocks when the prerequisites are complete.</p>
              ) : (
                <Link href={`/academy/lessons/${lesson.key}/quiz`} className={buttonClasses("primary")}>
                  {state === "COMPLETED" ? "Retake the quiz" : "Take the quiz"}
                </Link>
              )}
            </div>
          </section>

          <div className="max-w-3xl space-y-6">
            <SourcesList sources={lesson.sources} />
            <p className="text-xs text-fg-subtle">{lesson.disclaimer}</p>
          </div>
        </div>
      )}

      <div className="mt-10">
        <TrackNav lessons={trackLessons} current={lesson.key} />
      </div>
    </>
  );
}
