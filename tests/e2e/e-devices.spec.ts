import { expect, test } from "@playwright/test";
import { asRole, createRoomAs, enterCall } from "./helpers";

test("E24 @uat switch microphone mid-call via the ⌃ menu", async ({ browser }) => {
  const { ctx, page } = await asRole(browser, "member");
  const room = await createRoomAs(ctx.request, { name: "E24", kind: "instant" });
  await enterCall(page, room.code);
  await page.getByRole("button", { name: "Choose microphone" }).click();
  await page.getByRole("menuitem", { name: /Fake Audio Input 1/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("video")]
          .flatMap((v) => (v.srcObject as MediaStream | null)?.getAudioTracks() ?? [])
          .map((t) => t.label)
          .join(","),
      ),
    )
    .toContain("Fake Audio Input 1");
  await expect(page.getByText(/Couldn't switch/)).toHaveCount(0);
  // second fake camera / unplug can't be simulated with Chromium fake devices: manual (M-list)
  await ctx.close();
});
