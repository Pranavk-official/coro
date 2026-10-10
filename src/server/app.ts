import { Hono } from "hono";
import { auth } from "@/lib/better-auth/server";
import { sessionMiddleware } from "@/server/middlewares/session";
import { errorHandler } from "@/server/middlewares/error-handler";
import { rateLimit } from "@/server/middlewares/rate-limit";
import { emailLimit } from "@/server/middlewares/auth-email-limit";
import { NotFoundError } from "@/server/shared/errors";
import routes from "@/server/routes";

// Chained: typeof app below carries the full route schema for hc<AppType>.
const app = new Hono()
  .basePath("/api")
  // Per-email limits run before better-auth (it limits by IP + path only; spec 002 FR20).
  .use("/auth/sign-in/magic-link", emailLimit("auth:magic:email"))
  .use("/auth/request-password-reset", emailLimit("auth:reset:email"))
  .use("/auth/send-verification-email", emailLimit("auth:verify-email"))
  .use("/auth/sign-in/email", emailLimit("auth:password", { withIp: true }))
  // better-auth next — it answers /auth/* itself, so nothing below runs for those paths.
  .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
  // Internal routes are server-to-server (signaling), so they skip the per-IP limit.
  .use((c, next) => (c.req.path.startsWith("/api/internal/") ? next() : rateLimit("api:global", "ip")(c, next)))
  .use(sessionMiddleware)
  .use(rateLimit("api:user", "user"))
  .get("/auth/ok", (c) => c.json({ ok: true }))
  .route("/", routes);

app.onError(errorHandler);
app.notFound(() => {
  throw new NotFoundError("route_not_found");
});

export default app;
export type AppType = typeof app;
