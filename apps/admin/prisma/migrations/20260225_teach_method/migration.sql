-- Add teachMethod to ContentAssertion
-- Stores the wizard-assigned teach method for each assertion group
-- (e.g., "recall_quiz", "definition_matching", "close_reading")
ALTER TABLE "ContentAssertion" ADD COLUMN "teachMethod" TEXT;
