import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Zap, Target, BookOpen, BarChart3, ShieldCheck, Mail } from "lucide-react";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const features = [
    { icon: Target, title: "Operation Get Hired", text: "A 90-day campaign with daily missions, quotas and follow-ups that map to real applications." },
    { icon: Zap, title: "RPG progression", text: "Earn XP only for verified, real-world actions. No double counting, no fake streaks." },
    { icon: Mail, title: "Universal tracker", text: "Capture applications from email confirmations, a Chrome extension, CSV imports and manual entry." },
    { icon: BookOpen, title: "Electrician Academy", text: "California certification roadmap, apprenticeship directory, lessons, quizzes and hour tracking." },
    { icon: BarChart3, title: "Honest analytics", text: "Funnel rates with uncertainty intervals. Observed vs. hypothetical vs. estimated, always labeled." },
    { icon: ShieldCheck, title: "Private by design", text: "Your data stays yours: export or delete it at any time. Integrations use least-privilege OAuth." },
  ];

  return (
    <main className="flex-1 flex flex-col">
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          CareerQuest
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="px-3 py-2 rounded-ctl text-sm text-fg-muted hover:text-fg">
            Sign in
          </Link>
          <Link href="/register" className="px-3 py-2 rounded-ctl text-sm bg-accent text-accent-fg font-medium hover:bg-accent-strong">
            Create account
          </Link>
        </nav>
      </header>

      <section className="px-5 sm:px-8 py-16 sm:py-24 max-w-6xl w-full mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-accent mb-4">Career simulator · Application tracker · Electrician academy</p>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight max-w-3xl leading-[1.05]">
          Turn the job hunt into a campaign you can actually win.
        </h1>
        <p className="mt-6 text-lg text-fg-muted max-w-2xl">
          CareerQuest tracks every application, rewards real progress, and plots your path from first application to a
          California electrician certification and a $150,000 career.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="px-5 py-3 rounded-ctl bg-accent text-accent-fg font-medium hover:bg-accent-strong shadow-glow">
            Start your 90-day campaign
          </Link>
          <Link href="/login" className="px-5 py-3 rounded-ctl glass text-fg hover:bg-surface-hover">
            I already have an account
          </Link>
        </div>
      </section>

      <section className="px-5 sm:px-8 pb-24 max-w-6xl w-full mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="glass rounded-card p-5">
            <f.icon className="h-5 w-5 text-accent mb-3" aria-hidden />
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="px-5 sm:px-8 py-6 text-xs text-fg-subtle max-w-6xl w-full mx-auto">
        CareerQuest never submits applications or contacts employers on your behalf without your explicit action, and never
        presents game progress as a license, certification or job offer.
      </footer>
    </main>
  );
}
