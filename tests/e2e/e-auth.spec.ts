import { expect, test } from "@playwright/test";
import { uniqueEmail, waitForMail } from "./mail";

const PASSWORD = "longpassword1";

test("E7 @regression @uat email me a link → check-email, mail arrives", async ({ page }) => {
  const email = uniqueEmail("e7");
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Email", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/check-email\?kind=magic/);
  await expect(page.getByText(/We sent a sign-in link to/)).toBeVisible();
  await waitForMail(email, "sign-in link"); // spec target ≤ 2 s is checked by hand; a loaded test box needs slack
});

test("E8 @regression @uat magic link: scanner GET is harmless, Continue signs in and lands on next", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("e8");
  await page.goto("/sign-in?next=%2F");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const { link } = await waitForMail(email, "sign-in link");
  await request.get(link); // fake scanner

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Almost there" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "New meeting" })).toBeVisible({ timeout: 15000 });

  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("This link has expired or was already used.")).toBeVisible();
});

test("E9 @regression @uat sign up → blocked until verified → verify via mail → signed in", async ({ page }) => {
  const email = uniqueEmail("e9");
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/check-email\?kind=verify/);

  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Verify your email first. We can send the link again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend link" })).toBeVisible();

  const { link } = await waitForMail(email, "Verify your email");
  await page.goto(link);
  await expect(page.getByRole("button", { name: "New meeting" })).toBeVisible({ timeout: 15000 });
});

test("E10 @regression @uat forgot → reset → new password works, other session signed out", async ({ browser }) => {
  const email = uniqueEmail("e10");
  const other = await browser.newContext();
  await other.request.post("/api/auth/sign-up/email", { data: { email, password: PASSWORD, name: "r" } });
  await other.request.get((await waitForMail(email, "Verify your email")).link);
  expect((await (await other.request.get("/api/auth/get-session")).json())?.user?.email).toBe(email);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page).toHaveURL(/\/check-email\?kind=reset/);
  await page.goto((await waitForMail(email, "Reset your")).link);
  await page.getByLabel("New password").fill("newpassword22");
  await page.getByLabel("Confirm password").fill("newpassword22");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Password updated. Other devices were signed out.")).toBeVisible();

  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("newpassword22");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "New meeting" })).toBeVisible({ timeout: 15000 });
  expect(await (await other.request.get("/api/auth/get-session")).json()).toBeNull();
  await other.close();
  await ctx.close();
});

test("E11 @uat reused / bad reset link shows expired + request new", async ({ page }) => {
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(page.getByText("This reset link has expired.")).toBeVisible();
  await page.goto("/reset-password?token=not-a-real-token");
  await page.getByLabel("New password").fill("newpassword22");
  await page.getByLabel("Confirm password").fill("newpassword22");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("This reset link has expired.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
});
