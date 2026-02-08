-- Migration: Add triggers to maintain Playbook spec counts
-- These counts are denormalized for performance but need to stay in sync

-- Function to recalculate all spec counts for a playbook
CREATE OR REPLACE FUNCTION update_playbook_spec_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_playbook_id UUID;
BEGIN
  -- Determine which playbook ID to update
  IF TG_OP = 'DELETE' THEN
    v_playbook_id := OLD."playbookId";
  ELSE
    v_playbook_id := NEW."playbookId";
  END IF;

  -- Recalculate all counts for this playbook
  UPDATE "Playbook" p
  SET
    "measureSpecCount" = (
      SELECT COUNT(*)
      FROM "PlaybookItem" pi
      JOIN "BddFeature" s ON pi."specId" = s.id
      WHERE pi."playbookId" = v_playbook_id
        AND s."outputType" = 'MEASURE'
    ),
    "learnSpecCount" = (
      SELECT COUNT(*)
      FROM "PlaybookItem" pi
      JOIN "BddFeature" s ON pi."specId" = s.id
      WHERE pi."playbookId" = v_playbook_id
        AND s."outputType" = 'LEARN'
    ),
    "adaptSpecCount" = (
      SELECT COUNT(*)
      FROM "PlaybookItem" pi
      JOIN "BddFeature" s ON pi."specId" = s.id
      WHERE pi."playbookId" = v_playbook_id
        AND s."specRole" = 'ADAPT'
    ),
    "parameterCount" = (
      SELECT COUNT(DISTINCT p2.id)
      FROM "PlaybookItem" pi
      JOIN "BddFeature" s ON pi."specId" = s.id
      JOIN "Parameter" p2 ON p2."computedBy" LIKE 'spec:' || s.slug
      WHERE pi."playbookId" = v_playbook_id
    )
  WHERE p.id = v_playbook_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS playbook_item_spec_counts_trigger ON "PlaybookItem";

-- Create trigger on PlaybookItem
CREATE TRIGGER playbook_item_spec_counts_trigger
AFTER INSERT OR UPDATE OR DELETE ON "PlaybookItem"
FOR EACH ROW
EXECUTE FUNCTION update_playbook_spec_counts();

-- Also trigger when a spec's role/type changes
CREATE OR REPLACE FUNCTION update_playbook_counts_on_spec_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if outputType or specRole changed
  IF (TG_OP = 'UPDATE' AND (
      OLD."outputType" IS DISTINCT FROM NEW."outputType" OR
      OLD."specRole" IS DISTINCT FROM NEW."specRole"
    )) THEN

    -- Update all playbooks that use this spec
    UPDATE "Playbook" p
    SET
      "measureSpecCount" = (
        SELECT COUNT(*)
        FROM "PlaybookItem" pi
        JOIN "BddFeature" s ON pi."specId" = s.id
        WHERE pi."playbookId" = p.id
          AND s."outputType" = 'MEASURE'
      ),
      "learnSpecCount" = (
        SELECT COUNT(*)
        FROM "PlaybookItem" pi
        JOIN "BddFeature" s ON pi."specId" = s.id
        WHERE pi."playbookId" = p.id
          AND s."outputType" = 'LEARN'
      ),
      "adaptSpecCount" = (
        SELECT COUNT(*)
        FROM "PlaybookItem" pi
        JOIN "BddFeature" s ON pi."specId" = s.id
        WHERE pi."playbookId" = p.id
          AND s."specRole" = 'ADAPT'
      )
    WHERE p.id IN (
      SELECT DISTINCT "playbookId"
      FROM "PlaybookItem"
      WHERE "specId" = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS spec_change_update_playbook_counts ON "BddFeature";

-- Create trigger on BddFeature (AnalysisSpec)
CREATE TRIGGER spec_change_update_playbook_counts
AFTER UPDATE ON "BddFeature"
FOR EACH ROW
EXECUTE FUNCTION update_playbook_counts_on_spec_change();

-- Recalculate all existing playbook counts
UPDATE "Playbook" p
SET
  "measureSpecCount" = (
    SELECT COUNT(*)
    FROM "PlaybookItem" pi
    JOIN "BddFeature" s ON pi."specId" = s.id
    WHERE pi."playbookId" = p.id
      AND s."outputType" = 'MEASURE'
  ),
  "learnSpecCount" = (
    SELECT COUNT(*)
    FROM "PlaybookItem" pi
    JOIN "BddFeature" s ON pi."specId" = s.id
    WHERE pi."playbookId" = p.id
      AND s."outputType" = 'LEARN'
  ),
  "adaptSpecCount" = (
    SELECT COUNT(*)
    FROM "PlaybookItem" pi
    JOIN "BddFeature" s ON pi."specId" = s.id
    WHERE pi."playbookId" = p.id
      AND s."specRole" = 'ADAPT'
  );

-- Report
SELECT 'Triggers created and all playbook counts recalculated' AS status;
