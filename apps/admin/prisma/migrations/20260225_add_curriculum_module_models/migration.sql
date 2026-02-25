-- CreateTable: CurriculumModule
CREATE TABLE "CurriculumModule" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedDurationMinutes" INTEGER,
    "masteryThreshold" DOUBLE PRECISION,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assessmentCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LearningObjective
CREATE TABLE "LearningObjective" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CallerModuleProgress
CREATE TABLE "CallerModuleProgress" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastCallId" TEXT,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallerModuleProgress_pkey" PRIMARY KEY ("id")
);

-- AddColumn: ContentAssertion.learningObjectiveId
ALTER TABLE "ContentAssertion" ADD COLUMN "learningObjectiveId" TEXT;

-- AddColumn: Call.curriculumModuleId
ALTER TABLE "Call" ADD COLUMN "curriculumModuleId" TEXT;

-- CreateIndex: CurriculumModule
CREATE UNIQUE INDEX "CurriculumModule_curriculumId_slug_key" ON "CurriculumModule"("curriculumId", "slug");
CREATE INDEX "CurriculumModule_curriculumId_sortOrder_idx" ON "CurriculumModule"("curriculumId", "sortOrder");
CREATE INDEX "CurriculumModule_isActive_idx" ON "CurriculumModule"("isActive");

-- CreateIndex: LearningObjective
CREATE UNIQUE INDEX "LearningObjective_moduleId_ref_key" ON "LearningObjective"("moduleId", "ref");
CREATE INDEX "LearningObjective_moduleId_sortOrder_idx" ON "LearningObjective"("moduleId", "sortOrder");
CREATE INDEX "LearningObjective_ref_idx" ON "LearningObjective"("ref");

-- CreateIndex: CallerModuleProgress
CREATE UNIQUE INDEX "CallerModuleProgress_callerId_moduleId_key" ON "CallerModuleProgress"("callerId", "moduleId");
CREATE INDEX "CallerModuleProgress_callerId_status_idx" ON "CallerModuleProgress"("callerId", "status");
CREATE INDEX "CallerModuleProgress_moduleId_idx" ON "CallerModuleProgress"("moduleId");

-- CreateIndex: ContentAssertion.learningObjectiveId
CREATE INDEX "ContentAssertion_learningObjectiveId_idx" ON "ContentAssertion"("learningObjectiveId");

-- CreateIndex: Call.curriculumModuleId
CREATE INDEX "Call_curriculumModuleId_idx" ON "Call"("curriculumModuleId");

-- AddForeignKey: CurriculumModule → Curriculum
ALTER TABLE "CurriculumModule" ADD CONSTRAINT "CurriculumModule_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LearningObjective → CurriculumModule
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CallerModuleProgress → Caller
ALTER TABLE "CallerModuleProgress" ADD CONSTRAINT "CallerModuleProgress_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CallerModuleProgress → CurriculumModule
ALTER TABLE "CallerModuleProgress" ADD CONSTRAINT "CallerModuleProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ContentAssertion → LearningObjective
ALTER TABLE "ContentAssertion" ADD CONSTRAINT "ContentAssertion_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Call → CurriculumModule
ALTER TABLE "Call" ADD CONSTRAINT "Call_curriculumModuleId_fkey" FOREIGN KEY ("curriculumModuleId") REFERENCES "CurriculumModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
