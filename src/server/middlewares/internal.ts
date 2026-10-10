import type { Context, Next } from "hono";
import { UnauthorizedError } from "@/server/shared/errors";

export async function internalGuard(c: Context, next: Next) {
  const secret = process.env.INTERNAL_SECRET;
  const header = c.req.header("x-internal-secret");
  if (!secret || header !== secret) {
    throw new UnauthorizedError();
  }
  await next();
}
