import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireUser } from "@/server/middlewares/session";
import { rateLimit } from "@/server/middlewares/rate-limit";
import { UnauthorizedError } from "@/server/shared/errors";
import { ServiceUnavailableError } from "@/server/shared/errors";
import { storageHealthy } from "@/lib/s3/client";
import { presignUpload } from "@/server/module/storage/storage.service";

const presignSchema = z.object({
  key: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
});

function member(user: ReturnType<typeof requireUser>) {
  if (!user || user.isAnonymous) throw new UnauthorizedError();
  return user;
}

function zodHook(result: { success: boolean; error?: unknown }): void {
  if (!result.success) throw result.error;
}

const storage = new Hono()
  .get("/health", async (c) => {
    member(requireUser(c));
    const ok = await storageHealthy();
    if (!ok) throw new ServiceUnavailableError();
    return c.json({ ok: true });
  })
  .post("/presign", rateLimit("storage:presign", "user"), zValidator("json", presignSchema, zodHook), async (c) => {
    const user = member(requireUser(c));
    const { key, contentType } = c.req.valid("json");
    return c.json(await presignUpload(user, key, contentType));
  });

export default storage;
