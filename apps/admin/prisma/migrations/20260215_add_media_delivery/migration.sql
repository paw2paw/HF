-- Media Delivery System
-- Adds MediaAsset, SubjectMedia, ChannelConfig models
-- Extends CallMessage and ConversationArtifact with media references

-- MediaAsset — uploaded files (images, PDFs, audio) for content delivery
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageType" TEXT NOT NULL DEFAULT 'gcs',
    "title" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploadedBy" TEXT NOT NULL,
    "sourceId" TEXT,
    "trustLevel" "ContentTrustLevel" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- SubjectMedia — many-to-many: media assets in a subject's content library
CREATE TABLE "SubjectMedia" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectMedia_pkey" PRIMARY KEY ("id")
);

-- ChannelConfig — per-domain delivery channel settings
CREATE TABLE "ChannelConfig" (
    "id" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "domainId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConfig_pkey" PRIMARY KEY ("id")
);

-- Extend CallMessage with optional media attachment
ALTER TABLE "CallMessage" ADD COLUMN IF NOT EXISTS "mediaId" TEXT;

-- Extend ConversationArtifact with structured media reference
ALTER TABLE "ConversationArtifact" ADD COLUMN IF NOT EXISTS "mediaId" TEXT;

-- Unique constraints
CREATE UNIQUE INDEX "MediaAsset_contentHash_key" ON "MediaAsset"("contentHash");
CREATE UNIQUE INDEX "SubjectMedia_subjectId_mediaId_key" ON "SubjectMedia"("subjectId", "mediaId");
CREATE UNIQUE INDEX "ChannelConfig_domainId_channelType_key" ON "ChannelConfig"("domainId", "channelType");

-- Indexes
CREATE INDEX "MediaAsset_uploadedBy_idx" ON "MediaAsset"("uploadedBy");
CREATE INDEX "MediaAsset_sourceId_idx" ON "MediaAsset"("sourceId");
CREATE INDEX "MediaAsset_mimeType_idx" ON "MediaAsset"("mimeType");
CREATE INDEX "SubjectMedia_subjectId_idx" ON "SubjectMedia"("subjectId");
CREATE INDEX "SubjectMedia_mediaId_idx" ON "SubjectMedia"("mediaId");
CREATE INDEX "ChannelConfig_channelType_idx" ON "ChannelConfig"("channelType");
CREATE INDEX "CallMessage_mediaId_idx" ON "CallMessage"("mediaId");
CREATE INDEX "ConversationArtifact_mediaId_idx" ON "ConversationArtifact"("mediaId");

-- Foreign keys
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubjectMedia" ADD CONSTRAINT "SubjectMedia_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectMedia" ADD CONSTRAINT "SubjectMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelConfig" ADD CONSTRAINT "ChannelConfig_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationArtifact" ADD CONSTRAINT "ConversationArtifact_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
