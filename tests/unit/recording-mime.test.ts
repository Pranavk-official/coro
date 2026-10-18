import { expect, test } from "@playwright/test";
import { layout, pickMime } from "../../src/lib/media-recorder/recorder";

test("U1 @regression pickMime: first supported per format, '' when none", () => {
  expect(pickMime("webm", () => true)).toBe("video/webm;codecs=vp9,opus");
  expect(pickMime("webm", (t) => !t.includes("vp9"))).toBe("video/webm;codecs=vp8,opus");
  expect(pickMime("mp4", (t) => t === "video/mp4")).toBe("video/mp4");
  expect(pickMime("mp4", () => false)).toBe("");
});

test("U6 @regression layout: grid fills the canvas; screen share gets the left 3/4", () => {
  const { tiles } = layout(4, false, 1280, 720, 8);
  expect(tiles).toHaveLength(4);
  expect(tiles[1]!.x).toBeCloseTo(8 + tiles[0]!.w + 8);
  expect(tiles[3]!.x + tiles[3]!.w).toBeCloseTo(1272); // right edge = W - gap
  expect(tiles[3]!.y + tiles[3]!.h).toBeCloseTo(712); // bottom edge = H - gap
  const s = layout(2, true, 1280, 720, 8);
  expect(s.screen!.x + s.screen!.w + 8).toBeCloseTo(s.tiles[0]!.x); // gap between screen and column
  expect(s.tiles[1]!.y + s.tiles[1]!.h).toBeCloseTo(712);
  expect(layout(0, true, 1280, 720, 8).screen!.w).toBe(1264); // alone: full width
});
