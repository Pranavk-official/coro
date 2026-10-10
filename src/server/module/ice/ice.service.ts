import type { SessionUser } from "@/server/shared/env";
import { iceServers } from "@/lib/webrtc/ice";
import { cached } from "@/lib/redis/cache";
import { cacheKey } from "@/lib/redis/keys";

// 5 min: well under the 1 h TURN credential lifetime (spec 002 plan §6).
export function getIceServers(user: SessionUser) {
  return cached(cacheKey("ice", user.id), 300, async () =>
    iceServers(user.id, {
      turnHost: process.env.TURN_HOST,
      turnSecret: process.env.TURN_SECRET,
    }),
  );
}
