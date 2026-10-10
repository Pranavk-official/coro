import { expect, test } from "@playwright/test";
import { hashPassword, verifyPassword } from "../../src/server/module/rooms/password";

test("U2 @regression hash differs from plain text and verifies", async () => {
  const hash = await hashPassword("s3cret-room-pw");
  expect(hash).not.toContain("s3cret-room-pw");
  expect(hash.startsWith("scrypt$")).toBe(true);
  expect(await verifyPassword("s3cret-room-pw", hash)).toBe(true);
  expect(await verifyPassword("wrong-pw", hash)).toBe(false);
});

test("U2 @regression same password gets different salts", async () => {
  const a = await hashPassword("same");
  const b = await hashPassword("same");
  expect(a).not.toBe(b);
  expect(await verifyPassword("same", a)).toBe(true);
  expect(await verifyPassword("same", b)).toBe(true);
});

test("U2 malformed stored hash fails closed", async () => {
  expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  expect(await verifyPassword("x", "scrypt$abc$zz")).toBe(false);
});
