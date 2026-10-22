import type { toPublicRecording } from "@/server/module/recordings/recordings.service";

export type PublicRecording = ReturnType<typeof toPublicRecording>;
