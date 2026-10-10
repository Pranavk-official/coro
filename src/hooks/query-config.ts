import { ApiError } from "@/lib/hono/client";

/** `staleTime` per query, at or just under the server's Redis TTL (spec 002 FR10, plan §6). */
export const STALE = { room: 10_000, ice: 240_000, list: 30_000, health: 60_000 } as const;

/** The only client retry policy (plan D11): never 4xx (incl. 429), at most 2 on 5xx / network. */
export const shouldRetry = (failures: number, err: unknown): boolean =>
  err instanceof ApiError && err.status > 0 ? err.status >= 500 && failures < 2 : failures < 2;

/** Honour `Retry-After` when the server sent one, else exponential backoff capped at 8 s. */
export const retryDelay = (attempt: number, err: unknown): number =>
  err instanceof ApiError && err.retryAfter ? err.retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000);
