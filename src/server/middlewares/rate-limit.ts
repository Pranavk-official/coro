import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { getLimit, type LimitName } from "@/lib/rate-limit/config";
import { countBlocked, limit } from "@/lib/rate-limit/limit";
import { clientIp } from "@/lib/rate-limit/ip";
import { hashIp, rl } from "@/lib/redis/keys";
import { ServiceUnavailableError, TooManyRequestsError } from "@/server/shared/errors";
import type { SessionUser } from "@/server/shared/env";

/** What the counter is keyed by. A function returning `null` skips the limit for that request. */
export type LimitBy = "ip" | "user" | "ip+user" | ((c: Context) => string | null);

export const ipOf = (c: Context): string => hashIp(clientIp(c.req.raw.headers));
const userOf = (c: Context): string | null => (c.get("user") as SessionUser | null | undefined)?.id ?? null;

function keyFor(by: LimitBy, c: Context): string | null {
  if (typeof by === "function") return by(c);
  if (by === "ip") return ipOf(c);
  const user = userOf(c);
  if (!user) return null; // anonymous request: the route's own 401 answers it; `api:global` still counts the IP
  return by === "user" ? user : `${ipOf(c)}:${user}`;
}

/**
 * One line per route (US6): `rateLimit("rooms:create", "user")`.
 * Blocked ⇒ `TooManyRequestsError` (429 + `Retry-After` via the error handler); Redis down on a fail-closed limit ⇒ 503 `try_again`.
 */
export const rateLimit = (name: LimitName, by: LimitBy) =>
  createMiddleware(async (c, next) => {
    const id = keyFor(by, c);
    if (id === null) return next();
    const rule = getLimit(name);
    const r = await limit({ key: rl(name, id), ...rule });
    if (r.unavailable && rule.failClosed) {
      throw new ServiceUnavailableError("try_again", "Can't check that right now. Try again in a moment.");
    }
    c.header("X-RateLimit-Limit", String(rule.max));
    c.header("X-RateLimit-Remaining", String(r.remaining));
    c.header("X-RateLimit-Reset", String(r.resetSec));
    if (!r.ok) {
      void countBlocked(name);
      throw new TooManyRequestsError("rate_limited", r.resetSec, "Too many requests");
    }
    await next();
  });
