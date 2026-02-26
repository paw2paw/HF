-- Add figureRefs column to ContentAssertion
ALTER TABLE "ContentAssertion" ADD COLUMN "figureRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add image extraction provenance columns to MediaAsset
ALTER TABLE "MediaAsset" ADD COLUMN "pageNumber" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN "positionIndex" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN "captionText" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "figureRef" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "extractedFrom" TEXT;

-- Create index on MediaAsset.figureRef for lookup during linking
CREATE INDEX "MediaAsset_figureRef_idx" ON "MediaAsset"("figureRef");

-- Create AssertionMedia junction table
CREATE TABLE "AssertionMedia" (
    "id" TEXT NOT NULL,
    "assertionId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "figureRef" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssertionMedia_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one link per assertion-media pair
CREATE UNIQUE INDEX "AssertionMedia_assertionId_mediaId_key" ON "AssertionMedia"("assertionId", "mediaId");

-- Indexes for efficient joins
CREATE INDEX "AssertionMedia_assertionId_idx" ON "AssertionMedia"("assertionId");
CREATE INDEX "AssertionMedia_mediaId_idx" ON "AssertionMedia"("mediaId");

-- Foreign keys
ALTER TABLE "AssertionMedia" ADD CONSTRAINT "AssertionMedia_assertionId_fkey"
    FOREIGN KEY ("assertionId") REFERENCES "ContentAssertion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssertionMedia" ADD CONSTRAINT "AssertionMedia_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
