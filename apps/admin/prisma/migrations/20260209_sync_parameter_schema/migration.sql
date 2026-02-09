-- Sync Parameter table schema to match current prisma/schema.prisma
-- Adds missing columns that should exist

-- Make definition nullable (was required, should be optional)
ALTER TABLE "Parameter" ALTER COLUMN "definition" DROP NOT NULL;

-- Add isAdjustable if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'isAdjustable'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "isAdjustable" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END
$$;

-- Add baseParameterId if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'baseParameterId'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "baseParameterId" TEXT;
  END IF;
END
$$;

-- Add goalTarget if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'goalTarget'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "goalTarget" DOUBLE PRECISION;
  END IF;
END
$$;

-- Add goalWindow if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'goalWindow'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "goalWindow" INTEGER;
  END IF;
END
$$;

-- Add enrichment fields if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'enrichedHigh'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "enrichedHigh" TEXT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'enrichedLow'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "enrichedLow" TEXT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'enrichedAt'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "enrichedAt" TIMESTAMP(3);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'enrichmentChunkIds'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "enrichmentChunkIds" TEXT[];
  END IF;
END
$$;

-- Add sourceFeatureSetId if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'sourceFeatureSetId'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "sourceFeatureSetId" TEXT;
  END IF;
END
$$;

-- Add registry fields if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'isCanonical'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "isCanonical" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'deprecatedAt'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "deprecatedAt" TIMESTAMP(3);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'replacedBy'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "replacedBy" TEXT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'aliases'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Parameter' AND column_name = 'defaultTarget'
  ) THEN
    ALTER TABLE "Parameter" ADD COLUMN "defaultTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
  END IF;
END
$$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS "Parameter_isCanonical_idx" ON "Parameter"("isCanonical");
CREATE INDEX IF NOT EXISTS "Parameter_deprecatedAt_idx" ON "Parameter"("deprecatedAt");
CREATE INDEX IF NOT EXISTS "Parameter_domainGroup_idx" ON "Parameter"("domainGroup");
CREATE INDEX IF NOT EXISTS "Parameter_sourceFeatureSetId_idx" ON "Parameter"("sourceFeatureSetId");
