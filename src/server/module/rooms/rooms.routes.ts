import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireUser } from "@/server/middlewares/session";
import { ipOf, rateLimit } from "@/server/middlewares/rate-limit";
import type { SessionUser } from "@/server/shared/env";
import { UnauthorizedError } from "@/server/shared/errors";
import {
  createRoomSchema,
  patchRoomSchema,
  verifyRoomSchema,
} from "@/server/module/rooms/rooms.schema";
import {
  createRoom,
  deleteRoom,
  endRoom,
  getInternalRoom,
  getRoom,
  listRooms,
  updateRoom,
  verifyRoomPassword,
} from "@/server/module/rooms/rooms.service";
import { buildIcs } from "@/lib/calendar/ics";
import { normalizeCode } from "@/lib/utils/meeting-code";
import { NotFoundError } from "@/server/shared/errors";

function member(user: SessionUser | null): SessionUser {
  if (!user || user.isAnonymous) throw new UnauthorizedError();
  return user;
}

function normalizedCode(c: Context): string {
  const code = normalizeCode(c.req.param("code") ?? "");
  if (!code) throw new NotFoundError();
  return code;
}

// Password guessing is limited per network and per account, each per room (spec 002 US3).
// Keyed on the normalized code so case/dash variants share one counter.
const verifyCode = (c: Context) => normalizeCode(c.req.param("code") ?? "") ?? "";
const verifyByIp = rateLimit("rooms:verify", (c) => `ip:${ipOf(c)}:${verifyCode(c)}`);
const verifyByUser = rateLimit("rooms:verify", (c) => {
  const user = requireUser(c);
  return user ? `user:${user.id}:${verifyCode(c)}` : null;
});

function zodHook(result: { success: boolean; error?: unknown }): void {
  if (!result.success) throw result.error;
}

const rooms = new Hono()
  .get("/", async (c) => {
    return c.json(await listRooms(member(requireUser(c)).id));
  })
  .post("/", rateLimit("rooms:create", "user"), zValidator("json", createRoomSchema, zodHook), async (c) => {
    return c.json(await createRoom(member(requireUser(c)).id, c.req.valid("json")), 201);
  })
  .get("/:code", rateLimit("rooms:get", "ip"), async (c) => {
    const user = requireUser(c);
    if (!user) throw new UnauthorizedError();
    return c.json(await getRoom(normalizedCode(c)));
  })
  .get("/:code/calendar.ics", async (c) => {
    const user = requireUser(c);
    if (!user) throw new UnauthorizedError();
    const room = await getInternalRoom(normalizedCode(c));
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    return c.text(
      buildIcs(
        {
          code: room.code,
          name: room.name,
          startsAt: room.startsAt,
          expiresAt: room.expiresAt,
          createdAt: room.createdAt,
        },
        base,
      ),
      200,
      { "Content-Type": "text/calendar; charset=utf-8" },
    );
  })
  .patch("/:code", zValidator("json", patchRoomSchema, zodHook), async (c) => {
    const user = member(requireUser(c));
    return c.json(await updateRoom(user.id, normalizedCode(c), c.req.valid("json")));
  })
  .post("/:code/verify", verifyByIp, verifyByUser, zValidator("json", verifyRoomSchema, zodHook), async (c) => {
    const user = requireUser(c);
    if (!user) throw new UnauthorizedError();
    return c.json(
      await verifyRoomPassword(user.id, normalizedCode(c), c.req.valid("json").password),
    );
  })
  .post("/:code/end", async (c) => {
    const user = member(requireUser(c));
    await endRoom(user.id, normalizedCode(c));
    return c.body(null, 204);
  })
  .delete("/:code", async (c) => {
    const user = member(requireUser(c));
    await deleteRoom(user.id, normalizedCode(c));
    return c.body(null, 204);
  });

export default rooms;
