import { expect, test, type Page } from "@playwright/test";

// Signed-out landing → sign-in modal (header "Sign in" + hero "Start a free meeting").
// Keep scrollbars: headless hides them, and the stuck-close bug (cancelled `scrollbar-color` transition on the
// closing container, see globals.css "Overlay close fix") only happens when they're drawn.
test.use({ storageState: { cookies: [], origins: [] }, launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const PASSWORD = "test1234-password";
const dialog = (page: Page) => page.getByRole("dialog");
const headerSignIn = (page: Page) => page.getByRole("button", { name: "Sign in", exact: true });

async function openFromHeader(page: Page) {
  await headerSignIn(page).click();
  await expect(dialog(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(headerSignIn(page)).toBeVisible({ timeout: 15000 });
});

test("M1 @regression closes by Escape, X and backdrop; page stays clickable", async ({ page }) => {
  await openFromHeader(page);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  await openFromHeader(page);
  await dialog(page).getByRole("button", { name: /close/i }).click();
  await expect(dialog(page)).toHaveCount(0);

  await openFromHeader(page);
  await page.mouse.click(8, 400);
  await expect(dialog(page)).toHaveCount(0);

  // a stuck exiting backdrop would swallow this click (memory: ModalBackdrop must wrap the container)
  await page.getByLabel("Code or link").fill("abc-defg-hij");
});

test("M2 @regression hero CTA opens the same modal", async ({ page }) => {
  await page.getByRole("button", { name: "Start a free meeting" }).first().click();
  await expect(dialog(page).getByRole("heading", { name: "Sign in" })).toBeVisible();
  await dialog(page).getByRole("button", { name: /close/i }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("M3 @regression leaving via a link and pressing Back does not reopen it", async ({ page }) => {
  await openFromHeader(page);
  await dialog(page).getByRole("button", { name: "Use a password instead" }).click();
  await dialog(page).getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(dialog(page)).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(headerSignIn(page)).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
});

test("M4 @regression wrong password keeps it open with an error; right one signs in and closes", async ({ page }) => {
  const email = `m4-${Date.now().toString(36)}@test.local`;
  await page.request.post("/api/auth/sign-up/email", { data: { email, password: PASSWORD, name: "m4" } });
  await page.context().clearCookies(); // sign-up may sign in; we want the modal path

  await page.reload();
  await openFromHeader(page);
  await dialog(page).getByRole("button", { name: "Use a password instead" }).click();
  await dialog(page).getByLabel("Email", { exact: true }).fill(email);
  await dialog(page).getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await dialog(page).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toBeVisible();
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog(page).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your rooms" })).toBeVisible({ timeout: 15000 });
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "New meeting" }).click(); // nothing left on top
});

test("M5 @regression magic link and sign-up go to check-email with the modal gone", async ({ page }) => {
  await openFromHeader(page);
  await dialog(page).getByLabel("Email", { exact: true }).fill(`m5-${Date.now().toString(36)}@test.local`);
  await dialog(page).getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page).toHaveURL(/\/check-email\?kind=magic/);
  await expect(dialog(page)).toHaveCount(0);

  await page.goto("/");
  await openFromHeader(page);
  await dialog(page).getByRole("button", { name: "New here? Create an account" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Create an account" })).toBeVisible();
  await dialog(page).getByLabel("Email", { exact: true }).fill(`m5b-${Date.now().toString(36)}@test.local`);
  await dialog(page).getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog(page).getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/check-email\?kind=verify/);
  await expect(dialog(page)).toHaveCount(0);
});

test("M6 @regression liquid glass + kinematic motion classes are applied", async ({ page }) => {
  await openFromHeader(page);
  const style = await page.evaluate(() => {
    const d = getComputedStyle(document.querySelector(".modal__dialog")!);
    return { blur: d.backdropFilter, radius: d.borderTopLeftRadius };
  });
  expect(style.blur).toMatch(/blur\((2[4-9]|[3-9]\d)px\)/); // backdrop-blur-2xl (40px), not the 16px default
  expect(style.radius).toBe("28px");
  expect(await page.locator(".modal__container").getAttribute("class")).toContain("data-[entering]:animate-in");
});

test("M7 @regression phone: fits 375px, no sideways scroll", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await headerSignIn(page).click();
  const box = await dialog(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await ctx.close();
});

test("M8 @regression overlay containers never transition `all` (stuck-close guard)", async ({ page }) => {
  // react-aria waits on every running animation of a closing overlay; a cancelled one (HeroUI's `transition: all`
  // started scrollbar-color in headed browsers) left the modal on screen, already closed. Headless can't show it.
  await openFromHeader(page);
  const props = await page.evaluate(() =>
    [".modal__container", ".modal__backdrop"].map((s) => getComputedStyle(document.querySelector(s)!).transitionProperty),
  );
  for (const p of props) expect(p).not.toMatch(/\ball\b/);
});

test("M9 @regression layout: nothing shifts on open/close, dialog is centered", async ({ page }) => {
  const h1 = () => page.locator("main h1").first().boundingBox();
  const before = await h1();
  await openFromHeader(page);
  expect(await h1()).toEqual(before);

  // centered in the viewport
  const vp = page.viewportSize()!;
  await page.waitForTimeout(500); // let the spring settle
  const settled = (await dialog(page).boundingBox())!;
  // ±8px horizontally: headless-with-scrollbars accounts the scroll-lock gutter differently (half a 15px bar);
  // headed Brave measured dead center.
  expect(Math.abs(settled.x + settled.width / 2 - vp.width / 2)).toBeLessThanOrEqual(8);
  expect(Math.abs(settled.y + settled.height / 2 - vp.height / 2)).toBeLessThanOrEqual(4);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(await h1()).toEqual(before);
});
