-- Add archive support to ContentSource
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Index for fast filtered queries (active vs archived)
CREATE INDEX IF NOT EXISTS "ContentSource_archivedAt_idx" ON "ContentSource"("archivedAt");
