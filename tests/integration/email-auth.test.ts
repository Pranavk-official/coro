import { expect, test } from "@playwright/test";
import { countMail, uniqueEmail, waitForMail } from "../e2e/mail";

test("I13 @regression magic link: known and unknown email get the same answer and one mail each", async ({ request }) => {
  const known = uniqueEmail("known");
  await request.post("/api/auth/sign-up/email", { data: { email: known, password: "longpassword1", name: "k" } });
  const unknown = uniqueEmail("unknown");
  const bodies: unknown[] = [];
  for (const email of [known, unknown]) {
    const res = await request.post("/api/auth/sign-in/magic-link", { data: { email, callbackURL: "/" } });
    expect(res.status()).toBe(200);
    bodies.push(await res.json());
  }
  expect(bodies[0]).toEqual(bodies[1]);
  await waitForMail(unknown, "sign-in link");
  expect(await countMail(unknown)).toBe(1);
});

test("I14 @regression mailed link opens the interstitial; GET does not spend the token, verify works once", async ({
  request,
}) => {
  const email = uniqueEmail("magic");
  await request.post("/api/auth/sign-in/magic-link", { data: { email, callbackURL: "/rooms/abc-defg-hij" } });
  const { link } = await waitForMail(email, "sign-in link");
  const url = new URL(link);
  expect(url.pathname).toBe("/magic-link");
  expect(url.searchParams.get("next")).toBe("/rooms/abc-defg-hij");

  expect((await request.get(link)).status()).toBe(200); // a mail scanner's GET
  const token = url.searchParams.get("token")!;
  const first = await request.get(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`, { maxRedirects: 0 });
  expect(first.status()).toBe(200);
  const second = await request.get(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`, { maxRedirects: 0 });
  expect(second.status()).not.toBe(200);
});

test("I14b @regression password sign-up needs verification before sign-in", async ({ request }) => {
  const email = uniqueEmail("verify");
  const signUp = await request.post("/api/auth/sign-up/email", {
    data: { email, password: "longpassword1", name: "v" },
  });
  expect((await signUp.json()).token).toBeNull();
  const blocked = await request.post("/api/auth/sign-in/email", { data: { email, password: "longpassword1" } });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe("EMAIL_NOT_VERIFIED");

  const { link } = await waitForMail(email, "Verify your email");
  await request.get(link, { maxRedirects: 0 });
  // verify auto-signs-in (cookie set), so better-auth's CSRF check now wants an Origin
  const ok = await request.post("/api/auth/sign-in/email", {
    data: { email, password: "longpassword1" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(ok.status()).toBe(200);
});

test("I21 @regression sign-up with an existing email answers like a fresh one; the owner gets an accountExists mail", async ({
  request,
}) => {
  const email = uniqueEmail("exists");
  const first = await request.post("/api/auth/sign-up/email", { data: { email, password: "longpassword1", name: "a" } });
  const again = await request.post("/api/auth/sign-up/email", { data: { email, password: "otherpassword2", name: "b" } });
  expect(again.status()).toBe(first.status());
  const [a, b] = [await first.json(), await again.json()];
  expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  expect(b.token).toBeNull();
  await waitForMail(email, "You already have");
  expect(await countMail(email)).toBe(2); // verify (first sign-up) + account exists, no second verification
});

test("I22 @regression reset: mail → token → new password works, old fails, other sessions revoked, token single-use", async ({
  playwright,
}) => {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const email = uniqueEmail("reset");
  await ctx.post("/api/auth/sign-up/email", { data: { email, password: "oldpassword1", name: "r" } });
  await ctx.get((await waitForMail(email, "Verify your email")).link, { maxRedirects: 0 });
  const other = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  expect((await other.post("/api/auth/sign-in/email", { data: { email, password: "oldpassword1" } })).status()).toBe(200);

  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  expect((await anon.post("/api/auth/request-password-reset", { data: { email, redirectTo: "/reset-password" } })).status()).toBe(200);
  const { link } = await waitForMail(email, "Reset your");
  const hop = await anon.get(link, { maxRedirects: 0 });
  const token = new URL(hop.headers()["location"]!, "http://localhost:3000").searchParams.get("token")!;
  expect(token).toBeTruthy();
  const reset = () => anon.post("/api/auth/reset-password", { data: { newPassword: "newpassword2", token } });
  expect((await reset()).status()).toBe(200);
  expect((await reset()).status()).not.toBe(200);

  expect((await anon.post("/api/auth/sign-in/email", { data: { email, password: "oldpassword1" } })).status()).toBe(401);
  expect((await anon.post("/api/auth/sign-in/email", { data: { email, password: "newpassword2" } })).status()).toBe(200);
  expect(await (await other.get("/api/auth/get-session")).json()).toBeNull();
  await Promise.all([ctx.dispose(), other.dispose(), anon.dispose()]);
});
