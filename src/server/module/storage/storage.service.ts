import { presignPut } from "@/lib/s3/client";
import type { SessionUser } from "@/server/shared/env";
import { BadRequestError } from "@/server/shared/errors";

export function presignUpload(user: SessionUser, key: string, contentType: string) {
  if (!key.startsWith("rooms/") || !key.includes(`/${user.id}/`)) {
    throw new BadRequestError("bad_key_prefix", "Key must be rooms/<code>/<your-user-id>/…");
  }
  return presignPut(key, contentType);
}
