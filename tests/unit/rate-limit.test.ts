import { expect, test } from "@playwright/test";
import { Hono } from "hono";
import { blockedKey, cacheKey, hashIp, rl } from "@/lib/redis/keys";
import { envName, getLimit, LIMITS } from "@/lib/rate-limit/config";
import { limit } from "@/lib/rate-limit/limit";
import { clientIp, REMOTE_ADDR_HEADER } from "@/lib/rate-limit/ip";
import { socketLimit } from "@/lib/rate-limit/socket";
import { bootCheck } from "@/lib/rate-limit/boot";
import { bust, cached } from "@/lib/redis/cache";
import { getRedis } from "@/lib/redis/client";
import { ApiError, apiJson } from "@/lib/hono/client";
import { retryDelay, shouldRetry } from "@/hooks/query-config";
import { sendMail } from "@/lib/nodemailer/client";
import { emailLimit } from "@/server/middlewares/auth-email-limit";
import { errorHandler } from "@/server/middlewares/error-handler";

// Real Redis from the dev compose, DB 15 so tests never touch dev counters (tests.md header).
process.env.REDIS_URL = "redis://localhost:6379/15";
delete process.env.RATE_LIMIT_DISABLED;
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** In-memory stand-in for the Lua script: INCR + TTL fixed at first hit. */
function fakeRedis() {
  const counts = new Map<string, number>();
  const client = {
    eval: async (_lua: string, o: { keys: string[]; arguments: string[] }) => {
      const n = (counts.get(o.keys[0]) ?? 0) + 1;
      counts.set(o.keys[0], n);
      return [n, Number(o.arguments[0])];
    },
  };
  return async () => client as never;
}

test("U1 @regression keys: rl/cache shape, hashIp 16 hex, stable, not the input", () => {
  expect(rl("a", "x")).toBe("rl:a:x");
  expect(cacheKey("room", "abc")).toBe("cache:room:abc");
  expect(blockedKey("ice")).toBe("rl:blocked:ice");
  const h = hashIp("203.0.113.9");
  expect(h).toMatch(/^[0-9a-f]{16}$/);
  expect(hashIp("203.0.113.9")).toBe(h);
  expect(h).not.toContain("203");
});

test("U2 @regression limit() with a fake redis: counts, flips at max+1, remaining floors at 0", async () => {
  const fake = fakeRedis();
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await limit({ key: "k", max: 2, windowSec: 30 }, fake));
  expect(results.map((r) => r.ok)).toEqual([true, true, false, false]);
  expect(results.map((r) => r.remaining)).toEqual([1, 0, 0, 0]);
  expect(results.every((r) => r.resetSec >= 1 && !r.unavailable)).toBe(true);
  // Redis error ⇒ fail open, unless failClosed
  const broken = async () => {
    throw new Error("down");
  };
  expect((await limit({ key: "k", max: 1, windowSec: 1 }, broken)).ok).toBe(true);
  const closed = await limit({ key: "k", max: 1, windowSec: 1, failClosed: true }, broken);
  expect(closed).toMatchObject({ ok: false, unavailable: true });
});

test("U3 @regression limit() on real Redis: TTL set on first hit only, keys independent, atomic, resets", async () => {
  const r = await getRedis();
  const key = `rl:test:${RUN}:a`;
  await limit({ key, max: 5, windowSec: 30 });
  await r.expire(key, 100); // a later hit must not reset the window
  await limit({ key, max: 5, windowSec: 30 });
  expect(await r.ttl(key)).toBeGreaterThan(30);
  expect((await limit({ key: `rl:test:${RUN}:b`, max: 5, windowSec: 30 })).remaining).toBe(4);

  const par = `rl:test:${RUN}:par`;
  const all = await Promise.all(Array.from({ length: 100 }, () => limit({ key: par, max: 10, windowSec: 30 })));
  expect(all.filter((x) => x.ok)).toHaveLength(10);

  const short = `rl:test:${RUN}:short`;
  expect((await limit({ key: short, max: 1, windowSec: 1 })).ok).toBe(true);
  expect((await limit({ key: short, max: 1, windowSec: 1 })).ok).toBe(false);
  await new Promise((res) => setTimeout(res, 1200));
  expect((await limit({ key: short, max: 1, windowSec: 1 })).ok).toBe(true);
});

test("U4 @regression config: env override, malformed ⇒ default + warning, unknown names ignored", () => {
  expect(envName("rooms:verify")).toBe("RATE_LIMIT_ROOMS_VERIFY");
  expect(envName("auth:verify-email")).toBe("RATE_LIMIT_AUTH_VERIFY_EMAIL");
  process.env.RATE_LIMIT_ROOMS_VERIFY = "3/60";
  expect(getLimit("rooms:verify")).toEqual({ max: 3, windowSec: 60, failClosed: true });
  const warnings: unknown[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => void warnings.push(a);
  process.env.RATE_LIMIT_ROOMS_VERIFY = "lots";
  expect(getLimit("rooms:verify")).toEqual(LIMITS["rooms:verify"]);
  console.warn = warn;
  expect(warnings).toHaveLength(1);
  delete process.env.RATE_LIMIT_ROOMS_VERIFY;
  process.env.RATE_LIMIT_NOT_A_LIMIT = "1/1";
  expect(getLimit("ice")).toEqual(LIMITS.ice);
  delete process.env.RATE_LIMIT_NOT_A_LIMIT;
});

test("U5 @regression clientIp: X-Forwarded-For only with TRUST_PROXY, ports/IPv6 stripped, unknown fallback", () => {
  const h = new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1", [REMOTE_ADDR_HEADER]: "::ffff:127.0.0.1" });
  delete process.env.TRUST_PROXY;
  expect(clientIp(h)).toBe("127.0.0.1");
  process.env.TRUST_PROXY = "1";
  expect(clientIp(h)).toBe("198.51.100.7");
  delete process.env.TRUST_PROXY;
  expect(clientIp({}, "[2001:db8::1]:443")).toBe("2001:db8::1");
  expect(clientIp({}, "::1")).toBe("::1");
  expect(clientIp({}, "203.0.113.5:5555")).toBe("203.0.113.5");
  expect(clientIp({ [REMOTE_ADDR_HEADER]: ["192.0.2.1"] })).toBe("192.0.2.1");
  expect(clientIp(new Headers())).toBe("unknown");
});

test("U6 @regression apiJson: numeric retryAfter from Retry-After / X-Retry-After; 2xx passthrough", async () => {
  const env = { success: false, message: "Too many requests", error: { code: "rate_limited" } };
  const a = (await apiJson(new Response(JSON.stringify(env), { status: 429, headers: { "Retry-After": "12" } })).catch(
    (e: unknown) => e,
  )) as ApiError;
  expect(a).toBeInstanceOf(ApiError);
  expect([a.status, a.code, a.retryAfter]).toEqual([429, "rate_limited", 12]);
  // better-auth's own 429: no envelope, X-Retry-After
  const b = (await apiJson(
    new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { "X-Retry-After": "600" },
    }),
  ).catch((e: unknown) => e)) as ApiError;
  expect([b.status, b.code, b.retryAfter]).toEqual([429, "rate_limited", 600]);
  expect(await apiJson<{ a: number }>(new Response(JSON.stringify({ a: 1 }), { status: 200 }))).toEqual({ a: 1 });
});

test("U7 @regression cached(): single-flight for 20 callers, hit skips fn, bust removes, Redis error falls through", async () => {
  const key = cacheKey("test", RUN);
  let calls = 0;
  const fn = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 50));
    return { n: calls };
  };
  const results = await Promise.all(Array.from({ length: 20 }, () => cached(key, 30, fn)));
  expect(calls).toBe(1);
  expect(results.every((r) => r.n === 1)).toBe(true);
  expect(await cached(key, 30, fn)).toEqual({ n: 1 });
  expect(calls).toBe(1);
  await bust(key);
  expect(await cached(key, 30, fn)).toEqual({ n: 2 });
  // fn errors are not cached
  const failing = cacheKey("test-fail", RUN);
  await expect(cached(failing, 30, async () => Promise.reject(new Error("db")))).rejects.toThrow("db");
  expect(await cached(failing, 30, async () => "ok")).toBe("ok");
  // Redis unset ⇒ pass-through
  const url = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  expect(await cached(key, 30, async () => "direct")).toBe("direct");
  process.env.REDIS_URL = url;
});

test("U8 @regression shouldRetry / retryDelay", () => {
  const e = (status: number, retryAfter?: number) => new ApiError(status, "unknown", "", undefined, retryAfter);
  for (const s of [400, 401, 403, 404, 409, 429]) expect(shouldRetry(0, e(s))).toBe(false);
  expect(shouldRetry(0, e(500))).toBe(true);
  expect(shouldRetry(1, e(503))).toBe(true);
  expect(shouldRetry(2, e(503))).toBe(false);
  expect(shouldRetry(1, new TypeError("fetch failed"))).toBe(true);
  expect(shouldRetry(2, new TypeError("fetch failed"))).toBe(false);
  expect(retryDelay(0, e(429, 7))).toBe(7000);
  expect(retryDelay(0, e(500))).toBe(1000);
  expect(retryDelay(2, e(500))).toBe(4000);
  expect(retryDelay(10, e(500))).toBe(8000);
});

test("U9 @regression socketLimit: blocked returns retryAfter; third strike disconnects once", async () => {
  process.env.RATE_LIMIT_SOCK_STATE = "1/60";
  let disconnects = 0;
  const socket = { id: `s-${RUN}`, disconnect: () => void disconnects++ };
  expect(await socketLimit(socket, "sock:state")).toEqual({ ok: true });
  const blocked = await socketLimit(socket, "sock:state");
  expect(blocked.ok).toBe(false);
  expect(!blocked.ok && blocked.retryAfter).toBeGreaterThan(0);
  expect(disconnects).toBe(0);
  await socketLimit(socket, "sock:state");
  expect(disconnects).toBe(0);
  await socketLimit(socket, "sock:state");
  expect(disconnects).toBe(1);
  delete process.env.RATE_LIMIT_SOCK_STATE;
});

test("U10 @regression bootCheck: prod + RATE_LIMIT_DISABLED throws; REDIS_REQUIRED + unreachable throws; else boots", async () => {
  const up = async () => true;
  const down = async () => false;
  await expect(bootCheck({ NODE_ENV: "production", RATE_LIMIT_DISABLED: "1", TRUST_PROXY: "1" }, up)).rejects.toThrow(
    /RATE_LIMIT_DISABLED/,
  );
  await expect(bootCheck({ REDIS_REQUIRED: "1", REDIS_URL: "redis://x" }, down)).rejects.toThrow(/REDIS_REQUIRED/);
  expect(await bootCheck({ REDIS_URL: "redis://x", RATE_LIMIT_DISABLED: "1" }, down)).toEqual([]);
  expect((await bootCheck({ NODE_ENV: "production", REDIS_URL: "redis://x" }, up)).join()).toMatch(/TRUST_PROXY/);
  expect((await bootCheck({}, down)).join()).toMatch(/REDIS_URL unset/);
});

test("U12 @regression sendMail: sends; transporter error swallowed + logged; mail:daily cap ⇒ no send + log", async () => {
  const mail = { subject: "s", text: "t", html: "<p>t</p>" };
  const sent: unknown[] = [];
  const ok = { sendMail: async (m: unknown) => void sent.push(m) };
  const allow = async () => ({ ok: true, remaining: 1, resetSec: 1, unavailable: false });
  const deny = async () => ({ ok: false, remaining: 0, resetSec: 1, unavailable: false });
  await sendMail("a@x.test", mail, { transporter: ok as never, limit: allow });
  expect(sent).toHaveLength(1);

  const logs: string[] = [];
  const [err, warn] = [console.error, console.warn];
  console.error = (...a: unknown[]) => void logs.push(a.join(" "));
  console.warn = (...a: unknown[]) => void logs.push(a.join(" "));
  const boom = { sendMail: async () => Promise.reject(new Error("smtp down")) };
  await expect(sendMail("a@x.test", mail, { transporter: boom as never, limit: allow })).resolves.toBeUndefined();
  await sendMail("a@x.test", mail, { transporter: ok as never, limit: deny });
  [console.error, console.warn] = [err, warn];
  expect(sent).toHaveLength(1);
  expect(logs.join("\n")).toContain("smtp down");
  expect(logs.join("\n")).toContain("mail_cap_reached");
});

test("U15 @regression emailLimit: normalises email, passes bodies without email, 429 same shape", async () => {
  process.env.RATE_LIMIT_AUTH_MAGIC_EMAIL = "2/60";
  const app = new Hono().use("/m", emailLimit("auth:magic:email")).post("/m", async (c) => c.json(await c.req.json()));
  app.onError(errorHandler);
  const post = (body: string) => app.request("/m", { method: "POST", body, headers: { "content-type": "application/json" } });
  const email = `Mixed-${RUN}@Example.test`;
  expect((await post(JSON.stringify({ email: `  ${email} ` }))).status).toBe(200);
  expect((await post(JSON.stringify({ email: email.toLowerCase() }))).status).toBe(200); // body still readable downstream
  const blocked = await post(JSON.stringify({ email: email.toUpperCase() }));
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBeTruthy();
  const body = await blocked.json();
  expect(body).toMatchObject({ success: false, error: { code: "rate_limited" } });
  // another address has its own counter — and the 429 never says whether an account exists
  expect((await post(JSON.stringify({ email: `other-${RUN}@example.test` }))).status).toBe(200);
  for (const raw of ["{}", "not json", JSON.stringify({ email: 5 })]) expect((await post(raw)).status).not.toBe(429);
  delete process.env.RATE_LIMIT_AUTH_MAGIC_EMAIL;
});
