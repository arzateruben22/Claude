import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export function WelcomeCard({ name, onboardingComplete }: { name: string; onboardingComplete: boolean }) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <section aria-labelledby="welcome-title" className="glass rounded-card p-5 mb-5 animate-rise border-accent/30 shadow-glow">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="welcome-title" className="text-base font-semibold tracking-tight">
            Welcome to CareerQuest, {first}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {onboardingComplete
              ? "Your command center fills in as you log real applications. Nothing here is simulated."
              : "Two things make the rest of this page useful: your campaign targets (a three-step setup), and your first logged application. Every number here is computed from what you record."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!onboardingComplete && (
              <Link href="/settings/onboarding" className={buttonClasses("primary", "sm")}>
                Finish setup
              </Link>
            )}
            <Link href="/applications/new" className={buttonClasses(onboardingComplete ? "primary" : "secondary", "sm")}>
              Log your first application
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
