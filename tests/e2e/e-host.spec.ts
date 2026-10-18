import { expect, test, type Browser } from "@playwright/test";
import { asRole, createRoomAs, enterCall, NAMES, remoteTiles } from "./helpers";

async function hostAndMember(browser: Browser, name: string) {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name, kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page)).toHaveCount(1, { timeout: 15000 });
  return { host, member, room, close: async () => Promise.all([host.ctx.close(), member.ctx.close()]) };
}

test("E12 @regression @uat host mutes member → member mic off + toast", async ({ browser }) => {
  const { host, member, close } = await hostAndMember(browser, "E12");
  await host.page.getByRole("button", { name: /^Participants/ }).click();
  await host.page.getByRole("button", { name: `Mute ${NAMES.member}` }).click();
  await expect(member.page.getByRole("button", { name: "Unmute microphone" })).toBeVisible({ timeout: 3000 });
  await expect(member.page.getByText("Muted by host")).toBeVisible();
  await close();
});

test("E13 @regression @uat host removes member → removed screen, host alone", async ({ browser }) => {
  const { host, member, close } = await hostAndMember(browser, "E13");
  await host.page.getByRole("button", { name: /^Participants/ }).click();
  await host.page.getByRole("button", { name: `Remove ${NAMES.member}` }).click();
  await expect(member.page.getByRole("heading", { name: "You were removed by the host." })).toBeVisible({ timeout: 3000 });
  await expect(remoteTiles(host.page)).toHaveCount(0, { timeout: 3000 });
  await close();
});

test("E14 @uat lock blocks new member, unlock lets them in", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E14", kind: "instant" });
  await enterCall(host.page, room.code);
  await host.page.getByRole("button", { name: "Lock room" }).click();
  await expect(host.page.getByRole("button", { name: "Unlock room" })).toHaveAttribute("aria-pressed", "true");

  await member.page.goto(`/rooms/${room.code}`);
  await member.page.getByRole("button", { name: "Join now" }).click();
  await expect(member.page.getByRole("heading", { name: "This room is locked by the host." })).toBeVisible({ timeout: 5000 });

  await host.page.getByRole("button", { name: "Unlock room" }).click();
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page)).toHaveCount(1, { timeout: 5000 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E15 E27 @regression @uat host End for everyone ends it for all; instant room deleted", async ({ browser }) => {
  const { host, member, room, close } = await hostAndMember(browser, "E15");
  await host.page.getByRole("button", { name: "Leave options" }).click();
  await host.page.getByRole("menuitem", { name: "End for everyone" }).click();
  await host.page.getByRole("button", { name: "End meeting" }).click();
  await expect(member.page.getByRole("heading", { name: "Meeting ended." })).toBeVisible({ timeout: 5000 });
  await expect(host.page.getByRole("heading", { name: "Meeting ended." })).toBeVisible({ timeout: 5000 });
  await expect(member.page.getByText(/Going home in \d+s/)).toBeVisible();
  await expect(member.page).toHaveURL("/", { timeout: 15_000 }); // timed redirect after the end
  // instant rooms are deleted when ended
  expect((await host.ctx.request.get(`/api/rooms/${room.code}`)).status()).toBe(404);
  await close();
});

test("E27 @regression @uat member Leave → LeftScreen → Rejoin goes back through pre-join", async ({ browser }) => {
  const { host, member, close } = await hostAndMember(browser, "E27");
  await expect(host.page.getByRole("button", { name: "Leave options" })).toBeVisible();
  await member.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(member.page.getByRole("heading", { name: "You left the meeting" })).toBeVisible();
  await expect(remoteTiles(host.page)).toHaveCount(0, { timeout: 3000 });
  await member.page.getByRole("button", { name: "Rejoin" }).click();
  await expect(member.page.getByText("Ready to join?", { exact: true })).toBeVisible();
  await member.page.getByRole("button", { name: "Join now" }).click();
  await expect(remoteTiles(host.page).filter({ hasText: NAMES.member })).toBeVisible({ timeout: 5000 });
  await close();
});
