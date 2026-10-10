import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, leaveButton, NAMES, remoteTiles } from "./helpers";

test("E33 @regression @uat same account in a 2nd tab → Switch here moves the call; old tab told", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const tab1 = await asRole(browser, "member");
  const tab2 = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E33", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(tab1.page, room.code);

  await tab2.page.goto(`/rooms/${room.code}`);
  await tab2.page.getByRole("button", { name: "Join now" }).click();
  await expect(tab2.page.getByRole("heading", { name: "You're already in this call" })).toBeVisible({ timeout: 10_000 });
  await tab2.page.getByRole("button", { name: "Switch here" }).click();
  await expect(leaveButton(tab2.page)).toBeVisible({ timeout: 10_000 });
  await expect(tab1.page.getByRole("heading", { name: "You switched to another tab or device." })).toBeVisible();
  await expect(remoteTiles(host.page).filter({ hasText: NAMES.member })).toHaveCount(1);
  for (const c of [host.ctx, tab1.ctx, tab2.ctx]) await c.close();
});
