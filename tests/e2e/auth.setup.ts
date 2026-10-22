import { expect, test as setup, type Browser } from "@playwright/test";
import path from "node:path";

const authDir = path.join(process.cwd(), "tests", ".auth");

async function ensureUser(browser: Browser, email: string, name: string, file: string) {
  const context = await browser.newContext();
  // Sign-up never returns a session (verification required); @test.local is auto-verified under AUTH_TEST_LOGIN.
  await context.request.post("/api/auth/sign-up/email", {
    data: { name, email, password: "test1234-password" },
  });
  const signin = await context.request.post("/api/auth/sign-in/email", {
    data: { email, password: "test1234-password" },
  });
  expect(signin.status()).toBe(200);
  await context.storageState({ path: path.join(authDir, file) });
  await context.close();
}

setup("auth setup: host + member storageState", async ({ browser }) => {
  await ensureUser(browser, "e2e-host@test.local", "E2E Host", "host.json");
  await ensureUser(browser, "e2e-member@test.local", "E2E Member", "member.json");
});

setup("warm dev routes (first compile reloads the page in dev)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const route of ["/", "/sign-in", "/new", "/rooms/abc-defg-hij", "/check-email", "/magic-link", "/forgot-password", "/reset-password", "/verify-email", "/profile", "/privacy", "/terms", "/delete-account"]) {
    await page.goto(route);
    await page.waitForLoadState("load");
    await page.waitForTimeout(300);
  }
  await context.close();
});
