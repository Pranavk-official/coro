import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, liveTrackCount } from "./helpers";

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
