import { createMiddleware } from "hono/factory";
import { getLimit, type LimitName } from "@/lib/rate-limit/config";
import { countBlocked, limit } from "@/lib/rate-limit/limit";
import { hashIp, rl } from "@/lib/redis/keys";
import { ipOf } from "@/server/middlewares/rate-limit";
import { ServiceUnavailableError, TooManyRequestsError } from "@/server/shared/errors";

/** Lower-cased, trimmed `email` from a JSON body; `null` when absent/unreadable. Reads a clone so better-auth still gets the body. */
export async function bodyEmail(req: Request): Promise<string | null> {
  const body: unknown = await req
    .clone()
    .json()
    .catch(() => null);
  const email = typeof body === "object" && body !== null ? (body as { email?: unknown }).email : null;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

/**
 * Per-email limit in front of better-auth (spec FR20, plan D18): better-auth only limits by IP + path.
 * Same 429 for known and unknown addresses (no enumeration). `withIp`: key is ip+email (password brute force).
 */
export const emailLimit = (name: LimitName, opts: { withIp?: boolean } = {}) =>
  createMiddleware(async (c, next) => {
    if (c.req.method !== "POST") return next();
    const email = await bodyEmail(c.req.raw);
    if (!email) return next(); // better-auth answers the validation error itself
    const rule = getLimit(name);
    const id = opts.withIp ? `${ipOf(c)}:${hashIp(email)}` : hashIp(email);
    const r = await limit({ key: rl(name, id), ...rule });
    if (r.unavailable && rule.failClosed) {
      throw new ServiceUnavailableError("try_again", "Can't sign you in right now. Try again in a moment.");
    }
    if (!r.ok) {
      void countBlocked(name);
      throw new TooManyRequestsError("rate_limited", r.resetSec, "Too many requests");
    }
    await next();
  });
