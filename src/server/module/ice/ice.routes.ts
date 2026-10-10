import { Hono } from "hono";
import { requireUser } from "@/server/middlewares/session";
import { rateLimit } from "@/server/middlewares/rate-limit";
import { UnauthorizedError } from "@/server/shared/errors";
import { getIceServers } from "@/server/module/ice/ice.service";

const ice = new Hono().get("/", rateLimit("ice", "user"), async (c) => {
  const user = requireUser(c);
  if (!user) throw new UnauthorizedError();
  return c.json(await getIceServers(user));
});

export default ice;
