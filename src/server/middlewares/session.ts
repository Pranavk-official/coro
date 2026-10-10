import type { Context, Next } from "hono";
import { auth } from "@/lib/better-auth/server";
import type { SessionUser } from "@/server/shared/env";

export async function sessionMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("session", session);
  c.set(
    "user",
    session?.user
      ? {
          id: session.user.id,
          name: session.user.name,
          image: session.user.image ?? null,
          isAnonymous: (session.user as { isAnonymous?: boolean }).isAnonymous ?? false,
        }
      : null,
  );
  await next();
}

export function requireUser(c: Context): SessionUser | null {
  return c.get("user") as SessionUser | null;
}
