"use client";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// On globalThis, not module scope: dev can evaluate this module twice (HMR / separate chunks), and two
// sockets on one connection show up to everyone else as a duplicate "you" in the room.
const g = globalThis as { __vcSocket?: TypedClientSocket };

export function getSocket(): TypedClientSocket {
  g.__vcSocket ??= io({ autoConnect: false });
  return g.__vcSocket;
}
