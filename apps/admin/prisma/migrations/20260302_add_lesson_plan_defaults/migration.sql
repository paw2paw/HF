-- Add lessonPlanDefaults JSON column to Domain table
-- Stores course creation defaults: { sessionCount?, durationMins?, emphasis?, assessments?, lessonPlanModel? }
ALTER TABLE "Domain" ADD COLUMN "lessonPlanDefaults" JSONB;
