-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "pageContext" TEXT,
ADD COLUMN "screenshotUrl" TEXT,
ADD COLUMN "githubIssueUrl" TEXT,
ADD COLUMN "githubIssueNumber" INTEGER;
