-- Add contentHash to ContentSource for file-level deduplication on re-upload
ALTER TABLE "ContentSource" ADD COLUMN "contentHash" TEXT;
CREATE UNIQUE INDEX "ContentSource_contentHash_key" ON "ContentSource"("contentHash");
