-- Add pyramid hierarchy fields to ContentAssertion
ALTER TABLE "ContentAssertion" ADD COLUMN IF NOT EXISTS "depth" INTEGER;
ALTER TABLE "ContentAssertion" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "ContentAssertion" ADD COLUMN IF NOT EXISTS "orderIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentAssertion" ADD COLUMN IF NOT EXISTS "topicSlug" TEXT;

-- Self-referential FK for tree structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ContentAssertion_parentId_fkey'
  ) THEN
    ALTER TABLE "ContentAssertion" ADD CONSTRAINT "ContentAssertion_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "ContentAssertion"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS "ContentAssertion_parentId_idx" ON "ContentAssertion"("parentId");
CREATE INDEX IF NOT EXISTS "ContentAssertion_depth_idx" ON "ContentAssertion"("depth");
CREATE INDEX IF NOT EXISTS "ContentAssertion_topicSlug_idx" ON "ContentAssertion"("topicSlug");

-- Add teachingDepth to Subject
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "teachingDepth" INTEGER;
