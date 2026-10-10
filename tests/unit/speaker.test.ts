import { expect, test } from "@playwright/test";
import { createAutoFollow, createSpeakerDetector } from "../../src/lib/webrtc/speaker";

function levels(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

test("U13 speaking needs 2 ticks, hold keeps it, loudest wins", async () => {
  let now = 0;
  const d = createSpeakerDetector({ now: () => now });
  const events: (string | null)[] = [];
  d.onSpeaking((id) => events.push(id));

  d.add("a", undefined, levels([0.05, 0.05, 0, 0]));
  d.add("b", undefined, levels([0.09, 0.09, 0, 0]));
  expect(d.tick()).toBeNull(); // first tick: consecutive == 1
  now += 100;
  expect(d.tick()).toBe("b"); // both eligible, b louder
  expect(events).toEqual(["b"]);

  // both go quiet: hold keeps b for 600 ms
  now += 100;
  expect(d.tick()).toBe("b");
  expect(events).toEqual(["b"]);
  now += 700;
  expect(d.tick()).toBeNull();
  expect(events).toEqual(["b", null]);
});

test("U13 auto-follow debounces 1.5 s", async () => {
  const followed: string[] = [];
  const follow = createAutoFollow((id) => followed.push(id), 1500);
  follow.push("a");
  follow.push("b");
  follow.push("b");
  await new Promise((r) => setTimeout(r, 1600));
  expect(followed).toEqual(["b"]);
  follow.cancel();
});
