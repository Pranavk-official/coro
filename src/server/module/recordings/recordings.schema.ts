import { z } from "zod";

export const createRecordingSchema = z.object({
  roomCode: z.string().min(1).max(32),
  roomName: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  bytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export const attachDriveSchema = z.object({ driveFileId: z.string().min(1).max(200) });

export type CreateRecordingInput = z.infer<typeof createRecordingSchema>;
