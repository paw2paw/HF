-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('SCORING_GUIDE', 'EXAMPLES', 'RESEARCH_SUMMARY', 'PROMPT_TEMPLATE', 'CALIBRATION_DATA');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('BATCH_EXPORT', 'SINGLE_CALL', 'CSV_EXPORT');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "controlSetId" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "contentSha" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "ingestedAt" TIMESTAMP(3),
    "chunksExpected" INTEGER,
    "chunksCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startChar" INTEGER NOT NULL,
    "endChar" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VectorEmbedding" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "embeddingData" BYTEA NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VectorEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArtifact" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT,
    "type" "ArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceChunkIds" TEXT[],
    "confidence" DOUBLE PRECISION,
    "tags" TEXT[],
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterKnowledgeLink" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParameterKnowledgeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "callCount" INTEGER NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "sourcePreserved" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalityObservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "controlSetId" TEXT,
    "openness" DOUBLE PRECISION,
    "conscientiousness" DOUBLE PRECISION,
    "extraversion" DOUBLE PRECISION,
    "agreeableness" DOUBLE PRECISION,
    "neuroticism" DOUBLE PRECISION,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalityObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPersonality" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openness" DOUBLE PRECISION,
    "conscientiousness" DOUBLE PRECISION,
    "extraversion" DOUBLE PRECISION,
    "agreeableness" DOUBLE PRECISION,
    "neuroticism" DOUBLE PRECISION,
    "preferredTone" TEXT,
    "preferredLength" TEXT,
    "technicalLevel" TEXT,
    "lastAggregatedAt" TIMESTAMP(3),
    "observationsUsed" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION,
    "decayHalfLife" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPersonality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "promptTemplateId" TEXT,
    "expectedOpenness" DOUBLE PRECISION,
    "expectedConscientiousness" DOUBLE PRECISION,
    "expectedExtraversion" DOUBLE PRECISION,
    "expectedAgreeableness" DOUBLE PRECISION,
    "expectedNeuroticism" DOUBLE PRECISION,
    "avgScore" DOUBLE PRECISION,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlSetParameter" (
    "id" TEXT NOT NULL,
    "controlSetId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ControlSetParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "personalityModifiers" JSONB,
    "contextTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardScore" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "clarityScore" DOUBLE PRECISION,
    "empathyScore" DOUBLE PRECISION,
    "resolutionScore" DOUBLE PRECISION,
    "efficiencyScore" DOUBLE PRECISION,
    "coherenceScore" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoredBy" TEXT,
    "customerSatisfaction" DOUBLE PRECISION,
    "taskCompleted" BOOLEAN,
    "escalated" BOOLEAN,
    "followUpRequired" BOOLEAN,
    "parametersSnapshot" JSONB,

    CONSTRAINT "RewardScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptSlugSelection" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT,
    "promptSlug" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "personalitySnapshot" JSONB,
    "recentSlugs" JSONB,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectionMethod" TEXT NOT NULL DEFAULT 'rule-based',

    CONSTRAINT "PromptSlugSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE INDEX "User_externalId_idx" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDoc_sourcePath_key" ON "KnowledgeDoc"("sourcePath");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_updatedAt_idx" ON "KnowledgeDoc"("updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_contentSha_idx" ON "KnowledgeDoc"("contentSha");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_status_idx" ON "KnowledgeDoc"("status");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_docId_idx" ON "KnowledgeChunk"("docId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_chunkIndex_idx" ON "KnowledgeChunk"("chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_docId_chunkIndex_key" ON "KnowledgeChunk"("docId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "VectorEmbedding_chunkId_key" ON "VectorEmbedding"("chunkId");

-- CreateIndex
CREATE INDEX "VectorEmbedding_chunkId_idx" ON "VectorEmbedding"("chunkId");

-- CreateIndex
CREATE INDEX "VectorEmbedding_model_idx" ON "VectorEmbedding"("model");

-- CreateIndex
CREATE INDEX "KnowledgeArtifact_parameterId_idx" ON "KnowledgeArtifact"("parameterId");

-- CreateIndex
CREATE INDEX "KnowledgeArtifact_type_idx" ON "KnowledgeArtifact"("type");

-- CreateIndex
CREATE INDEX "ParameterKnowledgeLink_parameterId_idx" ON "ParameterKnowledgeLink"("parameterId");

-- CreateIndex
CREATE INDEX "ParameterKnowledgeLink_chunkId_idx" ON "ParameterKnowledgeLink"("chunkId");

-- CreateIndex
CREATE INDEX "ParameterKnowledgeLink_relevanceScore_idx" ON "ParameterKnowledgeLink"("relevanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterKnowledgeLink_parameterId_chunkId_key" ON "ParameterKnowledgeLink"("parameterId", "chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedFile_fileHash_key" ON "ProcessedFile"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedFile_filepath_filename_key" ON "ProcessedFile"("filepath", "filename");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalityObservation_callId_key" ON "PersonalityObservation"("callId");

-- CreateIndex
CREATE INDEX "PersonalityObservation_userId_idx" ON "PersonalityObservation"("userId");

-- CreateIndex
CREATE INDEX "PersonalityObservation_callId_idx" ON "PersonalityObservation"("callId");

-- CreateIndex
CREATE INDEX "PersonalityObservation_controlSetId_idx" ON "PersonalityObservation"("controlSetId");

-- CreateIndex
CREATE INDEX "PersonalityObservation_observedAt_idx" ON "PersonalityObservation"("observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonality_userId_key" ON "UserPersonality"("userId");

-- CreateIndex
CREATE INDEX "ControlSet_isActive_idx" ON "ControlSet"("isActive");

-- CreateIndex
CREATE INDEX "ControlSetParameter_controlSetId_idx" ON "ControlSetParameter"("controlSetId");

-- CreateIndex
CREATE INDEX "ControlSetParameter_parameterId_idx" ON "ControlSetParameter"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlSetParameter_controlSetId_parameterId_key" ON "ControlSetParameter"("controlSetId", "parameterId");

-- CreateIndex
CREATE INDEX "PromptTemplate_isActive_idx" ON "PromptTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RewardScore_callId_key" ON "RewardScore"("callId");

-- CreateIndex
CREATE INDEX "RewardScore_callId_idx" ON "RewardScore"("callId");

-- CreateIndex
CREATE INDEX "RewardScore_overallScore_idx" ON "RewardScore"("overallScore");

-- CreateIndex
CREATE INDEX "RewardScore_scoredAt_idx" ON "RewardScore"("scoredAt");

-- CreateIndex
CREATE INDEX "PromptSlugSelection_callId_idx" ON "PromptSlugSelection"("callId");

-- CreateIndex
CREATE INDEX "PromptSlugSelection_userId_idx" ON "PromptSlugSelection"("userId");

-- CreateIndex
CREATE INDEX "PromptSlugSelection_promptSlug_idx" ON "PromptSlugSelection"("promptSlug");

-- CreateIndex
CREATE INDEX "PromptSlugSelection_selectedAt_idx" ON "PromptSlugSelection"("selectedAt");

-- CreateIndex
CREATE INDEX "Call_userId_idx" ON "Call"("userId");

-- CreateIndex
CREATE INDEX "Call_controlSetId_idx" ON "Call"("controlSetId");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_controlSetId_fkey" FOREIGN KEY ("controlSetId") REFERENCES "ControlSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_docId_fkey" FOREIGN KEY ("docId") REFERENCES "KnowledgeDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VectorEmbedding" ADD CONSTRAINT "VectorEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArtifact" ADD CONSTRAINT "KnowledgeArtifact_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterKnowledgeLink" ADD CONSTRAINT "ParameterKnowledgeLink_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterKnowledgeLink" ADD CONSTRAINT "ParameterKnowledgeLink_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptBatch" ADD CONSTRAINT "TranscriptBatch_processedFileId_fkey" FOREIGN KEY ("processedFileId") REFERENCES "ProcessedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityObservation" ADD CONSTRAINT "PersonalityObservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityObservation" ADD CONSTRAINT "PersonalityObservation_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalityObservation" ADD CONSTRAINT "PersonalityObservation_controlSetId_fkey" FOREIGN KEY ("controlSetId") REFERENCES "ControlSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPersonality" ADD CONSTRAINT "UserPersonality_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSet" ADD CONSTRAINT "ControlSet_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSetParameter" ADD CONSTRAINT "ControlSetParameter_controlSetId_fkey" FOREIGN KEY ("controlSetId") REFERENCES "ControlSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSetParameter" ADD CONSTRAINT "ControlSetParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardScore" ADD CONSTRAINT "RewardScore_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptSlugSelection" ADD CONSTRAINT "PromptSlugSelection_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptSlugSelection" ADD CONSTRAINT "PromptSlugSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
