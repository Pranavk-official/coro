import { expect, test } from "@playwright/test";
import { asRole } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } }); // signed out: the landing page is where Google reviewers look

test("E53 @regression privacy + terms: reachable from landing and sign-in, Google Limited Use disclosed", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("Limited Use requirements", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();

  await page.goto("/sign-in");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("E54 signed-in: profile links to privacy + terms", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  await page.goto("/profile");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await ctx.close();
});
