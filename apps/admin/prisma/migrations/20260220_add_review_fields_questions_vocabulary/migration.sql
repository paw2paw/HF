-- Add review fields to ContentQuestion
ALTER TABLE "ContentQuestion" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ContentQuestion" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Add review fields to ContentVocabulary
ALTER TABLE "ContentVocabulary" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ContentVocabulary" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Foreign keys for reviewer
ALTER TABLE "ContentQuestion" ADD CONSTRAINT "ContentQuestion_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentVocabulary" ADD CONSTRAINT "ContentVocabulary_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
