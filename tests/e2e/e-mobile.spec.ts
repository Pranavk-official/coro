import { expect, test } from "@playwright/test";
import { asRole, AUTH, createRoomAs, enterCall } from "./helpers";

test("E29 @uat 375×667 call: compact toolbar, no horizontal scroll; desktop ? sheet and C copies link", async ({ browser }) => {
  const phone = await browser.newContext({ storageState: AUTH.member, viewport: { width: 375, height: 667 } });
  const page = await phone.newPage();
  const room = await createRoomAs(phone.request, { name: "E29", kind: "instant" });
  await enterCall(page, room.code);
  for (const name of ["Mute microphone", "Turn camera off", "Leave", "More options"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Share screen" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await phone.close();

  const { ctx, page: desk } = await asRole(browser, "member");
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enterCall(desk, room.code);
  await desk.keyboard.press("?");
  await expect(desk.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await desk.keyboard.press("Escape");
  await desk.keyboard.press("c");
  await expect.poll(() => desk.evaluate(() => navigator.clipboard.readText())).toContain(`/rooms/${room.code}`);
  await ctx.close();
});
