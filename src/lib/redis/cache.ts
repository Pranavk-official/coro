import { getRedis, logRedisError, redisConfigured } from "@/lib/redis/client";

// Single-flight per key, in-process only (plan D10): concurrent misses share one `fn()` call.
const inflight = new Map<string, Promise<unknown>>();

/** Read-through JSON cache. Redis down or unset ⇒ just runs `fn` (never fails a request). Errors from `fn` are not cached. */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  if (!redisConfigured()) return fn();
  try {
    const hit = await (await getRedis()).get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    logRedisError("cache_get", err);
  }
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = fn()
    .then(async (value) => {
      try {
        await (await getRedis()).set(key, JSON.stringify(value), { expiration: { type: "EX", value: ttlSec } });
      } catch (err) {
        logRedisError("cache_set", err);
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Drop cache keys after a write (plan §6). Never throws; the TTL is the safety net. */
export async function bust(...keys: string[]): Promise<void> {
  if (!redisConfigured() || keys.length === 0) return;
  try {
    await (await getRedis()).del(keys);
  } catch (err) {
    logRedisError("cache_bust", err);
  }
}
