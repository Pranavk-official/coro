import type { RoomPeek } from "@/lib/socket.io/events";

/** Meet-style pre-join line: who is already in the call. */
export function presenceLabel(peek: RoomPeek): string {
  const { count, names } = peek;
  if (count === 0) return "No one else is here";
  if (count === 1) return `${names[0] ?? "Someone"} is in this call`;
  if (count === 2 && names.length === 2) return `${names[0]} and ${names[1]} are in this call`;
  const shown = names.slice(0, 2);
  const others = count - shown.length;
  return `${shown.join(", ")} and ${others} other${others === 1 ? "" : "s"} are in this call`;
}
