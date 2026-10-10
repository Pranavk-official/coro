import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall } from "./helpers";

test("E19 @uat toolbar tab order mic → cam → share → participants → leave; aria-pressed toggles", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  const room = await createRoomAs(ctx.request, { name: "E19", kind: "instant" });
  await enterCall(page, room.code);
  await page.getByRole("button", { name: "Mute microphone" }).focus();
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    seen.push((await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ?? "");
    await page.keyboard.press("Tab");
  }
  const at = (re: RegExp) => seen.findIndex((n) => re.test(n));
  const order = [/^Mute microphone/, /^Turn camera off/, /^Share screen/, /^Participants/, /^Leave/].map(at);
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  const mic = page.getByRole("button", { name: "Mute microphone" });
  await mic.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Unmute microphone" })).toHaveAttribute("aria-pressed", "false");
  await ctx.close();
});
