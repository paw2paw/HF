-- Add parameterType column to Parameter table
-- This column was missing from the database but is required by the schema

-- First create the enum type if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParameterType') THEN
    CREATE TYPE "ParameterType" AS ENUM ('TRAIT', 'BEHAVIOR', 'STATE', 'DELTA', 'GOAL');
  END IF;
END
$$;

-- Add column with default value
ALTER TABLE "Parameter" ADD COLUMN "parameterType" "ParameterType" NOT NULL DEFAULT 'TRAIT';
