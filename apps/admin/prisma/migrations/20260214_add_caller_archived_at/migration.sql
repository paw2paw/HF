-- Add archive support to Caller
ALTER TABLE "Caller" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Index for fast filtered queries (active vs archived)
CREATE INDEX IF NOT EXISTS "Caller_archivedAt_idx" ON "Caller"("archivedAt");
