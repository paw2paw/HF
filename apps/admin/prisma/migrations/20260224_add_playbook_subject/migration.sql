-- CreateTable
CREATE TABLE "PlaybookSubject" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookSubject_playbookId_subjectId_key" ON "PlaybookSubject"("playbookId", "subjectId");

-- CreateIndex
CREATE INDEX "PlaybookSubject_playbookId_idx" ON "PlaybookSubject"("playbookId");

-- CreateIndex
CREATE INDEX "PlaybookSubject_subjectId_idx" ON "PlaybookSubject"("subjectId");

-- AddForeignKey
ALTER TABLE "PlaybookSubject" ADD CONSTRAINT "PlaybookSubject_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookSubject" ADD CONSTRAINT "PlaybookSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
