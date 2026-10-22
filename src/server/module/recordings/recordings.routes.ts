import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireUser } from "@/server/middlewares/session";
import { rateLimit } from "@/server/middlewares/rate-limit";
import type { SessionUser } from "@/server/shared/env";
import { ForbiddenError, UnauthorizedError } from "@/server/shared/errors";
import { attachDriveSchema, createRecordingSchema } from "@/server/module/recordings/recordings.schema";
import { attachDrive, createRecording, deleteRecording, listRecordings } from "@/server/module/recordings/recordings.service";

/** Guests can't record (spec 003 FR10), so they have no recordings either. */
function member(user: SessionUser | null): SessionUser {
  if (!user) throw new UnauthorizedError();
  if (user.isAnonymous) throw new ForbiddenError("guests_cannot_record");
  return user;
}

function zodHook(result: { success: boolean; error?: unknown }): void {
  if (!result.success) throw result.error;
}

const recordings = new Hono()
  .get("/", rateLimit("recordings:read", "user"), async (c) => c.json(await listRecordings(member(requireUser(c)).id)))
  .post("/", rateLimit("recordings:write", "user"), zValidator("json", createRecordingSchema, zodHook), async (c) => {
    const user = member(requireUser(c));
    return c.json(await createRecording(user.id, c.req.valid("json")), 201);
  })
  .patch("/:id/drive", rateLimit("recordings:write", "user"), zValidator("json", attachDriveSchema, zodHook), async (c) => {
    const user = member(requireUser(c));
    return c.json(await attachDrive(user.id, c.req.param("id"), c.req.valid("json").driveFileId));
  })
  .delete("/:id", rateLimit("recordings:write", "user"), async (c) => {
    await deleteRecording(member(requireUser(c)).id, c.req.param("id"));
    return c.body(null, 204);
  });

export default recordings;
