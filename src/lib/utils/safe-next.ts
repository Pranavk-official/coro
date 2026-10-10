// Only same-origin absolute paths survive; anything else (//host, /\host, schemes) → "/".
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f]/.test(raw)) return "/";
  return raw;
}
