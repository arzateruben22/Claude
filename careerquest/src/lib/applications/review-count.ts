import "server-only";
import { getReviewCounts } from "@/lib/ingest/review";

/**
 * Items waiting for the user in the review queue: emails the classifier could not file with
 * confidence, extension captures awaiting confirmation, and possible duplicate records whose two
 * records are both still unmerged. Shares the review pages' own counting (`getReviewCounts`) so the
 * tracker's badge always matches the review tabs. Every count is scoped by userId.
 */
export async function getReviewQueueCount(userId: string): Promise<number> {
  const { emails, captures, duplicates } = await getReviewCounts(userId);
  return emails + captures + duplicates;
}
