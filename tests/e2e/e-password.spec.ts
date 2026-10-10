import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, remoteTiles } from "./helpers";

test("E10 @regression @uat member: wrong → right password; host skips the prompt", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, {
    name: "E10",
    kind: "scheduled",
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    password: "sesame-123",
  });
  await enterCall(host.page, room.code); // host: straight to pre-join, no password gate

  await member.page.goto(`/rooms/${room.code}`);
  await member.page.getByLabel("Room password").fill("wrong-one");
  await member.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(member.page.getByText("Wrong password.")).toBeVisible();
  await member.page.getByLabel("Room password").fill("sesame-123");
  await member.page.getByRole("button", { name: "Join", exact: true }).click();
  await member.page.getByRole("button", { name: "Join now" }).click();
  await expect(remoteTiles(host.page)).toHaveCount(1, { timeout: 10_000 });
  await host.ctx.close();
  await member.ctx.close();
});
