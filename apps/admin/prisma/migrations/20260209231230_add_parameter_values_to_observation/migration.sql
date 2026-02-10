-- Migration: Add dynamic parameterValues to PersonalityObservation
-- Date: 2026-02-09
-- Purpose: Remove hardcoded OCEAN fields, make system 100% data-driven

-- Add parameterValues JSON column with default empty object
ALTER TABLE "PersonalityObservation" ADD COLUMN "parameterValues" JSONB NOT NULL DEFAULT '{}';

-- Migrate existing OCEAN data to parameterValues
-- This preserves all existing observations with their legacy field values
-- jsonb_build_object automatically handles NULL values, no need for COALESCE
UPDATE "PersonalityObservation"
SET "parameterValues" = jsonb_strip_nulls(jsonb_build_object(
  'B5-O', "openness",
  'B5-C', "conscientiousness",
  'B5-E', "extraversion",
  'B5-A', "agreeableness",
  'B5-N', "neuroticism"
))
WHERE "openness" IS NOT NULL
   OR "conscientiousness" IS NOT NULL
   OR "extraversion" IS NOT NULL
   OR "agreeableness" IS NOT NULL
   OR "neuroticism" IS NOT NULL;

-- Legacy fields are kept for backward compatibility
-- They will be removed in a future migration after confirming all code uses parameterValues
-- Comments added to schema mark them as DEPRECATED
