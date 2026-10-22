"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, Copy, Loader2, MessageSquare, Send, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { FieldError, Label, Select, Textarea } from "@/components/ui/input";
import { clearCoachHistoryAction, sendCoachMessageAction } from "@/lib/coach/actions";
import type { CoachMessageView } from "@/lib/coach/messages";
import type { ApplicationChoice, QuickReply } from "@/lib/coach/replies";
import type { Draft } from "@/lib/coach/drafts";
import { RichText, metricsById } from "./rich-text";

export const STARTER_PROMPTS: QuickReply[] = [
  { label: "How am I doing?", text: "How am I doing?" },
  { label: "What should I do today?", text: "What should I do today?" },
  { label: "Where are applications stalling?", text: "Where are my applications stalling?" },
  { label: "Which roles fit me best?", text: "Which roles fit me best?" },
  { label: "Draft a follow-up email", text: "Draft a follow-up email" },
  { label: "Tailor my résumé", text: "Tailor my résumé" },
  { label: "Cover letter draft", text: "Cover letter draft" },
  { label: "What skills am I missing?", text: "What skills am I missing?" },
  { label: "Mock interview", text: "Mock interview" },
  { label: "Compare apprenticeship programs", text: "Compare apprenticeship programs" },
  { label: "Explain salary progression", text: "Explain salary progression" },
];

const STATUS_LABEL: Record<string, string> = {
  SAVED: "saved",
  PREPARING: "preparing",
  SUBMITTED: "submitted",
  CONFIRMED: "confirmed",
  SCREENING: "screening",
  INTERVIEWING: "interviewing",
  OFFER: "offer",
  NO_RESPONSE: "no response",
};

type SendState = Awaited<ReturnType<typeof sendCoachMessageAction>> | null;
type FormAction = (formData: FormData) => void;

function QuickReplyButton({ reply, formAction, pending }: { reply: QuickReply; formAction: FormAction; pending: boolean }) {
  return (
    <form action={formAction}>
      <input type="hidden" name="text" value={reply.text} />
      {reply.applicationId && <input type="hidden" name="applicationId" value={reply.applicationId} />}
      {reply.role && <input type="hidden" name="role" value={reply.role} />}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg hover:bg-surface-hover hover:border-line-strong disabled:opacity-50"
      >
        {reply.label}
      </button>
    </form>
  );
}

function DraftBlock({ draft }: { draft: Draft }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const full = `${draft.subject ? `Subject: ${draft.subject}\n\n` : ""}${draft.body}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: select the text so the user can copy it manually.
      const el = preRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };
  return (
    <div className="mt-3 rounded-ctl border border-line bg-bg-elevated" data-testid="coach-draft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs font-medium text-fg">{draft.title}</p>
          <Badge tone="warning">Draft · not sent</Badge>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${draft.title}`}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre ref={preRef} className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-sans text-sm text-fg">
        {full}
      </pre>
      <span className="sr-only" aria-live="polite">
        {copied ? "Draft copied to the clipboard" : ""}
      </span>
    </div>
  );
}

function timeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

function MessageItem({ m, timeZone, isLast, formAction, pending }: { m: CoachMessageView; timeZone: string; isLast: boolean; formAction: FormAction; pending: boolean }) {
  const mine = m.role === "USER";
  return (
    <li className={cn("flex gap-2.5", mine && "flex-row-reverse")} data-testid={mine ? "coach-user-message" : "coach-assistant-message"}>
      <span
        className={cn("mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", mine ? "bg-surface-strong text-fg-muted" : "bg-accent-soft text-accent")}
        aria-hidden
      >
        {mine ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div className={cn("min-w-0 max-w-[92%] sm:max-w-[85%]", mine && "text-right")}>
        <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
          <span className="font-medium text-fg-muted">{mine ? "You" : "Advisor"}</span>
          {!mine && <Badge tone={m.provider === "ANTHROPIC" ? "accent" : "neutral"}>{m.provider === "ANTHROPIC" ? "Claude" : "Rules engine"}</Badge>}
          <time dateTime={m.createdAt}>{timeLabel(m.createdAt, timeZone)}</time>
        </p>
        <div className={cn("rounded-card px-3.5 py-2.5 text-left", mine ? "bg-accent-soft" : "glass")}>
          {m.notice && (
            <Alert tone="warning" className="mb-2 text-xs">
              {m.notice}
            </Alert>
          )}
          {mine ? <p className="whitespace-pre-wrap break-words text-sm text-fg">{m.content}</p> : <RichText text={m.content} metrics={metricsById(m.citations)} />}
          {m.drafts?.map((d, i) => <DraftBlock key={i} draft={d} />)}
          {m.actions && m.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {m.actions.map((a) => (
                <Link key={a.href + a.label} href={a.href} className={buttonClasses("outline", "sm")}>
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {isLast && !mine && m.quickReplies && m.quickReplies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Suggested replies">
            {m.quickReplies.map((q) => (
              <QuickReplyButton key={q.label + (q.applicationId ?? "")} reply={q} formAction={formAction} pending={pending} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function ChatPanel({
  messages,
  applications,
  llmEnabled,
  timeZone,
  initialText,
}: {
  messages: CoachMessageView[];
  applications: ApplicationChoice[];
  llmEnabled: boolean;
  timeZone: string;
  initialText?: string;
}) {
  const [state, formAction, pending] = useActionState<SendState, FormData>(sendCoachMessageAction, null);
  const [clearState, clearAction, clearing] = useActionState(clearCoachHistoryAction, null);
  const [applicationId, setApplicationId] = useState("");
  // The ?ask= prefill is used once; after the first send the box resets to empty.
  const [prefill, setPrefill] = useState(initialText);
  const listRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textId = useId();
  const appId = useId();
  const lastAssistant = [...messages].reverse().find((m) => m.role === "ASSISTANT");
  const interviewActive = Boolean(lastAssistant?.interview?.active);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" aria-hidden />
            Ask the Advisor
          </CardTitle>
          <CardDescription>
            {llmEnabled
              ? "Open questions are answered by Claude (Anthropic API) using only the metrics below. Drafts, résumé tailoring, mock interviews and program comparisons always use the built-in tools."
              : "Answers come from the built-in rules engine (no Anthropic API key is configured). Every number is cited from your records."}
          </CardDescription>
        </div>
        <Badge tone={llmEnabled ? "accent" : "neutral"}>{llmEnabled ? "Claude + rules" : "Rules engine"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div ref={listRef} className="max-h-[65vh] min-h-48 overflow-y-auto pr-1" aria-live="polite" aria-busy={pending}>
          {messages.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-fg-muted">No messages yet. Ask anything about your search, or start with one of these:</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STARTER_PROMPTS.map((q) => (
                  <QuickReplyButton key={q.label} reply={q} formAction={formAction} pending={pending} />
                ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-4" aria-label="Conversation">
              {messages.map((m, i) => (
                <MessageItem key={m.id} m={m} timeZone={timeZone} isLast={i === messages.length - 1} formAction={formAction} pending={pending} />
              ))}
            </ol>
          )}
          {pending && (
            <p className="mt-3 flex items-center gap-2 text-xs text-fg-muted" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              The Advisor is working on it…
            </p>
          )}
        </div>

        {interviewActive && (
          <Alert tone="info" title="Mock interview in progress">
            Your next message is treated as your answer. Type &ldquo;skip&rdquo; to move on or &ldquo;stop&rdquo; to end it.
          </Alert>
        )}
        {state && !state.ok && !fieldErrors && (
          <Alert tone="danger" className="text-xs">
            {state.error}
          </Alert>
        )}

        <form
          ref={formRef}
          action={formAction}
          className="space-y-2"
          onSubmit={() => {
            if (prefill !== undefined) setPrefill(undefined);
          }}
        >
          <Label htmlFor={textId}>{interviewActive ? "Your answer" : "Message the Advisor"}</Label>
          <Textarea
            id={textId}
            name="text"
            rows={3}
            maxLength={4000}
            required
            defaultValue={prefill}
            placeholder={interviewActive ? "Answer as you would out loud…" : "e.g. How am I doing? · Draft a follow-up email for Acme"}
            aria-invalid={fieldErrors?.text ? true : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <FieldError errors={fieldErrors?.text} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor={appId}>Application (for drafts and tailoring)</Label>
              <Select id={appId} name="applicationId" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
                <option value="">None, or name it in your message</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.companyName} · {a.positionTitle} ({STATUS_LABEL[a.status] ?? a.status.toLowerCase()})
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" loading={pending} className="sm:w-auto">
              {!pending && <Send className="h-4 w-4" aria-hidden />}
              Send
            </Button>
          </div>
          <p className="text-[11px] text-fg-subtle">Ctrl/⌘ + Enter sends. Nothing you draft here is ever sent to an employer; you copy it and send it yourself.</p>
        </form>

        {messages.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-fg-subtle hover:text-fg">Clear conversation…</summary>
            <form action={clearAction} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="confirm" value="yes" />
              <span className="text-fg-muted">This deletes your Advisor chat history. Your applications and metrics are not affected.</span>
              <Button type="submit" variant="danger" size="sm" loading={clearing}>
                {!clearing && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                Clear it
              </Button>
            </form>
            {clearState && <p className="mt-1 text-fg-muted" role="status">{clearState.ok ? clearState.data.message : clearState.error}</p>}
          </details>
        )}
      </CardContent>
    </Card>
  );
}
