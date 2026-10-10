export type RoomStatus = "live" | "scheduled" | "expired" | "ended";

export type RoomLike = {
  startsAt: Date | null;
  expiresAt: Date | null;
  endedAt: Date | null;
};

export function roomStatus(room: RoomLike, now: Date = new Date()): RoomStatus {
  if (room.endedAt) return "ended";
  if (room.expiresAt && room.expiresAt < now) return "expired";
  if (room.startsAt && room.startsAt > now) return "scheduled";
  return "live";
}
