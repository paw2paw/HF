-- Expand UserRole enum with new role values
-- Add: SUPERADMIN, SUPER_TESTER, TESTER, DEMO
-- Keep: ADMIN, OPERATOR, VIEWER (VIEWER deprecated, alias for TESTER)

-- Create UserRole enum if it doesn't exist (may have been created via db push)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');
  END IF;
END $$;

-- Add role column to User if it doesn't exist (may have been added via db push)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'VIEWER';

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_TESTER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TESTER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEMO';

-- Add domain scoping for testers (null = all domains)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedDomainId" TEXT;

-- Foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'User_assignedDomainId_fkey'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_assignedDomainId_fkey"
      FOREIGN KEY ("assignedDomainId") REFERENCES "Domain"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for domain scoping queries
CREATE INDEX IF NOT EXISTS "User_assignedDomainId_idx" ON "User"("assignedDomainId");
