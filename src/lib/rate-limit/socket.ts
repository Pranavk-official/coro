import { getLimit, type LimitName } from "@/lib/rate-limit/config";
import { countBlocked, limit } from "@/lib/rate-limit/limit";
import { rl } from "@/lib/redis/keys";

/** The bits of a Socket.IO socket the guard needs (keeps this file free of socket.io types for tests). */
type GuardedSocket = { id: string; disconnect: (close?: boolean) => unknown };

export type SocketLimitResult = { ok: true } | { ok: false; retryAfter: number };

const STRIKES = 3;

/**
 * First line of a handler (spec 002 FR6). Keyed per socket unless `id` is given (e.g. user id for joins).
 * Third block within 60 s ⇒ `disconnect(true)`. Redis down ⇒ allowed (fail open). Prisma/React-free.
 */
export async function socketLimit(socket: GuardedSocket, name: LimitName, id: string = socket.id): Promise<SocketLimitResult> {
  const r = await limit({ key: rl(name, id), ...getLimit(name) });
  if (r.ok) return { ok: true };
  void countBlocked(name);
  const strike = await limit({ key: `strike:${socket.id}`, max: STRIKES - 1, windowSec: 60 });
  if (!strike.ok) socket.disconnect(true);
  return { ok: false, retryAfter: r.resetSec };
}
