import { expect, test, type APIRequestContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3000";
const RUN = `${Date.now().toString(36)}-e`;
const email = (tag: string) => `${tag}-${RUN}@test.local`;

type PW = { request: { newContext(opts: { baseURL: string }): Promise<APIRequestContext> } };

function cookies(setCookies: { value: string }[]): string {
  return setCookies.map((c) => c.value.split(";")[0]).join("; ");
}

async function signup(pw: PW, tag: string, name: string): Promise<string> {
  const ctx = await pw.request.newContext({ baseURL: BASE });
  // sign-up never returns a session (verification required); @test.local is auto-verified in test mode
  await ctx.post("/api/auth/sign-up/email", {
    data: { name, email: email(tag), password: "test1234-password" },
  });
  const res = await ctx.post("/api/auth/sign-in/email", {
    data: { email: email(tag), password: "test1234-password" },
  });
  expect(res.status()).toBe(200);
  return cookies(res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie"));
}

async function req(
  pw: PW,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  cookie?: string,
  data?: unknown,
  raw?: string,
): Promise<{ status: number; body: unknown }> {
  const ctx = await pw.request.newContext({ baseURL: BASE });
  const res = await ctx[method](path, {
    ...(cookie ? { headers: { Cookie: cookie, ...(raw ? { "Content-Type": "application/json" } : {}) } } : raw ? { headers: { "Content-Type": "application/json" } } : {}),
    ...(raw !== undefined ? { data: raw } : data !== undefined ? { data } : {}),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

function expectEnvelope(r: { status: number; body: unknown }, status: number, code: string) {
  expect(r.status).toBe(status);
  const b = r.body as { success: boolean; message: string; error: { code: string } };
  expect(b.success).toBe(false);
  expect(typeof b.message).toBe("string");
  expect(b.error.code).toBe(code);
  return b;
}

test("I27 @regression invalid body → 400 validation_failed with paths", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i27-host", "I27 Host");
  const r = await req(pw, "post", "/api/rooms", host, { name: "", kind: "instant" });
  const b = expectEnvelope(r, 400, "validation_failed");
  const paths = (
    (b.error as { details?: { path?: (string | number)[] }[] }).details ?? []
  ).map((d) => (d.path ?? []).join("."));
  expect(paths).toContain("name");
});

test("I28 @regression auth guard → 401 unauthorized envelope", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const r = await req(pw, "get", "/api/rooms");
  expectEnvelope(r, 401, "unauthorized");
  const internal = await req(pw, "get", "/api/internal/rooms/abc-defg-hij");
  expectEnvelope(internal, 401, "unauthorized");
});

test("I29 @regression non-host writes → 403 forbidden envelope", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i29-host", "I29 Host");
  const member = await signup(pw, "i29-member", "I29 Member");
  const created = (await (
    await (await pw.request.newContext({ baseURL: BASE })).post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "guarded", kind: "instant" },
    })
  ).json()) as { code: string };

  expectEnvelope(await req(pw, "patch", `/api/rooms/${created.code}`, member, { name: "x" }), 403, "forbidden");
  expectEnvelope(await req(pw, "post", `/api/rooms/${created.code}/end`, member), 403, "forbidden");
  expectEnvelope(await req(pw, "delete", `/api/rooms/${created.code}`, member), 403, "forbidden");
});

test("I30 @regression unknown code and route → 404 envelopes", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i30-host", "I30 Host");
  expectEnvelope(await req(pw, "get", "/api/rooms/aaa-bbbb-ccc", host), 404, "not_found");
  expectEnvelope(await req(pw, "get", "/api/nope", host), 404, "route_not_found");
});

test("I31 @regression malformed JSON → 400 invalid_json", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i31-host", "I31 Host");
  const ctx = await pw.request.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/rooms", {
    headers: { Cookie: host, "Content-Type": "application/json" },
    data: Buffer.from("{bad json"),
  });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as { success: boolean; error: { code: string } };
  expect(body.success).toBe(false);
  expect(body.error.code).toBe("invalid_json");
});

test("I32 missing row → 404; Prisma mapping covered in U15", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i32-host", "I32 Host");
  const room = await (
    await (await pw.request.newContext({ baseURL: BASE })).post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "gone", kind: "instant" },
    })
  ).json();
  const code = (room as { code: string }).code;
  await req(pw, "delete", `/api/rooms/${code}`, host);
  expectEnvelope(await req(pw, "patch", `/api/rooms/${code}`, host, { name: "x" }), 404, "not_found");
});

test("I33 @regression wrong password → 401 wrong_password, no secrets", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i33-host", "I33 Host");
  const member = await signup(pw, "i33-member", "I33 Member");
  const created = (await (
    await (await pw.request.newContext({ baseURL: BASE })).post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "pw", kind: "scheduled", password: "right" },
    })
  ).json()) as { code: string };
  const r = await req(pw, "post", `/api/rooms/${created.code}/verify`, member, { password: "wrong" });
  const b = expectEnvelope(r, 401, "wrong_password");
  const text = JSON.stringify(b);
  expect(text).not.toContain("scrypt$");
  expect(text).not.toContain("joinToken");
  expect(text).not.toContain("right");
});

test("I35 @regression every route errors with the envelope", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const cases: { method: "get" | "post"; path: string; authed: boolean }[] = [
    { method: "get", path: "/api/rooms", authed: false },
    { method: "post", path: "/api/rooms", authed: false },
    { method: "get", path: "/api/ice-servers", authed: false },
    { method: "get", path: "/api/storage/health", authed: false },
    { method: "post", path: "/api/storage/presign", authed: false },
    { method: "get", path: "/api/internal/rooms/aaa-bbbb-ccc", authed: false },
    { method: "get", path: "/api/does-not-exist", authed: false },
  ];
  for (const c of cases) {
    const r = await req(pw, c.method, c.path, undefined, c.method === "post" ? {} : undefined);
    expect(r.status).toBeGreaterThanOrEqual(400);
    const b = r.body as { success: boolean; message: string; error: { code: string } };
    expect(b.success).toBe(false);
    expect(typeof b.message).toBe("string");
    expect(typeof b.error?.code).toBe("string");
  }
});

test("I36 @regression error bodies leak nothing", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const host = await signup(pw, "i36-host", "I36 Host");
  const bodies: string[] = [];
  const paths: [string, "get" | "post", unknown?][] = [
    ["/api/rooms", "post", { name: "", kind: "instant" }],
    ["/api/rooms/aaa-bbbb-ccc", "get"],
    ["/api/nope", "get"],
  ];
  for (const [path, method, data] of paths) {
    const r = await req(pw, method, path, host, data);
    bodies.push(JSON.stringify(r.body));
  }
  const leak = /(at\s+\S+:\d+|Prisma|P20\d\d|scrypt\$|eyJ[A-Za-z0-9_-]{10}|BEGIN (RSA )?PRIVATE KEY)/;
  for (const b of bodies) {
    expect(b).not.toMatch(leak);
  }
});
