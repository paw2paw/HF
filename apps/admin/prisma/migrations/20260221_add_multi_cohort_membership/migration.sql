-- Multi-Cohort Membership
-- Adds CallerCohortMembership join table so callers can belong to multiple cohort groups.
-- The old Caller.cohortGroupId FK is preserved for backwards compat during migration.

-- 1. Create the join table
CREATE TABLE "CallerCohortMembership" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "cohortGroupId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "CallerCohortMembership_pkey" PRIMARY KEY ("id")
);

-- 2. Unique constraint — one membership per caller per cohort
CREATE UNIQUE INDEX "CallerCohortMembership_callerId_cohortGroupId_key" ON "CallerCohortMembership"("callerId", "cohortGroupId");

-- 3. Performance indexes
CREATE INDEX "CallerCohortMembership_callerId_idx" ON "CallerCohortMembership"("callerId");
CREATE INDEX "CallerCohortMembership_cohortGroupId_idx" ON "CallerCohortMembership"("cohortGroupId");

-- 4. Foreign keys
ALTER TABLE "CallerCohortMembership" ADD CONSTRAINT "CallerCohortMembership_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallerCohortMembership" ADD CONSTRAINT "CallerCohortMembership_cohortGroupId_fkey" FOREIGN KEY ("cohortGroupId") REFERENCES "CohortGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Backfill: Copy existing single-cohort FK values into the join table
INSERT INTO "CallerCohortMembership" ("id", "callerId", "cohortGroupId", "joinedAt", "role")
SELECT
    gen_random_uuid(),
    "id",
    "cohortGroupId",
    COALESCE("createdAt", CURRENT_TIMESTAMP),
    'MEMBER'
FROM "Caller"
WHERE "cohortGroupId" IS NOT NULL;
