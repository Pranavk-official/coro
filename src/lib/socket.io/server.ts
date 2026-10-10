import type { Server, Socket } from "socket.io";
import { getSocketUser } from "@/lib/socket.io/auth";
import {
  MAX_PEERS,
  MAX_WAITING,
  READMIT_WINDOW_MS,
  type ClientToServerEvents,
  type Peer,
  type ServerToClientEvents,
  type SocketData,
} from "@/lib/socket.io/events";
import { dropRoomState, getRoomState, type CachedRoom, type RoomStates } from "@/lib/socket.io/rooms";
import { verifyJoinToken } from "@/server/module/rooms/join-token";
import { canAdmit, isHost } from "@/server/module/rooms/guards";
import { normalizeCode } from "@/lib/utils/meeting-code";
import { getLimit, type LimitName } from "@/lib/rate-limit/config";
import { limit } from "@/lib/rate-limit/limit";
import { clientIp } from "@/lib/rate-limit/ip";
import { socketLimit } from "@/lib/rate-limit/socket";
import { hashIp, rl } from "@/lib/redis/keys";

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export type SignalingOpts = {
  base: string;
  internalSecret: string;
  tokenSecret: string;
};

const waitingRoom = (code: string) => `${code}:waiting`;

function peerOf(room: CachedRoom, socket: TypedSocket): Peer {
  const user = socket.data.user;
  return {
    id: socket.id,
    userId: user.id,
    name: user.name,
    image: user.image,
    isGuest: user.isAnonymous,
    isHost: isHost(user, room),
    state: socket.data.state,
  };
}

function emitWaiting(io: TypedServer, states: RoomStates, code: string): void {
  const state = states.get(code);
  if (!state) return;
  const waiting = [...state.waiting.values()];
  for (const [, s] of io.sockets.sockets) {
    const sock = s as TypedSocket;
    if (sock.data.room !== code) continue;
    if (canAdmit(sock.data.user, state.room)) {
      sock.emit("waiting:update", waiting);
    }
  }
}

export type AdmittedPayload = {
  ok: true;
  status: "admitted";
  peers: Peer[];
  polite: boolean;
  locked: boolean;
  canAdmit: boolean;
  isHost: boolean;
};

function admittedPayload(
  io: TypedServer,
  state: { room: CachedRoom; locked: boolean },
  socket: TypedSocket,
): AdmittedPayload {
  const peers: Peer[] = [];
  for (const [, s] of io.sockets.sockets) {
    const sock = s as TypedSocket;
    if (sock.data.room === state.room.code && sock.id !== socket.id) {
      peers.push(peerOf(state.room, sock));
    }
  }
  return {
    ok: true,
    status: "admitted",
    peers,
    polite: true,
    locked: state.locked,
    canAdmit: canAdmit(socket.data.user, state.room),
    isHost: isHost(socket.data.user, state.room),
  };
}

function roomSize(io: TypedServer, code: string): number {
  return io.sockets.adapter.rooms.get(code)?.size ?? 0;
}

function limitFor(event: string): LimitName | null {
  if (event === "room:join") return "sock:join";
  if (event === "signal") return "sock:signal";
  if (event === "state") return "sock:state";
  if (event.startsWith("host:")) return "sock:host";
  return null;
}

export function registerSignaling(io: TypedServer, opts: SignalingOpts): RoomStates {
  const states: RoomStates = new Map();

  io.use(async (socket, next) => {
    // Handshake flood guard per IP, before the session lookup (spec 002 `sock:connect`).
    const ip = hashIp(clientIp(socket.handshake.headers, socket.handshake.address));
    if (!(await limit({ key: rl("sock:connect", ip), ...getLimit("sock:connect") })).ok) {
      next(new Error("rate_limited"));
      return;
    }
    const cookie = socket.handshake.headers.cookie;
    const user = await getSocketUser(opts.base, cookie);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = user;
    socket.data.state = { mic: true, cam: true, screen: false };
    next();
  });

  io.on("connection", (socket) => {
    // Per-event limits (spec 002 FR6) in one packet middleware, so every new handler is covered.
    // Acked events (room:join) get `{ ok:false, error:"rate_limited", retryAfter }`; others are dropped + `rate_limited`.
    socket.use(([event, ...args], next) => {
      const name = limitFor(event);
      if (!name) return next();
      void socketLimit(socket, name, name === "sock:join" ? socket.data.user.id : socket.id).then((r) => {
        if (r.ok) return next();
        const ack = args[args.length - 1];
        if (typeof ack === "function") ack({ ok: false, error: "rate_limited", retryAfter: r.retryAfter });
        else socket.emit("rate_limited", event, r.retryAfter);
      });
    });

    // One join at a time per socket: React dev double-effects send a second join before the first ack.
    let joins: Promise<void> = Promise.resolve();
    socket.on("room:join", (...args) => {
      joins = joins.then(() => join(...args)).catch((err) => console.error("[signaling] join failed", err));
    });

    const join = async (...[rawCode, joinOpts, cb]: Parameters<ClientToServerEvents["room:join"]>) => {
      const normalized = normalizeCode(rawCode);
      if (!normalized) {
        cb({ ok: false, error: "not_found" });
        return;
      }
      const code = normalized;
      const state = await getRoomState(states, opts.base, opts.internalSecret, code);
      if (!state) {
        cb({ ok: false, error: "not_found" });
        return;
      }
      // Time's up ends the call for everyone (the join check alone only stops new joins).
      // shortcut: uses the expiry cached when the room went active; a later PATCH applies once the room empties.
      const msLeft = state.room.expiresAt ? new Date(state.room.expiresAt).getTime() - Date.now() : 0;
      if (!state.expiryTimer && msLeft > 0 && msLeft < 2 ** 31 - 1) {
        state.expiryTimer = setTimeout(() => endRoom(io, states, code), msLeft);
      }
      if (socket.data.room === code) {
        cb(admittedPayload(io, state, socket)); // repeat join: same answer, no second peer:joined
        return;
      }
      if (state.waiting.has(socket.id)) {
        cb({ ok: true, status: "waiting" });
        return;
      }
      const room = state.room;
      const user = socket.data.user;
      const host = isHost(user, room);
      const now = new Date();

      if (room.endedAt) {
        cb({ ok: false, error: "ended" });
        return;
      }
      if (room.expiresAt && new Date(room.expiresAt) < now) {
        cb({ ok: false, error: "expired" });
        return;
      }
      if (room.hasPassword && !host) {
        const token = joinOpts?.joinToken;
        if (!token || !verifyJoinToken(opts.tokenSecret, token, code, user.id)) {
          cb({ ok: false, error: "password_required" });
          return;
        }
      }
      if (user.isAnonymous && !room.allowGuests) {
        cb({ ok: false, error: "guests_not_allowed" });
        return;
      }
      if (state.locked && !host) {
        cb({ ok: false, error: "locked" });
        return;
      }
      // Same account already in the call (other tab/device): ask first, like Meet's "Switch here".
      if (!user.isAnonymous) {
        const mine = [...io.sockets.sockets.values()].filter(
          (s) => s.id !== socket.id && (s as TypedSocket).data.room === code && (s as TypedSocket).data.user.id === user.id,
        ) as TypedSocket[];
        if (mine.length > 0 && !joinOpts?.here) {
          cb({ ok: false, error: "in_other_tab" });
          return;
        }
        if (joinOpts?.here === "switch") {
          for (const old of mine) {
            old.data.room = undefined;
            await old.leave(code);
            io.to(code).emit("peer:left", old.id);
            old.emit("moved");
          }
        }
      }
      if (roomSize(io, code) >= MAX_PEERS) {
        cb({ ok: false, error: "room_full" });
        return;
      }

      const remembered = state.recentlyAdmitted.get(user.id) ?? 0;
      const readmitted = Date.now() - remembered < READMIT_WINDOW_MS;
      if (user.isAnonymous && !readmitted) {
        if (state.waiting.size >= MAX_WAITING) {
          cb({ ok: false, error: "room_full" });
          return;
        }
        await socket.join(waitingRoom(code));
        state.waiting.set(socket.id, peerOf(room, socket));
        cb({ ok: true, status: "waiting" });
        emitWaiting(io, states, code);
        return;
      }

      state.waiting.delete(socket.id);
      state.recentlyAdmitted.delete(user.id);
      await socket.join(code);
      socket.data.room = code;
      const payload = admittedPayload(io, state, socket);
      cb(payload);
      socket.to(code).emit("peer:joined", peerOf(room, socket));
    };

    socket.on("room:peek", (rawCode, cb) => {
      const code = normalizeCode(rawCode);
      const byUser = new Map<string, string>();
      if (code) {
        for (const [, s] of io.sockets.sockets) {
          const sock = s as TypedSocket;
          if (sock.data.room === code && sock.id !== socket.id) byUser.set(sock.data.user.id, sock.data.user.name);
        }
      }
      cb({ count: byUser.size, names: [...byUser.values()].slice(0, 3) }); // first few names are enough for the label
    });

    socket.on("room:leave", async () => {
      await leaveAll(io, states, socket);
    });

    socket.on("signal", (to, data) => {
      const target = io.sockets.sockets.get(to) as TypedSocket | undefined;
      if (!target) return;
      if (!socket.data.room || target.data.room !== socket.data.room) return;
      target.emit("signal", socket.id, data);
    });

    // Room this socket last took the presenter slot in (spec 007 FR6): takeover fires once per share, not per mic toggle.
    let presentingIn: string | undefined;
    socket.on("state", (media) => {
      socket.data.state = media;
      const code = socket.data.room;
      if (!media.screen) presentingIn = undefined;
      if (!code) return;
      if (media.screen && presentingIn !== code) {
        presentingIn = code;
        for (const [, s] of io.sockets.sockets) {
          const other = s as TypedSocket;
          if (other.id !== socket.id && other.data.room === code && other.data.state.screen) other.emit("share:stop", "takeover");
        }
      }
      socket.to(code).emit("peer:state", socket.id, media);
    });

    socket.on("host:admit", async (id) => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!canAdmit(socket.data.user, state.room)) return;
      if (!state.waiting.has(id)) return;
      if (roomSize(io, code) >= MAX_PEERS) return;
      const target = io.sockets.sockets.get(id) as TypedSocket | undefined;
      if (!target) {
        state.waiting.delete(id);
        emitWaiting(io, states, code);
        return;
      }
      await target.leave(waitingRoom(code));
      state.waiting.delete(id);
      await target.join(code);
      target.data.room = code;
      target.emit("admitted", admittedPayload(io, state, target));
      io.to(code).emit("peer:joined", peerOf(state.room, target));
      emitWaiting(io, states, code);
    });

    socket.on("host:deny", async (id) => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!canAdmit(socket.data.user, state.room)) return;
      if (!state.waiting.has(id)) return;
      const target = io.sockets.sockets.get(id) as TypedSocket | undefined;
      state.waiting.delete(id);
      if (target) {
        await target.leave(waitingRoom(code));
        target.emit("denied");
      }
      emitWaiting(io, states, code);
    });

    socket.on("host:mute", (id) => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!isHost(socket.data.user, state.room)) return;
      const target = io.sockets.sockets.get(id) as TypedSocket | undefined;
      if (!target || target.data.room !== code) return;
      target.emit("host:muted");
    });

    socket.on("host:stop-share", (id) => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!isHost(socket.data.user, state.room)) return;
      const target = io.sockets.sockets.get(id) as TypedSocket | undefined;
      if (!target || target.data.room !== code || !target.data.state.screen) return;
      target.emit("share:stop", "host");
    });

    socket.on("host:kick", async (id) => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!isHost(socket.data.user, state.room)) return;
      const target = io.sockets.sockets.get(id) as TypedSocket | undefined;
      if (!target || target.data.room !== code) return;
      target.emit("kicked");
      target.data.room = undefined;
      await target.leave(code);
      io.to(code).emit("peer:left", id);
      if (roomSize(io, code) === 0 && roomSize(io, waitingRoom(code)) === 0) {
        dropRoomState(states, code);
      }
    });

    socket.on("host:lock", (locked) => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!isHost(socket.data.user, state.room)) return;
      state.locked = locked;
      io.to(code).emit("room:locked", locked);
    });

    socket.on("host:end", async () => {
      const code = socket.data.room;
      const state = code ? states.get(code) : undefined;
      if (!code || !state) return;
      if (!isHost(socket.data.user, state.room)) return;
      endRoom(io, states, code);
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        if (room.endsWith(":waiting")) {
          const code = room.slice(0, -":waiting".length);
          const state = states.get(code);
          if (state) {
            state.waiting.delete(socket.id);
            emitWaiting(io, states, code);
          }
          continue;
        }
        const state = states.get(room);
        if (state) {
          state.recentlyAdmitted.set(socket.data.user.id, Date.now());
          socket.to(room).emit("peer:left", socket.id);
        }
      }
      socket.data.room = undefined;
    });

    socket.on("disconnect", async () => {
      for (const [code] of states) {
        if (roomSize(io, code) === 0 && roomSize(io, waitingRoom(code)) === 0) {
          dropRoomState(states, code);
        }
      }
    });
  });

  return states;
}

function endRoom(io: TypedServer, states: RoomStates, code: string): void {
  io.to(code).to(waitingRoom(code)).emit("room:ended");
  for (const [, s] of io.sockets.sockets) if ((s as TypedSocket).data.room === code) (s as TypedSocket).data.room = undefined;
  io.in(code).socketsLeave(code);
  io.in(waitingRoom(code)).socketsLeave(waitingRoom(code));
  dropRoomState(states, code);
}

async function leaveAll(io: TypedServer, states: RoomStates, socket: TypedSocket): Promise<void> {
  const code = socket.data.room;
  if (code) {
    const state = states.get(code);
    if (state) state.recentlyAdmitted.set(socket.data.user.id, Date.now());
    socket.data.room = undefined;
    await socket.leave(code);
    socket.to(code).emit("peer:left", socket.id);
    if (roomSize(io, code) === 0 && roomSize(io, waitingRoom(code)) === 0) {
      dropRoomState(states, code);
    }
  }
  for (const [c, state] of states) {
    const w = waitingRoom(c);
    if (state.waiting.delete(socket.id)) {
      await socket.leave(w);
      emitWaiting(io, states, c);
    }
  }
}
