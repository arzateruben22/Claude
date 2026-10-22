import { getSessionUser } from "@/lib/auth/current-user";
import { getUnseenAchievements, type UnseenAchievement } from "@/lib/game/queries";
import { CelebrationOverlay } from "./celebration-overlay";

/**
 * Global celebration for achievements the user has not acknowledged yet (UserAchievement.seenAt is
 * null). Mounted once in the app layout. Never breaks the page: a failure renders nothing.
 */
export async function AchievementCelebration() {
  let items: UnseenAchievement[] = [];
  try {
    const user = await getSessionUser();
    if (!user) return null;
    items = await getUnseenAchievements(user.id);
  } catch (err) {
    console.error("AchievementCelebration failed", err);
    return null;
  }
  if (items.length === 0) return null;
  // Keyed by the set of ids so newly unlocked achievements start a fresh celebration.
  return <CelebrationOverlay key={items.map((i) => i.id).join(",")} items={items} />;
}
