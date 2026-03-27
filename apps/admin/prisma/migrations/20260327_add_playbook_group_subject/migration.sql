-- CreateTable: PlaybookGroupSubject (department ↔ subject many-to-many)
CREATE TABLE "PlaybookGroupSubject" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookGroupSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaybookGroupSubject_groupId_idx" ON "PlaybookGroupSubject"("groupId");
CREATE INDEX "PlaybookGroupSubject_subjectId_idx" ON "PlaybookGroupSubject"("subjectId");
CREATE UNIQUE INDEX "PlaybookGroupSubject_groupId_subjectId_key" ON "PlaybookGroupSubject"("groupId", "subjectId");

-- AddForeignKey
ALTER TABLE "PlaybookGroupSubject" ADD CONSTRAINT "PlaybookGroupSubject_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PlaybookGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaybookGroupSubject" ADD CONSTRAINT "PlaybookGroupSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: infer department→subject from existing Playbook.groupId + PlaybookSubject
-- If a course belongs to a department AND has subjects linked, the department teaches those subjects.
INSERT INTO "PlaybookGroupSubject" ("id", "groupId", "subjectId", "sortOrder", "createdAt")
SELECT
    gen_random_uuid(),
    p."groupId",
    ps."subjectId",
    0,
    NOW()
FROM "Playbook" p
JOIN "PlaybookSubject" ps ON ps."playbookId" = p."id"
WHERE p."groupId" IS NOT NULL
ON CONFLICT ("groupId", "subjectId") DO NOTHING;
