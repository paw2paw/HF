-- AlterTable: Make callId nullable for educator-created artifacts
ALTER TABLE "ConversationArtifact" ALTER COLUMN "callId" DROP NOT NULL;

-- AlterTable: Add createdBy for provenance tracking
ALTER TABLE "ConversationArtifact" ADD COLUMN "createdBy" TEXT;
