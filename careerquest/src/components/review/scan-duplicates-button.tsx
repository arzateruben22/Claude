"use client";

import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui";
import { scanDuplicatesAction } from "@/lib/ingest/review-actions";
import { useReviewForm } from "./use-review-form";

/** Runs the duplicate scan over the user's applications. */
export function ScanDuplicatesButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const { pending, formProps } = useReviewForm(scanDuplicatesAction);
  return (
    <form {...formProps}>
      <Button type="submit" variant={variant} loading={pending}>
        {!pending && <ScanSearch className="h-4 w-4" aria-hidden />}
        Scan for duplicates
      </Button>
    </form>
  );
}
