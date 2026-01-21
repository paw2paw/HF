/*
  Warnings:

  - You are about to drop the column `maxScore` on the `BddAcceptanceCriteria` table. All the data in the column will be lost.
  - You are about to drop the column `minScore` on the `BddAcceptanceCriteria` table. All the data in the column will be lost.
  - You are about to drop the column `scaleType` on the `BddAcceptanceCriteria` table. All the data in the column will be lost.
  - You are about to drop the `BddScoringAnchor` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `parameterId` on table `BddAcceptanceCriteria` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "BddAcceptanceCriteria" DROP CONSTRAINT "BddAcceptanceCriteria_parameterId_fkey";

-- DropForeignKey
ALTER TABLE "BddScoringAnchor" DROP CONSTRAINT "BddScoringAnchor_criteriaId_fkey";

-- AlterTable
ALTER TABLE "BddAcceptanceCriteria" DROP COLUMN "maxScore",
DROP COLUMN "minScore",
DROP COLUMN "scaleType",
ALTER COLUMN "parameterId" SET NOT NULL;

-- DropTable
DROP TABLE "BddScoringAnchor";

-- CreateTable
CREATE TABLE "ParameterScoringAnchor" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "positiveSignals" TEXT[],
    "negativeSignals" TEXT[],
    "isGold" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterScoringAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParameterScoringAnchor_parameterId_idx" ON "ParameterScoringAnchor"("parameterId");

-- CreateIndex
CREATE INDEX "ParameterScoringAnchor_score_idx" ON "ParameterScoringAnchor"("score");

-- CreateIndex
CREATE INDEX "ParameterScoringAnchor_isGold_idx" ON "ParameterScoringAnchor"("isGold");

-- AddForeignKey
ALTER TABLE "BddAcceptanceCriteria" ADD CONSTRAINT "BddAcceptanceCriteria_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("parameterId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterScoringAnchor" ADD CONSTRAINT "ParameterScoringAnchor_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("parameterId") ON DELETE CASCADE ON UPDATE CASCADE;
