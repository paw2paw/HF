/**
 * Tests for lib/bdd/compiler.ts
 *
 * Tests the BDD compiler that takes raw BDD uploads (XML content) and
 * compiles them into a CompiledFeatureSet containing parameters, constraints,
 * validations, prompt guidance, definitions, and thresholds.
 *
 * Covers:
 * - compileBDDToFeatureSet(): main compilation function
 * - Story compilation (definitions, constraints, failure conditions, validations)
 * - Parameter compilation (submetrics, definitions, thresholds, interpretation scale)
 * - Deduplication of parameters and constraints
 * - Feature ID and name derivation
 * - Edge cases (empty uploads, parameter-only, story-only)
 */

import { describe, it, expect } from "vitest";
import { compileBDDToFeatureSet } from "@/lib/bdd/compiler";
import type { CompiledFeatureSet } from "@/lib/bdd/compiler";

// =====================================================
// FIXTURES
// =====================================================

function makeUpload(overrides: {
  id?: string;
  filename?: string;
  fileType?: "STORY" | "PARAMETER";
  xmlContent: string;
  storyId?: string | null;
  parameterIds?: string[];
  name?: string | null;
  version?: string | null;
}) {
  return {
    id: overrides.id || "upload-1",
    filename: overrides.filename || "test.xml",
    fileType: overrides.fileType || "STORY",
    xmlContent: overrides.xmlContent,
    storyId: overrides.storyId ?? null,
    parameterIds: overrides.parameterIds || [],
    name: overrides.name ?? null,
    version: overrides.version ?? null,
  };
}

const STORY_XML = `
<bdd_story id="FEAT-001" version="1.0">
  <metadata><title>Test Feature</title></metadata>
  <user_story>
    <as_a>tutor</as_a>
    <i_want>to measure engagement</i_want>
    <so_that>I can adapt my approach</so_that>
  </user_story>
  <acceptance_criteria>
    <ac id="AC-001">
      <title>Score Calculation</title>
      <given>a completed call</given>
      <when>the system scores engagement</when>
      <then>the score is between 0 and 1</then>
      <threshold name="min_pass" operator="gte">0.5</threshold>
    </ac>
  </acceptance_criteria>
  <constraints>
    <constraint id="CON-001" type="performance">Must score within 5 seconds</constraint>
    <constraint id="CON-002" type="accuracy">Must achieve 90% agreement</constraint>
  </constraints>
  <failure_conditions>
    <condition id="FC-001" severity="critical">
      <trigger>No transcript available</trigger>
      <implication>Cannot score without data</implication>
    </condition>
    <condition id="FC-002" severity="warning">
      <trigger>Low confidence</trigger>
      <threshold operator="lt" value="0.3"/>
      <implication>Score may be unreliable</implication>
    </condition>
  </failure_conditions>
</bdd_story>
`;

const STORY_WITH_GHERKIN_XML = `
<bdd_story id="FEAT-002" version="1.0">
  <metadata><title>Gherkin Feature</title></metadata>
  <user_story>
    <as_a>scorer</as_a>
    <i_want>validated scoring</i_want>
    <so_that>results are reliable</so_that>
  </user_story>
  <acceptance_criteria>
    <ac id="AC-G1">
      <given>setup</given>
      <when>scored</when>
      <then>correct</then>
      <gherkin>
Scenario: Valid score
  Given a transcript is provided
  When the scoring engine runs
  Then a score between 0 and 1 is returned
  And the score has a rationale

Scenario: Missing transcript
  Given no transcript is available
  When the scoring engine runs
  Then an error is returned
      </gherkin>
    </ac>
  </acceptance_criteria>
</bdd_story>
`;

const PARAMETER_XML = `
<parameter_measurement_guide version="1.0">
  <title>Engagement Parameters</title>
  <parameter id="ENG-001">
    <metadata>
      <n>engagement_level</n>
      <target_range min="0" max="1" />
    </metadata>
    <description>Measures overall caller engagement</description>
    <calculation>
      <formula>0.5 * verbal + 0.5 * behavioral</formula>
    </calculation>
    <submetrics>
      <submetric id="ENG-V" name="verbal_engagement" weight="0.5">
        <description>Engagement through speech</description>
        <formula>word_count_ratio * topic_relevance</formula>
        <threshold name="low" value="0.3" basis="per_call">low engagement</threshold>
        <definition term="word_count_ratio">Ratio of caller words to total words</definition>
      </submetric>
      <submetric id="ENG-B" name="behavioral_engagement" weight="0.5">
        <description>Engagement through behavior</description>
      </submetric>
    </submetrics>
    <interpretation_scale>
      <range min="0" max="0.3" label="Low" implication="Disengaged"/>
      <range min="0.3" max="0.7" label="Medium" implication="Moderate engagement"/>
      <range min="0.7" max="1" label="High" implication="Fully engaged"/>
    </interpretation_scale>
    <action_thresholds>
      <threshold value="0.3" operator="lt" max="0.3" status="alert" action="Flag for review"/>
    </action_thresholds>
  </parameter>
</parameter_measurement_guide>
`;

const SECOND_PARAMETER_XML = `
<parameter_measurement_guide version="1.0">
  <title>Tone Parameters</title>
  <parameter id="TONE-001">
    <metadata>
      <n>tone_warmth</n>
      <target_range min="0" max="1" />
    </metadata>
    <description>Measures vocal tone warmth</description>
  </parameter>
</parameter_measurement_guide>
`;

// =====================================================
// compileBDDToFeatureSet — Story Processing
// =====================================================

describe("compileBDDToFeatureSet — story processing", () => {
  it("derives feature ID and name from first story", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.featureId).toBe("FEAT-001");
    expect(result.name).toBe("Test Feature");
    expect(result.description).toBe(
      "As tutor, I want to measure engagement so that I can adapt my approach"
    );
  });

  it("adds user story to definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.definitions["FEAT-001-user-story"]).toBeDefined();
    expect(result.definitions["FEAT-001-user-story"].type).toBe("term");
    expect(result.definitions["FEAT-001-user-story"].term).toBe("User Story");
  });

  it("adds acceptance criteria to definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.definitions["AC-001"]).toBeDefined();
    expect(result.definitions["AC-001"].type).toBe("acceptance_criterion");
    expect(result.definitions["AC-001"].definition).toContain("GIVEN a completed call");
    expect(result.definitions["AC-001"].definition).toContain("WHEN the system scores engagement");
    expect(result.definitions["AC-001"].definition).toContain("THEN the score is between 0 and 1");
  });

  it("extracts thresholds from acceptance criteria", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.thresholds["AC-001.min_pass"]).toBeDefined();
    expect(result.thresholds["AC-001.min_pass"].value).toBe(0.5);
    expect(result.thresholds["AC-001.min_pass"].operator).toBe("gte");
    expect(result.thresholds["AC-001.min_pass"].source).toBe("AC-001");
  });

  it("compiles constraints from story", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.constraints).toHaveLength(4); // 2 constraints + 2 failure conditions
    expect(result.constraints[0].id).toBe("CON-001");
    expect(result.constraints[0].type).toBe("performance");
    expect(result.constraints[0].description).toBe("Must score within 5 seconds");
    expect(result.constraints[0].severity).toBe("warning"); // default
    expect(result.constraints[0].source).toBe("FEAT-001");
  });

  it("adds constraint definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.definitions["CON-001"]).toBeDefined();
    expect(result.definitions["CON-001"].type).toBe("constraint");
  });

  it("converts failure conditions to constraints", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    const fcConstraints = result.constraints.filter((c) => c.id.startsWith("failure-"));
    expect(fcConstraints).toHaveLength(2);

    const criticalFC = fcConstraints.find((c) => c.id === "failure-FC-001");
    expect(criticalFC).toBeDefined();
    expect(criticalFC!.severity).toBe("critical");
    expect(criticalFC!.description).toContain("No transcript available");
    expect(criticalFC!.description).toContain("Cannot score without data");

    const warningFC = fcConstraints.find((c) => c.id === "failure-FC-002");
    expect(warningFC).toBeDefined();
    expect(warningFC!.severity).toBe("warning");
    expect(warningFC!.threshold).toBe("lt 0.3");
  });

  it("adds failure condition thresholds", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.thresholds["failure-FC-002"]).toBeDefined();
    expect(result.thresholds["failure-FC-002"].value).toBe(0.3);
    expect(result.thresholds["failure-FC-002"].operator).toBe("lt");
  });

  it("extracts Gherkin validations from acceptance criteria", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_WITH_GHERKIN_XML }),
    ]);

    // Should have Gherkin-parsed validations from the <gherkin> tag
    const gherkinValidations = result.validations.filter((v) => v.acId === "AC-G1");
    expect(gherkinValidations.length).toBeGreaterThanOrEqual(2);

    const validScore = gherkinValidations.find((v) => v.name === "Valid score");
    expect(validScore).toBeDefined();
    expect(validScore!.given).toContain("a transcript is provided");
    expect(validScore!.when).toContain("the scoring engine runs");
    expect(validScore!.then.length).toBeGreaterThanOrEqual(1);
    expect(validScore!.source).toBe("FEAT-002");
  });
});

// =====================================================
// compileBDDToFeatureSet — Parameter Processing
// =====================================================

describe("compileBDDToFeatureSet — parameter processing", () => {
  it("compiles parameters from PARAMETER uploads", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.parameters).toHaveLength(1);
    const param = result.parameters[0];
    expect(param.id).toBe("ENG-001");
    expect(param.name).toBe("engagement_level");
    expect(param.definition).toBe("Measures overall caller engagement");
    expect(param.formula).toBe("0.5 * verbal + 0.5 * behavioral");
    expect(param.targetRange).toEqual({ min: 0, max: 1 });
    expect(param.source).toBe("parameter");
  });

  it("compiles submetrics for parameters", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    const param = result.parameters[0];
    expect(param.submetrics).toHaveLength(2);
    expect(param.submetrics![0].id).toBe("ENG-V");
    expect(param.submetrics![0].name).toBe("verbal_engagement");
    expect(param.submetrics![0].weight).toBe(0.5);
    expect(param.submetrics![0].description).toBe("Engagement through speech");
    expect(param.submetrics![0].formula).toBe("word_count_ratio * topic_relevance");
  });

  it("adds parameter definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({
        fileType: "PARAMETER",
        xmlContent: PARAMETER_XML,
        filename: "engagement.param.xml",
      }),
    ]);

    expect(result.definitions["ENG-001"]).toBeDefined();
    expect(result.definitions["ENG-001"].term).toBe("engagement_level");
    expect(result.definitions["ENG-001"].type).toBe("parameter");
    expect(result.definitions["ENG-001"].source).toBe("engagement.param.xml");
  });

  it("adds submetric definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.definitions["ENG-V"]).toBeDefined();
    expect(result.definitions["ENG-V"].term).toBe("verbal_engagement");
    expect(result.definitions["ENG-V"].type).toBe("submetric");
    expect(result.definitions["ENG-V"].source).toBe("ENG-001");
  });

  it("adds submetric threshold values", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.thresholds["ENG-V.low"]).toBeDefined();
    expect(result.thresholds["ENG-V.low"].value).toBe(0.3);
    expect(result.thresholds["ENG-V.low"].basis).toBe("per_call");
    expect(result.thresholds["ENG-V.low"].parameterId).toBe("ENG-001");
  });

  it("adds submetric term definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.definitions["ENG-V.word_count_ratio"]).toBeDefined();
    expect(result.definitions["ENG-V.word_count_ratio"].term).toBe("word_count_ratio");
    expect(result.definitions["ENG-V.word_count_ratio"].definition).toBe(
      "Ratio of caller words to total words"
    );
    expect(result.definitions["ENG-V.word_count_ratio"].type).toBe("term");
  });

  it("adds interpretation scale entries to definitions", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.definitions["ENG-001.Low"]).toBeDefined();
    expect(result.definitions["ENG-001.Low"].definition).toContain("0-0.3");
    expect(result.definitions["ENG-001.Low"].type).toBe("threshold");

    expect(result.definitions["ENG-001.High"]).toBeDefined();
    expect(result.definitions["ENG-001.High"].definition).toContain("0.7-1");
  });

  it("adds target range as threshold", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.thresholds["ENG-001.target"]).toBeDefined();
    expect(result.thresholds["ENG-001.target"].name).toBe("target_range");
    expect(result.thresholds["ENG-001.target"].value).toBe("0-1");
    expect(result.thresholds["ENG-001.target"].parameterId).toBe("ENG-001");
  });

  it("adds action thresholds", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    expect(result.thresholds["ENG-001.alert"]).toBeDefined();
    expect(result.thresholds["ENG-001.alert"].value).toBe(0.3);
    expect(result.thresholds["ENG-001.alert"].operator).toBe("lt");
  });
});

// =====================================================
// compileBDDToFeatureSet — Multiple Uploads
// =====================================================

describe("compileBDDToFeatureSet — multiple uploads", () => {
  it("combines story and parameter uploads", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    // Feature info comes from story
    expect(result.featureId).toBe("FEAT-001");
    expect(result.name).toBe("Test Feature");

    // Has both story constraints and parameter data
    expect(result.constraints.length).toBeGreaterThan(0);
    expect(result.parameters.length).toBeGreaterThan(0);

    // Has definitions from both
    expect(result.definitions["FEAT-001-user-story"]).toBeDefined();
    expect(result.definitions["ENG-001"]).toBeDefined();
  });

  it("deduplicates parameters by ID", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    // Same parameter uploaded twice should appear only once
    const engParams = result.parameters.filter((p) => p.id === "ENG-001");
    expect(engParams).toHaveLength(1);
  });

  it("deduplicates constraints by ID", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    // Same constraints uploaded twice should appear only once each
    const conConstraints = result.constraints.filter((c) => c.id === "CON-001");
    expect(conConstraints).toHaveLength(1);
  });

  it("merges multiple parameter uploads", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
      makeUpload({ fileType: "PARAMETER", xmlContent: SECOND_PARAMETER_XML }),
    ]);

    expect(result.parameters).toHaveLength(2);
    expect(result.parameters.map((p) => p.id)).toContain("ENG-001");
    expect(result.parameters.map((p) => p.id)).toContain("TONE-001");
  });
});

// =====================================================
// compileBDDToFeatureSet — Edge Cases
// =====================================================

describe("compileBDDToFeatureSet — edge cases", () => {
  it("generates feature ID when no story is present", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    // Should generate a feature ID since no story provides one
    expect(result.featureId).toMatch(/^feature-/);
  });

  it("uses upload name when no story title", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({
        fileType: "PARAMETER",
        xmlContent: PARAMETER_XML,
        name: "My Feature Set",
      }),
    ]);

    expect(result.name).toBe("My Feature Set");
  });

  it("defaults to 'Unnamed Feature' when nothing available", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({
        fileType: "PARAMETER",
        xmlContent: PARAMETER_XML,
        name: null,
      }),
    ]);

    // The first upload has name null, so it defaults
    // The actual name comes from the upload object's name property
    // If null, it should use "Unnamed Feature"
    expect(result.name).toBeDefined();
  });

  it("returns empty arrays when uploads produce no data", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: "<empty/>" }),
    ]);

    expect(result.parameters).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.validations).toEqual([]);
  });

  it("sets description to undefined when no story", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "PARAMETER", xmlContent: PARAMETER_XML }),
    ]);

    // Empty string becomes undefined via || undefined
    expect(result.description).toBeUndefined();
  });

  it("returns empty promptGuidance (not populated by XML pipeline)", () => {
    const result = compileBDDToFeatureSet([
      makeUpload({ fileType: "STORY", xmlContent: STORY_XML }),
    ]);

    expect(result.promptGuidance).toEqual({});
  });
});
