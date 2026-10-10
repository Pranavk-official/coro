import { Hono } from "hono";
import { internalGuard } from "@/server/middlewares/internal";
import { getInternalRoom } from "@/server/module/rooms/rooms.service";
import { normalizeCode } from "@/lib/utils/meeting-code";
import { NotFoundError } from "@/server/shared/errors";

const internal = new Hono()
  .use(internalGuard)
  .get("/rooms/:code", async (c) => {
    const code = normalizeCode(c.req.param("code") ?? "");
    if (!code) throw new NotFoundError();
    return c.json(await getInternalRoom(code));
  });

export default internal;
