import { expect, test, type Page } from "@playwright/test";
import { uniqueEmail, waitForMail } from "./mail";

// spec 002 E12 / E13: no account enumeration in the UI, no open redirect through `next`.

async function screenAfter(page: Page, path: string, button: string, email: string): Promise<string> {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: button }).click();
  await expect(page).toHaveURL(/\/check-email/);
  const url = new URL(page.url());
  url.searchParams.delete("email");
  const text = (await page.getByRole("main").innerText()).replace(/\S+\*\*\*@\S+/, "<masked>");
  return `${url.pathname}?${url.searchParams} | ${text}`;
}

test("E12 @regression @uat unknown email on forgot / magic-link forms: same screen and copy as a known one", async ({ page, request }) => {
  const known = uniqueEmail("e12k");
  await request.post("/api/auth/sign-up/email", { data: { email: known, password: "longpassword1", name: "k" } });
  for (const [path, button] of [
    ["/forgot-password", "Send reset link"],
    ["/sign-in", "Email me a sign-in link"],
  ] as const) {
    const a = await screenAfter(page, path, button, known);
    const b = await screenAfter(page, path, button, uniqueEmail("e12u"));
    expect(b).toBe(a);
  }
});

test("E13 @regression @uat ?next=//evil.com through the magic-link flow lands on /", async ({ page }) => {
  const email = uniqueEmail("e13");
  await page.goto(`/sign-in?next=${encodeURIComponent("//evil.com")}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const { link } = await waitForMail(email, "sign-in link");
  expect(new URL(link).searchParams.get("next")).toBe("/");
  await page.goto(link.replace("next=%2F", `next=${encodeURIComponent("https://evil.com")}`)); // tampered link too
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15000 });
});
