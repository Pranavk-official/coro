import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, expectPlaying, leaveButton } from "./helpers";

const countGum = () => {
  const w = window as unknown as { __gum: number };
  w.__gum = 0;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    w.__gum++;
    return orig(c);
  };
};

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

test("E21 @regression @uat mic+cam off is remembered, one getUserMedia per join", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  await page.addInitScript(countGum);
  const room = await createRoomAs(ctx.request, { name: "E21", kind: "instant" });
  await page.goto(`/rooms/${room.code}`);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await page.getByRole("button", { name: "Turn camera off" }).click();
  const gum = () => page.evaluate(() => (window as unknown as { __gum: number }).__gum);
  const beforeJoin = await gum(); // dev Strict Mode mounts pre-join twice (2 here, 1 in prod)
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("button", { name: "Unmute microphone" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
  expect(await gum()).toBe(beforeJoin); // joining reuses the pre-join stream: no second prompt

  await page.reload();
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Unmute microphone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
  await ctx.close();
});

test("E37 @regression @uat pre-join shows the meeting name and who's already in the call", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "Design sync", kind: "instant" });
  await member.page.goto(`/rooms/${room.code}`);
  await expect(member.page.getByRole("heading", { name: "Design sync" })).toBeVisible({ timeout: 10_000 });
  await expect(member.page.getByText("No one else is here")).toBeVisible({ timeout: 10_000 });
  await enterCall(host.page, room.code);
  await expect(member.page.getByText("E2E Host is in this call")).toBeVisible({ timeout: 10_000 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E38 @regression preview isn't re-attached while the mic level updates (no flicker)", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  await page.addInitScript(() => {
    const w = window as unknown as { __srcSets: number };
    w.__srcSets = 0;
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "srcObject")!;
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      get: desc.get,
      set(v) {
        w.__srcSets++;
        desc.set!.call(this, v);
      },
    });
  });
  const room = await createRoomAs(ctx.request, { name: "E38", kind: "instant" });
  await page.goto(`/rooms/${room.code}`);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 10_000 });
  const before = await page.evaluate(() => (window as unknown as { __srcSets: number }).__srcSets);
  await page.waitForTimeout(2000); // fake mic tone keeps the level meter moving
  const after = await page.evaluate(() => (window as unknown as { __srcSets: number }).__srcSets);
  expect(after - before).toBe(0);
  await ctx.close();
});
