-- Add STUDENT role to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STUDENT';
