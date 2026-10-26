import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, expectPlaying, leaveButton, liveTrackCount, NAMES, remoteVideo } from "./helpers";

test("E11 @regression @uat expired / ended / locked / unknown → status screen, no live media", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const page = member.page;

  await page.goto("/rooms/zzz-zzzz-zzz");
  await expect(page.getByRole("heading", { name: "Room not found" })).toBeVisible({ timeout: 10_000 });

  const expired = await createRoomAs(host.ctx.request, {
    name: "E11 expired",
    kind: "scheduled",
    startsAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    expiresAt: new Date(Date.now() - 3600_000).toISOString(),
  });
  await page.goto(`/rooms/${expired.code}`);
  await expect(page.getByRole("heading", { name: "This room has expired." })).toBeVisible({ timeout: 10_000 });
  expect(await (await host.ctx.request.get("/api/rooms")).text()).not.toContain(expired.code); // hidden from the lobby

  const ended = await createRoomAs(host.ctx.request, { name: "E11 ended", kind: "later" });
  expect((await host.ctx.request.post(`/api/rooms/${ended.code}/end`)).status()).toBe(204);
  await page.goto(`/rooms/${ended.code}`);
  await expect(page.getByRole("heading", { name: "Meeting ended." })).toBeVisible({ timeout: 10_000 });

  const locked = await createRoomAs(host.ctx.request, { name: "E11 locked", kind: "instant" });
  await enterCall(host.page, locked.code);
  await host.page.getByRole("button", { name: "Lock room" }).click();
  await page.goto(`/rooms/${locked.code}`);
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("heading", { name: "This room is locked by the host." })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => liveTrackCount(page)).toBe(0);
  // room_full needs 10 live peers; covered at the socket level by I12
  await host.ctx.close();
  await member.ctx.close();
});

// Every capture track the page ever opened, so the check still works once the call's <video>s are gone.
const recordTracks = () => {
  const w = window as unknown as { __tracks: MediaStreamTrack[] };
  w.__tracks = [];
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const s = await orig(c);
    w.__tracks.push(...s.getTracks());
    return s;
  };
};
const liveCaptures = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.readyState === "live").length);

test("E66 @regression @uat leaving or ending the meeting turns the camera and mic off", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  await host.page.addInitScript(recordTracks);
  await member.page.addInitScript(recordTracks);
  const room = await createRoomAs(host.ctx.request, { name: "E66", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  expect(await liveCaptures(member.page)).toBeGreaterThan(0);

  // member leaves
  await leaveButton(member.page).click();
  await expect(member.page.getByRole("heading", { name: "You left the meeting" })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => liveCaptures(member.page)).toBe(0);

  // host ends for everyone
  expect(await liveCaptures(host.page)).toBeGreaterThan(0);
  await leaveButton(host.page).click();
  await host.page.getByRole("menuitem", { name: "End for everyone" }).click();
  await host.page.getByRole("button", { name: "End meeting" }).click();
  await expect(host.page.getByRole("heading", { name: "Meeting ended." })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => liveCaptures(host.page), { timeout: 10_000 }).toBe(0);
  await host.ctx.close();
  await member.ctx.close();
});

const liveKind = (page: import("@playwright/test").Page, kind: "audio" | "video") =>
  page.evaluate((k) => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.kind === k && t.readyState === "live").length, kind);

test("E67 @regression @uat camera off / mic off release the device; turning them on works and peers see it", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  await member.page.addInitScript(recordTracks);
  const room = await createRoomAs(host.ctx.request, { name: "E67", kind: "instant" });
  await enterCall(host.page, room.code);

  // pre-join: off releases, on reopens
  const page = member.page;
  await page.goto(`/rooms/${room.code}`);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await expect.poll(() => liveKind(page, "video")).toBe(0);
  await expect.poll(() => liveKind(page, "audio")).toBe(0);
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await expect.poll(() => liveKind(page, "video")).toBe(1);

  // join with mic off, camera on
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(leaveButton(page)).toBeVisible({ timeout: 15_000 });
  await expectPlaying(remoteVideo(host.page, NAMES.member));

  // in call: camera off releases it, the host sees the mascot
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await expect.poll(() => liveKind(page, "video")).toBe(0);
  await expect(host.page.getByRole("button", { name: `Boop the ${NAMES.member}'s avatar` })).toBeVisible({ timeout: 10_000 });
  // camera back on: a fresh capture reaches the host
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await expect.poll(() => liveKind(page, "video")).toBe(1);
  await expectPlaying(remoteVideo(host.page, NAMES.member));

  // mic was off since pre-join (no slot at join): unmute opens it and the host receives live audio
  await page.getByRole("button", { name: "Unmute microphone" }).click();
  await expect.poll(() => liveKind(page, "audio")).toBe(1);
  await expect
    .poll(() => remoteVideo(host.page, NAMES.member).evaluate((el: HTMLVideoElement) =>
      (el.srcObject as MediaStream | null)?.getAudioTracks().some((t) => t.readyState === "live" && !t.muted) ?? false), { timeout: 10_000 })
    .toBe(true);
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await expect.poll(() => liveKind(page, "audio")).toBe(0);
  await host.ctx.close();
  await member.ctx.close();
});
