-- PlaybookSource: direct Playbook → ContentSource link
-- Replaces the 4-hop Subject chain for content scoping
CREATE TABLE "PlaybookSource" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY['content']::TEXT[],
    "trustLevelOverride" "ContentTrustLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookSource_pkey" PRIMARY KEY ("id")
);

-- Unique constraint + indexes
CREATE UNIQUE INDEX "PlaybookSource_playbookId_sourceId_key" ON "PlaybookSource"("playbookId", "sourceId");
CREATE INDEX "PlaybookSource_playbookId_idx" ON "PlaybookSource"("playbookId");
CREATE INDEX "PlaybookSource_sourceId_idx" ON "PlaybookSource"("sourceId");

-- Foreign keys
ALTER TABLE "PlaybookSource" ADD CONSTRAINT "PlaybookSource_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaybookSource" ADD CONSTRAINT "PlaybookSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Curriculum.playbookId: direct course → curriculum link
ALTER TABLE "Curriculum" ADD COLUMN "playbookId" TEXT;
CREATE INDEX "Curriculum_playbookId_idx" ON "Curriculum"("playbookId");
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- BACKFILL: Populate PlaybookSource from existing PlaybookSubject → SubjectSource chain
-- ============================================================================
INSERT INTO "PlaybookSource" ("id", "playbookId", "sourceId", "sortOrder", "tags", "trustLevelOverride", "createdAt")
SELECT
    gen_random_uuid(),
    ps."playbookId",
    ss."sourceId",
    ss."sortOrder",
    ss."tags",
    ss."trustLevelOverride",
    NOW()
FROM "PlaybookSubject" ps
JOIN "SubjectSource" ss ON ps."subjectId" = ss."subjectId"
ON CONFLICT ("playbookId", "sourceId") DO NOTHING;

-- ============================================================================
-- BACKFILL: Populate Curriculum.playbookId from PlaybookSubject chain
-- ============================================================================
UPDATE "Curriculum" c
SET "playbookId" = (
    SELECT ps."playbookId"
    FROM "PlaybookSubject" ps
    WHERE ps."subjectId" = c."subjectId"
    ORDER BY ps."createdAt" ASC
    LIMIT 1
)
WHERE c."subjectId" IS NOT NULL AND c."playbookId" IS NULL;
