import { expect, test, type Browser } from "@playwright/test";
import { asRole, createRoomAs } from "./helpers";
import { waitForMail } from "./mail";

const PASSWORD = "test1234-password";

async function user(browser: Browser) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const email = `del-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.local`;
  await ctx.request.post("/api/auth/sign-up/email", { data: { email, password: PASSWORD, name: "Del Me" } });
  expect((await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } })).status()).toBe(200);
  return { ctx, page: await ctx.newPage(), email };
}

test("E55 @regression @uat profile → delete account → emailed link → confirm → account + rooms gone", async ({ browser }) => {
  const { ctx, page, email } = await user(browser);
  const room = await createRoomAs(ctx.request, { name: "E55", kind: "later" });

  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Email me the link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nothing is deleted until then" })).toBeVisible();

  const mail = await waitForMail(email, "Confirm deleting");
  expect(mail.link).toContain("/delete-account?token=");
  // A mail scanner fetching the link (no cookies) must not delete anything.
  expect((await fetch(mail.link)).ok).toBe(true);
  expect((await ctx.request.get("/api/auth/get-session")).ok()).toBe(true);
  expect(await (await ctx.request.get("/api/auth/get-session")).json()).not.toBeNull();

  await page.goto(mail.link);
  await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Account deleted" })).toBeVisible();

  expect(await (await ctx.request.get("/api/auth/get-session")).json()).toBeNull();
  expect((await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } })).status()).toBe(401);
  const someone = await asRole(browser, "host");
  expect((await someone.ctx.request.get(`/api/rooms/${room.code}`)).status()).toBe(404); // cascade + cache busted
  await someone.ctx.close();

  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page.getByRole("link", { name: "Profile" })).toHaveCount(0);
  await ctx.close();
});

test("E56 @regression delete link opened signed out → asks to sign in, deletes nothing; reused link refused", async ({ browser }) => {
  const { ctx, page, email } = await user(browser);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Email me the link" }).click();
  const mail = await waitForMail(email, "Confirm deleting");

  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const other = await anon.newPage();
  await other.goto(mail.link);
  await expect(other.getByRole("link", { name: "Sign in" })).toBeVisible({ timeout: 10_000 });
  await anon.close();

  await page.goto("/delete-account?token=not-a-real-token");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "expired or was already used" })).toBeVisible();
  expect(await (await ctx.request.get("/api/auth/get-session")).json()).not.toBeNull(); // still signed in
  await ctx.close();
});
