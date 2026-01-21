-- DropForeignKey
ALTER TABLE "TranscriptBatch" DROP CONSTRAINT IF EXISTS "TranscriptBatch_processedFileId_fkey";

-- DropTable
DROP TABLE IF EXISTS "TranscriptBatch";

-- AddColumns to ProcessedFile for extraction stats
ALTER TABLE "ProcessedFile" ADD COLUMN IF NOT EXISTS "callsExtracted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProcessedFile" ADD COLUMN IF NOT EXISTS "callsFailed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProcessedFile" ADD COLUMN IF NOT EXISTS "usersCreated" INTEGER NOT NULL DEFAULT 0;
