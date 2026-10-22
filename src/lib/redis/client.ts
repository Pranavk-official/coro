import { createClient } from "redis";

const makeClient = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 2000, reconnectStrategy: (n: number) => Math.min(200 * 2 ** n, 5000) },
  });

export type RedisClient = ReturnType<typeof makeClient>;

let client: RedisClient | null = null;
let clientUrl: string | null = null;
let firstWait: Promise<unknown> | null = null;
const lastLog = new Map<string, number>();

/** One line per tag per 30 s at most: a down Redis must not flood the logs (spec FR1). */
export function logRedisError(tag: string, err: unknown): void {
  const now = Date.now();
  if (now - (lastLog.get(tag) ?? 0) < 30_000) return;
  lastLog.set(tag, now);
  console.error(`[redis] ${tag}:`, err instanceof Error ? err.message : err);
}

/** `REDIS_URL` unset = Redis features off (limits allow, cache passes through). */
export const redisConfigured = (): boolean => Boolean(process.env.REDIS_URL);

/**
 * Lazy singleton. Throws when Redis is not configured or not reachable, so callers can fail open/closed.
 * Commands never queue while disconnected (`disableOfflineQueue`), so an outage costs no request latency.
 */
export async function getRedis(): Promise<RedisClient> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("redis_not_configured");
  // A different URL than the cached client's (tests swap REDIS_URL inside one worker process): start over.
  if (client && clientUrl !== url) {
    client.destroy();
    client = null;
  }
  let c = client;
  if (!c) {
    c = client = makeClient(url);
    clientUrl = url;
    c.on("error", (err) => logRedisError("connection", err));
    // Callers during the first handshake wait for it (max 1 s); afterwards a down Redis fails immediately.
    firstWait = Promise.race([c.connect(), new Promise((r) => setTimeout(r, 1000))]).catch(() => {}); // errors: `error` event
  }
  if (!c.isReady) await firstWait;
  if (!c.isReady) throw new Error("redis_unavailable");
  return c;
}

/** `PING` with a timeout; used by the boot check. */
export async function pingRedis(): Promise<boolean> {
  try {
    const r = await getRedis();
    return (await r.ping()) === "PONG";
  } catch {
    return false;
  }
}
