import { createHmac, timingSafeEqual } from "node:crypto";

export const JOIN_TOKEN_TTL_SEC = 600;

function signature(secret: string, code: string, userId: string, exp: number): Buffer {
  return createHmac("sha256", secret).update(`${code}:${userId}:${exp}`).digest();
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function signJoinToken(
  secret: string,
  code: string,
  userId: string,
  ttlSec: number = JOIN_TOKEN_TTL_SEC,
  nowMs: number = Date.now(),
): string {
  const exp = Math.floor(nowMs / 1000) + ttlSec;
  return `${exp}.${toBase64Url(signature(secret, code, userId, exp))}`;
}

export function verifyJoinToken(
  secret: string,
  token: string,
  code: string,
  userId: string,
  nowMs: number = Date.now(),
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isInteger(exp) || exp * 1000 <= nowMs) return false;
  let provided: Buffer;
  try {
    provided = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return false;
  }
  const expected = signature(secret, code, userId, exp);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
