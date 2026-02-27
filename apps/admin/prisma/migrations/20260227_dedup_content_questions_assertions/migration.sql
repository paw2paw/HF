-- Deduplicate ContentQuestion and ContentAssertion rows, then add
-- unique constraints on (sourceId, contentHash) to prevent the race
-- condition caused by parallel chunk saves (CHUNK_CONCURRENCY = 3).
--
-- Root cause: specialist extractor saves chunks in parallel via
-- onChunkComplete → saveQuestions/saveAssertions. Without a unique
-- constraint, concurrent findMany→createMany calls insert duplicates.

-- Step 1: Remove duplicate ContentQuestion rows (keep the oldest per group)
DELETE FROM "ContentQuestion" WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sourceId", "contentHash"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "ContentQuestion"
    WHERE "contentHash" IS NOT NULL
  ) dupes WHERE rn > 1
);

-- Step 2: Remove duplicate ContentAssertion rows (keep the oldest per group)
-- Must first unlink children referencing duplicates to avoid FK violations
UPDATE "ContentAssertion" SET "parentId" = NULL
WHERE "parentId" IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sourceId", "contentHash"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "ContentAssertion"
    WHERE "contentHash" IS NOT NULL
  ) dupes WHERE rn > 1
);

-- Unlink questions pointing at duplicate assertions
UPDATE "ContentQuestion" SET "assertionId" = NULL
WHERE "assertionId" IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sourceId", "contentHash"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "ContentAssertion"
    WHERE "contentHash" IS NOT NULL
  ) dupes WHERE rn > 1
);

-- Unlink vocabulary pointing at duplicate assertions
UPDATE "ContentVocabulary" SET "assertionId" = NULL
WHERE "assertionId" IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sourceId", "contentHash"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "ContentAssertion"
    WHERE "contentHash" IS NOT NULL
  ) dupes WHERE rn > 1
);

-- Now safe to delete duplicate assertions
DELETE FROM "ContentAssertion" WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sourceId", "contentHash"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "ContentAssertion"
    WHERE "contentHash" IS NOT NULL
  ) dupes WHERE rn > 1
);

-- Step 3: Add filtered unique constraints (NULL contentHash rows are exempt)
CREATE UNIQUE INDEX "ContentQuestion_sourceId_contentHash_key"
  ON "ContentQuestion"("sourceId", "contentHash")
  WHERE "contentHash" IS NOT NULL;

CREATE UNIQUE INDEX "ContentAssertion_sourceId_contentHash_key"
  ON "ContentAssertion"("sourceId", "contentHash")
  WHERE "contentHash" IS NOT NULL;
