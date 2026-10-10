import { roomStatus } from "@/server/module/rooms/status";
import type { Peer } from "@/lib/socket.io/events";

export type CachedRoom = {
  id: string;
  code: string;
  name: string;
  kind: string;
  hostId: string;
  hasPassword: boolean;
  allowGuests: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type RoomState = {
  room: CachedRoom;
  locked: boolean;
  waiting: Map<string, Peer>;
  recentlyAdmitted: Map<string, number>;
  expiryTimer?: ReturnType<typeof setTimeout>;
};

export type RoomStates = Map<string, RoomState>;

export function roomLive(room: CachedRoom, now: Date = new Date()): boolean {
  return (
    roomStatus({
      startsAt: room.startsAt ? new Date(room.startsAt) : null,
      expiresAt: room.expiresAt ? new Date(room.expiresAt) : null,
      endedAt: room.endedAt ? new Date(room.endedAt) : null,
    }, now) === "live"
  );
}

export async function getRoomState(
  states: RoomStates,
  base: string,
  internalSecret: string,
  code: string,
): Promise<RoomState | null> {
  const existing = states.get(code);
  if (existing) return existing;
  let res: Response;
  try {
    res = await fetch(`${base}/api/internal/rooms/${encodeURIComponent(code)}`, {
      headers: { "x-internal-secret": internalSecret },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const room = (await res.json()) as CachedRoom;
  const state: RoomState = {
    room,
    locked: false,
    waiting: new Map(),
    recentlyAdmitted: new Map(),
  };
  states.set(code, state);
  return state;
}

export function dropRoomState(states: RoomStates, code: string): void {
  clearTimeout(states.get(code)?.expiryTimer);
  states.delete(code);
}
