import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";
import { iceServers } from "../../src/lib/webrtc/ice";

const NOW = 1_700_000_000_000;

test("U6 @regression STUN only without TURN env", async () => {
  const servers = iceServers("u1", {}, NOW);
  expect(servers).toEqual([{ urls: "stun:stun.l.google.com:19302" }]);
});

test("U6 @regression TURN creds with REST format", async () => {
  const servers = iceServers("u1", { turnHost: "turn.example.com", turnSecret: "s3cr3t" }, NOW);
  expect(servers).toHaveLength(2);
  const turn = servers[1];
  expect(turn.urls).toEqual([
    "turn:turn.example.com:3478?transport=udp",
    "turn:turn.example.com:3478?transport=tcp",
  ]);
  const [exp, user] = turn.username!.split(":");
  expect(user).toBe("u1");
  expect(Number(exp) - NOW / 1000).toBeGreaterThan(3500);
  expect(Number(exp) - NOW / 1000).toBeLessThanOrEqual(3600);
  expect(turn.credential).toBe(
    createHmac("sha1", "s3cr3t").update(turn.username!).digest("base64"),
  );
});
