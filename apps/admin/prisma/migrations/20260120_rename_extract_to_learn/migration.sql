-- Rename EXTRACT to LEARN in AnalysisOutputType enum
-- This reflects the semantic meaning better: "learning" about the caller

-- Add LEARN value to the enum
ALTER TYPE "AnalysisOutputType" ADD VALUE IF NOT EXISTS 'LEARN';

-- Note: PostgreSQL doesn't support removing enum values
-- The EXTRACT value will remain but won't be used
-- Existing EXTRACT records were updated to LEARN via direct SQL
