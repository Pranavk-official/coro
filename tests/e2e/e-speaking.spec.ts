import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, expectPlaying, leaveButton, NAMES, remoteTiles, remoteVideo } from "./helpers";

// Chrome's default fake mic only blips once a second (meters and the speaker detector mostly miss it);
// a steady tone reads as continuous speech.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${process.cwd()}/tests/fixtures/tone.wav`,
    ],
  },
});

test("E42 @regression camera off → avatar, audio keeps playing, speaking outline on the tile", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E42", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page)).toHaveCount(1, { timeout: 15_000 });
  // Media flowing before we test anything (the mesh sometimes never delivers it: same flake as E3's expectPlaying).
  await expect.poll(() => remoteVideo(host.page, NAMES.member).evaluate((el: HTMLVideoElement) => el.readyState), { timeout: 15_000 }).toBeGreaterThan(0);

  await host.page.getByRole("button", { name: "Mute microphone" }).click(); // only the member can be "speaking"
  await member.page.getByRole("button", { name: "Turn camera off" }).click();
  const tile = remoteTiles(host.page).filter({ hasText: NAMES.member });
  await expect(tile.getByLabel("Camera off")).toBeVisible({ timeout: 2000 });
  const mascot = tile.getByRole("button", { name: `Boop the ${NAMES.member}'s avatar` }); // no photo → mascot
  await expect(mascot).toBeVisible();
  await mascot.click();
  await expect(tile.getByText("pinned")).toHaveCount(0); // booping doesn't pin the tile
  // The <video> stays mounted and playing: it is what plays the member's audio.
  await expect
    .poll(() =>
      remoteVideo(host.page, NAMES.member).evaluate(
        (el: HTMLVideoElement) =>
          !el.paused && !!(el.srcObject as MediaStream | null)?.getAudioTracks().some((t) => t.readyState === "live"),
      ),
    )
    .toBe(true);
  await expect(tile.locator("[data-speaking]")).toBeVisible({ timeout: 10_000 });
  // The member sees their own speaking outline + avatar on the self-view.
  await expect(member.page.getByRole("button", { name: `Boop the ${NAMES.member}'s avatar` })).toBeVisible();
  const selfView = member.page.locator("div").filter({ has: member.page.getByText("You", { exact: true }) }).last();
  await expect(selfView.locator("[data-speaking]")).toBeVisible({ timeout: 10_000 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E20 @regression @uat pre-join: live preview, level meter moves, Join now focused, Enter joins", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  const room = await createRoomAs(ctx.request, { name: "E20", kind: "instant" });
  await page.goto(`/rooms/${room.code}`);
  await expectPlaying(page.locator("video").first());
  await expect
    .poll(async () => Number((await page.getByLabel(/^Microphone level/).getAttribute("aria-label"))?.match(/\d+/)?.[0]), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Join now" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(leaveButton(page)).toBeVisible({ timeout: 10_000 });
  await ctx.close();
});
