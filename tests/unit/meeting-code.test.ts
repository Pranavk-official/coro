import { expect, test } from "@playwright/test";
import { normalizeCode, parseMeetingInput } from "../../src/lib/utils/meeting-code";

test("U10 @regression normalizeCode accepts variants, rejects junk", async () => {
  expect(normalizeCode("ABC-DEFG-HIJ")).toBe("abc-defg-hij");
  expect(normalizeCode("abcdefghij")).toBe("abc-defg-hij");
  expect(normalizeCode(" abc defg hij ")).toBe("abc-defg-hij");
  expect(normalizeCode("abc-defg-hi")).toBeNull();
  expect(normalizeCode("abcdefghijk")).toBeNull();
  expect(normalizeCode("abcldefghj")).toBeNull();
  expect(normalizeCode("abcdefghoj")).toBeNull();
  expect(normalizeCode("abc123defg")).toBeNull();
  expect(normalizeCode("")).toBeNull();
});

test("U10 @regression parseMeetingInput handles URLs and codes", async () => {
  expect(parseMeetingInput("https://host/rooms/abc-defg-hij?x=1")).toBe("abc-defg-hij");
  expect(parseMeetingInput("https://host/rooms/ABC-DEFG-HIJ#frag")).toBe("abc-defg-hij");
  expect(parseMeetingInput("/rooms/ABC-DEFG-HIJ")).toBe("abc-defg-hij");
  expect(parseMeetingInput("abc-defg-hij")).toBe("abc-defg-hij");
  expect(parseMeetingInput(" abcdefghij ")).toBe("abc-defg-hij");
  expect(parseMeetingInput("abc-defg")).toBeNull();
  expect(parseMeetingInput("garbage!!")).toBeNull();
  expect(parseMeetingInput("")).toBeNull();
});
