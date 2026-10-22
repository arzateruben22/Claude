/**
 * FormData → raw values for the Job Discovery forms (pure). Blank title/company/url/location/pay
 * are filled from the pasted posting text, so "Paste a job URL or posting text" also works without
 * JavaScript (the client pre-fills the same fields with the same parser when it runs).
 */
import { parseLeadPaste } from "./paste";

export function formString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
}

const blank = (v: string | undefined) => !v || !v.trim();

export type RawLeadValues = {
  title?: string;
  company?: string;
  url?: string;
  location?: string;
  salaryText?: string;
  category?: string;
  notes?: string;
  requiresCompanyVehicle?: string;
  requiresDrivingRecord?: string;
  requiresCdl?: string;
};

export function leadFormValues(fd: FormData): { values: RawLeadValues; pasted: string | null; flagsReviewed: boolean } {
  const values: RawLeadValues = {
    title: formString(fd, "title"),
    company: formString(fd, "company"),
    url: formString(fd, "url"),
    location: formString(fd, "location"),
    salaryText: formString(fd, "salaryText"),
    category: formString(fd, "category"),
    notes: formString(fd, "notes"),
    requiresCompanyVehicle: formString(fd, "requiresCompanyVehicle"),
    requiresDrivingRecord: formString(fd, "requiresDrivingRecord"),
    requiresCdl: formString(fd, "requiresCdl"),
  };
  const pastedRaw = formString(fd, "pasted");
  const pasted = pastedRaw && pastedRaw.trim() ? pastedRaw.slice(0, 20_000) : null;
  if (pasted) {
    const draft = parseLeadPaste(pasted);
    if (blank(values.title) && draft.title) values.title = draft.title;
    if (blank(values.company) && draft.company) values.company = draft.company;
    if (blank(values.url) && draft.url) values.url = draft.url;
    if (blank(values.location) && draft.location) values.location = draft.location;
    if (blank(values.salaryText) && draft.salaryText) values.salaryText = draft.salaryText;
  }
  return { values, pasted, flagsReviewed: formString(fd, "flagsReviewed") === "1" };
}
