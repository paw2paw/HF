-- Add extraction tracking fields to ContentSource
-- extractorVersion: bumped when extraction logic changes (null = never extracted or pre-tracking)
-- lastExtractedAt: set on successful extraction completion

ALTER TABLE "ContentSource" ADD COLUMN "extractorVersion" INTEGER;
ALTER TABLE "ContentSource" ADD COLUMN "lastExtractedAt" TIMESTAMP(3);
