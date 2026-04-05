-- CreateEnum
CREATE TYPE "BloomLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');

-- CreateEnum
CREATE TYPE "AssessmentUse" AS ENUM ('PRE_TEST', 'POST_TEST', 'BOTH', 'FORMATIVE', 'TUTOR_ONLY');

-- AlterTable
ALTER TABLE "ContentQuestion" ADD COLUMN "bloomLevel" "BloomLevel",
ADD COLUMN "assessmentUse" "AssessmentUse";

-- CreateIndex
CREATE INDEX "ContentQuestion_bloomLevel_idx" ON "ContentQuestion"("bloomLevel");

-- CreateIndex
CREATE INDEX "ContentQuestion_assessmentUse_idx" ON "ContentQuestion"("assessmentUse");
