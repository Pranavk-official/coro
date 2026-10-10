import { expect, test, type Page } from "@playwright/test";
import { AUTH, asRole, createRoomAs } from "./helpers";

// The dev server runs with RATE_LIMIT_DISABLED=1, so these UI checks fake the server's 429 with `page.route`
// (same envelope + headers as server/middlewares/rate-limit.ts). Limits themselves: tests/integration/rate-limit*.
const tooMany = (retryAfter: number) => ({
  status: 429,
  headers: { "content-type": "application/json", "retry-after": String(retryAfter) },
  body: JSON.stringify({ success: false, message: "Too many requests", error: { code: "rate_limited", retryAfter } }),
});

async function count429(page: Page, pattern: string | RegExp, retryAfter: number, method = "POST") {
  const hits: number[] = [];
  await page.route(pattern, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    hits.push(Date.now());
    await route.fulfill(tooMany(retryAfter));
  });
  return hits;
}

test.describe("signed in", () => {
  test.use({ storageState: AUTH.host });

  test("E1 @regression @uat create room → 429: one countdown toast, modal kept, Create disabled, no auto-retry", async ({ page }) => {
    const hits = await count429(page, "**/api/rooms", 20);
    await page.goto("/");
    await page.getByRole("button", { name: "New meeting" }).click();
    await page.getByRole("menuitem", { name: /Schedule in calendar/ }).click();
    await page.getByLabel("Room name").fill("Spam");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText(/Too many requests — try again in \d+ s/)).toHaveCount(1);
    const blocked = page.getByRole("button", { name: /Try again in \d+ s/ });
    await expect(blocked).toBeDisabled();
    await expect(page.getByLabel("Room name")).toHaveValue("Spam");
    await page.waitForTimeout(1500);
    expect(hits).toHaveLength(1); // mutations never retry
  });
});

test("E2 @regression @uat password gate → 429: inline m:ss countdown, Join disabled, input kept", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, {
    name: "E2 limits",
    kind: "scheduled",
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    password: "sesame-123",
  });
  const member = await asRole(browser, "member");
  await count429(member.page, `**/api/rooms/${room.code}/verify`, 272);
  await member.page.goto(`/rooms/${room.code}`);
  await member.page.getByLabel("Room password").fill("guess-6");
  await member.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(member.page.getByText(/Too many attempts\. Try again in 4:3\d\./)).toBeVisible();
  await expect(member.page.getByRole("button", { name: "Join", exact: true })).toBeDisabled();
  await expect(member.page.getByLabel("Room password")).toHaveValue("guess-6");
  await host.ctx.close();
  await member.ctx.close();
});

test("E6 @uat guest sign-in → 429: friendly inline message, no toast", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "E6", kind: "instant" });
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.route("**/api/auth/sign-in/anonymous", (route) =>
    route.fulfill({
      status: 429,
      headers: { "content-type": "application/json", "x-retry-after": "540" },
      body: JSON.stringify({ message: "Too many requests. Please try again later." }),
    }),
  );
  await page.goto(`/rooms/${room.code}`);
  await page.getByLabel("Your name").fill("Spammy");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByText(/Too many guests from your network\. Try again in 5\d\d s\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue as guest" })).toBeDisabled();
  await expect(page.getByText(/Too many requests — try again/)).toHaveCount(0);
  await host.ctx.close();
  await ctx.close();
});

test("E14 @uat 4th magic-link request → form shows countdown, button disabled", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await count429(page, "**/api/auth/sign-in/magic-link", 42);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("someone@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/Too many requests — try again in 4\d s\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeDisabled();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("someone@example.com");
  await ctx.close();
});
