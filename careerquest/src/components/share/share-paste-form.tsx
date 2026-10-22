import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";

/**
 * Plain GET form back to /share (works without JavaScript): the fallback when the share sheet does
 * not offer CareerQuest (iOS Safari) — copy the link or posting text, open /share, paste.
 */
export function SharePasteForm({ defaultText = "" }: { defaultText?: string }) {
  return (
    <form method="get" action="/share" className="space-y-3">
      <Field label="Paste a job link or posting text" htmlFor="share-paste" hint="Read on CareerQuest's server from what you paste; the link itself is never opened.">
        <Textarea id="share-paste" name="text" defaultValue={defaultText} rows={4} maxLength={20000} placeholder="https://…" />
      </Field>
      <Button type="submit" variant="secondary" className="w-full sm:w-auto">
        Read it
      </Button>
    </form>
  );
}
