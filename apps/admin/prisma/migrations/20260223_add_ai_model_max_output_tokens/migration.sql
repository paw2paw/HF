-- AlterTable
ALTER TABLE "AIModel" ADD COLUMN "maxOutputTokens" INTEGER;

-- Backfill known model limits
UPDATE "AIModel" SET "maxOutputTokens" = 16384 WHERE "modelId" = 'claude-sonnet-4-20250514';
UPDATE "AIModel" SET "maxOutputTokens" = 8192  WHERE "modelId" = 'claude-3-5-sonnet-20241022';
UPDATE "AIModel" SET "maxOutputTokens" = 8192  WHERE "modelId" = 'claude-3-5-haiku-20241022';
UPDATE "AIModel" SET "maxOutputTokens" = 8192  WHERE "modelId" = 'claude-haiku-4-5-20251001';
UPDATE "AIModel" SET "maxOutputTokens" = 4096  WHERE "modelId" = 'claude-3-haiku-20240307';
UPDATE "AIModel" SET "maxOutputTokens" = 16384 WHERE "modelId" = 'gpt-4o';
UPDATE "AIModel" SET "maxOutputTokens" = 16384 WHERE "modelId" = 'gpt-4o-mini';
UPDATE "AIModel" SET "maxOutputTokens" = 4096  WHERE "modelId" = 'gpt-4-turbo';
UPDATE "AIModel" SET "maxOutputTokens" = 4096  WHERE "modelId" = 'gpt-3.5-turbo';
UPDATE "AIModel" SET "maxOutputTokens" = 4096  WHERE "modelId" = 'mock-model';

-- Insert missing models that config-loader references but weren't seeded
INSERT INTO "AIModel" ("id", "modelId", "provider", "label", "tier", "isActive", "sortOrder", "maxOutputTokens", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'claude-3-5-haiku-20241022', 'claude', 'Claude 3.5 Haiku', 'fast', true, 3, 8192, NOW(), NOW()),
  (gen_random_uuid(), 'claude-haiku-4-5-20251001', 'claude', 'Claude Haiku 4.5', 'fast', true, 4, 8192, NOW(), NOW())
ON CONFLICT ("modelId") DO UPDATE SET "maxOutputTokens" = EXCLUDED."maxOutputTokens";
