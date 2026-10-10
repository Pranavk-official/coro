import { roomUrl, type CalendarRoom } from "./ics";

function toGoogleDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

export function googleCalendarUrl(room: CalendarRoom, base: string): string {
  const startIso = room.startsAt ?? room.createdAt ?? new Date().toISOString();
  const start = new Date(startIso).getTime();
  const endIso = room.expiresAt ?? new Date(start + 3600 * 1000).toISOString();
  const url = roomUrl(room, base);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: room.name,
    dates: `${toGoogleDate(startIso)}/${toGoogleDate(endIso)}`,
    details: url,
    location: url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
