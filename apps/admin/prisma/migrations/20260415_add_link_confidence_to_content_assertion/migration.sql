-- AlterTable: add linkConfidence to ContentAssertion (issue #162)
-- Nullable Float in [0, 1]. Written by every reconciler pass and by the
-- manual LO picker in AssertionDetailDrawer. NULL = legacy row.
ALTER TABLE "ContentAssertion" ADD COLUMN "linkConfidence" DOUBLE PRECISION;
