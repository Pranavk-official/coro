import path from "node:path";
import { expect, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";

export const AUTH = {
  host: path.join(process.cwd(), "tests", ".auth", "host.json"),
  member: path.join(process.cwd(), "tests", ".auth", "member.json"),
};
export const NAMES = { host: "E2E Host", member: "E2E Member" };

export async function createRoomAs(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<{ code: string; name: string }> {
  const res = await request.post("/api/rooms", { data: body });
  expect(res.status()).toBe(201);
  return (await res.json()) as { code: string; name: string };
}

/** Fresh context + page signed in as host/member (project `use` applies: baseURL, fake media). */
export async function asRole(browser: Browser, role: keyof typeof AUTH) {
  const ctx = await browser.newContext({ storageState: AUTH[role] });
  return { ctx, page: await ctx.newPage() };
}

/** Fresh verified user (@test.local auto-verifies) for tests that mutate account-wide state. */
export async function freshUser(browser: Browser, tag: string) {
  // explicit empty state: a file-level test.use({ storageState }) would otherwise leak in
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const email = `${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.local`;
  await ctx.request.post("/api/auth/sign-up/email", { data: { email, password: "test1234-password", name: tag } });
  const res = await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: "test1234-password" } });
  expect(res.status()).toBe(200);
  return { ctx, page: await ctx.newPage() };
}

export async function guestContext(browser: Browser) {
  const context = await browser.newContext();
  const res = await context.request.post("/api/auth/sign-in/anonymous", { data: {} });
  expect(res.status()).toBe(200);
  return context;
}

/** Signed-out visitor → name → guest → pre-join "Ask to join" → waiting room. */
export async function joinAsGuest(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`/rooms/${code}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Ask to join" }).click();
}

/** Open the room, pass pre-join, wait for the call toolbar. */
export async function enterCall(page: Page, code: string): Promise<void> {
  await page.goto(`/rooms/${code}`);
  await expect(page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(leaveButton(page)).toBeVisible({ timeout: 15000 });
}

export const leaveButton = (page: Page) => page.getByRole("button", { name: /^Leave/ }).first();

export const remoteVideo = (page: Page, name: string) => page.getByLabel(`${name}'s video`);

/** Remote tiles are the pin buttons (one per remote peer). */
export const remoteTiles = (page: Page) => page.getByRole("button", { name: /^Pin / });

export async function expectPlaying(video: Locator): Promise<void> {
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState >= 2 && el.videoWidth > 0), {
      timeout: 15000,
    })
    .toBe(true);
}

/** Count of live local capture tracks (fake devices) the page still holds. */
export async function liveTrackCount(page: Page): Promise<number> {
  return page.evaluate(() =>
    [...document.querySelectorAll("video")]
      .flatMap((v) => ((v.srcObject as MediaStream | null)?.getTracks() ?? []))
      .filter((t) => t.readyState === "live").length,
  );
}
