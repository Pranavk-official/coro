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

test("E43 @regression phone More opens a drawer: link, participants, host lock + end", async ({ browser }) => {
  const phone = await browser.newContext({ storageState: AUTH.host, viewport: { width: 375, height: 667 } });
  const page = await phone.newPage();
  const room = await createRoomAs(phone.request, { name: "E43", kind: "instant" });
  await enterCall(page, room.code);
  await page.getByRole("button", { name: "More options" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Joining information")).toBeVisible();
  await expect(sheet.getByText(`/rooms/${room.code}`)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Copy meeting link" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Participants/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Lock room" }).click();
  await expect(sheet.getByRole("button", { name: "Unlock room" })).toBeVisible();
  await sheet.getByRole("button", { name: "End for everyone" }).click();
  await page.getByRole("button", { name: "End meeting" }).click();
  await expect(page.getByRole("heading", { name: "Meeting ended." })).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await phone.close();
});

test("E44 @regression phone devices: ⋯ → Audio & video → stacked list picks a device; same from the call's More", async ({ browser }) => {
  const phone = await browser.newContext({ storageState: AUTH.member, viewport: { width: 375, height: 812 } });
  const page = await phone.newPage();
  const room = await createRoomAs(phone.request, { name: "E44", kind: "instant" });
  await page.goto(`/rooms/${room.code}`);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Microphone", exact: true })).toHaveCount(0); // no inline pills on phones
  await page.getByRole("button", { name: "Audio and video settings" }).click();
  await page.getByRole("button", { name: /^Camera/ }).click();
  const cam = page.getByRole("button", { name: "fake_device_0", exact: true });
  await expect(cam).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await cam.click();
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0); // stacked list closed…
  await expect(page.getByRole("button", { name: /^Microphone/ })).toBeVisible(); // …first sheet still open
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("button", { name: "More options" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: "Audio & video" }).click();
  await expect(page.getByRole("button", { name: /^Microphone/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await phone.close();
});
