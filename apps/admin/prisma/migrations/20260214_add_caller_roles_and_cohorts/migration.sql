-- CreateEnum CallerRole
CREATE TYPE "CallerRole" AS ENUM ('LEARNER', 'TEACHER', 'TUTOR', 'PARENT', 'MENTOR');

-- Add role to Caller (default LEARNER for all existing rows)
ALTER TABLE "Caller" ADD COLUMN "role" "CallerRole" NOT NULL DEFAULT 'LEARNER';

-- Add cohort group membership to Caller
ALTER TABLE "Caller" ADD COLUMN "cohortGroupId" TEXT;
ALTER TABLE "Caller" ADD COLUMN "supervisorCallerId" TEXT;

-- CreateTable CohortGroup
CREATE TABLE "CohortGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domainId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for CohortGroup
CREATE INDEX "CohortGroup_domainId_idx" ON "CohortGroup"("domainId");
CREATE INDEX "CohortGroup_ownerId_idx" ON "CohortGroup"("ownerId");
CREATE INDEX "CohortGroup_isActive_idx" ON "CohortGroup"("isActive");

-- CreateIndex for Caller new columns
CREATE INDEX "Caller_role_idx" ON "Caller"("role");
CREATE INDEX "Caller_cohortGroupId_idx" ON "Caller"("cohortGroupId");
CREATE INDEX "Caller_supervisorCallerId_idx" ON "Caller"("supervisorCallerId");

-- AddForeignKey: CohortGroup.domainId -> Domain.id
ALTER TABLE "CohortGroup" ADD CONSTRAINT "CohortGroup_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CohortGroup.ownerId -> Caller.id
ALTER TABLE "CohortGroup" ADD CONSTRAINT "CohortGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Caller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Caller.cohortGroupId -> CohortGroup.id
ALTER TABLE "Caller" ADD CONSTRAINT "Caller_cohortGroupId_fkey" FOREIGN KEY ("cohortGroupId") REFERENCES "CohortGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Caller.supervisorCallerId -> Caller.id (self-relation)
ALTER TABLE "Caller" ADD CONSTRAINT "Caller_supervisorCallerId_fkey" FOREIGN KEY ("supervisorCallerId") REFERENCES "Caller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
