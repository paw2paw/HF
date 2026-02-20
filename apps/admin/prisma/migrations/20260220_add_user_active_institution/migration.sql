-- Add activeInstitutionId column to User table
ALTER TABLE "User" ADD COLUMN "activeInstitutionId" TEXT;

-- Add foreign key constraint
ALTER TABLE "User" ADD CONSTRAINT "User_activeInstitutionId_fkey" FOREIGN KEY ("activeInstitutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for queries on activeInstitutionId
CREATE INDEX "User_activeInstitutionId_idx" ON "User"("activeInstitutionId");
