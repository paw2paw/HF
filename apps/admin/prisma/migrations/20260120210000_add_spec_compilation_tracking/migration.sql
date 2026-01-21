-- Add compilation tracking fields to AnalysisSpec (mapped as BddFeature)
ALTER TABLE "BddFeature" ADD COLUMN "compiledAt" TIMESTAMP(3);
ALTER TABLE "BddFeature" ADD COLUMN "compiledSetId" TEXT;
ALTER TABLE "BddFeature" ADD COLUMN "isDirty" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BddFeature" ADD COLUMN "dirtyReason" TEXT;

-- Add locking fields
ALTER TABLE "BddFeature" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BddFeature" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "BddFeature" ADD COLUMN "lockedReason" TEXT;
ALTER TABLE "BddFeature" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

-- Create indexes
CREATE INDEX "BddFeature_compiledSetId_idx" ON "BddFeature"("compiledSetId");
CREATE INDEX "BddFeature_isLocked_idx" ON "BddFeature"("isLocked");
