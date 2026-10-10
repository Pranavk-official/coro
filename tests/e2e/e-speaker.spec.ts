import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, NAMES, remoteTiles } from "./helpers";

test("E25 @uat pin a tile; click again unpins", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E25", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  const tile = remoteTiles(host.page).filter({ hasText: NAMES.member });
  await expect(tile).toBeVisible({ timeout: 10_000 });
  await tile.click();
  await expect(tile.getByText("pinned")).toBeVisible();
  await expect(remoteTiles(member.page).filter({ hasText: NAMES.host }).getByText("pinned")).toHaveCount(0);
  await tile.click();
  await expect(tile.getByText("pinned")).toHaveCount(0);
  await host.ctx.close();
  await member.ctx.close();
});
