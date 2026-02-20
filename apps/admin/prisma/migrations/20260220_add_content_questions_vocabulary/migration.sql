-- Add new DocumentType enum values, QuestionType enum, ContentQuestion + ContentVocabulary models

-- Add new document types to existing enum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'COMPREHENSION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'LESSON_PLAN';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'POLICY_DOCUMENT';

-- Create QuestionType enum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'MATCHING', 'FILL_BLANK', 'SHORT_ANSWER', 'OPEN', 'UNSCRAMBLE', 'ORDERING');

-- Create ContentQuestion table
CREATE TABLE "ContentQuestion" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT,
    "answerExplanation" TEXT,
    "markScheme" TEXT,
    "assertionId" TEXT,
    "learningOutcomeRef" TEXT,
    "difficulty" INTEGER,
    "pageRef" TEXT,
    "chapter" TEXT,
    "section" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentQuestion_pkey" PRIMARY KEY ("id")
);

-- Create ContentVocabulary table
CREATE TABLE "ContentVocabulary" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "partOfSpeech" TEXT,
    "exampleUsage" TEXT,
    "pronunciation" TEXT,
    "topic" TEXT,
    "difficulty" INTEGER,
    "chapter" TEXT,
    "pageRef" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assertionId" TEXT,
    "contentHash" TEXT,
    "embedding" vector(1536),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentVocabulary_pkey" PRIMARY KEY ("id")
);

-- ContentQuestion indexes
CREATE INDEX "ContentQuestion_sourceId_idx" ON "ContentQuestion"("sourceId");
CREATE INDEX "ContentQuestion_questionType_idx" ON "ContentQuestion"("questionType");
CREATE INDEX "ContentQuestion_assertionId_idx" ON "ContentQuestion"("assertionId");
CREATE INDEX "ContentQuestion_learningOutcomeRef_idx" ON "ContentQuestion"("learningOutcomeRef");

-- ContentVocabulary indexes
CREATE UNIQUE INDEX "ContentVocabulary_sourceId_term_key" ON "ContentVocabulary"("sourceId", "term");
CREATE INDEX "ContentVocabulary_sourceId_idx" ON "ContentVocabulary"("sourceId");
CREATE INDEX "ContentVocabulary_topic_idx" ON "ContentVocabulary"("topic");

-- Foreign keys: ContentQuestion
ALTER TABLE "ContentQuestion" ADD CONSTRAINT "ContentQuestion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentQuestion" ADD CONSTRAINT "ContentQuestion_assertionId_fkey" FOREIGN KEY ("assertionId") REFERENCES "ContentAssertion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: ContentVocabulary
ALTER TABLE "ContentVocabulary" ADD CONSTRAINT "ContentVocabulary_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVocabulary" ADD CONSTRAINT "ContentVocabulary_assertionId_fkey" FOREIGN KEY ("assertionId") REFERENCES "ContentAssertion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
