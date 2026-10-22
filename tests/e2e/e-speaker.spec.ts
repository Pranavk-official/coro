import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, NAMES, remoteTiles } from "./helpers";

test("E25 @uat pin a tile from its pin button (and from Participants); unpin clears it", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E25", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  const tile = remoteTiles(host.page).filter({ hasText: NAMES.member });
  await expect(tile).toBeVisible({ timeout: 10_000 });
  await tile.hover();
  await tile.getByRole("button", { name: `Pin ${NAMES.member}` }).click();
  await expect(tile.getByText("pinned")).toBeVisible();
  await expect(remoteTiles(member.page).filter({ hasText: NAMES.host }).getByText("pinned")).toHaveCount(0);
  await tile.getByRole("button", { name: `Unpin ${NAMES.member}` }).click();
  await expect(tile.getByText("pinned")).toHaveCount(0);

  // Same control from the Participants panel.
  await host.page.getByRole("button", { name: /^Participants/ }).click();
  await host.page.getByRole("button", { name: `Pin ${NAMES.member}`, exact: true }).last().click();
  await expect(tile.getByText("pinned")).toBeVisible();
  await host.ctx.close();
  await member.ctx.close();
});
