-- Add PARTIAL to ProcessingStatus enum
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

-- Create FailedCallErrorType enum
DO $$ BEGIN
    CREATE TYPE "FailedCallErrorType" AS ENUM ('NO_TRANSCRIPT', 'INVALID_FORMAT', 'DUPLICATE', 'DB_ERROR', 'NO_CUSTOMER', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create FailedCall table
CREATE TABLE IF NOT EXISTS "FailedCall" (
    "id" TEXT NOT NULL,
    "processedFileId" TEXT NOT NULL,
    "callIndex" INTEGER NOT NULL,
    "externalId" TEXT,
    "errorType" "FailedCallErrorType" NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedCall_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "FailedCall_processedFileId_idx" ON "FailedCall"("processedFileId");
CREATE INDEX IF NOT EXISTS "FailedCall_errorType_idx" ON "FailedCall"("errorType");
CREATE INDEX IF NOT EXISTS "FailedCall_resolvedAt_idx" ON "FailedCall"("resolvedAt");

-- Add foreign key constraint
ALTER TABLE "FailedCall" DROP CONSTRAINT IF EXISTS "FailedCall_processedFileId_fkey";
ALTER TABLE "FailedCall" ADD CONSTRAINT "FailedCall_processedFileId_fkey"
    FOREIGN KEY ("processedFileId") REFERENCES "ProcessedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
