import type { toPublicRoom } from "@/server/module/rooms/rooms.service";

export type PublicRoom = ReturnType<typeof toPublicRoom>;

export type RoomKind = "instant" | "scheduled" | "later";

export type CreateRoomBody = {
  name: string;
  kind: RoomKind;
  startsAt?: string;
  expiresAt?: string;
  password?: string;
  allowGuests?: boolean;
};

export type PatchRoomBody = {
  name?: string;
  expiresAt?: string | null;
  password?: string | null;
  allowGuests?: boolean;
};
