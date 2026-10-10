import { expect, test } from "@playwright/test";
import { buildIcs } from "../../src/lib/calendar/ics";
import { googleCalendarUrl } from "../../src/lib/calendar/google";

const ROOM = {
  code: "abcd1234",
  name: "Team standup & planning",
  startsAt: "2026-10-10T09:00:00.000Z",
  expiresAt: "2026-10-10T10:00:00.000Z",
  createdAt: "2026-10-09T12:00:00.000Z",
};
const BASE = "http://localhost:3000";

test("U7 ICS has CRLF, UTC stamps, UID, URL", async () => {
  const ics = buildIcs(ROOM, BASE);
  expect(ics).toContain("\r\n");
  expect(ics).not.toMatch(/[^\r]\n/);
  expect(ics).toContain("DTSTART:20261010T090000Z");
  expect(ics).toContain("DTEND:20261010T100000Z");
  expect(ics).toContain("UID:abcd1234@");
  expect(ics).toContain("URL:http://localhost:3000/rooms/abcd1234");
  expect(ics).toContain("BEGIN:VEVENT");
});

test("U7 Google link has dates and encoded name", async () => {
  const url = googleCalendarUrl(ROOM, BASE);
  expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
  expect(url).toContain("dates=20261010T090000Z%2F20261010T100000Z");
  expect(url).toContain("text=Team+standup+%26+planning");
});
