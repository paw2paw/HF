-- Add EDUCATOR to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EDUCATOR';

-- Extend Invite model with educator fields
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "cohortGroupId" TEXT;
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "callerRole" "CallerRole";
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;

-- Add magic join link fields to CohortGroup
ALTER TABLE "CohortGroup" ADD COLUMN IF NOT EXISTS "joinToken" TEXT;
ALTER TABLE "CohortGroup" ADD COLUMN IF NOT EXISTS "joinTokenExp" TIMESTAMP(3);

-- Indexes
CREATE INDEX IF NOT EXISTS "Invite_cohortGroupId_idx" ON "Invite"("cohortGroupId");
CREATE UNIQUE INDEX IF NOT EXISTS "CohortGroup_joinToken_key" ON "CohortGroup"("joinToken");

-- Foreign keys
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_cohortGroupId_fkey"
  FOREIGN KEY ("cohortGroupId") REFERENCES "CohortGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
