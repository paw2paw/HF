-- CreateEnum
CREATE TYPE "AgentInstanceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'OK', 'ERROR');

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "status" "AgentInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "settingsHash" TEXT,
    "parentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentInstanceId" TEXT,
    "agentId" TEXT NOT NULL,
    "agentTitle" TEXT,
    "opid" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" "AgentRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" TEXT,
    "stdout" TEXT,
    "stderr" TEXT,
    "artifacts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptSlugReward" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "rewardScore" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "explicitFeedback" JSONB,
    "implicitSignals" JSONB,
    "derivedMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptSlugReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptSlugStats" (
    "id" TEXT NOT NULL,
    "promptSlug" TEXT NOT NULL,
    "personalityBucket" TEXT NOT NULL,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    "avgReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentUses" INTEGER NOT NULL DEFAULT 0,
    "recentAvgReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptSlugStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentInstance_agentId_idx" ON "AgentInstance"("agentId");

-- CreateIndex
CREATE INDEX "AgentInstance_status_idx" ON "AgentInstance"("status");

-- CreateIndex
CREATE INDEX "AgentInstance_parentVersionId_idx" ON "AgentInstance"("parentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_agentId_version_key" ON "AgentInstance"("agentId", "version");

-- CreateIndex
CREATE INDEX "AgentRun_agentInstanceId_idx" ON "AgentRun"("agentInstanceId");

-- CreateIndex
CREATE INDEX "AgentRun_agentId_idx" ON "AgentRun"("agentId");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptSlugReward_selectionId_key" ON "PromptSlugReward"("selectionId");

-- CreateIndex
CREATE INDEX "PromptSlugReward_selectionId_idx" ON "PromptSlugReward"("selectionId");

-- CreateIndex
CREATE INDEX "PromptSlugReward_rewardScore_idx" ON "PromptSlugReward"("rewardScore");

-- CreateIndex
CREATE INDEX "PromptSlugReward_createdAt_idx" ON "PromptSlugReward"("createdAt");

-- CreateIndex
CREATE INDEX "PromptSlugStats_promptSlug_idx" ON "PromptSlugStats"("promptSlug");

-- CreateIndex
CREATE INDEX "PromptSlugStats_personalityBucket_idx" ON "PromptSlugStats"("personalityBucket");

-- CreateIndex
CREATE INDEX "PromptSlugStats_avgReward_idx" ON "PromptSlugStats"("avgReward");

-- CreateIndex
CREATE UNIQUE INDEX "PromptSlugStats_promptSlug_personalityBucket_key" ON "PromptSlugStats"("promptSlug", "personalityBucket");

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "AgentInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentInstanceId_fkey" FOREIGN KEY ("agentInstanceId") REFERENCES "AgentInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptSlugReward" ADD CONSTRAINT "PromptSlugReward_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "PromptSlugSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
