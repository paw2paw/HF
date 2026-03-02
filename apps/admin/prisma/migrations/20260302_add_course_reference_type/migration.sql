-- Add COURSE_REFERENCE document type for tutor instruction documents
-- (skills framework, session flow, scaffolding rules — NOT student content)
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'COURSE_REFERENCE';
