import { expect, test, type Page } from "@playwright/test";
import { AUTH, createRoomAs, enterCall } from "./helpers";

const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
// Inner scrollers too (device pills once scrolled sideways inside a non-scrolling page).
const innerHScroll = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX))
      .map((el) => el.className),
  );
const smallTargets = (page: Page, scope: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} button`)]
        .filter((b) => (b as HTMLElement).offsetParent !== null && !b.getAttribute("aria-label")?.startsWith("Choose "))
        .map((b) => ({ label: b.getAttribute("aria-label") ?? b.textContent, h: b.getBoundingClientRect().height }))
        .filter((b) => b.h < 44),
    scope,
  );

test("V2 V3 @regression 375px: no horizontal scroll, call + pre-join actions ≥ 44px", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.member, viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const room = await createRoomAs(ctx.request, { name: "V3", kind: "instant" });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Video calls." })).toBeVisible({ timeout: 10_000 });
  expect(await noHScroll(page)).toBe(true);

  await page.goto(`/rooms/${room.code}`);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 10_000 });
  expect(await noHScroll(page)).toBe(true);
  expect(await innerHScroll(page)).toEqual([]);
  expect(await smallTargets(page, "main")).toEqual([]);

  await enterCall(page, room.code);
  expect(await noHScroll(page)).toBe(true);
  expect(await smallTargets(page, "main > div.absolute.inset-x-0")).toEqual([]); // the toolbar
  await ctx.close();
});
