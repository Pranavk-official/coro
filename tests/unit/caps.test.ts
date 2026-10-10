import { expect, test } from "@playwright/test";
import { capsFor } from "../../src/lib/webrtc/caps";

test("U9 n≤4 → 720p/30/1.2Mbps; n>4 → 360p/15/400kbps", async () => {
  expect(capsFor(1)).toEqual({ width: 1280, height: 720, frameRate: 30, bitrate: 1_200_000 });
  expect(capsFor(4)).toEqual({ width: 1280, height: 720, frameRate: 30, bitrate: 1_200_000 });
  expect(capsFor(5)).toEqual({ width: 640, height: 360, frameRate: 15, bitrate: 400_000 });
  expect(capsFor(10)).toEqual({ width: 640, height: 360, frameRate: 15, bitrate: 400_000 });
});
