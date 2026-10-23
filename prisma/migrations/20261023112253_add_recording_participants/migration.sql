-- CreateTable
CREATE TABLE "recording_participant" (
    "recordingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "recording_participant_pkey" PRIMARY KEY ("recordingId","userId")
);

-- CreateIndex
CREATE INDEX "recording_participant_userId_idx" ON "recording_participant"("userId");

-- AddForeignKey
ALTER TABLE "recording_participant" ADD CONSTRAINT "recording_participant_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_participant" ADD CONSTRAINT "recording_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
