import nodemailer, { type Transporter } from "nodemailer";
import type { Mail } from "@/lib/nodemailer/templates";
import { getLimit } from "@/lib/rate-limit/config";
import { limit } from "@/lib/rate-limit/limit";
import { rl } from "@/lib/redis/keys";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  }
  return transporter;
}

type Deps = { transporter?: Pick<Transporter, "sendMail"> | null; limit?: typeof limit };

/**
 * Never throws: auth flows must answer the same way whether or not mail went out.
 * Global `mail:daily` cap (spec 002 D20) blocks the send, not the request, and logs `mail_cap_reached`.
 */
export async function sendMail(to: string, mail: Mail, deps: Deps = {}): Promise<void> {
  const t = deps.transporter !== undefined ? deps.transporter : getTransporter();
  if (!t) {
    console.warn("[mail] SMTP_URL unset, not sent:", mail.subject, "→", to);
    return;
  }
  try {
    const cap = await (deps.limit ?? limit)({
      key: rl("mail:daily", new Date().toISOString().slice(0, 10)),
      ...getLimit("mail:daily"),
    });
    if (!cap.ok) {
      console.warn("[mail] mail_cap_reached, not sent:", mail.subject);
      return;
    }
    await t.sendMail({ from: process.env.MAIL_FROM ?? "Coro <no-reply@localhost>", to, ...mail });
  } catch (err) {
    console.error("[mail] send failed:", mail.subject, err instanceof Error ? err.message : err);
  }
}
