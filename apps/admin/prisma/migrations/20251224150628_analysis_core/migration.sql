/*
  Warnings:

  - You are about to drop the `AnalysisRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Call` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CallScore` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParameterSet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParameterSetParameter` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AnalysisRun" DROP CONSTRAINT "run_set_fk";

-- DropForeignKey
ALTER TABLE "CallScore" DROP CONSTRAINT "score_call_fk";

-- DropForeignKey
ALTER TABLE "CallScore" DROP CONSTRAINT "score_run_fk";

-- DropForeignKey
ALTER TABLE "ParameterSetParameter" DROP CONSTRAINT "psp_set_fk";

-- DropTable
DROP TABLE "AnalysisRun";

-- DropTable
DROP TABLE "Call";

-- DropTable
DROP TABLE "CallScore";

-- DropTable
DROP TABLE "ParameterSet";

-- DropTable
DROP TABLE "ParameterSetParameter";
