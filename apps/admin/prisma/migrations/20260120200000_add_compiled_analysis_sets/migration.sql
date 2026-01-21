-- Add enrichment fields to Parameter
ALTER TABLE "Parameter" ADD COLUMN "enrichedHigh" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "enrichedLow" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "enrichedAt" TIMESTAMP(3);
ALTER TABLE "Parameter" ADD COLUMN "enrichmentChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add locking fields to AnalysisProfile (mapped as ParameterSet)
ALTER TABLE "ParameterSet" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ParameterSet" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ParameterSet" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "ParameterSet" ADD COLUMN "lockedReason" TEXT;

-- Create CompilationStatus enum
CREATE TYPE "CompilationStatus" AS ENUM ('DRAFT', 'COMPILING', 'READY', 'ERROR', 'SUPERSEDED');

-- Create CompiledAnalysisSet table
CREATE TABLE "CompiledAnalysisSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "analysisProfileId" TEXT NOT NULL,
    "status" "CompilationStatus" NOT NULL DEFAULT 'DRAFT',
    "compiledAt" TIMESTAMP(3),
    "compiledBy" TEXT,
    "validationErrors" JSONB,
    "validationPassed" BOOLEAN NOT NULL DEFAULT false,
    "specIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ragContext" TEXT,
    "kbChunksUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "measureSpecCount" INTEGER NOT NULL DEFAULT 0,
    "learnSpecCount" INTEGER NOT NULL DEFAULT 0,
    "parameterCount" INTEGER NOT NULL DEFAULT 0,
    "anchorCount" INTEGER NOT NULL DEFAULT 0,
    "parentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompiledAnalysisSet_pkey" PRIMARY KEY ("id")
);

-- Add compiledSetId to AnalysisRun
ALTER TABLE "AnalysisRun" ADD COLUMN "compiledSetId" TEXT;
ALTER TABLE "AnalysisRun" ADD COLUMN "metadata" JSONB;

-- Make analysisProfileId optional on AnalysisRun (can use compiledSet instead)
ALTER TABLE "AnalysisRun" ALTER COLUMN "parameterSetId" DROP NOT NULL;

-- Create indexes
CREATE INDEX "CompiledAnalysisSet_analysisProfileId_idx" ON "CompiledAnalysisSet"("analysisProfileId");
CREATE INDEX "CompiledAnalysisSet_status_idx" ON "CompiledAnalysisSet"("status");
CREATE INDEX "AnalysisRun_compiledSetId_idx" ON "AnalysisRun"("compiledSetId");

-- Add foreign keys
ALTER TABLE "CompiledAnalysisSet" ADD CONSTRAINT "CompiledAnalysisSet_analysisProfileId_fkey"
    FOREIGN KEY ("analysisProfileId") REFERENCES "ParameterSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompiledAnalysisSet" ADD CONSTRAINT "CompiledAnalysisSet_parentVersionId_fkey"
    FOREIGN KEY ("parentVersionId") REFERENCES "CompiledAnalysisSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_compiledSetId_fkey"
    FOREIGN KEY ("compiledSetId") REFERENCES "CompiledAnalysisSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
