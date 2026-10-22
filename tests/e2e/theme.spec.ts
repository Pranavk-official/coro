import { expect, test, type Page } from "@playwright/test";

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// Single-selection ToggleButtonGroup = radiogroup of radios (react-aria).
const option = (page: Page, name: "Light" | "Dark" | "System") => page.getByRole("radio", { name, exact: true });

// OS scheme must not leak into the chosen theme, so run against both
for (const colorScheme of ["light", "dark"] as const) {
  test(`T1 @regression theme switcher flips colours, persists (OS ${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    const html = page.locator("html");

    // defaultTheme="dark" in Providers
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(option(page, "Dark")).toBeChecked();
    const darkBg = await bg(page);

    await option(page, "Light").click();
    await expect(html).not.toHaveClass(/\bdark\b/);
    const lightBg = await bg(page);
    expect(lightBg).not.toBe(darkBg);

    await page.reload();
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(option(page, "Light")).toBeChecked();
    expect(await bg(page)).toBe(lightBg);

    await option(page, "System").click();
    await expect(html).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
  });
}

/** The collapsed dock clips its other options (overflow: hidden), which Playwright still calls "visible": compare boxes. */
const shownInDock = async (page: Page, name: "Light" | "Dark" | "System") => {
  const dock = (await page.locator(".theme-dock").boundingBox())!;
  const o = (await option(page, name).boundingBox())!;
  return o.x >= dock.x - 1 && o.x + o.width <= dock.x + dock.width + 1;
};

test("T2 @regression theme badge on other pages: current icon only, expands on hover", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(option(page, "Dark")).toBeVisible();
  await expect.poll(() => shownInDock(page, "Dark")).toBe(true);
  await expect.poll(() => shownInDock(page, "Light")).toBe(false);

  await option(page, "Dark").hover();
  await expect.poll(() => shownInDock(page, "Light")).toBe(true);
  await option(page, "Light").click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});
