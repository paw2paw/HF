-- CreateEnum
CREATE TYPE "CallActionType" AS ENUM ('SEND_MEDIA', 'HOMEWORK', 'TASK', 'FOLLOWUP', 'REMINDER');

-- CreateEnum
CREATE TYPE "CallActionAssignee" AS ENUM ('CALLER', 'OPERATOR', 'AGENT');

-- CreateEnum
CREATE TYPE "CallActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CallActionSource" AS ENUM ('EXTRACTED', 'MANUAL');

-- CreateTable
CREATE TABLE "CallAction" (
    "id" TEXT NOT NULL,
    "callId" TEXT,
    "callerId" TEXT NOT NULL,
    "type" "CallActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "artifactId" TEXT,
    "assignee" "CallActionAssignee" NOT NULL,
    "status" "CallActionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "CallActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "source" "CallActionSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "evidence" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "CallAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallAction_callerId_idx" ON "CallAction"("callerId");

-- CreateIndex
CREATE INDEX "CallAction_callId_idx" ON "CallAction"("callId");

-- CreateIndex
CREATE INDEX "CallAction_callerId_status_idx" ON "CallAction"("callerId", "status");

-- CreateIndex
CREATE INDEX "CallAction_assignee_idx" ON "CallAction"("assignee");

-- CreateIndex
CREATE INDEX "CallAction_status_idx" ON "CallAction"("status");

-- AddForeignKey
ALTER TABLE "CallAction" ADD CONSTRAINT "CallAction_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAction" ADD CONSTRAINT "CallAction_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "Caller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAction" ADD CONSTRAINT "CallAction_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ConversationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
