import { expect, test } from "@playwright/test";
import { signJoinToken, verifyJoinToken } from "../../src/server/module/rooms/join-token";

const SECRET = "test-secret";

test("U3 @regression sign then verify ok", async () => {
  const token = signJoinToken(SECRET, "abcd1234", "user-1");
  expect(verifyJoinToken(SECRET, token, "abcd1234", "user-1")).toBe(true);
});

test("U3 @regression tampered token fails", async () => {
  const token = signJoinToken(SECRET, "abcd1234", "user-1");
  // flip a middle char: the last base64url char can be pure padding bits and decode unchanged
  const i = Math.floor(token.length / 2);
  const tampered = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
  expect(verifyJoinToken(SECRET, tampered, "abcd1234", "user-1")).toBe(false);
});

test("U3 @regression expired token fails", async () => {
  const token = signJoinToken(SECRET, "abcd1234", "user-1", 600, Date.now() - 601_000);
  expect(verifyJoinToken(SECRET, token, "abcd1234", "user-1")).toBe(false);
});

test("U3 @regression different code or user fails", async () => {
  const token = signJoinToken(SECRET, "abcd1234", "user-1");
  expect(verifyJoinToken(SECRET, token, "other123", "user-1")).toBe(false);
  expect(verifyJoinToken(SECRET, token, "abcd1234", "user-2")).toBe(false);
  expect(verifyJoinToken("other-secret", token, "abcd1234", "user-1")).toBe(false);
});

test("U4 token is url-safe base64 and short", async () => {
  const token = signJoinToken(SECRET, "abcd1234", "user-1");
  expect(token).toMatch(/^[A-Za-z0-9\-_.]+$/);
  expect(token.length).toBeLessThanOrEqual(128);
});
