-- Rename BDD tables to AnalysisSpec (using @@map to keep table names)
-- This is a schema evolution, not a table rename

-- Add new columns to BddFeature (mapped as AnalysisSpec)
-- Create the enum first
CREATE TYPE "AnalysisOutputType" AS ENUM ('MEASURE', 'EXTRACT');

-- Add outputType column with default MEASURE
ALTER TABLE "BddFeature" ADD COLUMN "outputType" "AnalysisOutputType" NOT NULL DEFAULT 'MEASURE';

-- Rename category to domain (preserve existing data)
ALTER TABLE "BddFeature" RENAME COLUMN "category" TO "domain";

-- Add new columns to BddAcceptanceCriteria (mapped as AnalysisAction)
-- Make parameterId optional (was required, now only for MEASURE)
ALTER TABLE "BddAcceptanceCriteria" ALTER COLUMN "parameterId" DROP NOT NULL;

-- Add extraction fields for EXTRACT output type
ALTER TABLE "BddAcceptanceCriteria" ADD COLUMN "extractCategory" "MemoryCategory";
ALTER TABLE "BddAcceptanceCriteria" ADD COLUMN "extractKeyPrefix" TEXT;
ALTER TABLE "BddAcceptanceCriteria" ADD COLUMN "extractKeyHint" TEXT;

-- Add index on outputType
CREATE INDEX "BddFeature_outputType_idx" ON "BddFeature"("outputType");
