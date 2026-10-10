import { expect, test } from "@playwright/test";
import { createRoomAs, freshUser } from "./helpers";

test("E16 @uat .ics parses; Google link pre-fills the title", async ({ browser }) => {
  const { ctx, page } = await freshUser(browser, "e16");
  const name = `E16 sync ${Date.now().toString(36)}`;
  const room = await createRoomAs(ctx.request, {
    name,
    kind: "scheduled",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    expiresAt: new Date(Date.now() + 90_000_000).toISOString(),
  });
  const ics = await (await ctx.request.get(`/api/rooms/${room.code}/calendar.ics`)).text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z\r\n/);
  expect(ics).toContain(`UID:${room.code}@`);
  expect(ics).toContain(`/rooms/${room.code}`);

  await page.goto("/");
  // capture the URL handed to window.open (the real popup redirects to a Google sign-in page)
  await page.evaluate(() => {
    window.open = ((u: string) => {
      (window as unknown as { __opened: string }).__opened = u;
      return null;
    }) as typeof window.open;
  });
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Add to Google Calendar" }).click();
  const url = await page.evaluate(() => (window as unknown as { __opened: string }).__opened);
  expect(url).toContain("calendar.google.com");
  expect(decodeURIComponent(url.replace(/\+/g, " "))).toContain(name);
  await ctx.close();
});
