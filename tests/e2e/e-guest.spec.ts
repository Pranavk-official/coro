import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, joinAsGuest, NAMES, remoteTiles } from "./helpers";

test("E6 E7 @regression @uat guest waits with preview, host sees request, admits; guest badge", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "E6", kind: "instant" });
  await enterCall(host.page, room.code);

  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await joinAsGuest(guest, room.code, "Dana");
  await expect(guest.getByText("Waiting for someone to let you in…")).toBeVisible({ timeout: 15000 });
  await expect(guest.getByLabel("Your preview")).toBeVisible();
  await expect(host.page.getByText("Dana wants to join").first()).toBeVisible({ timeout: 5000 });
  await expect(host.page.getByRole("button", { name: "Participants, 1 waiting" })).toBeVisible();

  await host.page.getByRole("status").getByRole("button", { name: "Admit" }).click();
  await expect(guest.getByRole("button", { name: /^Leave/ }).first()).toBeVisible({ timeout: 3000 });
  const tile = remoteTiles(host.page).filter({ hasText: "Dana" });
  await expect(tile.getByText("guest")).toBeVisible({ timeout: 5000 });
  await expect(remoteTiles(guest).filter({ hasText: NAMES.host })).toBeVisible({ timeout: 5000 });
  await host.ctx.close();
  await guestCtx.close();
});

test("E8 @uat host denies guest → not admitted, no remote video", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "E8", kind: "instant" });
  await enterCall(host.page, room.code);
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await joinAsGuest(guest, room.code, "Eve");
  await expect(host.page.getByText("Eve wants to join").first()).toBeVisible({ timeout: 15000 });
  await host.page.getByRole("status").getByRole("button", { name: "Deny" }).click();
  await expect(guest.getByRole("heading", { name: "You weren't admitted." })).toBeVisible({ timeout: 5000 });
  await expect(guest.locator("video[aria-label$=\"'s video\"]")).toHaveCount(0);
  await host.ctx.close();
  await guestCtx.close();
});

test("E9 @regression @uat member admits in instant room; scheduled room shows member no admit controls", async ({
  browser,
}) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");

  const instant = await createRoomAs(host.ctx.request, { name: "E9 instant", kind: "instant" });
  await enterCall(member.page, instant.code);
  const g1 = await browser.newContext();
  const guest1 = await g1.newPage();
  await joinAsGuest(guest1, instant.code, "Finn");
  await member.page.getByRole("status").getByRole("button", { name: "Admit" }).click();
  await expect(guest1.getByRole("button", { name: /^Leave/ }).first()).toBeVisible({ timeout: 5000 });
  await member.page.goto("/");

  const scheduled = await createRoomAs(host.ctx.request, {
    name: "E9 scheduled",
    kind: "scheduled",
    startsAt: new Date(Date.now() - 60_000).toISOString(),
  });
  await enterCall(member.page, scheduled.code);
  const g2 = await browser.newContext();
  const guest2 = await g2.newPage();
  await joinAsGuest(guest2, scheduled.code, "Gail");
  await expect(guest2.getByText("Waiting for someone to let you in…")).toBeVisible({ timeout: 15000 });
  await expect(member.page.getByText("Gail wants to join")).toHaveCount(0);
  await member.page.getByRole("button", { name: /^Participants/ }).click();
  await expect(member.page.getByRole("button", { name: "Admit" })).toHaveCount(0);
  for (const c of [host.ctx, member.ctx, g1, g2]) await c.close();
});

test("E26 @regression @uat two waiting guests → banner with Admit all admits both", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "E26", kind: "instant" });
  await enterCall(host.page, room.code);
  const ctxs = [await browser.newContext(), await browser.newContext()];
  const guests = await Promise.all(ctxs.map((c) => c.newPage()));
  await joinAsGuest(guests[0]!, room.code, "Hal");
  await joinAsGuest(guests[1]!, room.code, "Ivy");
  await expect(host.page.getByText("2 people want to join")).toBeVisible({ timeout: 15000 });
  await host.page.getByRole("button", { name: "Admit all" }).click();
  for (const g of guests) await expect(g.getByRole("button", { name: /^Leave/ }).first()).toBeVisible({ timeout: 5000 });
  await expect(host.page.getByText("people want to join")).toHaveCount(0);
  await host.ctx.close();
  for (const c of ctxs) await c.close();
});

test("E28 @regression @uat signed-out link → name + guest, no wall; Sign in instead keeps the room", async ({
  browser,
}) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "E28", kind: "instant" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/rooms/${room.code}`);
  await page.getByLabel("Your name").fill("Jo");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Ask to join" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Sign in instead" }).click();
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(`/rooms/${room.code}`)}`);
  await host.ctx.close();
  await ctx.close();
});
