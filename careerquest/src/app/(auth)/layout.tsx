import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight mb-8">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-glow">
          <Zap className="h-4 w-4" aria-hidden />
        </span>
        CareerQuest
      </Link>
      <div className="w-full max-w-md glass rounded-card p-6 sm:p-8 animate-rise">{children}</div>
    </main>
  );
}
