import { expect, test } from "@playwright/test";
import { asRole, AUTH, createRoomAs, enterCall } from "./helpers";

test.describe("errors", () => {
  test.use({ storageState: AUTH.host });

  test("E30 @regression @uat bad room name → inline field error, modal stays, no toast", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New meeting" }).click();
    await page.getByRole("menuitem", { name: /Schedule in calendar/ }).click();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText("Give the room a name.")).toBeVisible();

    await page.getByLabel("Room name").fill("x".repeat(121)); // passes the client check, fails zod max(120)
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator('[data-slot="field-error"], [slot="errorMessage"]').first()).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("E32 @regression @uat server 500 → generic toast only, app still usable", async ({ page }) => {
    await page.route("**/api/rooms", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ success: false, message: "boom: SELECT * FROM room", error: { code: "internal_error" } }),
          })
        : route.continue(),
    );
    await page.goto("/");
    await expect(page.getByText("Something went wrong. Try again.").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("SELECT")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New meeting" })).toBeEnabled();
  });
});

test("E31 @regression @uat wrong password / locked / expired → friendly copy, one action, no raw JSON", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const page = member.page;
  const noRaw = async () => expect(await page.locator("body").innerText()).not.toMatch(/[{}]|"code"|success|\b(4|5)\d\d\b/);

  const pw = await createRoomAs(host.ctx.request, {
    name: "E31 pw",
    kind: "scheduled",
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    password: "right-pass",
  });
  await page.goto(`/rooms/${pw.code}`);
  await page.getByLabel("Room password").fill("nope");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByText("Wrong password.")).toBeVisible();
  await noRaw();

  const locked = await createRoomAs(host.ctx.request, { name: "E31 locked", kind: "instant" });
  await enterCall(host.page, locked.code);
  await host.page.getByRole("button", { name: "Lock room" }).click();
  await page.goto(`/rooms/${locked.code}`);
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("heading", { name: "This room is locked by the host." })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(1);
  await noRaw();

  const expired = await createRoomAs(host.ctx.request, {
    name: "E31 expired",
    kind: "scheduled",
    startsAt: new Date(Date.now() - 7200_000).toISOString(),
    expiresAt: new Date(Date.now() - 3600_000).toISOString(),
  });
  await page.goto(`/rooms/${expired.code}`);
  await expect(page.getByRole("heading", { name: "This room has expired." })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Back to home" })).toHaveCount(1);
  await noRaw();
  await host.ctx.close();
  await member.ctx.close();
});
