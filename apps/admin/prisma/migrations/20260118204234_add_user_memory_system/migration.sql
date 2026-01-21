-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('FACT', 'PREFERENCE', 'EVENT', 'TOPIC', 'RELATIONSHIP', 'CONTEXT');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('EXTRACTED', 'INFERRED', 'STATED', 'CORRECTED');

-- CreateTable
CREATE TABLE "UserMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callId" TEXT,
    "category" "MemoryCategory" NOT NULL,
    "source" "MemorySource" NOT NULL DEFAULT 'EXTRACTED',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedKey" TEXT,
    "evidence" TEXT,
    "context" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "expiresAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMemorySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factCount" INTEGER NOT NULL DEFAULT 0,
    "preferenceCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "topicCount" INTEGER NOT NULL DEFAULT 0,
    "keyFacts" JSONB NOT NULL DEFAULT '[]',
    "topTopics" JSONB NOT NULL DEFAULT '[]',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "lastMemoryAt" TIMESTAMP(3),
    "lastAggregatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemorySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMemory_userId_idx" ON "UserMemory"("userId");

-- CreateIndex
CREATE INDEX "UserMemory_callId_idx" ON "UserMemory"("callId");

-- CreateIndex
CREATE INDEX "UserMemory_category_idx" ON "UserMemory"("category");

-- CreateIndex
CREATE INDEX "UserMemory_key_idx" ON "UserMemory"("key");

-- CreateIndex
CREATE INDEX "UserMemory_normalizedKey_idx" ON "UserMemory"("normalizedKey");

-- CreateIndex
CREATE INDEX "UserMemory_extractedAt_idx" ON "UserMemory"("extractedAt");

-- CreateIndex
CREATE INDEX "UserMemory_confidence_idx" ON "UserMemory"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "UserMemorySummary_userId_key" ON "UserMemorySummary"("userId");

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "UserMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemorySummary" ADD CONSTRAINT "UserMemorySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
