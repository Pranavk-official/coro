import { expect, test, type Page } from "@playwright/test";
import { asRole, createRoomAs, enterCall, expectPlaying, NAMES, remoteTiles, remoteVideo } from "./helpers";

// Spec 007: the screen is its own track; camera keeps running; one presenter at a time.
const screenOf = (page: Page, name: string) => page.getByLabel(`${name}'s screen`);
const shareButton = (page: Page) => page.getByRole("button", { name: /^(Share screen|Stop sharing)$/ });

async function share(page: Page) {
  await page.getByRole("button", { name: "Share screen" }).click();
  await expect(page.getByRole("button", { name: "Stop sharing" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "You are presenting" })).toBeVisible();
}

async function pair(browser: import("@playwright/test").Browser, name: string) {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name, kind: "instant" });
  return { host, member, room };
}

test("E36 @regression @uat share mid-call → others see screen + camera; Stop presenting ends it", async ({ browser }) => {
  const { host, member, room } = await pair(browser, "E36");
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page).filter({ hasText: NAMES.member })).toBeVisible({ timeout: 10_000 });
  await expectPlaying(remoteVideo(host.page, NAMES.member)); // connected before sharing

  await share(member.page);
  await expectPlaying(member.page.getByLabel("Your screen preview"));
  // Presenter sees their own share on the stage (FR9), not a thumbnail.
  const stage = await member.page.getByLabel("Your screen preview").boundingBox();
  expect(stage!.width).toBeGreaterThan(member.page.viewportSize()!.width / 2);
  await expectPlaying(screenOf(host.page, NAMES.member));
  await expectPlaying(remoteVideo(host.page, NAMES.member)); // camera still running alongside
  await expect(host.page.getByText(`${NAMES.member} is presenting`)).toBeVisible();

  await member.page.getByRole("button", { name: "Stop presenting" }).click();
  await expect(shareButton(member.page)).toHaveAttribute("aria-pressed", "false");
  await expect(member.page.getByLabel("Your screen preview")).toHaveCount(0);
  await expect(screenOf(host.page, NAMES.member)).toHaveCount(0, { timeout: 5_000 });
  await expectPlaying(remoteVideo(host.page, NAMES.member));
  await host.ctx.close();
  await member.ctx.close();
});

test("E37 @regression @uat late joiner sees a share already in progress", async ({ browser }) => {
  const { host, member, room } = await pair(browser, "E37");
  await enterCall(member.page, room.code);
  await share(member.page);
  await enterCall(host.page, room.code);
  await expectPlaying(screenOf(host.page, NAMES.member));
  await expectPlaying(remoteVideo(host.page, NAMES.member));
  await host.ctx.close();
  await member.ctx.close();
});

test("E38 @regression @uat starting a share while someone presents takes over", async ({ browser }) => {
  const { host, member, room } = await pair(browser, "E38");
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expectPlaying(remoteVideo(host.page, NAMES.member)); // connected before sharing
  await share(member.page);
  await expectPlaying(screenOf(host.page, NAMES.member));

  await share(host.page);
  await expect(shareButton(member.page)).toHaveAttribute("aria-pressed", "false", { timeout: 5_000 });
  await expect(member.page.getByText("Someone else is presenting now")).toBeVisible();
  await expectPlaying(screenOf(member.page, NAMES.host));
  await expect(screenOf(host.page, NAMES.member)).toHaveCount(0, { timeout: 5_000 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E39 @regression browser's own Stop sharing (track ended) stops the presentation for everyone", async ({ browser }) => {
  const { host, member, room } = await pair(browser, "E39");
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expectPlaying(remoteVideo(host.page, NAMES.member)); // connected before sharing
  await share(member.page);
  await expectPlaying(screenOf(host.page, NAMES.member));

  await member.page.evaluate(() => {
    const el = document.querySelector<HTMLVideoElement>('video[aria-label="Your screen preview"]');
    const track = (el?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    track?.stop();
    track?.dispatchEvent(new Event("ended")); // what the browser fires from its sharing bar
  });
  await expect(shareButton(member.page)).toHaveAttribute("aria-pressed", "false");
  await expect(screenOf(host.page, NAMES.member)).toHaveCount(0, { timeout: 5_000 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E40 @regression host stops someone's presentation from Participants", async ({ browser }) => {
  const { host, member, room } = await pair(browser, "E40");
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expectPlaying(remoteVideo(host.page, NAMES.member)); // connected before sharing
  await share(member.page);
  await expectPlaying(screenOf(host.page, NAMES.member));

  await host.page.getByRole("button", { name: /^Participants/ }).click();
  await host.page.getByRole("button", { name: `Stop ${NAMES.member}'s presentation` }).click();
  await expect(shareButton(member.page)).toHaveAttribute("aria-pressed", "false", { timeout: 5_000 });
  await expect(member.page.getByText("The host stopped your presentation")).toBeVisible();
  await host.ctx.close();
  await member.ctx.close();
});
