import "server-only";
/**
 * Email file imports: .eml files, .mbox archives and pasted raw source.
 *
 * Files are checked by extension AND content (an RFC 5322 header block; no binary data) before parsing.
 * Each message goes through the shared email pipeline (classify → store → ingest) under one ImportBatch.
 * Messages the classifier labels UNRELATED are skipped and not stored, so importing a whole mailbox
 * export keeps only job-related mail.
 */
import { classifyEmail } from "@/lib/email/classify";
import { parseEmail, splitMbox } from "@/lib/email/parse";
import { processRawEmail } from "@/lib/email/pipeline";
import type { IngestResult } from "@/lib/ingest/types";
import { createBatch, finishBatch } from "./batches";
import { addOutcome, bucketForEmail, emptyTotals } from "./outcome";
import type { ImportSummaryData, IngestFn, RowIssue } from "./types";

export const MAX_EMAIL_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_MESSAGES_PER_IMPORT = 2000;
export const MAX_PASTE_CHARS = 2 * 1024 * 1024;
const HEADER_SCAN_BYTES = 64 * 1024;

export type EmailFileKind = "eml" | "mbox";

export function emailFileKind(fileName: string): EmailFileKind | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "eml") return "eml";
  if (ext === "mbox" || ext === "mbx") return "mbox";
  return null;
}

const KEY_HEADERS = /^(from|to|subject|date|message-id|received|return-path|mime-version|delivered-to|reply-to|content-type)$/i;

/** True when the text starts with an RFC 5322 header block (at least two fields, one of them a key header). */
export function looksLikeEmail(text: string): boolean {
  const head = text.slice(0, HEADER_SCAN_BYTES).replace(/^﻿/, "");
  if (head.includes("\u0000")) return false;
  const lines = head.replace(/\r\n?/g, "\n").split("\n");
  let fields = 0;
  let key = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === "") break;
    if (i === 0 && line.startsWith("From ")) continue; // mbox envelope line on a single message
    if (/^[ \t]/.test(line)) {
      if (fields === 0) return false;
      continue;
    }
    const m = /^([!-9;-~]+):/.exec(line);
    if (!m) return false;
    fields++;
    if (KEY_HEADERS.test(m[1]!)) key = true;
  }
  return fields >= 2 && key;
}

export type EmailUpload = { name: string; bytes: Buffer };
export type PreparedMessage = { raw: string | Buffer; label: string; provider: "EML" | "MBOX" | "PASTE" };

/** Validate uploads and split them into messages. Returns per-file errors instead of throwing. */
export function prepareEmailInputs(
  files: EmailUpload[],
  pasted: string | null,
): { messages: PreparedMessage[]; fileErrors: string[]; hasMbox: boolean; truncated: boolean } {
  const messages: PreparedMessage[] = [];
  const fileErrors: string[] = [];
  let hasMbox = false;
  let truncated = false;

  for (const f of files) {
    const kind = emailFileKind(f.name);
    if (!kind) {
      fileErrors.push(`${f.name}: only .eml and .mbox files can be imported.`);
      continue;
    }
    if (f.bytes.length === 0) {
      fileErrors.push(`${f.name}: the file is empty.`);
      continue;
    }
    if (f.bytes.subarray(0, HEADER_SCAN_BYTES).includes(0)) {
      fileErrors.push(`${f.name}: this is a binary file, not an email.`);
      continue;
    }
    if (kind === "eml") {
      if (!looksLikeEmail(f.bytes.subarray(0, HEADER_SCAN_BYTES).toString("latin1"))) {
        fileErrors.push(`${f.name}: this does not look like an email (no message headers found).`);
        continue;
      }
      messages.push({ raw: f.bytes, label: f.name, provider: "EML" });
    } else {
      hasMbox = true;
      const parts = splitMbox(f.bytes);
      let valid = 0;
      parts.forEach((p, i) => {
        if (!looksLikeEmail(p)) {
          fileErrors.push(`${f.name}, message ${i + 1}: no message headers found; skipped.`);
          return;
        }
        valid++;
        messages.push({ raw: p, label: `${f.name}, message ${i + 1}`, provider: "MBOX" });
      });
      if (!valid && !parts.length) fileErrors.push(`${f.name}: no messages found.`);
    }
    if (messages.length > MAX_MESSAGES_PER_IMPORT) {
      truncated = true;
      messages.length = MAX_MESSAGES_PER_IMPORT;
      break;
    }
  }

  if (pasted && pasted.trim() && !truncated) {
    if (!looksLikeEmail(pasted.trimStart())) {
      fileErrors.push("Pasted text: this is not raw email source. In your mail app use “Show original” / “View source” and paste all of it, headers included.");
    } else if (messages.length < MAX_MESSAGES_PER_IMPORT) {
      messages.push({ raw: pasted.trimStart(), label: "Pasted email", provider: "PASTE" });
    }
  }
  return { messages, fileErrors, hasMbox, truncated };
}

export type EmailImportInput = { files: EmailUpload[]; pasted: string | null; now?: Date };

export async function importEmails(
  userId: string,
  input: EmailImportInput,
  ingest: IngestFn,
): Promise<{ ok: true; data: ImportSummaryData } | { ok: false; error: string }> {
  const totalBytes = input.files.reduce((n, f) => n + f.bytes.length, 0) + (input.pasted?.length ?? 0);
  if (totalBytes > MAX_EMAIL_UPLOAD_BYTES) return { ok: false, error: "The upload is larger than 25 MB. Import fewer or smaller files at a time." };
  if (input.pasted && input.pasted.length > MAX_PASTE_CHARS) return { ok: false, error: "Pasted text is larger than 2 MB." };

  const prepared = prepareEmailInputs(input.files, input.pasted);
  if (!prepared.messages.length) {
    return { ok: false, error: prepared.fileErrors[0] ?? "Choose .eml or .mbox files, or paste a raw email." };
  }

  const fileName =
    input.files.length === 1 ? input.files[0]!.name : input.files.length > 1 ? `${input.files.length} files` : "Pasted email";
  const batch = await createBatch(userId, prepared.hasMbox ? "MBOX" : "EML", fileName);
  const totals = emptyTotals();
  const issues: RowIssue[] = prepared.fileErrors.map((message) => ({ row: 0, type: "error", message }));
  totals.errors += prepared.fileErrors.length;
  totals.total += prepared.fileErrors.length;
  if (prepared.truncated) {
    issues.push({
      row: 0,
      type: "warning",
      message: `Only the first ${MAX_MESSAGES_PER_IMPORT.toLocaleString("en-US")} messages were imported. Import the rest separately.`,
    });
  }

  let lastIngest: IngestResult | null = null;
  const capture: IngestFn = async (uid, obs) => {
    const r = await ingest(uid, obs);
    lastIngest = r;
    return r;
  };

  for (let i = 0; i < prepared.messages.length; i++) {
    const m = prepared.messages[i]!;
    const n = i + 1;
    totals.total++;
    try {
      const parsed = await parseEmail(m.raw);
      if (classifyEmail(parsed).classification === "UNRELATED") {
        totals.ignored++;
        continue;
      }
      lastIngest = null;
      const summary = await processRawEmail(userId, parsed, { provider: m.provider, importBatchId: batch.id, now: input.now }, capture);
      const bucket = bucketForEmail(summary.action, lastIngest);
      addOutcome(totals, bucket);
      if (bucket === "needs_review") issues.push({ row: n, type: "needs_review", message: `${m.label}: ${summary.reason}` });
    } catch (err) {
      console.error("email import message failed", err);
      totals.errors++;
      issues.push({ row: n, type: "error", message: `${m.label}: could not be read as an email.` });
    }
  }

  const data = await finishBatch(userId, { id: batch.id, kind: batch.kind, fileName: batch.fileName }, totals, issues, {
    unit: "message",
    reviewQueue: true,
  });
  return { ok: true, data };
}
