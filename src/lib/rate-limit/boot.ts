import { pingRedis } from "@/lib/redis/client";

type Env = Record<string, string | undefined>;

/**
 * Startup guard (spec 002 T19, AC7). Throws on a config that must not run; returns warnings to log.
 * Prisma/React-free: loaded by server.ts.
 */
export async function bootCheck(env: Env = process.env, ping: () => Promise<boolean> = pingRedis): Promise<string[]> {
  const prod = env.NODE_ENV === "production";
  if (prod && env.RATE_LIMIT_DISABLED === "1") {
    throw new Error("RATE_LIMIT_DISABLED=1 turns every rate limit off; refusing to start in production");
  }
  if (env.REDIS_REQUIRED === "1" && !(await ping())) {
    throw new Error(`REDIS_REQUIRED=1 but Redis is unreachable at REDIS_URL=${env.REDIS_URL ?? "(unset)"}`);
  }
  const warnings: string[] = [];
  if (!env.REDIS_URL) warnings.push("REDIS_URL unset: rate limits and the read cache are off");
  if (prod && env.TRUST_PROXY !== "1") {
    warnings.push("TRUST_PROXY unset: behind a reverse proxy every client shares the proxy's IP limit");
  }
  return warnings;
}
