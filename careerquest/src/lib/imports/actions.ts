"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { dateKeyInTz } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_EMAIL_UPLOAD_BYTES, importEmails, type EmailUpload } from "./email-files";
import { defaultIngest } from "./ingest";
import { IMPORT_FIELDS, type ColumnMapping } from "./mapping";
import { PRESETS, type PresetId } from "./presets";
import { MAX_SPREADSHEET_BYTES, analyzeSpreadsheet, importSpreadsheet } from "./spreadsheet";
import type { AnalyzeData, ImportSummaryData } from "./types";
import { importUrls } from "./url-import";

/**
 * Server actions for /applications/import. Every action authenticates, validates every input on the
 * server (sizes, extensions, content, mapping) and imports only into the signed-in user's account.
 */

const IMPORT_LIMIT = { count: 30, windowMs: 60 * 60_000 };

async function guard(userId: string): Promise<string | null> {
  return rateLimit(`imports:${userId}`, IMPORT_LIMIT.count, IMPORT_LIMIT.windowMs).ok ? null : "Too many imports in the last hour. Try again later.";
}

function filesFrom(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v && (v as File).size > 0);
}

function revalidateImports() {
  revalidatePath("/applications");
  revalidatePath("/applications/import", "layout");
  revalidatePath("/applications/review");
  revalidatePath("/dashboard");
}

async function auditImport(userId: string, data: ImportSummaryData) {
  await audit("applications.imported", {
    userId,
    entityType: "ImportBatch",
    entityId: data.batchId,
    metadata: { kind: data.kind, status: data.status, ...data.totals },
  });
}

// ---------------------------------------------------------------------------
// Email files
// ---------------------------------------------------------------------------

export async function importEmailAction(_prev: ActionResult<ImportSummaryData> | null, formData: FormData): Promise<ActionResult<ImportSummaryData>> {
  const user = await requireUser("/applications/import");
  const limited = await guard(user.id);
  if (limited) return fail(limited);

  const files = filesFrom(formData, "files");
  const pastedRaw = formData.get("pasted");
  const pasted = typeof pastedRaw === "string" && pastedRaw.trim() ? pastedRaw : null;
  if (!files.length && !pasted) return fail("Choose .eml or .mbox files, or paste a raw email.");
  if (files.length > 50) return fail("Import at most 50 files at a time.");
  const totalSize = files.reduce((n, f) => n + f.size, 0);
  if (totalSize > MAX_EMAIL_UPLOAD_BYTES) return fail("The upload is larger than 25 MB. Import fewer or smaller files at a time.");

  const uploads: EmailUpload[] = [];
  for (const f of files) uploads.push({ name: f.name.slice(0, 200), bytes: Buffer.from(await f.arrayBuffer()) });
  const res = await importEmails(user.id, { files: uploads, pasted }, defaultIngest);
  if (!res.ok) return fail(res.error);
  await auditImport(user.id, res.data);
  revalidateImports();
  return ok(res.data);
}

// ---------------------------------------------------------------------------
// Spreadsheets (own trackers and platform exports)
// ---------------------------------------------------------------------------

const presetSchema = z.enum(Object.keys(PRESETS) as [PresetId, ...PresetId[]]);

async function readSpreadsheetUpload(formData: FormData): Promise<{ ok: true; file: File; bytes: Buffer; preset: PresetId } | { ok: false; error: string }> {
  const file = filesFrom(formData, "file")[0];
  if (!file) return { ok: false, error: "Choose a .csv, .tsv or .xlsx file." };
  if (file.size > MAX_SPREADSHEET_BYTES) return { ok: false, error: "The file is larger than 10 MB. Split it and import each part." };
  const preset = presetSchema.safeParse(formData.get("preset") ?? "generic");
  if (!preset.success) return { ok: false, error: "Unknown import preset." };
  return { ok: true, file, bytes: Buffer.from(await file.arrayBuffer()), preset: preset.data };
}

export async function analyzeSpreadsheetAction(_prev: ActionResult<AnalyzeData> | null, formData: FormData): Promise<ActionResult<AnalyzeData>> {
  const user = await requireUser("/applications/import/spreadsheet");
  if (!rateLimit(`imports-analyze:${user.id}`, 60, IMPORT_LIMIT.windowMs).ok) return fail("Too many files analyzed in the last hour. Try again later.");
  const upload = await readSpreadsheetUpload(formData);
  if (!upload.ok) return fail(upload.error);
  const tz = await userTimezone(user.id);
  const res = await analyzeSpreadsheet(upload.file.name.slice(0, 200), upload.bytes, upload.preset, dateKeyInTz(new Date(), tz));
  return res.ok ? ok(res.data) : fail(res.error);
}

const mappingSchema = z
  .record(z.string(), z.number().int().min(0).max(99))
  .transform((m) => {
    const out: ColumnMapping = {};
    for (const f of IMPORT_FIELDS) if (typeof m[f] === "number") out[f] = m[f];
    return out;
  });

export async function importSpreadsheetAction(_prev: ActionResult<ImportSummaryData> | null, formData: FormData): Promise<ActionResult<ImportSummaryData>> {
  const user = await requireUser("/applications/import/spreadsheet");
  const limited = await guard(user.id);
  if (limited) return fail(limited);
  const upload = await readSpreadsheetUpload(formData);
  if (!upload.ok) return fail(upload.error);

  let mappingJson: unknown;
  try {
    mappingJson = JSON.parse(String(formData.get("mapping") ?? "{}"));
  } catch {
    return fail("The column mapping could not be read. Choose the columns again.");
  }
  const mapping = mappingSchema.safeParse(mappingJson);
  if (!mapping.success) return fail("The column mapping is invalid. Choose the columns again.");

  const tz = await userTimezone(user.id);
  const now = new Date();
  const res = await importSpreadsheet(
    user.id,
    {
      fileName: upload.file.name.slice(0, 200),
      bytes: upload.bytes,
      presetId: upload.preset,
      mapping: mapping.data,
      timezone: tz,
      todayKey: dateKeyInTz(now, tz),
      now,
    },
    defaultIngest,
  );
  if (!res.ok) return fail(res.error);
  await auditImport(user.id, res.data);
  revalidateImports();
  return ok(res.data);
}

// ---------------------------------------------------------------------------
// Job URLs
// ---------------------------------------------------------------------------

const urlsSchema = z.string().trim().min(1, "Paste at least one job posting URL.").max(500_000, "That is too much text; paste at most 200 links.");

export async function importUrlsAction(_prev: ActionResult<ImportSummaryData> | null, formData: FormData): Promise<ActionResult<ImportSummaryData>> {
  const user = await requireUser("/applications/import/urls");
  const limited = await guard(user.id);
  if (limited) return fail(limited);
  const parsed = urlsSchema.safeParse(formData.get("urls") ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Paste at least one job posting URL.", { urls: parsed.error.issues.map((i) => i.message) });
  const res = await importUrls(user.id, parsed.data, defaultIngest);
  if (!res.ok) return fail(res.error, { urls: [res.error] });
  await auditImport(user.id, res.data);
  revalidateImports();
  return ok(res.data);
}
