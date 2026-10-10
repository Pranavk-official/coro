import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export const ICE_TTL_SEC = 3600;

export function iceServers(
  userId: string,
  opts: { turnHost?: string; turnSecret?: string } = {},
  nowMs: number = Date.now(),
): IceServer[] {
  const servers: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (opts.turnHost && opts.turnSecret) {
    const exp = Math.floor(nowMs / 1000) + ICE_TTL_SEC;
    const username = `${exp}:${userId}`;
    const credential = createHmac("sha1", opts.turnSecret).update(username).digest("base64");
    servers.push({
      urls: [`turn:${opts.turnHost}:3478?transport=udp`, `turn:${opts.turnHost}:3478?transport=tcp`],
      username,
      credential,
    });
  }
  return servers;
}
