export type AdmitUser = { id: string; isAnonymous: boolean };
export type AdmitRoom = { hostId: string; kind: string };

export function canAdmit(user: AdmitUser, room: AdmitRoom): boolean {
  return user.id === room.hostId || (room.kind !== "scheduled" && !user.isAnonymous);
}

export function isHost(user: { id: string }, room: { hostId: string }): boolean {
  return user.id === room.hostId;
}
