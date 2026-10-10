import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, expectPlaying, leaveButton, NAMES, remoteTiles } from "./helpers";

async function pick(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("button", { name: /Join with/ }).click();
  await page.getByRole("option", { name: label }).click();
}

test("E34 @regression @uat Join with: audio only / video only preset the toggles", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  const room = await createRoomAs(ctx.request, { name: "E34", kind: "instant" });
  await page.goto(`/rooms/${room.code}`);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 10_000 });
  await pick(page, "Audio only (turn video on anytime)");
  await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute microphone" })).toBeVisible();
  await pick(page, "Video only (turn mic on anytime)");
  await expect(page.getByRole("button", { name: "Unmute microphone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn camera off" })).toBeVisible();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(leaveButton(page)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Unmute microphone" }).click(); // can still turn the mic on
  await expect(page.getByRole("button", { name: "Mute microphone" })).toBeVisible();
  await ctx.close();
});

test("E35 @regression @uat screen share only: joins presenting, others see the screen", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E35", kind: "instant" });
  await enterCall(host.page, room.code);
  await member.page.goto(`/rooms/${room.code}`);
  await expect(member.page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 10_000 });
  await pick(member.page, "Screen share only");
  await member.page.getByRole("button", { name: "Join now" }).click();
  await expect(member.page.getByRole("button", { name: "Stop sharing" })).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  await expect(member.page.getByRole("button", { name: "Unmute microphone" })).toBeVisible();
  await expect(remoteTiles(host.page).filter({ hasText: NAMES.member })).toBeVisible({ timeout: 10_000 });
  await expectPlaying(host.page.getByLabel(`${NAMES.member}'s screen`)); // own tile (spec 007); camera is off
  await host.ctx.close();
  await member.ctx.close();
});
