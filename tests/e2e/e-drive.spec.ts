import { expect, test, type Page } from "@playwright/test";
import { asRole, createRoomAs, enterCall } from "./helpers";

const DRIVE = "https://www.googleapis.com/auth/drive.file";
// Dev has no Google OAuth keys: fake a linked Google account with the Drive scope.
const fakeDriveLinked = (page: Page) =>
  page.route("**/api/auth/list-accounts", (r) =>
    r.fulfill({ json: [{ id: "acc-g", providerId: "google", accountId: "g-1", scopes: ["openid", DRIVE] }] }),
  );

test("E50 @regression profile: Drive not connected → Connect; connected → Disconnect; last sign-in explained", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  await page.goto("/");
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: "Google Drive" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Connect" })).toBeVisible({ timeout: 15_000 });

  await fakeDriveLinked(page);
  await page.route("**/api/auth/unlink-account", (r) =>
    r.fulfill({ status: 400, json: { code: "FAILED_TO_UNLINK_LAST_ACCOUNT", message: "x" } }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "only way to sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Google settings" })).toBeVisible();
  await ctx.close();
});

test("E51 @regression record sheet: Drive switch when connected, Connect when not", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  const room = await createRoomAs(ctx.request, { name: "E51", kind: "instant" });
  await enterCall(page, room.code);
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByText("Also save to Google Drive")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  await page.keyboard.press("Escape");

  await fakeDriveLinked(page);
  await page.reload();
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Join now" }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Also save to Google Drive" })).toBeVisible();
  await ctx.close();
});

test("E52 profile is for signed-in accounts only", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile|\/sign-in\?next=\/profile/, { timeout: 10_000 });
});
