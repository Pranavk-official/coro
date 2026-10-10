import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(_scrypt);

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hex] = parts;
  let expected: Buffer;
  try {
    expected = Buffer.from(hex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_BYTES) return false;
  const actual = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return timingSafeEqual(actual, expected);
}
