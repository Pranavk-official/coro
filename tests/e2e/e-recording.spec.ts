import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall, joinAsGuest, NAMES, remoteTiles } from "./helpers";

// Spec 003 (device sink): silent composite of the call (no capture prompt), REC badge for everyone, .webm download on stop.
test("E1+E5 @regression @uat record → peers see REC → stop downloads the file", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  const room = await createRoomAs(host.ctx.request, { name: "E-rec", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page).filter({ hasText: NAMES.member })).toBeVisible({ timeout: 10_000 });

  await member.page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(member.page.getByText("Record this call")).toBeVisible();
  const compress = member.page.getByRole("switch", { name: /Compress/ });
  await member.page.getByText("Compress (720p, smaller file)").click();
  await expect(compress).toBeChecked();
  const mp4 = member.page.getByRole("switch", { name: /MP4/ });
  const ext = (await mp4.count()) > 0 ? "mp4" : "webm"; // bundled Chromium may lack H.264 recording
  if (ext === "mp4") await member.page.getByText("Save as MP4", { exact: true }).click();
  await member.page.getByRole("button", { name: "Start recording" }).click();
  await expect(member.page.getByRole("button", { name: /^Stop recording/ })).toBeVisible();
  await expect(host.page.getByLabel(`${NAMES.member} is recording`)).toBeVisible({ timeout: 5_000 });
  await expect(host.page.getByText(`${NAMES.member} started recording`)).toBeVisible();

  await member.page.waitForTimeout(3_000);
  const download = member.page.waitForEvent("download");
  await member.page.getByRole("button", { name: /^Stop recording/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(new RegExp(`^${room.code}-.*\\.${ext}$`));
  const path = await file.path();
  const { size } = await import("node:fs/promises").then((fs) => fs.stat(path));
  expect(size).toBeGreaterThan(10_000);
  await expect(host.page.getByLabel(`${NAMES.member} is recording`)).toHaveCount(0, { timeout: 5_000 });
  await host.ctx.close();
  await member.ctx.close();
});

test("E6 @regression guest sees no Record button", async ({ browser }) => {
  const host = await asRole(browser, "host");
  const room = await createRoomAs(host.ctx.request, { name: "E-rec-guest", kind: "instant", allowGuests: true });
  await enterCall(host.page, room.code);
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await joinAsGuest(guest, room.code, "Dana");
  await expect(host.page.getByText("Dana wants to join").first()).toBeVisible({ timeout: 15_000 });
  await host.page.getByRole("status").getByRole("button", { name: "Admit" }).click();
  await expect(guest.getByRole("button", { name: /^Leave/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByRole("button", { name: "Record", exact: true })).toHaveCount(0);
  await host.ctx.close();
  await guestCtx.close();
});

test("E1b @regression narrow: More → Record stacks the sheet over More; Start records, More closes", async ({ browser }) => {
  const member = await asRole(browser, "member");
  await member.page.setViewportSize({ width: 375, height: 740 });
  const room = await createRoomAs(member.ctx.request, { name: "E-rec-narrow", kind: "instant" });
  await enterCall(member.page, room.code);
  await member.page.getByRole("button", { name: "More options" }).click();
  await member.page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(member.page.getByText("Record this call")).toBeVisible();
  await expect(member.page.getByText("Joining information")).toBeVisible(); // stacked, not replacing More
  await member.page.getByRole("button", { name: "Start recording" }).click();
  await expect(member.page.getByRole("button", { name: /^Stop recording/ })).toBeVisible();
  await expect(member.page.getByText("Joining information")).toHaveCount(0);
  await member.ctx.close();
});

// REC_SECONDS=300 for the long UAT run; the regression default keeps it short.
const REC_SECONDS = Number(process.env.REC_SECONDS ?? 5);

test("E7 @regression @uat host ends the meeting mid-recording → recording stops and saves locally", async ({ browser }) => {
  test.setTimeout((REC_SECONDS + 90) * 1000);
  const host = await asRole(browser, "host");
  const member = await asRole(browser, "member");
  member.page.on("console", (m) => /EXIT|fin |CANCELLED|gDM/.test(m.text()) && console.log(m.text()));
  await member.page.addInitScript(() => {
    new MutationObserver((ms) => { for (const mu of ms) { const el = mu.target as HTMLElement; if (el.getAttribute("data-exiting") === "true") { const a = el.getAnimations(); console.log("EXIT", el.className.slice(0,40), a.map((x) => (x as CSSTransition).transitionProperty ?? (x as CSSAnimation).animationName).join()); a.forEach((x) => x.finished.then(() => console.log("fin ", (x as CSSTransition).transitionProperty ?? (x as CSSAnimation).animationName), () => console.log("CANCELLED", (x as CSSTransition).transitionProperty ?? (x as CSSAnimation).animationName))); } } }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-exiting"] });
    const o = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = (x) => o(x).then((s) => (console.log("gDM ok"), s), (e) => (console.log("gDM err", e.name), Promise.reject(e)));
  });
  const room = await createRoomAs(host.ctx.request, { name: "E-rec-end", kind: "instant" });
  await enterCall(host.page, room.code);
  await enterCall(member.page, room.code);
  await expect(remoteTiles(host.page).filter({ hasText: NAMES.member })).toBeVisible({ timeout: 10_000 });

  await member.page.getByRole("button", { name: "Record", exact: true }).click();
  await member.page.getByRole("button", { name: "Start recording" }).click();
  await expect(member.page.getByText("Record this call")).toHaveCount(0); // popover closed
  await expect(host.page.getByLabel(`${NAMES.member} is recording`)).toBeVisible({ timeout: 5_000 });
  await member.page.waitForTimeout(REC_SECONDS * 1000);

  const download = member.page.waitForEvent("download", { timeout: 30_000 });
  await host.page.getByRole("button", { name: "Leave options" }).click();
  await host.page.getByRole("menuitem", { name: "End for everyone" }).click();
  await host.page.getByRole("button", { name: "End meeting" }).click();
  await expect(member.page.getByRole("heading", { name: "Meeting ended." })).toBeVisible({ timeout: 10_000 }); // slow under parallel WebRTC load
  const file = await download;
  const path = await file.path();

  // Decode it: real duration (MediaRecorder webm has no duration header) + both tracks present.
  const { execFileSync } = await import("node:child_process");
  const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path]).toString();
  expect(streams).toContain("video");
  expect(streams).toContain("audio");
  const out = execFileSync("sh", ["-c", `ffmpeg -i '${path}' -c copy -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1`]).toString();
  const [h, m, s] = out.replace("time=", "").trim().split(":").map(Number);
  const seconds = h! * 3600 + m! * 60 + s!;
  console.log(`recorded ${file.suggestedFilename()}: ${seconds.toFixed(1)} s, streams ${streams.trim().replace(/\n/g, ",")}`);
  expect(seconds).toBeGreaterThan(REC_SECONDS - 2);
  // Frame isn't black: the composite really drew the fake cameras.
  const yavg = Number(execFileSync("sh", ["-c", `ffmpeg -ss 1 -i '${path}' -frames:v 1 -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null - 2>&1 | grep -o 'YAVG=[0-9.]*' | head -1`]).toString().replace("YAVG=", ""));
  console.log(`frame luma ${yavg}`);
  expect(yavg).toBeGreaterThan(20);
  await host.ctx.close();
  await member.ctx.close();
});
