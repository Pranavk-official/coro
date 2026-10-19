import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { _android } from "playwright-core";
import { asRole, createRoomAs, enterCall, expectPlaying, NAMES } from "./helpers";

// Spec 008 I1: the real Android app (emulator in docker-android) presents; a headless browser views.
// Opt-in: needs `dev/android-emulator.sh -S` (container, app installed, adb relayed to the host). NATIVE_ANDROID=1 bun run test:e2e
const CONTAINER = process.env.ANDROID_CONTAINER ?? "coro-android";
const adb = (...a: string[]) => execFileSync("docker", ["exec", CONTAINER, "adb", ...a]).toString();
const shot = (name: string) => writeFileSync(test.info().outputPath(name), execFileSync("docker", ["exec", CONTAINER, "adb", "exec-out", "screencap", "-p"]));

/** Tap the first UI node whose text matches (system dialogs live outside the WebView). */
function tapText(re: RegExp): boolean {
  adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  const xml = adb("shell", "cat", "/sdcard/ui.xml");
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    if (re.test(m[1]!)) {
      adb("shell", "input", "tap", String((+m[2]! + +m[4]!) >> 1), String((+m[3]! + +m[5]!) >> 1));
      return true;
    }
  }
  return false;
}

test.skip(!process.env.NATIVE_ANDROID, "needs the Android emulator: NATIVE_ANDROID=1 (see dev/android-emulator.sh)");

test("I1 @uat spec 008: phone app shares its screen natively; a web viewer sees it, Stop ends it", async ({ browser }) => {
  test.setTimeout(180_000);
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "native", kind: "instant" });
  await enterCall(host.page, room.code);

  const [device] = await _android.devices();
  await device!.shell("am start -n app.coro.meet/.MainActivity");
  const page = await (await device!.webView({ pkg: "app.coro.meet" })).page();
  const signin = await page.evaluate(async () => {
    const r = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "e2e-member@test.local", password: "test1234-password" }) });
    return r.status;
  });
  expect(signin).toBe(200);
  await page.goto("http://localhost:3000/rooms/" + room.code);
  await expect(page.getByRole("button", { name: "Join now" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("button", { name: "More options" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: /^Share screen/ }).click();
  await page.waitForTimeout(2500);
  shot("emu-consent.png");
  // Android 14: optional "Entire screen" choice, then Start / Start now.
  tapText(/^Entire screen$/i);
  await page.waitForTimeout(500);
  if (!tapText(/^Start( now)?$/i)) throw new Error("consent button not found");
  await page.waitForTimeout(4000);
  shot("emu-sharing.png");

  await expectPlaying(host.page.getByLabel(NAMES.member + "'s screen"));
  await host.page.screenshot({ path: test.info().outputPath("host-sees-phone.png") });
  await expect(host.page.getByText("2/10")).toBeVisible(); // share session isn't a person
  const size = await host.page.getByLabel(NAMES.member + "'s screen").evaluate((v: HTMLVideoElement) => [v.videoWidth, v.videoHeight]);
  expect(size[1]).toBeGreaterThan(size[0]!); // a portrait phone screen, not a camera
  await expect(page.getByRole("region", { name: "You are presenting" })).toBeVisible();

  // Stop from the app: the viewer's screen tile goes away.
  await page.getByRole("button", { name: "Stop presenting" }).click();
  await expect(host.page.getByLabel(NAMES.member + "'s screen")).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole("button", { name: /^Leave/ }).first().click();
  await host.ctx.close();
  await device!.close();
});
