-- Add fields for classification learning (few-shot from corrections)
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "textSample" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "aiClassification" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "classificationCorrected" BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient few-shot example queries
CREATE INDEX IF NOT EXISTS "ContentSource_classificationCorrected_idx"
  ON "ContentSource"("classificationCorrected");
