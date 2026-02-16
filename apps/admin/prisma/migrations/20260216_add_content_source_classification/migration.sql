-- Add DocumentType enum and content source classification fields
-- These columns exist in the Prisma schema but were never migrated

-- Create DocumentType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('CURRICULUM', 'TEXTBOOK', 'WORKSHEET', 'EXAMPLE', 'ASSESSMENT', 'REFERENCE');
  END IF;
END $$;

-- Document classification
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "documentType" "DocumentType" NOT NULL DEFAULT 'TEXTBOOK';
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "documentTypeSource" TEXT;

-- Publisher / authority chain
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "publisherOrg" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "accreditingBody" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "accreditationRef" TEXT;

-- Bibliographic metadata
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "authors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "isbn" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "doi" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "edition" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "publicationYear" INTEGER;

-- Validity window
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "validFrom" TIMESTAMP(3);
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3);

-- Qualification coverage
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "qualificationRef" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "moduleCoverage" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Verification
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT;

-- Lifecycle
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ContentSource" ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

-- Unique constraint on supersededById (one-to-one self-relation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'ContentSource_supersededById_key'
  ) THEN
    CREATE UNIQUE INDEX "ContentSource_supersededById_key" ON "ContentSource"("supersededById");
  END IF;
END $$;

-- Self-referential FK for supersession chain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ContentSource_supersededById_fkey'
  ) THEN
    ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_supersededById_fkey"
      FOREIGN KEY ("supersededById") REFERENCES "ContentSource"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "ContentSource_documentType_idx" ON "ContentSource"("documentType");
CREATE INDEX IF NOT EXISTS "ContentSource_qualificationRef_idx" ON "ContentSource"("qualificationRef");
CREATE INDEX IF NOT EXISTS "ContentSource_validUntil_idx" ON "ContentSource"("validUntil");
CREATE INDEX IF NOT EXISTS "ContentSource_isActive_idx" ON "ContentSource"("isActive");
