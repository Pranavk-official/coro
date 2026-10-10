export type CalendarRoom = {
  code: string;
  name: string;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt?: string;
};

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

export function roomUrl(room: CalendarRoom, base: string): string {
  return `${base.replace(/\/$/, "")}/rooms/${room.code}`;
}

export function buildIcs(room: CalendarRoom, base: string): string {
  const startIso = room.startsAt ?? room.createdAt ?? new Date().toISOString();
  const start = new Date(startIso).getTime();
  const endIso = room.expiresAt ?? new Date(start + 3600 * 1000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//vc-demo//video-conferencing//EN",
    "BEGIN:VEVENT",
    `UID:${room.code}@vc-demo`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(startIso)}`,
    `DTEND:${toUtcStamp(endIso)}`,
    `SUMMARY:${room.name}`,
    `URL:${roomUrl(room, base)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
