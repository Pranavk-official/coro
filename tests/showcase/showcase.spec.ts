import path from "node:path";
import { devices, expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { createRoomAs, enterCall, expectPlaying, remoteVideo } from "../e2e/helpers";

// README screenshots: `bun run screenshots` → docs/screenshots/<device>-<theme>-<screen>.jpg
const OUT = path.join(process.cwd(), "docs", "screenshots");
// stay on Chromium (fake media): drop the WebKit hint from iPad/iPhone descriptors
const strip = (d: (typeof devices)[string]): BrowserContextOptions => ({ ...d, defaultBrowserType: undefined }) as BrowserContextOptions;
const DEVICES: Record<string, BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  tablet: strip(devices["iPad Pro 11"]),
  mobile: strip(devices["iPhone 15 Pro"]),
};
type State = Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;

/** Fresh verified user (@test.local auto-verifies) so screens show clean data and real-looking names. */
async function demoUser(browser: Browser, name: string): Promise<State> {
  const ctx = await browser.newContext();
  const email = `showcase-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.local`;
  await ctx.request.post("/api/auth/sign-up/email", { data: { email, password: "test1234-password", name } });
  expect((await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: "test1234-password" } })).status()).toBe(200);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function open(browser: Browser, device: string, theme: string, storageState?: State) {
  // reduced motion: the hero word and dust stay still, so shots never catch a mid-animation frame
  const ctx = await browser.newContext({ ...DEVICES[device], storageState, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => {
    localStorage.setItem("theme", t); // next-themes
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}"; // Next dev indicator
      document.head.append(s);
    });
  }, theme);
  return { ctx, page: await ctx.newPage() };
}

const shot = (page: Page, device: string, theme: string, name: string) =>
  page.screenshot({ path: path.join(OUT, `${device}-${theme}-${name}.jpg`), type: "jpeg", quality: 82 });

for (const device of Object.keys(DEVICES)) {
  for (const theme of ["light", "dark"]) {
    test(`showcase ${device} ${theme}`, async ({ browser }) => {
      test.setTimeout(120_000);

      const visitor = await open(browser, device, theme);
      await visitor.page.goto("/");
      await expect(visitor.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
      await shot(visitor.page, device, theme, "1-landing");
      if (device === "desktop")
        await visitor.page.screenshot({ path: path.join(OUT, `${device}-${theme}-0-landing-full.jpg`), type: "jpeg", quality: 80, fullPage: true });
      await visitor.page.goto("/sign-in");
      await expect(visitor.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
      await shot(visitor.page, device, theme, "2-sign-in");
      await visitor.ctx.close();

      const host = await open(browser, device, theme, await demoUser(browser, "Alex Morgan"));
      const req = host.ctx.request;
      const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString();
      await createRoomAs(req, { name: "Client demo", kind: "scheduled", startsAt: nextWeek, password: "demo" });
      await createRoomAs(req, { name: "Office hours", kind: "later" });
      const room = await createRoomAs(req, { name: "Design review", kind: "instant" });
      await host.page.goto("/");
      await expect(host.page.getByRole("heading", { name: "Your rooms" })).toBeVisible({ timeout: 15000 });
      await expect(host.page.getByText("Client demo")).toBeVisible({ timeout: 15000 });
      await shot(host.page, device, theme, "3-lobby");

      // Profile with one saved recording (a reference row; the file itself would be on the device / in Drive).
      await req.post("/api/recordings", {
        data: { roomCode: room.code, roomName: "Design review", name: `${room.code}-demo.webm`, mimeType: "video/webm", bytes: 48_211_456, durationMs: 1_843_000 },
      });
      await host.page.goto("/profile");
      await expect(host.page.getByRole("heading", { name: "Recordings" })).toBeVisible({ timeout: 15000 });
      await expect(host.page.getByText(`${room.code}-demo.webm`)).toBeVisible({ timeout: 15000 });
      await shot(host.page, device, theme, "6-profile");

      await host.page.goto(`/rooms/${room.code}`);
      await expect(host.page.getByText("Ready to join?", { exact: true })).toBeVisible({ timeout: 15000 });
      await host.page.waitForTimeout(1500); // camera preview + level meter settle
      await shot(host.page, device, theme, "4-prejoin");

      await enterCall(host.page, room.code);
      const others = [
        await open(browser, "desktop", theme, await demoUser(browser, "Priya Shah")),
        await open(browser, "desktop", theme, await demoUser(browser, "Sam Lee")),
      ];
      for (const o of others) await enterCall(o.page, room.code);
      await others[1].page.getByRole("button", { name: "Turn camera off" }).click(); // one avatar tile for variety
      await expect(host.page.getByRole("group", { name: /'s tile$/ })).toHaveCount(2, { timeout: 15000 });
      await expect(host.page.getByText(/ joined$/)).toHaveCount(0, { timeout: 15000 }); // join toasts gone
      await expectPlaying(remoteVideo(host.page, "Priya Shah"));
      await shot(host.page, device, theme, "5-call");

      for (const c of [host, ...others]) await c.ctx.close();
    });
  }
}
