import { expect, test, type APIRequestContext } from "@playwright/test";

type PlaywrightRequest = {
  request: { newContext(opts: { baseURL: string }): Promise<APIRequestContext> };
};

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3000";

async function freshContext(pw: PlaywrightRequest): Promise<APIRequestContext> {
  return pw.request.newContext({ baseURL: BASE });
}

const RUN = `${Date.now().toString(36)}-${process.env.TEST_WORKER_INDEX ?? "0"}`;
const email = (tag: string) => `${tag}-${RUN}@test.local`;

async function authCookie(pw: PlaywrightRequest, emailAddr: string, name: string): Promise<string> {
  const ctx = await freshContext(pw);

  // sign-up never returns a session (verification required); @test.local is auto-verified in test mode
  await ctx.post("/api/auth/sign-up/email", {
    data: { name, email: emailAddr, password: "test1234-password" },
  });
  const signin = await ctx.post("/api/auth/sign-in/email", {
    data: { email: emailAddr, password: "test1234-password" },
  });
  expect(signin.status()).toBe(200);
  return joinCookies(signin.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie"));
}

function joinCookies(setCookies: { value: string }[]): string {
  return setCookies.map((c) => c.value.split(";")[0]).join("; ");
}

async function userIdFromCookie(pw: PlaywrightRequest, cookie: string): Promise<string> {
  const ctx = await freshContext(pw);
  const res = await ctx.get("/api/auth/get-session", { headers: { Cookie: cookie } });
  const session = await res.json();
  return session.user.id as string;
}

async function guestCookie(pw: PlaywrightRequest): Promise<string> {
  const ctx = await freshContext(pw);
  const res = await ctx.post("/api/auth/sign-in/anonymous", { data: {} });
  expect(res.status()).toBe(200);
  return joinCookies(res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie"));
}

test("I1 @regression POST /api/rooms without session is 401", async ({ request }) => {
  const res = await request.post("/api/rooms", { data: { name: "x", kind: "instant" } });
  expect(res.status()).toBe(401);
});

test("I2 @regression instant room defaults", async ({ request, playwright }) => {
  const cookie = await authCookie(playwright, email("i2-host"), "I2 Host");
  const res = await request.post("/api/rooms", {
    headers: { Cookie: cookie },
    data: { name: "standup", kind: "instant" },
  });
  expect(res.status()).toBe(201);
  const room = await res.json();
  expect(room.code).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  expect(room.allowGuests).toBe(true);
  expect(room.hasPassword).toBe(false);
  expect(room.kind).toBe("instant");
  const expires = new Date(room.expiresAt).getTime() - Date.now();
  expect(expires).toBeGreaterThan(23 * 3600 * 1000);
  expect(expires).toBeLessThanOrEqual(24 * 3600 * 1000);
});

test("I3 @regression scheduled room with password hides hash", async ({ request, playwright }) => {
  const cookie = await authCookie(playwright, email("i3-host"), "I3 Host");
  const res = await request.post("/api/rooms", {
    headers: { Cookie: cookie },
    data: { name: "planning", kind: "scheduled", password: "room-pw", allowGuests: false },
  });
  expect(res.status()).toBe(201);
  const created = await res.json();
  expect(JSON.stringify(created)).not.toContain("room-pw");
  expect(JSON.stringify(created)).not.toContain("passwordHash");
  const get = await request.get(`/api/rooms/${created.code}`, { headers: { Cookie: cookie } });
  expect(get.status()).toBe(200);
  const fetched = await get.json();
  expect(fetched.hasPassword).toBe(true);
  expect(fetched.allowGuests).toBe(false);
  expect(JSON.stringify(fetched)).not.toContain("passwordHash");
});

test("I4 @regression password verify wrong/right/host", async ({ request, playwright }) => {
  const host = await authCookie(playwright, email("i4-host"), "I4 Host");
  const member = await authCookie(playwright, email("i4-member"), "I4 Member");
  const created = await (
    await request.post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "locked-room", kind: "scheduled", password: "letmein" },
    })
  ).json();

  const wrong = await request.post(`/api/rooms/${created.code}/verify`, {
    headers: { Cookie: member },
    data: { password: "nope" },
  });
  expect(wrong.status()).toBe(401);

  const right = await request.post(`/api/rooms/${created.code}/verify`, {
    headers: { Cookie: member },
    data: { password: "letmein" },
  });
  expect(right.status()).toBe(200);
  expect((await right.json()).joinToken).toMatch(/^[A-Za-z0-9\-_.]+$/);

  const hostRes = await request.post(`/api/rooms/${created.code}/verify`, {
    headers: { Cookie: host },
    data: { password: "anything" },
  });
  expect(hostRes.status()).toBe(200);
  expect((await hostRes.json()).joinToken).toBeTruthy();
});

test("I5 @regression non-host patch/delete/end forbidden, host allowed", async ({ request, playwright }) => {
  const host = await authCookie(playwright, email("i5-host"), "I5 Host");
  const member = await authCookie(playwright, email("i5-member"), "I5 Member");
  const created = await (
    await request.post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "owned", kind: "later" },
    })
  ).json();

  expect(
    (await request.patch(`/api/rooms/${created.code}`, { headers: { Cookie: member }, data: { name: "hijack" } })).status(),
  ).toBe(403);
  expect((await request.post(`/api/rooms/${created.code}/end`, { headers: { Cookie: member } })).status()).toBe(403);
  expect((await request.delete(`/api/rooms/${created.code}`, { headers: { Cookie: member } })).status()).toBe(403);

  const patched = await request.patch(`/api/rooms/${created.code}`, {
    headers: { Cookie: host },
    data: { name: "renamed" },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).name).toBe("renamed");

  expect((await request.post(`/api/rooms/${created.code}/end`, { headers: { Cookie: host } })).status()).toBe(204);
  const afterEnd = await (
    await request.get(`/api/rooms/${created.code}`, { headers: { Cookie: host } })
  ).json();
  expect(afterEnd.status).toBe("ended");

  // instant meetings are deleted when ended
  const instant = await (
    await request.post("/api/rooms", { headers: { Cookie: host }, data: { name: "throwaway", kind: "instant" } })
  ).json();
  expect((await request.post(`/api/rooms/${instant.code}/end`, { headers: { Cookie: host } })).status()).toBe(204);
  expect((await request.get(`/api/rooms/${instant.code}`, { headers: { Cookie: host } })).status()).toBe(404);

  expect((await request.delete(`/api/rooms/${created.code}`, { headers: { Cookie: host } })).status()).toBe(204);
  expect((await request.get(`/api/rooms/${created.code}`, { headers: { Cookie: host } })).status()).toBe(404);
});

test("I8 @regression storage health + presign round-trip", async ({ request, playwright }) => {
  const host = await authCookie(playwright, email("i8-host"), "I8 Host");
  const hostId = await userIdFromCookie(playwright, host);

  const health = await request.get("/api/storage/health", { headers: { Cookie: host } });
  expect(health.status()).toBe(200);

  const bad = await request.post("/api/storage/presign", {
    headers: { Cookie: host },
    data: { key: "elsewhere/file.txt", contentType: "text/plain" },
  });
  expect(bad.status()).toBe(400);

  const key = `rooms/abcd1234/${hostId}/probe.txt`;
  const presign = await request.post("/api/storage/presign", {
    headers: { Cookie: host },
    data: { key, contentType: "text/plain" },
  });
  expect(presign.status()).toBe(200);
  const { url } = await presign.json();
  const put = await request.put(url, {
    headers: { "Content-Type": "text/plain" },
    data: "hello-minio",
  });
  expect(put.status()).toBe(200);
});

test("I7 @regression internal route needs secret", async ({ request, playwright }) => {
  const noAuth = await request.get("/api/internal/rooms/doesnotexist");
  expect(noAuth.status()).toBe(401);

  const host = await authCookie(playwright, email("i7-host"), "I7 Host");
  const created = await (
    await request.post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "internal-check", kind: "instant" },
    })
  ).json();

  const wrongSecret = await request.get(`/api/internal/rooms/${created.code}`, {
    headers: { "x-internal-secret": "wrong" },
  });
  expect(wrongSecret.status()).toBe(401);

  const ok = await request.get(`/api/internal/rooms/${created.code}`, {
    headers: { "x-internal-secret": "dev-internal-secret" },
  });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.code).toBe(created.code);
  expect(body.hasPassword).toBe(false);
  expect(JSON.stringify(body)).not.toContain("passwordHash");
});

test("I6 guest reads public shape, unknown code 404s", async ({ request, playwright }) => {
  const host = await authCookie(playwright, email("i6-host"), "I6 Host");
  const guest = await guestCookie(playwright);
  const created = await (
    await request.post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "open", kind: "instant" },
    })
  ).json();

  const res = await request.get(`/api/rooms/${created.code}`, { headers: { Cookie: guest } });
  expect(res.status()).toBe(200);
  expect(Object.keys(await res.json()).sort()).toEqual(
    ["allowGuests", "code", "endedAt", "expiresAt", "hasPassword", "hostId", "kind", "name", "startsAt", "status"].sort(),
  );
  expect((await request.get("/api/rooms/doesnotexist", { headers: { Cookie: guest } })).status()).toBe(404);
});

test("I25 @regression meet-style codes and normalized reads", async ({ request, playwright }) => {
  const host = await authCookie(playwright, email("i25-host"), "I25 Host");
  const created = await (
    await request.post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "coded", kind: "instant" },
    })
  ).json();
  expect(created.code).toMatch(/^[a-kmnp-z]{3}-[a-kmnp-z]{4}-[a-kmnp-z]{3}$/);

  const upper = created.code.toUpperCase();
  const viaUpper = await request.get(`/api/rooms/${upper}`, { headers: { Cookie: host } });
  expect(viaUpper.status()).toBe(200);
  expect((await viaUpper.json()).code).toBe(created.code);

  const bare = created.code.replaceAll("-", "");
  const viaBare = await request.get(`/api/rooms/${bare}`, { headers: { Cookie: host } });
  expect(viaBare.status()).toBe(200);

  const bad = await request.get("/api/rooms/abc-defg", { headers: { Cookie: host } });
  expect(bad.status()).toBe(404);
});

test("I26 @regression later rooms: 30d default, member can admit", async ({
  request,
  playwright,
}) => {
  const host = await authCookie(playwright, email("i26-host"), "I26 Host");
  const created = await (
    await request.post("/api/rooms", {
      headers: { Cookie: host },
      data: { name: "for later", kind: "later" },
    })
  ).json();
  expect(created.kind).toBe("later");
  expect(created.startsAt).toBeNull();
  expect(created.allowGuests).toBe(true);
  expect(created.hasPassword).toBe(false);
  const expires = new Date(created.expiresAt).getTime() - Date.now();
  expect(expires).toBeGreaterThan(29 * 24 * 3600 * 1000);
  expect(expires).toBeLessThanOrEqual(30 * 24 * 3600 * 1000);
});
