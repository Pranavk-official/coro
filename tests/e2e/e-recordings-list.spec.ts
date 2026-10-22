import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, guestContext } from "./helpers";

const DRIVE = "https://www.googleapis.com/auth/drive.file";

test("E60 @regression @uat stop recording → profile lists it (device + Drive link); remove keeps nothing else", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  // Drive faked end to end: linked account, token, resumable session, upload.
  await page.route("**/api/auth/list-accounts", (r) =>
    r.fulfill({ json: [{ id: "acc-g", providerId: "google", accountId: "g-1", scopes: [DRIVE] }] }),
  );
  await page.route("**/api/auth/get-access-token", (r) => r.fulfill({ json: { accessToken: "fake" } }));
  await page.route("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", (r) =>
    r.fulfill({ status: 200, headers: { Location: "https://www.googleapis.com/upload/session/e60", "Access-Control-Expose-Headers": "Location" }, body: "" }),
  );
  await page.route("https://www.googleapis.com/upload/session/e60", (r) => r.fulfill({ json: { id: "drive-file-e60" } }));

  const room = await createRoomAs(ctx.request, { name: "E60 standup", kind: "instant" });
  await enterCall(page, room.code);
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Also save to Google Drive" })).toBeVisible({ timeout: 15_000 });
  if (!(await page.getByRole("switch", { name: "Also save to Google Drive" }).isChecked())) await page.getByText("Also save to Google Drive").click();
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.waitForTimeout(2000);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Stop recording/ }).click();
  await download;
  await expect(page.getByText("Saved to Google Drive")).toBeVisible({ timeout: 15_000 });

  await page.goto("/profile");
  const row = page.getByRole("listitem").filter({ hasText: "E60 standup" }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("This device")).toBeVisible();
  await expect(row.getByRole("link", { name: /Open in Drive/ })).toHaveAttribute("href", "https://drive.google.com/file/d/drive-file-e60/view");

  // Another account can't see or touch it; guests have no list at all.
  const list = (await (await ctx.request.get("/api/recordings")).json()) as { id: string; roomName: string }[];
  const mine = list.find((r) => r.roomName === "E60 standup")!;
  const other = await asRole(browser, "host");
  expect((await other.ctx.request.delete(`/api/recordings/${mine.id}`)).status()).toBe(404);
  expect(((await (await other.ctx.request.get("/api/recordings")).json()) as { id: string }[]).some((r) => r.id === mine.id)).toBe(false);
  await other.ctx.close();
  const guest = await guestContext(browser);
  expect((await guest.request.get("/api/recordings")).status()).toBe(403);
  await guest.close();

  await row.getByRole("button", { name: /Remove .* from the list/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "E60 standup" })).toHaveCount(0);
  await ctx.close();
});
