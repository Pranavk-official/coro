import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("E62 @regression docs: header → intro, sidebar nav, real deploy files, highlighted code + copy, prev/next, phone menu", async ({ page, context, browser }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Docs" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Introduction" })).toBeVisible({ timeout: 15_000 });

  const sidebar = page.getByRole("navigation", { name: "Docs" });
  await sidebar.getByRole("link", { name: "VPS with Caddy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VPS with Caddy" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "VPS with Caddy" })).toHaveAttribute("aria-current", "page");
  // The Caddyfile on the page is the file in deploy/, byte for byte, and it's highlighted (Shiki spans).
  const block = (title: string) => page.locator(".code-block").filter({ has: page.locator(".code-block__header", { hasText: new RegExp(`^${title}$`) }) });
  const caddy = block("deploy/Caddyfile");
  await expect(caddy.locator(".code-block__code")).toHaveText(readFileSync("deploy/Caddyfile", "utf8").trimEnd());
  await expect(block("deploy/caddy.compose.yml").locator(".shiki span[style*='--shiki-dark']").first()).toBeVisible();

  await sidebar.getByRole("link", { name: "Railway, Render, Fly.io" }).click();
  const fly = block("fly.toml");
  await fly.getByRole("button", { name: "Copy code" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('release_command = "bunx prisma migrate deploy"');

  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: /Environment variables/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Environment variables" })).toBeVisible();

  // Docs header: section tab follows the page; Ctrl+K search jumps to a heading.
  await expect(page.getByRole("navigation", { name: "Docs sections" }).getByRole("link", { name: "Configure" })).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search docs" }).fill("fly");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/deploy\/paas#fly$/);

  // "On this page" follows the scroll.
  const toc = page.getByRole("navigation", { name: "On this page" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(toc.getByRole("link", { name: "What every platform needs" })).toHaveAttribute("aria-current", "location");
  await page.locator("#render").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140));
  await expect(toc.getByRole("link", { name: "Render" })).toHaveAttribute("aria-current", "location");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(toc.getByRole("link", { name: "Fly.io" })).toHaveAttribute("aria-current", "location");

  // Sidebar and "On this page" sit exactly where they stick: no jump when scrolling starts.
  const tops = () =>
    page.evaluate(() => ["Docs", "On this page"].map((n) => Math.round(document.querySelector(`nav[aria-label="${n}"]`)!.getBoundingClientRect().top)));
  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await tops();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(tops).toEqual(before);

  await page.goto("/docs/quick-start");
  for (const img of await page.locator("figure img:visible").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  }

  // Phone: the sidebar becomes a menu button + drawer; nothing scrolls sideways.
  const phone = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 800 } });
  const p = await phone.newPage();
  await p.goto("/docs/turn");
  await p.getByRole("button", { name: /TURN relay/ }).click();
  await p.getByRole("dialog").getByRole("link", { name: "Troubleshooting" }).click();
  await expect(p.getByRole("heading", { level: 1, name: "Troubleshooting" })).toBeVisible();
  for (const href of ["/docs", "/docs/quick-start", "/docs/deploy/paas", "/docs/configuration", "/docs/sign-in"]) {
    await p.goto(href);
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), href).toBe(true);
  }
  await phone.close();
});

test("E63 @regression /api/config reports which sign-in providers are configured (no secrets)", async ({ request }) => {
  const body = await (await request.get("/api/config")).json();
  expect(Object.keys(body)).toEqual(["providers"]);
  expect(typeof body.providers.google).toBe("boolean");
  expect(typeof body.providers.github).toBe("boolean");
  expect(JSON.stringify(body)).not.toMatch(/secret|client_id/i);
});
