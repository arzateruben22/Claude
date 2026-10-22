import Link from "next/link";
import { Mail } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { loadAttachOptions, loadEmailReview } from "@/lib/ingest/review";
import { EmptyState, buttonClasses } from "@/components/ui";
import { EmailReviewCard } from "@/components/review/email-review-card";
import { InterviewInviteCard } from "@/components/review/interview-invite-card";

export default async function ReviewEmailsPage() {
  const user = await requireUser();
  const [{ items, total, invites }, attachOptions] = await Promise.all([loadEmailReview(user.id), loadAttachOptions(user.id)]);
  return (
    <div className="space-y-8">
      {invites.length > 0 && (
        <section aria-labelledby="invites-heading" className="space-y-3">
          <div>
            <h2 id="invites-heading" className="text-base font-semibold">
              Interview times to add
            </h2>
            <p className="text-sm text-fg-muted">
              These invitations were filed on their application automatically. The time was read from the email and is not on
              your interview list yet — check it, then add it.
            </p>
          </div>
          {invites.map((invite) => (
            <InterviewInviteCard key={invite.emailId} invite={invite} />
          ))}
        </section>
      )}

      <section aria-labelledby="emails-heading" className="space-y-3">
        <h2 id="emails-heading" className={invites.length > 0 ? "text-base font-semibold" : "sr-only"}>
          Emails to review
        </h2>
        {items.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-8 w-8" aria-hidden />}
            title="No emails waiting for review"
            description="When CareerQuest cannot tell for sure what a job email means, or which application it belongs to, it waits here instead of guessing. Connect or import your email to start."
            action={
              <Link href="/integrations" className={buttonClasses("secondary", "sm")}>
                Connect email
              </Link>
            }
          />
        ) : (
          <>
            {total > items.length && (
              <p className="text-sm text-fg-muted">
                Showing the {items.length} newest of {total} emails. Resolve these to see the rest.
              </p>
            )}
            {items.map((item) => (
              <EmailReviewCard key={item.id} item={item} attachOptions={attachOptions} />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
