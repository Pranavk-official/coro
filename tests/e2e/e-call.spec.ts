import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, expectPlaying, freshUser, NAMES, remoteTiles, remoteVideo } from "./helpers";

test("E3 @regression @uat host + member see each other's video, names, host badge", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E3", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);

  await expectPlaying(remoteVideo(host.page, NAMES.member));
  await expectPlaying(remoteVideo(member.page, NAMES.host));
  await expect(remoteTiles(member.page).filter({ hasText: NAMES.host }).getByLabel("Host").first()).toBeVisible();
  await host.ctx.close();
  await member.ctx.close();
});

test("E4 @regression @uat member mic/cam toggles reach the host ≤ 500 ms", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E4", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  const tile = remoteTiles(host.page).filter({ hasText: NAMES.member });
  await expect(tile).toBeVisible({ timeout: 15000 });

  await member.page.getByRole("button", { name: "Mute microphone" }).click();
  await expect(member.page.getByRole("button", { name: "Unmute microphone" })).toHaveAttribute("aria-pressed", "false");
  await expect(tile.getByLabel("Microphone off")).toBeVisible({ timeout: 500 });
  await member.page.getByRole("button", { name: "Turn camera off" }).click();
  await expect(tile.getByLabel("Camera off")).toBeVisible({ timeout: 500 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E5 @regression @uat member closes tab → host tile gone ≤ 2 s + toast", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E5", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page)).toHaveCount(1, { timeout: 15000 });

  await member.ctx.close();
  await expect(remoteTiles(host.page)).toHaveCount(0, { timeout: 2000 });
  await expect(host.page.getByText("Left the meeting")).toBeVisible();
  await host.ctx.close();
});

test("E18 sign-out from header lands on / with rooms hidden", async ({ browser }) => {
  // own throwaway user: signing out revokes the session, so never use the shared host/member state
  const { ctx, page } = await freshUser(browser, "e18");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your rooms" })).toBeVisible({ timeout: 15000 });
  // cancel keeps you signed in
  await page.getByRole("button", { name: "Sign out" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByRole("heading", { name: "Sign out?" })).toBeVisible();
  await confirm.getByRole("button", { name: "Stay signed in" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your rooms" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await confirm.getByRole("button", { name: "Sign out" }).click();
  await expect(confirm.getByRole("button", { name: /Signing out/ })).toBeVisible();
  await expect(page.getByText("Signed out", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your rooms" })).toHaveCount(0);
  await ctx.close();
});

test("E49 @regression desktop toolbar: every control shows a tooltip; menus still open", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "host");
  const room = await createRoomAs(ctx.request, { name: "E49", kind: "instant" });
  await enterCall(page, room.code);
  const tip = page.getByRole("tooltip");
  for (const [button, text] of [
    ["Mute microphone", "Mute microphone"],
    ["Choose microphone", "Choose microphone"],
    ["Turn camera off", "Turn camera off"],
    ["Choose camera", "Choose camera"],
    ["Share screen", "Share screen"],
    ["Record", "Record"],
    ["Participants", "Participants"],
    ["Leave options", "Leave or end for everyone"],
    ["Lock room", "Lock room"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).hover();
    await expect(tip).toHaveText(text);
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);
  }
  // Wrapping must not swallow the triggers' own menus.
  await page.getByRole("button", { name: "Choose camera" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Leave options" }).click();
  await expect(page.getByRole("menuitem", { name: "End for everyone" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Record this call" })).toBeVisible();
  await ctx.close();
});
