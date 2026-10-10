import { expect, test } from "@playwright/test";

// I5: Redis unreachable ⇒ fail open everywhere except the fail-closed limits (room password, password sign-in).
const BASE = "http://localhost:3000";
Object.assign(process.env, {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://app:app@localhost:5432/app",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "rate-limit-test-secret-0123456789abcdef",
  BETTER_AUTH_URL: BASE,
  REDIS_URL: "redis://127.0.0.1:6399", // nothing listens here
});
delete process.env.RATE_LIMIT_DISABLED;

test("I5 @regression Redis down: routes answer normally (fail open, logged); verify + password sign-in → 503 try_again", async () => {
  const logs: string[] = [];
  const error = console.error;
  console.error = (...a: unknown[]) => void logs.push(a.join(" "));
  try {
    const { default: app } = await import("@/server/app");
    const req = (path: string, json?: unknown) =>
      app.request(`${BASE}${path}`, {
        method: json ? "POST" : "GET",
        headers: { origin: BASE, "content-type": "application/json" },
        body: json ? JSON.stringify(json) : undefined,
      });
    expect((await req("/api/rooms/abc-defg-hij")).status).toBe(401); // limiter let it through to the auth check
    const verify = await req("/api/rooms/abc-defg-hij/verify", { password: "x" });
    expect(verify.status).toBe(503);
    expect((await verify.json()).error.code).toBe("try_again");
    const signIn = await req("/api/auth/sign-in/email", { email: "someone@test.local", password: "whatever-pass" });
    expect(signIn.status).toBe(503);
    expect((await req("/api/auth/sign-in/anonymous", {})).status).toBe(200); // better-auth limiter fails open too
  } finally {
    console.error = error;
  }
  expect(logs.join("\n")).toContain("rate_limit_unavailable");
});
