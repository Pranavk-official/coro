import { prisma } from "@/lib/prisma/client";
import type { CreateRoomInput, PatchRoomInput } from "@/server/module/rooms/rooms.schema";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/server/shared/errors";
import { hashPassword, verifyPassword } from "@/server/module/rooms/password";
import { signJoinToken } from "@/server/module/rooms/join-token";
import { isHost } from "@/server/module/rooms/guards";
import { roomStatus } from "@/server/module/rooms/status";
import { generateCode } from "@/server/module/rooms/code";
import { bust, cached } from "@/lib/redis/cache";
import { cacheKey } from "@/lib/redis/keys";

// Read cache (spec 002 plan §6): short TTLs, busted on every write below.
const ROOM_TTL = 10;
const ROOM_INT_TTL = 30;
const LIST_TTL = 30;
const bustRoom = (code: string, hostId: string) =>
  bust(cacheKey("room", code), cacheKey("room-int", code), cacheKey("rooms-list", hostId));

export type RoomRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  hostId: string;
  passwordHash: string | null;
  allowGuests: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
};

export function toPublicRoom(room: RoomRow) {
  return {
    code: room.code,
    name: room.name,
    kind: room.kind,
    hostId: room.hostId,
    hasPassword: room.passwordHash !== null,
    allowGuests: room.allowGuests,
    startsAt: room.startsAt?.toISOString() ?? null,
    expiresAt: room.expiresAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    status: roomStatus(room),
  };
}

export async function listRooms(hostId: string) {
  return cached(cacheKey("rooms-list", hostId), LIST_TTL, async () => {
    const list = await prisma.room.findMany({
      // Expired rooms drop off the lobby; the row stays so old links still say "expired", not "not found".
      where: { hostId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: "desc" },
    });
    return list.map(toPublicRoom);
  });
}

export async function createRoom(hostId: string, input: CreateRoomInput) {
  const instant = input.kind === "instant";
  const later = input.kind === "later";
  const room = await prisma.room.create({
    data: {
      code: await uniqueCode(),
      name: input.name,
      kind: input.kind,
      hostId,
      passwordHash: instant || later || !input.password ? null : await hashPassword(input.password),
      allowGuests: instant || later ? true : (input.allowGuests ?? true),
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt
        ? new Date(input.expiresAt)
        : instant
          ? new Date(Date.now() + 24 * 3600 * 1000)
          : later
            ? new Date(Date.now() + 30 * 24 * 3600 * 1000)
            : null,
    },
  });
  await bust(cacheKey("rooms-list", hostId));
  return toPublicRoom(room);
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("room code allocation failed");
}

async function getRoomRowOrThrow(code: string): Promise<RoomRow> {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new NotFoundError();
  return room;
}

export async function getRoom(code: string) {
  return cached(cacheKey("room", code), ROOM_TTL, async () => toPublicRoom(await getRoomRowOrThrow(code)));
}

export function getInternalRoom(code: string) {
  return cached(cacheKey("room-int", code), ROOM_INT_TTL, () => loadInternalRoom(code));
}

async function loadInternalRoom(code: string) {
  const room = await getRoomRowOrThrow(code);
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    kind: room.kind,
    hostId: room.hostId,
    hasPassword: room.passwordHash !== null,
    allowGuests: room.allowGuests,
    startsAt: room.startsAt?.toISOString() ?? null,
    expiresAt: room.expiresAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
  };
}

function requireHost(userId: string, room: { hostId: string }) {
  if (!isHost({ id: userId }, room)) {
    throw new ForbiddenError();
  }
}

export async function updateRoom(userId: string, code: string, input: PatchRoomInput) {
  const room = await getRoomRowOrThrow(code);
  requireHost(userId, room);
  const updated = await prisma.room.update({
    where: { code: room.code },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.password !== undefined
        ? { passwordHash: input.password ? await hashPassword(input.password) : null }
        : {}),
      ...(input.allowGuests !== undefined ? { allowGuests: input.allowGuests } : {}),
    },
  });
  await bustRoom(room.code, room.hostId);
  return toPublicRoom(updated);
}

export async function verifyRoomPassword(
  userId: string,
  code: string,
  password: string,
): Promise<{ joinToken: string }> {
  const room = await getRoomRowOrThrow(code);
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  if (room.passwordHash && !isHost({ id: userId }, room)) {
    const ok = await verifyPassword(password, room.passwordHash);
    if (!ok) throw new UnauthorizedError("wrong_password", "Wrong password.");
  }
  return { joinToken: signJoinToken(secret, room.code, userId) };
}

export async function endRoom(userId: string, code: string) {
  const room = await getRoomRowOrThrow(code);
  requireHost(userId, room);
  // Instant meetings are throwaway: ending one removes it. Scheduled/later rooms keep an "ended" record.
  if (room.kind === "instant") await prisma.room.delete({ where: { code: room.code } });
  else await prisma.room.update({ where: { code: room.code }, data: { endedAt: new Date() } });
  await bustRoom(room.code, room.hostId);
}

export async function deleteRoom(userId: string, code: string) {
  const room = await getRoomRowOrThrow(code);
  requireHost(userId, room);
  await prisma.room.delete({ where: { code: room.code } });
  await bustRoom(room.code, room.hostId);
}
