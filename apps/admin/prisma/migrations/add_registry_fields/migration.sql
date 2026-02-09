-- Add registry fields to Parameter table
-- Makes Parameter table the single source of truth for parameter definitions

ALTER TABLE "Parameter" ADD COLUMN "isCanonical" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Parameter" ADD COLUMN "deprecatedAt" TIMESTAMP(3);
ALTER TABLE "Parameter" ADD COLUMN "replacedBy" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "aliases" TEXT[];
ALTER TABLE "Parameter" ADD COLUMN "defaultTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- Index for queries
CREATE INDEX "Parameter_isCanonical_idx" ON "Parameter"("isCanonical");
CREATE INDEX "Parameter_deprecatedAt_idx" ON "Parameter"("deprecatedAt");
CREATE INDEX "Parameter_domainGroup_idx" ON "Parameter"("domainGroup");
