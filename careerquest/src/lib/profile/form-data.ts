/** Small FormData readers shared by the settings/account server actions. Pure. */

export function text(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

/** Trimmed string, or undefined when the field is absent or blank. */
export function trimmed(formData: FormData, key: string): string | undefined {
  const v = text(formData, key)?.trim();
  return v ? v : undefined;
}

/** Checkbox / switch semantics: present and truthy means on. */
export function checked(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Every non-blank string value submitted under `key` (multi-value inputs such as chips/checkboxes). */
export function list(formData: FormData, key: string): string[] {
  const out: string[] = [];
  for (const v of formData.getAll(key)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t) out.push(t);
  }
  return Array.from(new Set(out));
}

/** Numeric field: blank becomes null so optional decimals can be cleared. */
export function numberOrNull(formData: FormData, key: string): string | null {
  const v = trimmed(formData, key);
  return v === undefined ? null : v;
}
