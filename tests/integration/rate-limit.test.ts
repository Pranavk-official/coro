import { expect, test } from "@playwright/test";
import { countMail, uniqueEmail, waitForMail } from "../e2e/mail";

// In-process Hono app (`app.request`) + real Redis (DB 15) + dev Postgres + Mailpit (tests.md §2).
// Env is set before the dynamic imports: better-auth reads its rules once at init.
const BASE = "http://localhost:3000";
Object.assign(process.env, {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://app:app@localhost:54329/app",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "rate-limit-test-secret-0123456789abcdef",
  BETTER_AUTH_URL: BASE,
  AUTH_TEST_LOGIN: "1",
  REDIS_URL: "redis://localhost:16379/15",
  TRUST_PROXY: "1", // each test picks its own client IP via X-Forwarded-For
  SMTP_URL: process.env.SMTP_URL ?? "smtp://localhost:11025",
  RATE_LIMIT_AUTH_EMAIL: "1000/10", // better-auth's 3/10 s would mask the per-email password limit (I23)
});
delete process.env.RATE_LIMIT_DISABLED;

test.describe.configure({ mode: "serial" });

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
let ipSeq = 0;
const octet = () => Math.floor(Math.random() * 250) + 1;
const newIp = () => `10.${octet()}.${octet()}.${++ipSeq}`;

type App = (typeof import("@/server/app"))["default"];
let app: App;

async function call(
  path: string,
  o: { method?: string; ip?: string; cookie?: string; json?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = { "x-forwarded-for": o.ip ?? newIp(), origin: BASE };
  if (o.cookie) headers.cookie = o.cookie;
  if (o.json !== undefined) headers["content-type"] = "application/json";
  return app.request(`${BASE}${path}`, {
    method: o.method ?? (o.json !== undefined ? "POST" : "GET"),
    headers,
    body: o.json !== undefined ? JSON.stringify(o.json) : undefined,
  });
}

async function member(tag: string): Promise<string> {
  const email = `${tag}-${RUN}@test.local`; // auto-verified in test mode
  await call("/api/auth/sign-up/email", { json: { email, password: "test1234-password", name: tag } });
  const res = await call("/api/auth/sign-in/email", { json: { email, password: "test1234-password" } });
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function redis() {
  return (await import("@/lib/redis/client")).getRedis();
}

test.beforeAll(async () => {
  app = (await import("@/server/app")).default;
  // getRedis() only waits 1 s for the first handshake (fail fast in prod); under full-suite load that can lose the race.
  await expect.poll(async () => (await import("@/lib/redis/client")).pingRedis(), { timeout: 15_000 }).toBe(true);
});

test("I1 @regression middleware at max=2: 429 envelope, Retry-After + X-RateLimit-*, blocked counter", async () => {
  const { Hono } = await import("hono");
  const { rateLimit } = await import("@/server/middlewares/rate-limit");
  const { errorHandler } = await import("@/server/middlewares/error-handler");
  process.env.RATE_LIMIT_STORAGE_PRESIGN = "2/60";
  const mini = new Hono().use(rateLimit("storage:presign", () => `i1-${RUN}`)).get("/", (c) => c.text("ok"));
  mini.onError(errorHandler);
  const r = await redis();
  const before = Number((await r.get("rl:blocked:storage:presign")) ?? 0);
  expect((await mini.request("/")).status).toBe(200);
  const second = await mini.request("/");
  expect(second.headers.get("x-ratelimit-limit")).toBe("2");
  expect(second.headers.get("x-ratelimit-remaining")).toBe("0");
  const third = await mini.request("/");
  expect(third.status).toBe(429);
  expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(third.headers.get("x-ratelimit-remaining")).toBe("0");
  const body = await third.json();
  expect(body).toEqual({ success: false, message: "Too many requests", error: { code: "rate_limited", retryAfter: expect.any(Number) } });
  await expect.poll(async () => Number(await r.get("rl:blocked:storage:presign"))).toBe(before + 1);
  delete process.env.RATE_LIMIT_STORAGE_PRESIGN;
});

test("I2 @regression GET /api/rooms/:code ×61 from one IP: 61st → 429; another IP unaffected", async () => {
  const ip = newIp();
  for (let i = 0; i < 60; i++) expect((await call("/api/rooms/abc-defg-hij", { ip })).status).toBe(401);
  const blocked = await call("/api/rooms/abc-defg-hij", { ip });
  expect(blocked.status).toBe(429);
  expect((await blocked.json()).error.code).toBe("rate_limited");
  expect((await call("/api/rooms/abc-defg-hij")).status).toBe(401);
});

test("I3 @regression POST /api/rooms past the limit as one user → 429; other user fine", async () => {
  process.env.RATE_LIMIT_ROOMS_CREATE = "3/60";
  const [a, b] = [await member("i3a"), await member("i3b")];
  const create = (cookie: string) => call("/api/rooms", { cookie, json: { name: "I3", kind: "instant" } });
  for (let i = 0; i < 3; i++) expect((await create(a)).status).toBe(201);
  expect((await create(a)).status).toBe(429);
  expect((await create(b)).status).toBe(201);
  delete process.env.RATE_LIMIT_ROOMS_CREATE;
});

test("I4 @regression /verify: 5 wrong then 429 on the 6th and on a correct 7th", async () => {
  const host = await member("i4host");
  const guest = await member("i4guest");
  const room = await (
    await call("/api/rooms", { cookie: host, json: { name: "I4", kind: "scheduled", password: "right-one" } })
  ).json();
  const ip = newIp();
  const verify = (password: string) => call(`/api/rooms/${room.code}/verify`, { ip, cookie: guest, json: { password } });
  for (let i = 0; i < 5; i++) expect((await verify("wrong")).status).toBe(401);
  expect((await verify("wrong")).status).toBe(429);
  const correct = await verify("right-one");
  expect(correct.status).toBe(429);
  // same account from a fresh IP is still blocked (user+code counter)
  expect((await call(`/api/rooms/${room.code}/verify`, { cookie: guest, json: { password: "right-one" } })).status).toBe(429);
});

test("I6 @regression 6th anonymous sign-in from one IP → 429 (better-auth limiter on Redis); other IP fine", async () => {
  const ip = newIp();
  for (let i = 0; i < 5; i++) expect((await call("/api/auth/sign-in/anonymous", { ip, json: {} })).status).toBe(200);
  const blocked = await call("/api/auth/sign-in/anonymous", { ip, json: {} });
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get("x-retry-after"))).toBeGreaterThan(0);
  expect((await call("/api/auth/sign-in/anonymous", { json: {} })).status).toBe(200);
  const { hashIp } = await import("@/lib/redis/keys");
  const ttl = await (await redis()).ttl(`rl:auth:/sign-in/anonymous:${hashIp(ip)}`);
  expect(ttl).toBeGreaterThan(500);
  expect(ttl).toBeLessThanOrEqual(600);
});

test("I7 @regression cache: second GET served from Redis; PATCH visible at once; end busts the internal key", async () => {
  const { prisma } = await import("@/lib/prisma/client");
  const host = await member("i7");
  const room = await (await call("/api/rooms", { cookie: host, json: { name: "Before", kind: "scheduled" } })).json();
  expect((await (await call(`/api/rooms/${room.code}`, { cookie: host })).json()).name).toBe("Before");
  // change the row behind the cache's back: a cached read still shows the old name
  await prisma.room.update({ where: { code: room.code }, data: { name: "Sneaky" } });
  expect((await (await call(`/api/rooms/${room.code}`, { cookie: host })).json()).name).toBe("Before");
  // a write through the API busts it
  expect((await call(`/api/rooms/${room.code}`, { method: "PATCH", cookie: host, json: { name: "After" } })).status).toBe(200);
  expect((await (await call(`/api/rooms/${room.code}`, { cookie: host })).json()).name).toBe("After");

  const r = await redis();
  const internal = await app.request(`${BASE}/api/internal/rooms/${room.code}`, {
    headers: { "x-internal-secret": (process.env.INTERNAL_SECRET ??= "rate-limit-internal") },
  });
  expect(internal.status).toBe(200);
  expect(await r.exists(`cache:room-int:${room.code}`)).toBe(1);
  expect((await call(`/api/rooms/${room.code}/end`, { method: "POST", cookie: host })).status).toBe(204);
  expect(await r.exists(`cache:room-int:${room.code}`)).toBe(0);
  expect(await r.exists(`cache:room:${room.code}`)).toBe(0);
});

test("I16 @regression 4th magic-link request for one email → 429, Mailpit has 3", async () => {
  const email = uniqueEmail("i16");
  const ip = newIp();
  for (let i = 0; i < 3; i++) {
    expect((await call("/api/auth/sign-in/magic-link", { ip, json: { email, callbackURL: "/" } })).status).toBe(200);
  }
  const blocked = await call("/api/auth/sign-in/magic-link", { ip, json: { email: email.toUpperCase(), callbackURL: "/" } });
  expect(blocked.status).toBe(429);
  expect((await blocked.json()).error.code).toBe("rate_limited");
  await waitForMail(email, "sign-in link");
  await expect.poll(() => countMail(email)).toBe(3);
});

test("I17 @regression 11th magic-link request from one IP (different emails) → 429", async () => {
  const ip = newIp();
  for (let i = 0; i < 10; i++) {
    const res = await call("/api/auth/sign-in/magic-link", { ip, json: { email: uniqueEmail(`i17-${i}`), callbackURL: "/" } });
    expect(res.status).toBe(200);
  }
  expect((await call("/api/auth/sign-in/magic-link", { ip, json: { email: uniqueEmail("i17-x"), callbackURL: "/" } })).status).toBe(429);
});

test("I18 mail:daily cap reached → request still 200, no mail, mail_cap_reached logged", async () => {
  const r = await redis();
  const used = Number((await r.get(`rl:mail:daily:${new Date().toISOString().slice(0, 10)}`)) ?? 0);
  process.env.RATE_LIMIT_MAIL_DAILY = `${used + 2}/86400`;
  const logs: string[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => void logs.push(a.join(" "));
  const emails = [uniqueEmail("i18a"), uniqueEmail("i18b"), uniqueEmail("i18c")];
  try {
    for (const email of emails) {
      expect((await call("/api/auth/sign-in/magic-link", { json: { email, callbackURL: "/" } })).status).toBe(200);
      await waitForMail(email, "sign-in link").catch(() => null); // sends are fire-and-forget: let each settle
    }
  } finally {
    console.warn = warn;
    delete process.env.RATE_LIMIT_MAIL_DAILY;
  }
  expect(await countMail(emails[0])).toBe(1);
  expect(await countMail(emails[1])).toBe(1);
  expect(await countMail(emails[2])).toBe(0);
  expect(logs.join("\n")).toContain("mail_cap_reached");
});

test("I19 @regression enumeration parity: magic link / reset / sign-in answer the same for known and unknown", async () => {
  const known = `i19-${RUN}@test.local`;
  await call("/api/auth/sign-up/email", { json: { email: known, password: "test1234-password", name: "k" } });
  const unknown = `i19-nobody-${RUN}@test.local`;
  const probes: [string, (email: string) => unknown][] = [
    ["/api/auth/sign-in/magic-link", (email) => ({ email, callbackURL: "/" })],
    ["/api/auth/request-password-reset", (email) => ({ email, redirectTo: "/reset-password" })],
    ["/api/auth/sign-in/email", (email) => ({ email, password: "not-the-password" })],
  ];
  for (const [path, body] of probes) {
    const a = await call(path, { json: body(known) });
    const b = await call(path, { json: body(unknown) });
    expect([path, a.status]).toEqual([path, b.status]);
    expect(await a.json()).toEqual(await b.json());
  }
});

test("I23 @regression password brute force: 11th wrong sign-in for one ip+email → 429", async () => {
  const email = `i23-${RUN}@test.local`;
  await call("/api/auth/sign-up/email", { json: { email, password: "test1234-password", name: "b" } });
  const ip = newIp();
  for (let i = 0; i < 10; i++) {
    expect((await call("/api/auth/sign-in/email", { ip, json: { email, password: "wrong-password" } })).status).toBe(401);
  }
  const blocked = await call("/api/auth/sign-in/email", { ip, json: { email, password: "test1234-password" } });
  expect(blocked.status).toBe(429);
  // the same address from another network is its own counter
  expect((await call("/api/auth/sign-in/email", { json: { email, password: "test1234-password" } })).status).toBe(200);
});
