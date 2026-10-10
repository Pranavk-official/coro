import { expect, test, type APIRequestContext } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import { ERROR_CODES } from "../../src/lib/utils/error-copy";
import type {
  ClientToServerEvents,
  JoinResult,
  Peer,
  ServerToClientEvents,
} from "../../src/lib/socket.io/events";

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:3000";
const RUN = `${Date.now().toString(36)}-s`;
const email = (tag: string) => `${tag}-${RUN}@test.local`;

type PW = { request: { newContext(opts: { baseURL: string }): Promise<APIRequestContext> } };
type Sock = Socket<ServerToClientEvents, ClientToServerEvents>;

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

async function guest(pw: PW): Promise<string> {
  const ctx = await pw.request.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/auth/sign-in/anonymous", { data: {} });
  expect(res.status()).toBe(200);
  return cookies(res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie"));
}

async function createRoom(
  pw: PW,
  cookie: string,
  body: Record<string, unknown>,
): Promise<{ code: string }> {
  const ctx = await pw.request.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/rooms", { headers: { Cookie: cookie }, data: body });
  expect(res.status()).toBe(201);
  return (await res.json()) as { code: string };
}

async function http(
  pw: PW,
  method: "post" | "get" | "patch" | "delete",
  path: string,
  cookie: string,
  data?: Record<string, unknown>,
): Promise<{ status: number; json: () => Promise<unknown> }> {
  const ctx = await pw.request.newContext({ baseURL: BASE });
  const res = await ctx[method === "delete" ? "delete" : method](path, {
    headers: { Cookie: cookie },
    ...(data ? { data } : {}),
  });
  return { status: res.status(), json: () => res.json() as Promise<unknown> };
}

function connect(cookie?: string): Promise<{ socket?: Sock; error?: Error }> {
  return new Promise((resolve) => {
    const socket = io(BASE, {
      reconnection: false,
      ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
    }) as Sock;
    socket.once("connect", () => resolve({ socket }));
    socket.once("connect_error", (err) => {
      socket.close();
      resolve({ error: err });
    });
  });
}

function join(socket: Sock, code: string, joinToken?: string): Promise<JoinResult> {
  return new Promise((resolve) => {
    socket.emit("room:join", code, joinToken ? { joinToken } : {}, (r) => resolve(r));
  });
}

function waitEvent<T>(socket: Sock, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event as never, ((...args: unknown[]) => {
      clearTimeout(timer);
      resolve((args.length === 1 ? args[0] : args) as T);
    }) as never);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function closeAll(sockets: (Sock | undefined)[]): Promise<void> {
  for (const s of sockets) {
    try {
      s?.close();
    } catch {
      /* noop */
    }
  }
  await sleep(100);
}

test("I9 @regression socket auth: no cookie rejected, guest connects", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const noCookie = await connect();
  expect(noCookie.error?.message).toBe("unauthorized");
  expect(noCookie.socket).toBeUndefined();

  const g = await guest(pw);
  const withGuest = await connect(g);
  expect(withGuest.error).toBeUndefined();
  expect(withGuest.socket?.connected).toBe(true);
  await closeAll([withGuest.socket]);
});

test("I11 @regression two members join, peer events flow", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i11-host", "I11 Host");
    const memberCookie = await signup(pw, "i11-member", "I11 Member");
    const { code } = await createRoom(pw, hostCookie, { name: "pair", kind: "instant" });

    const a = (await connect(hostCookie)).socket!;
    const peerJoined = waitEvent<Peer>(a, "peer:joined");
    sockets.push(a);
    const ra = await join(a, code);
    expect(ra).toEqual(
      expect.objectContaining({ ok: true, status: "admitted", peers: [], polite: true }),
    );

    const b = (await connect(memberCookie)).socket!;
    sockets.push(b);
    const rb = await join(b, code);
    expect(rb.ok).toBe(true);
    if (rb.ok && rb.status === "admitted") {
      expect(rb.peers).toHaveLength(1);
      expect(rb.polite).toBe(true);
      expect(rb.canAdmit).toBe(true); // instant room: members can admit (FR7)
      expect(rb.isHost).toBe(false);
    } else {
      throw new Error(`expected admitted, got ${JSON.stringify(rb)}`);
    }

    const peer = await peerJoined;
    expect(peer.userId).not.toBe("");
    expect(peer.isHost).toBe(false);

    const state = waitEvent<[string, { mic: boolean }]>(a, "peer:state");
    b.emit("state", { mic: false, cam: true, screen: false });
    const [peerId, media] = await state;
    expect(media.mic).toBe(false);
    expect(peerId).toBe(b.id);
  } finally {
    await closeAll(sockets);
  }
});

test("I12 @regression 10 admitted, 11th gets room_full", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i12-host", "I12 Host");
    const { code } = await createRoom(pw, hostCookie, { name: "full", kind: "instant" });
    const host = (await connect(hostCookie)).socket!;
    sockets.push(host);
    expect(await join(host, code)).toEqual(expect.objectContaining({ status: "admitted" }));

    for (let i = 0; i < 9; i++) {
      const c = await signup(pw, `i12-m${i}`, `I12 M${i}`);
      const s = (await connect(c)).socket!;
      sockets.push(s);
      const r = await join(s, code);
      expect(r).toEqual(expect.objectContaining({ status: "admitted" }));
    }

    const extra = await signup(pw, "i12-extra", "I12 Extra");
    const sExtra = (await connect(extra)).socket!;
    sockets.push(sExtra);
    expect(await join(sExtra, code)).toEqual({ ok: false, error: "room_full" });
  } finally {
    await closeAll(sockets);
  }
});

test("I13 @regression unknown / ended / expired joins", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i13-host", "I13 Host");
    const s = (await connect(hostCookie)).socket!;
    sockets.push(s);

    expect(await join(s, "nope1234")).toEqual({ ok: false, error: "not_found" });

    const { code: live } = await createRoom(pw, hostCookie, { name: "doomed", kind: "later" });
    await http(pw, "post", `/api/rooms/${live}/end`, hostCookie);
    expect(await join(s, live)).toEqual({ ok: false, error: "ended" });

    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    const { code: old } = await createRoom(pw, hostCookie, {
      name: "old",
      kind: "scheduled",
      expiresAt: past,
    });
    expect(await join(s, old)).toEqual({ ok: false, error: "expired" });
  } finally {
    await closeAll(sockets);
  }
});

test("I14 @regression password room token flows", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i14-host", "I14 Host");
    const memberCookie = await signup(pw, "i14-member", "I14 Member");
    const { code } = await createRoom(pw, hostCookie, {
      name: "secret",
      kind: "scheduled",
      password: "letmein",
    });

    const m = (await connect(memberCookie)).socket!;
    sockets.push(m);
    expect(await join(m, code)).toEqual({ ok: false, error: "password_required" });
    const bad = await http(pw, "post", `/api/rooms/${code}/verify`, memberCookie, {
      password: "nope",
    });
    expect(bad.status).toBe(401);

    const good = await http(pw, "post", `/api/rooms/${code}/verify`, memberCookie, {
      password: "letmein",
    });
    const { joinToken } = (await good.json()) as { joinToken: string };
    expect(await join(m, code, joinToken)).toEqual(
      expect.objectContaining({ status: "admitted" }),
    );

    const h = (await connect(hostCookie)).socket!;
    sockets.push(h);
    expect(await join(h, code)).toEqual(expect.objectContaining({ status: "admitted" }));
  } finally {
    await closeAll(sockets);
  }
});

test("I15 guests_not_allowed when room closes guests", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i15-host", "I15 Host");
    const { code } = await createRoom(pw, hostCookie, {
      name: "members-only",
      kind: "scheduled",
      allowGuests: false,
    });
    const g = (await connect(await guest(pw))).socket!;
    sockets.push(g);
    expect(await join(g, code)).toEqual({ ok: false, error: "guests_not_allowed" });
  } finally {
    await closeAll(sockets);
  }
});

test("I16 @regression guest waits, admitters notified, other guest not", async ({
  playwright,
}) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i16-host", "I16 Host");
    const memberCookie = await signup(pw, "i16-member", "I16 Member");
    const { code } = await createRoom(pw, hostCookie, { name: "gate", kind: "instant" });

    const h = (await connect(hostCookie)).socket!;
    const m = (await connect(memberCookie)).socket!;
    sockets.push(h, m);
    await join(h, code);
    await join(m, code);

    const hostWaiting = waitEvent<Peer[]>(h, "waiting:update");
    const memberWaiting = waitEvent<Peer[]>(m, "waiting:update");

    const g2 = (await connect(await guest(pw))).socket!;
    sockets.push(g2);
    await join(g2, code);
    const g2Updates: Peer[][] = [];
    g2.on("waiting:update" as never, ((w: Peer[]) => g2Updates.push(w)) as never);

    const g = (await connect(await guest(pw))).socket!;
    sockets.push(g);
    const r = await join(g, code);
    expect(r).toEqual({ ok: true, status: "waiting" });

    const hw = await hostWaiting;
    const mw = await memberWaiting;
    expect(hw).toHaveLength(1);
    expect(mw).toHaveLength(1);
    await sleep(400);
    expect(g2Updates).toHaveLength(0);
  } finally {
    await closeAll(sockets);
  }
});

test("I17 @regression admit rights: instant member yes, scheduled member no, host yes", async ({
  playwright,
}) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i17-host", "I17 Host");
    const memberCookie = await signup(pw, "i17-member", "I17 Member");

    // instant: member can admit
    const { code: instant } = await createRoom(pw, hostCookie, { name: "fast", kind: "instant" });
    const h1 = (await connect(hostCookie)).socket!;
    const m1 = (await connect(memberCookie)).socket!;
    sockets.push(h1, m1);
    await join(h1, instant);
    await join(m1, instant);
    const g1 = (await connect(await guest(pw))).socket!;
    sockets.push(g1);
    const waiting1 = waitEvent<Peer[]>(h1, "waiting:update");
    expect(await join(g1, instant)).toEqual({ ok: true, status: "waiting" });
    const guestId = (await waiting1)[0].id;

    const admitted1 = waitEvent<{ peers: Peer[] }>(g1, "admitted");
    const joined1 = waitEvent<Peer>(m1, "peer:joined");
    m1.emit("host:admit", guestId);
    const a1 = await admitted1;
    expect(a1.peers.length).toBeGreaterThanOrEqual(2);
    expect((await joined1).isGuest).toBe(true);

    // scheduled: member cannot admit, host can
    const { code: sched } = await createRoom(pw, hostCookie, {
      name: "formal",
      kind: "scheduled",
    });
    const h2 = (await connect(hostCookie)).socket!;
    const m2 = (await connect(memberCookie)).socket!;
    sockets.push(h2, m2);
    await join(h2, sched);
    await join(m2, sched);
    const g2 = (await connect(await guest(pw))).socket!;
    sockets.push(g2);
    const waiting2 = waitEvent<Peer[]>(h2, "waiting:update");
    expect(await join(g2, sched)).toEqual({ ok: true, status: "waiting" });
    const guestId2 = (await waiting2)[0].id;

    let admittedByMember = false;
    g2.once("admitted" as never, (() => (admittedByMember = true)) as never);
    m2.emit("host:admit", guestId2);
    await sleep(500);
    expect(admittedByMember).toBe(false);

    const admitted2 = waitEvent<{ status: string }>(g2, "admitted");
    h2.emit("host:admit", guestId2);
    expect((await admitted2).status).toBe("admitted");
  } finally {
    await closeAll(sockets);
  }
});

test("I18 deny removes guest from waiting", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i18-host", "I18 Host");
    const { code } = await createRoom(pw, hostCookie, { name: "door", kind: "instant" });
    const h = (await connect(hostCookie)).socket!;
    sockets.push(h);
    await join(h, code);

    const g = (await connect(await guest(pw))).socket!;
    sockets.push(g);
    const waiting = waitEvent<Peer[]>(h, "waiting:update");
    expect(await join(g, code)).toEqual({ ok: true, status: "waiting" });
    const guestId = (await waiting)[0].id;

    const denied = waitEvent<void>(g, "denied");
    const emptied = waitEvent<Peer[]>(h, "waiting:update");
    h.emit("host:deny", guestId);
    await denied;
    expect(await emptied).toHaveLength(0);
  } finally {
    await closeAll(sockets);
  }
});

test("I19 @regression host mute/kick/lock/end, non-host ignored", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i19-host", "I19 Host");
    const memberCookie = await signup(pw, "i19-member", "I19 Member");
    const { code } = await createRoom(pw, hostCookie, { name: "control", kind: "instant" });
    const h = (await connect(hostCookie)).socket!;
    const m = (await connect(memberCookie)).socket!;
    sockets.push(h, m);
    await join(h, code);
    await join(m, code);

    let lockedByMember = false;
    h.once("room:locked" as never, (() => (lockedByMember = true)) as never);
    m.emit("host:lock", true);
    await sleep(400);
    expect(lockedByMember).toBe(false);

    const muted = waitEvent<void>(m, "host:muted");
    h.emit("host:mute", m.id!);
    await muted;

    const locked = waitEvent<boolean>(m, "room:locked");
    h.emit("host:lock", true);
    expect(await locked).toBe(true);
    const late = (await connect(await signup(pw, "i19-late", "I19 Late"))).socket!;
    sockets.push(late);
    expect(await join(late, code)).toEqual({ ok: false, error: "locked" });

    const kicked = waitEvent<void>(m, "kicked");
    const left = waitEvent<string>(h, "peer:left");
    h.emit("host:kick", m.id!);
    await kicked;
    expect(await left).toBe(m.id);

    // unlock so late can join, then end reaches everyone in the room
    h.emit("host:lock", false);
    expect(await join(late, code)).toEqual(
      expect.objectContaining({ status: "admitted" }),
    );

    const endedH = waitEvent<void>(h, "room:ended");
    const endedLate = waitEvent<void>(late, "room:ended");
    h.emit("host:end");
    await endedH;
    await endedLate;
  } finally {
    await closeAll(sockets);
  }
});

test("I20 admitted guest reconnects without re-admission", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i20-host", "I20 Host");
    const { code } = await createRoom(pw, hostCookie, { name: "return", kind: "instant" });
    const h = (await connect(hostCookie)).socket!;
    sockets.push(h);
    await join(h, code);

    const guestCookie = await guest(pw);
    const g1 = (await connect(guestCookie)).socket!;
    const waiting = waitEvent<Peer[]>(h, "waiting:update");
    expect(await join(g1, code)).toEqual({ ok: true, status: "waiting" });
    const guestId = (await waiting)[0].id;
    const admitted = waitEvent<{ status: string }>(g1, "admitted");
    h.emit("host:admit", guestId);
    expect((await admitted).status).toBe("admitted");
    g1.close();
    await sleep(300);

    const g2 = (await connect(guestCookie)).socket!;
    sockets.push(g2);
    const r = await join(g2, code);
    expect(r).toEqual(expect.objectContaining({ status: "admitted" }));
  } finally {
    await closeAll(sockets);
  }
});

test("I21 @regression signal relays only within the room", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i21-host", "I21 Host");
    const memberCookie = await signup(pw, "i21-member", "I21 Member");
    const { code: c1 } = await createRoom(pw, hostCookie, { name: "r1", kind: "instant" });
    const { code: c2 } = await createRoom(pw, hostCookie, { name: "r2", kind: "instant" });

    const a = (await connect(hostCookie)).socket!;
    const b = (await connect(memberCookie)).socket!;
    const c = (await connect(await signup(pw, "i21-other", "I21 Other"))).socket!;
    sockets.push(a, b, c);
    await join(a, c1);
    await join(b, c1);
    await join(c, c2);

    const got = waitEvent<[string, { candidate?: unknown }]>(b, "signal");
    let cGot = false;
    c.once("signal" as never, (() => (cGot = true)) as never);
    a.emit("signal", b.id!, { candidate: { candidate: "c", sdpMid: "0", sdpMLineIndex: 0 } });
    const [from] = await got;
    expect(from).toBe(a.id);
    await sleep(400);
    expect(cGot).toBe(false);
  } finally {
    await closeAll(sockets);
  }
});

test("I22 @regression disconnect notifies peers", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i22-host", "I22 Host");
    const memberCookie = await signup(pw, "i22-member", "I22 Member");
    const { code } = await createRoom(pw, hostCookie, { name: "bye", kind: "instant" });
    const a = (await connect(hostCookie)).socket!;
    const b = (await connect(memberCookie)).socket!;
    sockets.push(a);
    await join(a, code);
    await join(b, code);

    const left = waitEvent<string>(a, "peer:left");
    const bId = b.id!;
    b.close();
    expect(await left).toBe(bId);
  } finally {
    await closeAll(sockets);
  }
});

test("I10 room state drops after last leave, lock resets", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i10-host", "I10 Host");
    const { code } = await createRoom(pw, hostCookie, { name: "ephemeral", kind: "instant" });
    const h = (await connect(hostCookie)).socket!;
    sockets.push(h);
    await join(h, code);
    h.emit("host:lock", true);
    h.emit("room:leave");
    await sleep(300);

    const h2 = (await connect(hostCookie)).socket!;
    sockets.push(h2);
    const r = await join(h2, code);
    expect(r).toEqual(expect.objectContaining({ status: "admitted" }));
    if (r.ok && r.status === "admitted") {
      expect(r.locked).toBe(false);
    } else {
      throw new Error(`expected admitted, got ${JSON.stringify(r)}`);
    }
  } finally {
    await closeAll(sockets);
  }
});

test("I26b member admits in later room, uppercase code joins", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i26-host", "I26 Host");
    const memberCookie = await signup(pw, "i26-member", "I26 Member");
    const { code } = await createRoom(pw, hostCookie, { name: "later", kind: "later" });

    const h = (await connect(hostCookie)).socket!;
    const m = (await connect(memberCookie)).socket!;
    sockets.push(h, m);
    // uppercase variant normalizes on join
    expect(await join(h, code.toUpperCase())).toEqual(
      expect.objectContaining({ status: "admitted" }),
    );
    expect(await join(m, code)).toEqual(expect.objectContaining({ status: "admitted" }));

    const g = (await connect(await guest(pw))).socket!;
    sockets.push(g);
    const waiting = waitEvent<Peer[]>(h, "waiting:update");
    expect(await join(g, code)).toEqual({ ok: true, status: "waiting" });
    const guestId = (await waiting)[0].id;

    const admitted = waitEvent<{ status: string }>(g, "admitted");
    m.emit("host:admit", guestId);
    expect((await admitted).status).toBe("admitted");
  } finally {
    await closeAll(sockets);
  }
});

test("I34 @regression socket ack errors are catalogue codes", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const hostCookie = await signup(pw, "i34-host", "I34 Host");
    const memberCookie = await signup(pw, "i34-member", "I34 Member");
    const { code } = await createRoom(pw, hostCookie, { name: "catalogue", kind: "instant" });
    const h = (await connect(hostCookie)).socket!;
    sockets.push(h);

    const seen: string[] = [];
    const r1 = await join(h, "zzz-yyyy-xxx");
    if (!r1.ok) seen.push(r1.error);
    h.emit("host:lock", true);
    const m = (await connect(memberCookie)).socket!;
    sockets.push(m);
    const r2 = await join(m, code);
    if (!r2.ok) seen.push(r2.error);
    expect(seen.length).toBeGreaterThan(0);
    for (const code of seen) {
      expect(ERROR_CODES).toContain(code);
    }
  } finally {
    await closeAll(sockets);
  }
});

function joinHere(socket: Sock, code: string, here: "switch" | "also"): Promise<JoinResult> {
  return new Promise((resolve) => socket.emit("room:join", code, { here }, (r) => resolve(r)));
}

test("I37 @regression same account twice: ask first; switch moves the call, also keeps both", async ({ playwright }) => {
  const pw = playwright as unknown as PW;
  const sockets: (Sock | undefined)[] = [];
  try {
    const cookie = await signup(pw, "i37", "I37 User");
    const other = await signup(pw, "i37-other", "I37 Other");
    const { code } = await createRoom(pw, cookie, { name: "two tabs", kind: "instant" });
    const [a, b, c, o] = await Promise.all([cookie, cookie, cookie, other].map(async (k) => (await connect(k)).socket!));
    sockets.push(a, b, c, o);

    expect((await join(a, code)).ok).toBe(true);
    expect((await join(o, code)).ok).toBe(true);
    expect(await join(b, code)).toEqual({ ok: false, error: "in_other_tab" });

    const moved = waitEvent(a, "moved");
    const left = waitEvent<string>(o, "peer:left");
    const r = await joinHere(b, code, "switch");
    expect(r.ok && r.status === "admitted").toBe(true);
    await moved;
    expect(await left).toBe(a.id);

    const also = await joinHere(c, code, "also");
    expect(also.ok && also.status === "admitted" && also.peers.map((p) => p.id).sort()).toEqual([b.id, o.id].sort());
  } finally {
    await closeAll(sockets);
  }
});
