-- CreateTable
CREATE TABLE "recording" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "destinations" TEXT[],
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recording_userId_createdAt_idx" ON "recording"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "recording" ADD CONSTRAINT "recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
