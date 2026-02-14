-- Add extendsAgent column to AnalysisSpec (BddFeature table)
-- For overlay IDENTITY specs that extend a base archetype (e.g., TUT-001)
ALTER TABLE "BddFeature" ADD COLUMN IF NOT EXISTS "extendsAgent" TEXT;

-- Index for lookup during prompt composition merge
CREATE INDEX IF NOT EXISTS "BddFeature_extendsAgent_idx" ON "BddFeature"("extendsAgent");
