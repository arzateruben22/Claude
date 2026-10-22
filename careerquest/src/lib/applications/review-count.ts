import "server-only";
import { prisma } from "@/lib/db";

/**
 * Items waiting for the user in the review queue: emails the classifier could not file with
 * confidence, extension captures awaiting confirmation, and possible duplicate records. Every
 * count is scoped by userId.
 */
export async function getReviewQueueCount(userId: string): Promise<number> {
  const [emails, captures, duplicates] = await Promise.all([
    prisma.emailMessage.count({ where: { userId, reviewStatus: "NEEDS_REVIEW" } }),
    prisma.extensionCapture.count({ where: { userId, status: "PENDING_CONFIRMATION" } }),
    prisma.duplicateCandidate.count({ where: { userId, status: "PENDING" } }),
  ]);
  return emails + captures + duplicates;
}
