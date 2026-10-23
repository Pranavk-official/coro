import { prisma } from "@/lib/prisma/client";
import { auth } from "@/lib/better-auth/server";
import { shareDriveFile } from "@/lib/google-drive/server";
import type { CreateRecordingInput } from "@/server/module/recordings/recordings.schema";
import { NotFoundError } from "@/server/shared/errors";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const withPeople = {
  user: { select: { name: true } },
  participants: { select: { userId: true, name: true } },
} as const;

type RecordingRow = {
  id: string;
  userId: string;
  roomCode: string;
  roomName: string;
  name: string;
  mimeType: string;
  bytes: number;
  durationMs: number;
  destinations: string[];
  driveFileId: string | null;
  createdAt: Date;
  user: { name: string };
  participants: { userId: string; name: string }[];
};

/** `viewerId`: who asks. Participants see the same row, marked as shared by the recorder. */
export function toPublicRecording(r: RecordingRow, viewerId: string) {
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
    isOwner: r.userId === viewerId,
    recordedBy: r.user.name,
    participants: r.participants.map((p) => p.name),
  };
}

export async function listRecordings(userId: string) {
  const rows = await prisma.recording.findMany({
    where: { OR: [{ userId }, { participants: { some: { userId } } }] },
    include: withPeople,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => toPublicRecording(r, userId));
}

/** Every recording downloads to the device; Drive is added later by `attachDrive` once its upload finishes. */
export async function createRecording(userId: string, { participantIds, ...input }: CreateRecordingInput) {
  // shortcut: ids come from the recorder's client, so only real signed-in accounts are kept; verify against
  // the signaling server's room roster if recorders ever spam strangers' lists.
  const people = await prisma.user.findMany({
    where: { id: { in: participantIds.filter((id) => id !== userId) }, OR: [{ isAnonymous: false }, { isAnonymous: null }] },
    select: { id: true, name: true },
  });
  const row = await prisma.recording.create({
    data: {
      ...input,
      userId,
      destinations: ["device"],
      participants: { create: people.map((p) => ({ userId: p.id, name: p.name })) },
    },
    include: withPeople,
  });
  return toPublicRecording(row, userId);
}

async function own(userId: string, id: string) {
  const row = await prisma.recording.findFirst({ where: { id, userId } });
  if (!row) throw new NotFoundError(); // someone else's id looks the same as a missing one
  return row;
}

export async function attachDrive(userId: string, id: string, driveFileId: string) {
  const row = await own(userId, id);
  const destinations = row.destinations.includes("drive") ? row.destinations : [...row.destinations, "drive"];
  const updated = await prisma.recording.update({ where: { id }, data: { driveFileId, destinations }, include: withPeople });
  await shareWithParticipants(userId, id, driveFileId);
  return toPublicRecording(updated, userId);
}

/** Best effort: the recording is saved either way; a participant without access still sees it listed. */
async function shareWithParticipants(userId: string, recordingId: string, driveFileId: string) {
  const people = await prisma.recordingParticipant.findMany({
    where: { recordingId },
    select: { user: { select: { email: true } } },
  });
  if (!people.length) return;
  try {
    const account = await prisma.account.findFirst({
      where: { userId, providerId: "google", scope: { contains: DRIVE_FILE_SCOPE } },
      select: { id: true },
    });
    if (!account) return;
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
    const failed = await shareDriveFile(accessToken, driveFileId, people.map((p) => p.user.email));
    if (failed.length) console.error("[drive] share failed for", failed.length, "of", people.length, "participants");
  } catch (err) {
    console.error("[drive] share", (err as Error).message);
  }
}

/** Removes the reference only; the file on the device or in Drive is untouched. A participant just leaves the list. */
export async function deleteRecording(userId: string, id: string) {
  const { count } = await prisma.recording.deleteMany({ where: { id, userId } });
  if (count) return;
  const left = await prisma.recordingParticipant.deleteMany({ where: { recordingId: id, userId } });
  if (!left.count) throw new NotFoundError();
}
