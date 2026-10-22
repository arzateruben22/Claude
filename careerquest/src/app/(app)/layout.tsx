import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { levelFromXp } from "@/lib/game/xp-config";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { ToastProvider } from "@/components/ui/toast";
import { logoutAction } from "@/lib/auth/actions";
import { AchievementCelebration } from "@/components/game/achievement-celebration";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const stats = await prisma.playerStats.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  const lvl = levelFromXp(stats.totalXp);
  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar level={lvl.level} xpProgress={lvl.progress} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar userName={user.name} level={lvl.level} totalXp={stats.totalXp} streak={stats.currentStreak} logoutAction={logoutAction} />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">{children}</main>
          <MobileNav />
          <AchievementCelebration />
        </div>
      </div>
    </ToastProvider>
  );
}
