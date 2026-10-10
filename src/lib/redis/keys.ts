import { createHash } from "node:crypto";

/** Rate-limit counter key: `rl:<name>:<id>`. */
export const rl = (name: string, id: string): string => `rl:${name}:${id}`;

/** Read-cache key: `cache:<name>:<id>`. */
export const cacheKey = (name: string, id: string): string => `cache:${name}:${id}`;

/** Blocked-request counter per limit name (read by `dev-db.sh -Qr`). */
export const blockedKey = (name: string): string => `rl:blocked:${name}`;

/** Privacy: IPs/emails never land in Redis raw (spec NFR3). SHA-256, 16 hex chars. */
export const hashIp = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);
