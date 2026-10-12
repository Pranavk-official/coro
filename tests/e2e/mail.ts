// Mailpit API helper (dev compose, http://localhost:18025).
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:18025";

type Summary = { ID: string; Subject: string; Created: string };

export function extractLink(text: string): string | null {
  return text.match(/https?:\/\/[^\s<>"]+/)?.[0] ?? null;
}

export async function countMail(to: string): Promise<number> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return ((await res.json()) as { messages_count: number }).messages_count;
}

/** Newest mail to `to` (optionally whose subject contains `subject`), waiting up to `timeoutMs`. */
export async function waitForMail(
  to: string,
  subject = "",
  timeoutMs = 10_000,
): Promise<{ subject: string; text: string; link: string }> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    const hit = messages.find((m) => m.Subject.includes(subject));
    if (hit) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as { Subject: string; Text: string };
      const link = extractLink(msg.Text);
      if (!link) throw new Error(`no link in mail "${msg.Subject}"`);
      return { subject: msg.Subject, text: msg.Text, link };
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no mail to ${to} matching "${subject}" within ${timeoutMs} ms`);
}

export const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
