/** Only same-origin relative paths are allowed as post-login destinations (no //host, /\host or control chars). */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length > 512) return "/dashboard";
  if (!/^\/(?![/\\])/.test(next) || /[\\\s\u0000-\u001f\u007f]/.test(next)) return "/dashboard";
  try {
    const u = new URL(next, "http://careerquest.local");
    if (u.origin !== "http://careerquest.local") return "/dashboard";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/dashboard";
  }
}
