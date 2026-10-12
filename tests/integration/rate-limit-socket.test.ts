import { expect, test } from "@playwright/test";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import type { ClientToServerEvents, JoinResult, ServerToClientEvents } from "@/lib/socket.io/events";

// Signaling in-process (spec 002 I8–I12): real `registerSignaling` + real Redis (DB 15); session + room
// lookups go to a tiny stub instead of Next, so this needs no dev server.
process.env.REDIS_URL = "redis://localhost:16379/15";
delete process.env.RATE_LIMIT_DISABLED;
process.env.RATE_LIMIT_SOCK_CONNECT = "1000/60"; // every client here shares 127.0.0.1; I12 lowers it

test.describe.configure({ mode: "serial" });

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const CODE = "abc-defg-hij";
const RUN = Date.now().toString(36);
let stub: HttpServer;
let http: HttpServer;
let url = "";
const clients: Client[] = [];

test.beforeAll(async () => {
  const { registerSignaling } = await import("@/lib/socket.io/server");
  stub = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url?.startsWith("/api/auth/get-session")) {
      const id = /u=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
      res.end(JSON.stringify(id ? { user: { id, name: id, image: null, isAnonymous: false } } : null));
      return;
    }
    res.end(
      JSON.stringify({
        id: "room-1", code: CODE, name: "Stub", kind: "instant", hostId: "nobody", hasPassword: false, allowGuests: true,
        startsAt: null, expiresAt: null, endedAt: null, createdAt: new Date().toISOString(),
      }),
    );
  });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  http = createServer();
  registerSignaling(new Server(http), {
    base: `http://127.0.0.1:${(stub.address() as AddressInfo).port}`,
    internalSecret: "x",
    tokenSecret: "x",
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  for (const c of clients) c.disconnect();
  await new Promise((r) => http.close(r));
  await new Promise((r) => stub.close(r));
});

function client(user: string): Client {
  const c: Client = connect(url, {
    transports: ["websocket"],
    extraHeaders: { cookie: `u=${user}-${RUN}` },
    reconnection: false,
    forceNew: true,
  });
  clients.push(c);
  return c;
}

async function joined(user: string): Promise<Client> {
  const c = client(user);
  await new Promise<void>((resolve, reject) => {
    c.once("connect", () => resolve());
    c.once("connect_error", reject);
  });
  const r = await new Promise<JoinResult>((res) => c.emit("room:join", CODE, {}, res));
  expect(r.ok).toBe(true);
  return c;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("I8 @regression signal flood: over the limit dropped + `rate_limited`, connection alive", async () => {
  process.env.RATE_LIMIT_SOCK_SIGNAL = "5/60";
  const a = await joined("i8a");
  const b = await joined("i8b");
  let received = 0;
  const limited: string[] = [];
  b.on("signal", () => void received++);
  a.on("rate_limited", (event) => void limited.push(event));
  for (let i = 0; i < 6; i++) a.emit("signal", b.id!, { candidate: null });
  await expect.poll(() => limited).toEqual(["signal"]);
  expect(received).toBe(5);
  expect(a.connected).toBe(true);

  // I9 three strikes: two more blocked events → server disconnects; a fresh socket may come back
  const reason = new Promise<string>((r) => a.once("disconnect", r));
  a.emit("signal", b.id!, { candidate: null });
  a.emit("signal", b.id!, { candidate: null });
  expect(await reason).toBe("io server disconnect");
  await joined("i8a");
  delete process.env.RATE_LIMIT_SOCK_SIGNAL;
});

test("I11 room:join past the limit for one user → ack { ok:false, error:'rate_limited', retryAfter }", async () => {
  process.env.RATE_LIMIT_SOCK_JOIN = "2/60";
  const c = await joined("i11"); // join #1
  const again = () => new Promise<JoinResult>((res) => c.emit("room:join", CODE, {}, res));
  expect((await again()).ok).toBe(true); // #2
  const r = await again();
  expect(r).toMatchObject({ ok: false, error: "rate_limited" });
  expect(!r.ok && r.retryAfter).toBeGreaterThan(0);
  delete process.env.RATE_LIMIT_SOCK_JOIN;
});

test("I10 @regression 10-peer join with full offer/answer/ICE×15 stays under every default limit", async () => {
  for (const c of clients.splice(0)) c.disconnect(); // empty the room (max 10)
  await sleep(200);
  const peers = await Promise.all(Array.from({ length: 10 }, (_, i) => joined(`i10-${i}`)));
  let limited = 0;
  for (const p of peers) p.on("rate_limited", () => void limited++);
  for (const p of peers) {
    for (const q of peers) {
      if (p === q) continue;
      p.emit("signal", q.id!, { description: { type: "offer", sdp: "x" } });
      p.emit("signal", q.id!, { description: { type: "answer", sdp: "x" } });
      for (let i = 0; i < 15; i++) p.emit("signal", q.id!, { candidate: { candidate: "c" } });
    }
    p.emit("state", { mic: true, cam: true, screen: false });
  }
  await sleep(1000);
  expect(limited).toBe(0);
  expect(peers.every((p) => p.connected)).toBe(true);
});

test("I12 socket connect past the per-IP limit → connect_error rate_limited", async () => {
  const { getRedis } = await import("@/lib/redis/client");
  const { hashIp, rl } = await import("@/lib/redis/keys");
  await (await getRedis()).del(rl("sock:connect", hashIp("127.0.0.1")));
  process.env.RATE_LIMIT_SOCK_CONNECT = "3/60";
  const errors: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = client(`i12-${i}`);
    await new Promise<void>((resolve) => {
      c.once("connect", () => resolve());
      c.once("connect_error", (e) => {
        errors.push(e.message);
        resolve();
      });
    });
  }
  expect(errors).toEqual(["rate_limited"]);
  process.env.RATE_LIMIT_SOCK_CONNECT = "1000/60";
});
