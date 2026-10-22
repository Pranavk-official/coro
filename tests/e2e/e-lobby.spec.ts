import { expect, test } from "@playwright/test";
import { freshUser } from "./helpers";
import path from "node:path";

const HOST = path.join(process.cwd(), "tests", ".auth", "host.json");

test.use({ storageState: HOST });

test("E1 @regression instant meeting: pre-join first, room exists only after Join now", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: /Start an instant meeting/ }).click();
  await expect(page).toHaveURL("/new", { timeout: 15000 }); // client navigation is slow under full-suite load
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Meeting length/ }).click();
  await page.getByRole("option", { name: "15 min" }).click();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page).toHaveURL(/\/rooms\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/, { timeout: 15000 });
  const code = new URL(page.url()).pathname.split("/").pop()!;
  const room = await (await page.request.get(`/api/rooms/${code}`)).json();
  const mins = (new Date(room.expiresAt).getTime() - Date.now()) / 60_000;
  expect(mins).toBeGreaterThan(13);
  expect(mins).toBeLessThan(16);
});

test("E1b @regression backing out of instant pre-join creates nothing", async ({ browser }) => {
  const { ctx, page } = await freshUser(browser, "e1b");
  await page.goto("/");
  const before = (await (await page.request.get("/api/rooms")).json()).length;
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: /Start an instant meeting/ }).click();
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Sign in instead" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL("/");
  expect((await (await page.request.get("/api/rooms")).json()).length).toBe(before);
  await ctx.close();
});

test("E22 @regression instant meeting in 2 clicks + Join now, link shown in the call (no modal)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: /Start an instant meeting/ }).click();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByText("You're the only one here")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const code = new URL(page.url()).pathname.split("/").pop()!;
  expect(code).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  await expect(page.getByText(`/rooms/${code}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy meeting link" }).first()).toBeVisible();
});

test("E2 @uat schedule, edit, delete", async ({ page }) => {
  const name = `Sched ${Date.now().toString(36)}`;
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: /Schedule in calendar/ }).click();
  await page.getByLabel("Room name").fill(name);
  await page.getByLabel("Starts").fill("2030-01-01T10:00");
  await page.getByLabel("Password (optional)").fill("pw123");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/rooms\/[a-z]{3}-[a-z]{4}-[a-z]{3}/, { timeout: 15000 });

  await page.goto("/");
  const row = page.getByText(name);
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("scheduled").first()).toBeVisible();

  const newName = `${name} v2`;
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Room name").fill(newName);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(newName)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: `Actions for ${newName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(newName)).toHaveCount(0, { timeout: 15000 });
});

test("E23 @regression paste URL/code variants open the same room", async ({ page }) => {
  const { code } = await (await page.request.post("/api/rooms", { data: { name: "E23", kind: "instant" } })).json();

  const variants = [
    `https://host/rooms/${code}?x=1`,
    code.toUpperCase(),
    code.replaceAll("-", ""),
  ];
  for (const v of variants) {
    await page.goto("/");
    await page.getByLabel("Code or link").fill(v);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(`/rooms/${code}`, { timeout: 15000 });
  }

  await page.goto("/");
  await page.getByLabel("Code or link").fill("abc-defg");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByText("That doesn't look like a meeting code")).toBeVisible();
});

test("E23b @uat link for later has no modal and no time", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: /Create a meeting link for later/ }).click();
  await expect(page.getByRole("dialog", { name: "Your meeting's ready" })).toBeVisible({ timeout: 15000 });
});

/** Tomorrow's day-of-month cell in the visible calendar (a 1st-of-month tomorrow is in the next page: skip that rare case). */
const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  return { day: d.getDate(), sameMonth: d.getMonth() === new Date().getMonth() };
};
const endsHoursFromNow = async (page: import("@playwright/test").Page) => {
  await expect(page).toHaveURL(/\/rooms\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/, { timeout: 15000 });
  const code = new URL(page.url()).pathname.split("/").pop()!;
  const room = await (await page.request.get(`/api/rooms/${code}`)).json();
  return (new Date(room.expiresAt).getTime() - Date.now()) / 3_600_000;
};

test("E57 @regression desktop custom end time: HeroUI date picker (calendar + time), applied on Join now", async ({ page }) => {
  const t = tomorrow();
  test.skip(!t.sameMonth, "tomorrow is next month");
  await page.goto("/new");
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Meeting length/ }).click();
  await page.getByRole("option", { name: "Custom end time" }).click();
  await expect(page.getByRole("spinbutton", { name: "month, Custom end time" })).toBeVisible(); // HeroUI DateField, not a native input
  await page.getByRole("button", { name: "Calendar Custom end time" }).click();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`\\b${t.day}\\b`) }).first().click();
  await expect(page.getByRole("dialog").getByText("Time", { exact: true })).toBeVisible(); // popover stays open for the time
  await page.keyboard.press("Escape");
  await expect(page.getByRole("spinbutton", { name: "day, Custom end time" })).toHaveText(String(t.day).padStart(2, "0"));
  await expect(page.getByRole("spinbutton", { name: "minute, Custom end time" })).toHaveText("00"); // next full hour, not midnight
  await expect(page.getByRole("spinbutton", { name: "hour, Custom end time" })).not.toHaveText("––");
  await page.getByRole("button", { name: "Join now" }).click();
  const hours = await endsHoursFromNow(page);
  expect(hours).toBeGreaterThan(0);
  expect(hours).toBeLessThan(48);
});

test("E58 @regression phone /new: Join with + Meeting length open bottom drawers; custom time picked inline", async ({ browser }) => {
  const t = tomorrow();
  test.skip(!t.sameMonth, "tomorrow is next month");
  const ctx = await browser.newContext({ storageState: HOST, viewport: { width: 375, height: 740 } });
  const page = await ctx.newPage();
  await page.goto("/new");
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 15000 });

  await page.getByRole("button", { name: /^Join with:/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Audio only (turn video on anytime)" }).click();
  await expect(page.getByRole("button", { name: /^Join with: Audio only/ })).toBeVisible();

  await page.getByRole("button", { name: /^Meeting length: 1 hr/ }).click();
  await page.getByRole("dialog", { name: "Meeting length" }).getByRole("button", { name: "Custom end time" }).click();
  const stacked = page.getByRole("dialog", { name: "Custom end time" }); // nested drawer on top of the list
  await stacked.getByRole("grid").getByRole("button", { name: new RegExp(`\\b${t.day}\\b`) }).first().click();
  await stacked.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); // Done closes both
  await expect(page.getByRole("button", { name: /^Meeting length: Until / })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Join now" }).click();
  const hours = await endsHoursFromNow(page);
  expect(hours).toBeGreaterThan(12);
  expect(hours).toBeLessThan(48);
  await ctx.close();
});
