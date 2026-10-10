import { expect, test } from "@playwright/test";
import { roomStatus } from "../../src/server/module/rooms/status";

const NOW = new Date("2026-10-09T12:00:00Z");
const before = new Date("2026-10-09T11:00:00Z");
const after = new Date("2026-10-09T13:00:00Z");

test("U5 @regression precedence: ended > expired > scheduled > live", async () => {
  expect(roomStatus({ startsAt: after, expiresAt: before, endedAt: before }, NOW)).toBe("ended");
  expect(roomStatus({ startsAt: after, expiresAt: before, endedAt: null }, NOW)).toBe("expired");
  expect(roomStatus({ startsAt: after, expiresAt: after, endedAt: null }, NOW)).toBe("scheduled");
  expect(roomStatus({ startsAt: before, expiresAt: after, endedAt: null }, NOW)).toBe("live");
  expect(roomStatus({ startsAt: null, expiresAt: null, endedAt: null }, NOW)).toBe("live");
});

test("U5 @regression boundary at now", async () => {
  expect(roomStatus({ startsAt: NOW, expiresAt: null, endedAt: null }, NOW)).toBe("live");
  expect(roomStatus({ startsAt: null, expiresAt: NOW, endedAt: null }, NOW)).toBe("live");
});
