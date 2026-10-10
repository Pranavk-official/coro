const ALPHABET = "abcdefghijkmnpqrstuvwxyz";

export const CODE_SHAPE = [3, 4, 3] as const;

export function normalizeCode(raw: string): string | null {
  const c = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (c.length !== 10) return null;
  for (const ch of c) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return `${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7)}`;
}

export function parseMeetingInput(text: string): string | null {
  const t = text.trim();
  try {
    const u = new URL(t, "http://x");
    const m = u.pathname.match(/\/rooms\/([^/?#]+)/);
    if (m) return normalizeCode(m[1]);
  } catch {
    /* not a URL — fall through to bare code */
  }
  return normalizeCode(t);
}
