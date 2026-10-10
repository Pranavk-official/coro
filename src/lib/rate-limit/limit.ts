import { getRedis, logRedisError, redisConfigured, type RedisClient } from "@/lib/redis/client";
import { blockedKey } from "@/lib/redis/keys";
import { rateLimitDisabled } from "@/lib/rate-limit/config";

export type LimitResult = { ok: boolean; remaining: number; resetSec: number; unavailable: boolean };

// Fixed window: INCR, set the TTL on the first hit only, report the TTL left (plan D2/D3).
const LUA =
  "local c=redis.call('INCR',KEYS[1]) if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return {c,redis.call('TTL',KEYS[1])}";

type Evaluator = Pick<RedisClient, "eval">;

/**
 * One atomic round-trip. Redis error ⇒ allow (fail open) unless `failClosed`, logged as `rate_limit_unavailable`.
 * Limits off (`RATE_LIMIT_DISABLED=1` or no `REDIS_URL`) ⇒ always allowed.
 */
export async function limit(
  o: { key: string; max: number; windowSec: number; failClosed?: boolean },
  client?: () => Promise<Evaluator>, // tests inject a fake; default is the shared client
): Promise<LimitResult> {
  if (rateLimitDisabled() || (!client && !redisConfigured())) {
    return { ok: true, remaining: o.max, resetSec: o.windowSec, unavailable: false };
  }
  try {
    const r = await (client ?? getRedis)();
    const [count, ttl] = (await r.eval(LUA, { keys: [o.key], arguments: [String(o.windowSec)] })) as [
      number,
      number,
    ];
    return {
      ok: count <= o.max,
      remaining: Math.max(0, o.max - count),
      resetSec: Math.max(ttl, 1),
      unavailable: false,
    };
  } catch (err) {
    logRedisError("rate_limit_unavailable", err);
    return { ok: !o.failClosed, remaining: 0, resetSec: 1, unavailable: true };
  }
}

/** `rl:blocked:<name>` +1 (1-day TTL); never throws. */
export async function countBlocked(name: string): Promise<void> {
  if (!redisConfigured()) return;
  try {
    const r = await getRedis();
    const key = blockedKey(name);
    await r.multi().incr(key).expire(key, 86_400).exec();
  } catch (err) {
    logRedisError("blocked_counter", err);
  }
}
