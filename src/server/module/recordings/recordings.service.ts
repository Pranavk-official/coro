import { prisma } from "@/lib/prisma/client";
import type { CreateRecordingInput } from "@/server/module/recordings/recordings.schema";
import { NotFoundError } from "@/server/shared/errors";

type RecordingRow = {
  id: string;
  roomCode: string;
  roomName: string;
  name: string;
  mimeType: string;
  bytes: number;
  durationMs: number;
  destinations: string[];
  driveFileId: string | null;
  createdAt: Date;
};

export function toPublicRecording(r: RecordingRow) {
  return {
    id: r.id,
    roomCode: r.roomCode,
    roomName: r.roomName,
    name: r.name,
    mimeType: r.mimeType,
    bytes: r.bytes,
    durationMs: r.durationMs,
    destinations: r.destinations,
    driveUrl: r.driveFileId ? `https://drive.google.com/file/d/${r.driveFileId}/view` : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listRecordings(userId: string) {
  const rows = await prisma.recording.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map(toPublicRecording);
}

/** Every recording downloads to the device; Drive is added later by `attachDrive` once its upload finishes. */
export async function createRecording(userId: string, input: CreateRecordingInput) {
  return toPublicRecording(await prisma.recording.create({ data: { ...input, userId, destinations: ["device"] } }));
}

async function own(userId: string, id: string) {
  const row = await prisma.recording.findFirst({ where: { id, userId } });
  if (!row) throw new NotFoundError(); // someone else's id looks the same as a missing one
  return row;
}

export async function attachDrive(userId: string, id: string, driveFileId: string) {
  const row = await own(userId, id);
  const destinations = row.destinations.includes("drive") ? row.destinations : [...row.destinations, "drive"];
  return toPublicRecording(await prisma.recording.update({ where: { id }, data: { driveFileId, destinations } }));
}

/** Removes the reference only; the file on the device or in Drive is untouched. */
export async function deleteRecording(userId: string, id: string) {
  await own(userId, id);
  await prisma.recording.delete({ where: { id } });
}
