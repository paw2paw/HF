-- AlterTable: add eval persistence to ComposedPrompt
ALTER TABLE "ComposedPrompt" ADD COLUMN "evalResult" JSONB;
ALTER TABLE "ComposedPrompt" ADD COLUMN "evalAt" TIMESTAMP(3);
