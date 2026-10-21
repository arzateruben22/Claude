import type { ZodError } from "zod";

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: string, fieldErrors?: FieldErrors): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

export function fromZodError<T = undefined>(err: ZodError): ActionResult<T> {
  const fieldErrors: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}
