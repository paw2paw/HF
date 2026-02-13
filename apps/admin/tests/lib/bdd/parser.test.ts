/**
 * Tests for lib/bdd/parser.ts
 *
 * Tests the BDD XML parser that converts BDD story specs and parameter
 * measurement guides from XML format into structured TypeScript data.
 *
 * Covers:
 * - parseBDDXml(): main entry point for STORY and PARAMETER file types
 * - Story parsing (user story, acceptance criteria, constraints, failure conditions, scenarios)
 * - Parameter parsing (metadata, submetrics, interpretation scale, worked examples, thresholds)
 * - Parameter reference extraction from story XML
 * - Version extraction
 * - Edge cases (empty content, minimal XML, missing fields)
 */

import { describe, it, expect } from "vitest";
import { parseBDDXml } from "@/lib/bdd/parser";
import type { ParsedBDD } from "@/lib/bdd/parser";

// =====================================================
// FIXTURES
// =====================================================

const MINIMAL_STORY_XML = `
<bdd_story id="TEST-001" version="1.0">
  <metadata>
    <title>Test Story</title>
  </metadata>
  <user_story>
    <as_a>tester</as_a>
    <i_want>to verify parsing</i_want>
    <so_that>tests pass</so_that>
  </user_story>
</bdd_story>
`;

const STORY_WITH_AC_XML = `
<bdd_story id="STORY-002" version="2.1">
  <metadata>
    <title>Story With AC</title>
  </metadata>
  <user_story>
    <as_a>developer</as_a>
    <i_want>acceptance criteria parsed</i_want>
    <so_that>I can validate behavior</so_that>
  </user_story>
  <acceptance_criteria>
    <ac id="AC-001">
      <title>Basic Validation</title>
      <given>a valid input</given>
      <when>the system processes it</when>
      <then>the output is correct</then>
      <reason>correctness matters</reason>
      <parameters>PARAM-A, PARAM-B</parameters>
      <threshold name="min_score" operator="gte" basis="per_call" parameter="PARAM-A">0.7</threshold>
      <threshold name="max_error" operator="lte" basis="cumulative">0.1</threshold>
    </ac>
    <ac id="AC-002">
      <given>an edge case</given>
      <when>something unusual happens</when>
      <then>the system handles it gracefully</then>
    </ac>
  </acceptance_criteria>
</bdd_story>
`;

const STORY_WITH_GHERKIN_XML = `
<bdd_story id="STORY-003" version="1.0">
  <metadata>
    <title>Story With Gherkin</title>
  </metadata>
  <user_story>
    <as_a>QA engineer</as_a>
    <i_want>Gherkin scenarios parsed</i_want>
    <so_that>I can run automated tests</so_that>
  </user_story>
  <acceptance_criteria>
    <ac id="AC-G1">
      <given>a test setup</given>
      <when>test runs</when>
      <then>it passes</then>
      <gherkin>
Scenario: Happy path
  Given the system is ready
  When the user submits a request
  Then the response is successful
  And the data is saved

Scenario: Error handling
  Given the system is ready
  When the user submits invalid data
  Then an error message is shown
      </gherkin>
    </ac>
  </acceptance_criteria>
</bdd_story>
`;

const STORY_WITH_CONSTRAINTS_XML = `
<bdd_story id="STORY-004" version="1.0">
  <metadata>
    <title>Constrained Story</title>
  </metadata>
  <user_story>
    <as_a>admin</as_a>
    <i_want>constraints</i_want>
    <so_that>limits are enforced</so_that>
  </user_story>
  <constraints>
    <constraint id="C-001" type="performance">Response must be under 500ms</constraint>
    <constraint id="C-002" type="security">All data must be encrypted</constraint>
  </constraints>
  <failure_conditions>
    <condition id="F-001" severity="critical">
      <trigger>System timeout</trigger>
      <threshold operator=">" value="5000"/>
      <implication>Service degradation</implication>
      <action>Alert on-call team</action>
    </condition>
    <condition id="F-002" severity="warning">
      <trigger>High memory usage</trigger>
      <implication>Potential OOM</implication>
    </condition>
  </failure_conditions>
</bdd_story>
`;

const STORY_WITH_TIME_WINDOW_XML = `
<bdd_story id="STORY-005" version="1.0">
  <metadata>
    <title>Time Window Story</title>
  </metadata>
  <user_story>
    <as_a>scheduler</as_a>
    <i_want>time windows</i_want>
    <so_that>timing is controlled</so_that>
  </user_story>
  <time_window_definition>
    <name>business_hours</name>
    <start_condition>09:00 UTC</start_condition>
    <end_condition>17:00 UTC</end_condition>
    <exclusion>weekends</exclusion>
    <exclusion>public holidays</exclusion>
  </time_window_definition>
</bdd_story>
`;

const STORY_WITH_PARAM_REFS_XML = `
<bdd_story id="STORY-006" version="1.0">
  <metadata>
    <title>Param Refs Story</title>
  </metadata>
  <user_story>
    <as_a>analyst</as_a>
    <i_want>parameters</i_want>
    <so_that>measurement works</so_that>
  </user_story>
  <mvp_parameter_set>
    <parameter id="CP-001" />
    <parameter id="CP-002" />
  </mvp_parameter_set>
  <acceptance_criteria>
    <ac id="AC-P1">
      <given>input</given>
      <when>measured</when>
      <then>scored</then>
      <parameters>WARMTH, TONE</parameters>
      <threshold name="min" parameter="CP-003">0.5</threshold>
    </ac>
  </acceptance_criteria>
</bdd_story>
`;

const MINIMAL_PARAMETER_XML = `
<parameter_measurement_guide version="1.0">
  <title>Test Parameters</title>
  <parameter id="PM-001">
    <metadata>
      <n>engagement_level</n>
      <target_range min="0" max="1" />
    </metadata>
    <description>Measures how engaged the caller is</description>
    <calculation>
      <formula>0.4 * active_listening + 0.6 * verbal_cues</formula>
    </calculation>
  </parameter>
</parameter_measurement_guide>
`;

const PARAMETER_WITH_SUBMETRICS_XML = `
<parameter_measurement_guide version="2.0">
  <title>Detailed Parameters</title>
  <parameter id="PM-002">
    <metadata>
      <n>warmth_index</n>
      <target_range min="0" max="1" />
    </metadata>
    <description>Composite measure of conversational warmth</description>
    <submetrics>
      <submetric id="SM-001" name="verbal_warmth" weight="0.6">
        <description>Warm language usage</description>
        <formula>count_warm_phrases / total_phrases</formula>
        <input name="warm_phrases" source="transcript" required="true">Warm phrase count from transcript</input>
        <input name="total_phrases" source="transcript" required="true">Total phrase count</input>
        <threshold name="min" value="0.3" basis="per_call">min threshold</threshold>
        <definition term="warm_phrase">A phrase expressing empathy or friendliness</definition>
        <assumption>All transcripts are in English</assumption>
      </submetric>
      <submetric id="SM-002" name="tonal_warmth" weight="0.4">
        <description>Tone analysis score</description>
        <formula>tone_score * confidence_weight</formula>
      </submetric>
    </submetrics>
    <interpretation_scale>
      <range min="0" max="0.3" label="Cold" implication="Needs improvement"/>
      <range min="0.3" max="0.7" label="Warm" implication="Acceptable"/>
      <range min="0.7" max="1" label="Very Warm" implication="Excellent"/>
    </interpretation_scale>
    <worked_example>
      <description>Example warmth calculation</description>
      <input name="warm_phrases" value="12"/>
      <input name="total_phrases" value="40"/>
      <input name="tone_score" value="0.65"/>
      <step submetric="verbal_warmth" formula="12/40" result="0.30"/>
      <step submetric="tonal_warmth" formula="0.65*1.0" result="0.65"/>
      <final_result value="0.44" interpretation="Warm"/>
    </worked_example>
    <action_thresholds>
      <threshold value="0.3" operator="<" max="0.3" status="alert" action="Flag for coaching"/>
      <threshold value="0.7" operator=">=" max="1.0" status="excellent" action="Commend"/>
    </action_thresholds>
  </parameter>
</parameter_measurement_guide>
`;

const MULTI_PARAMETER_XML = `
<parameter_measurement_guide version="1.0">
  <title>Multiple Parameters</title>
  <parameter id="MP-001">
    <metadata><n>clarity</n></metadata>
    <description>How clear the communication is</description>
  </parameter>
  <parameter id="MP-002">
    <metadata><n>empathy</n></metadata>
    <description>Level of empathy shown</description>
  </parameter>
  <parameter id="MP-003">
    <metadata><n>professionalism</n></metadata>
    <description>Professional conduct level</description>
  </parameter>
</parameter_measurement_guide>
`;

// =====================================================
// parseBDDXml — STORY file type
// =====================================================

describe("parseBDDXml — STORY file type", () => {
  it("parses a minimal story with user story fields", () => {
    const result = parseBDDXml(MINIMAL_STORY_XML, "STORY");

    expect(result.storyId).toBe("TEST-001");
    expect(result.name).toBe("Test Story");
    expect(result.story).toBeDefined();
    expect(result.story!.id).toBe("TEST-001");
    expect(result.story!.title).toBe("Test Story");
    expect(result.story!.asA).toBe("tester");
    expect(result.story!.iWant).toBe("to verify parsing");
    expect(result.story!.soThat).toBe("tests pass");
  });

  it("extracts version from the bdd_story attribute", () => {
    const result = parseBDDXml(MINIMAL_STORY_XML, "STORY");
    expect(result.version).toBe("1.0");
  });

  it("parses acceptance criteria with thresholds", () => {
    const result = parseBDDXml(STORY_WITH_AC_XML, "STORY");
    const acs = result.story!.acceptanceCriteria;

    expect(acs).toHaveLength(2);

    // First AC has full details
    expect(acs[0].id).toBe("AC-001");
    expect(acs[0].title).toBe("Basic Validation");
    expect(acs[0].given).toBe("a valid input");
    expect(acs[0].when).toBe("the system processes it");
    expect(acs[0].then).toBe("the output is correct");
    expect(acs[0].reason).toBe("correctness matters");
    expect(acs[0].parameters).toEqual(["PARAM-A", "PARAM-B"]);

    // Check thresholds
    expect(acs[0].thresholds).toBeDefined();
    expect(acs[0].thresholds!["min_score"]).toEqual({
      value: 0.7,
      operator: "gte",
      basis: "per_call",
      parameter: "PARAM-A",
    });
    expect(acs[0].thresholds!["max_error"]).toEqual({
      value: 0.1,
      operator: "lte",
      basis: "cumulative",
      parameter: undefined,
    });

    // Second AC is minimal
    expect(acs[1].id).toBe("AC-002");
    expect(acs[1].title).toBeUndefined();
    expect(acs[1].given).toBe("an edge case");
  });

  it("parses Gherkin scenarios from acceptance criteria", () => {
    const result = parseBDDXml(STORY_WITH_GHERKIN_XML, "STORY");
    const scenarios = result.story!.scenarios;

    expect(scenarios.length).toBeGreaterThanOrEqual(2);

    const happyPath = scenarios.find((s) => s.name === "Happy path");
    expect(happyPath).toBeDefined();
    expect(happyPath!.given).toContain("the system is ready");
    expect(happyPath!.when).toContain("the user submits a request");
    expect(happyPath!.then.length).toBeGreaterThanOrEqual(1);

    const errorHandling = scenarios.find((s) => s.name === "Error handling");
    expect(errorHandling).toBeDefined();
  });

  it("parses constraints with id and type", () => {
    const result = parseBDDXml(STORY_WITH_CONSTRAINTS_XML, "STORY");
    const constraints = result.story!.constraints;

    expect(constraints).toHaveLength(2);
    expect(constraints[0].id).toBe("C-001");
    expect(constraints[0].type).toBe("performance");
    expect(constraints[0].description).toBe("Response must be under 500ms");
    expect(constraints[1].id).toBe("C-002");
    expect(constraints[1].type).toBe("security");
  });

  it("parses failure conditions with thresholds and actions", () => {
    const result = parseBDDXml(STORY_WITH_CONSTRAINTS_XML, "STORY");
    const fcs = result.story!.failureConditions;

    expect(fcs).toHaveLength(2);

    // Critical failure condition with threshold
    expect(fcs[0].id).toBe("F-001");
    expect(fcs[0].severity).toBe("critical");
    expect(fcs[0].trigger).toBe("System timeout");
    expect(fcs[0].threshold).toEqual({ operator: ">", value: 5000 });
    expect(fcs[0].implication).toBe("Service degradation");
    expect(fcs[0].action).toBe("Alert on-call team");

    // Warning failure condition without threshold
    expect(fcs[1].id).toBe("F-002");
    expect(fcs[1].severity).toBe("warning");
    expect(fcs[1].trigger).toBe("High memory usage");
    expect(fcs[1].threshold).toBeUndefined();
  });

  it("parses time window definitions", () => {
    const result = parseBDDXml(STORY_WITH_TIME_WINDOW_XML, "STORY");
    const tw = result.story!.timeWindow;

    expect(tw).toBeDefined();
    expect(tw!.name).toBe("business_hours");
    expect(tw!.start).toBe("09:00 UTC");
    expect(tw!.end).toBe("17:00 UTC");
    expect(tw!.exclusions).toEqual(["weekends", "public holidays"]);
  });

  it("extracts parameter references from multiple sources", () => {
    const result = parseBDDXml(STORY_WITH_PARAM_REFS_XML, "STORY");

    // Should extract from <mvp_parameter_set>, <parameters> tags, and parameter="" attributes
    expect(result.parameterIds).toContain("CP-001");
    expect(result.parameterIds).toContain("CP-002");
    expect(result.parameterIds).toContain("WARMTH");
    expect(result.parameterIds).toContain("TONE");
    expect(result.parameterIds).toContain("CP-003");
  });

  it("defaults title to 'Untitled Story' when missing", () => {
    const xml = `<bdd_story id="NO-TITLE">
      <user_story><as_a>x</as_a><i_want>y</i_want><so_that>z</so_that></user_story>
    </bdd_story>`;
    const result = parseBDDXml(xml, "STORY");
    expect(result.story!.title).toBe("Untitled Story");
  });

  it("handles story XML with no user story block", () => {
    const xml = `<bdd_story id="EMPTY-STORY">
      <metadata><title>Empty</title></metadata>
    </bdd_story>`;
    const result = parseBDDXml(xml, "STORY");
    expect(result.story!.asA).toBe("");
    expect(result.story!.iWant).toBe("");
    expect(result.story!.soThat).toBe("");
  });
});

// =====================================================
// parseBDDXml — PARAMETER file type
// =====================================================

describe("parseBDDXml — PARAMETER file type", () => {
  it("parses a minimal parameter with metadata and formula", () => {
    const result = parseBDDXml(MINIMAL_PARAMETER_XML, "PARAMETER");

    expect(result.parameters).toBeDefined();
    expect(result.parameters!).toHaveLength(1);

    const param = result.parameters![0];
    expect(param.id).toBe("PM-001");
    expect(param.name).toBe("engagement_level");
    expect(param.definition).toBe("Measures how engaged the caller is");
    expect(param.formula).toBe("0.4 * active_listening + 0.6 * verbal_cues");
    expect(param.targetRange).toEqual({ min: 0, max: 1 });
  });

  it("extracts name from title tag for PARAMETER type", () => {
    const result = parseBDDXml(MINIMAL_PARAMETER_XML, "PARAMETER");
    expect(result.name).toBe("Test Parameters");
  });

  it("extracts version from parameter guide", () => {
    const result = parseBDDXml(MINIMAL_PARAMETER_XML, "PARAMETER");
    expect(result.version).toBe("1.0");
  });

  it("sets parameterIds from parsed parameters", () => {
    const result = parseBDDXml(MINIMAL_PARAMETER_XML, "PARAMETER");
    expect(result.parameterIds).toEqual(["PM-001"]);
  });

  it("parses submetrics with full details", () => {
    const result = parseBDDXml(PARAMETER_WITH_SUBMETRICS_XML, "PARAMETER");
    const param = result.parameters![0];

    expect(param.submetrics).toBeDefined();
    expect(param.submetrics!).toHaveLength(2);

    const sm1 = param.submetrics![0];
    expect(sm1.id).toBe("SM-001");
    expect(sm1.name).toBe("verbal_warmth");
    expect(sm1.weight).toBe(0.6);
    expect(sm1.description).toBe("Warm language usage");
    expect(sm1.formula).toBe("count_warm_phrases / total_phrases");

    // Inputs
    expect(sm1.inputs).toHaveLength(2);
    expect(sm1.inputs![0]).toEqual({
      name: "warm_phrases",
      source: "transcript",
      required: true,
      description: "Warm phrase count from transcript",
    });

    // Thresholds
    expect(sm1.thresholds).toBeDefined();
    expect(sm1.thresholds!["min"]).toEqual({ value: 0.3, basis: "per_call" });

    // Definitions
    expect(sm1.definitions).toBeDefined();
    expect(sm1.definitions!["warm_phrase"]).toBe("A phrase expressing empathy or friendliness");

    // Assumptions
    expect(sm1.assumptions).toEqual(["All transcripts are in English"]);

    // Second submetric
    const sm2 = param.submetrics![1];
    expect(sm2.id).toBe("SM-002");
    expect(sm2.name).toBe("tonal_warmth");
    expect(sm2.weight).toBe(0.4);
  });

  it("parses interpretation scale", () => {
    const result = parseBDDXml(PARAMETER_WITH_SUBMETRICS_XML, "PARAMETER");
    const param = result.parameters![0];

    expect(param.interpretationScale).toBeDefined();
    expect(param.interpretationScale!).toHaveLength(3);
    expect(param.interpretationScale![0]).toEqual({
      min: 0,
      max: 0.3,
      label: "Cold",
      implication: "Needs improvement",
    });
    expect(param.interpretationScale![2]).toEqual({
      min: 0.7,
      max: 1,
      label: "Very Warm",
      implication: "Excellent",
    });
  });

  it("parses worked examples", () => {
    const result = parseBDDXml(PARAMETER_WITH_SUBMETRICS_XML, "PARAMETER");
    const param = result.parameters![0];

    expect(param.workedExample).toBeDefined();
    const we = param.workedExample!;
    expect(we.description).toBe("Example warmth calculation");
    expect(we.inputs).toEqual({
      warm_phrases: 12,
      total_phrases: 40,
      tone_score: 0.65,
    });
    expect(we.steps).toHaveLength(2);
    expect(we.steps[0]).toEqual({
      submetric: "verbal_warmth",
      formula: "12/40",
      result: "0.30",
    });
    expect(we.finalResult).toEqual({
      value: "0.44",
      interpretation: "Warm",
    });
  });

  it("parses action thresholds", () => {
    const result = parseBDDXml(PARAMETER_WITH_SUBMETRICS_XML, "PARAMETER");
    const param = result.parameters![0];

    expect(param.thresholds).toBeDefined();
    expect(param.thresholds!["alert"]).toEqual({
      value: 0.3,
      operator: "<",
    });
    expect(param.thresholds!["excellent"]).toEqual({
      value: 0.7,
      operator: ">=",
    });
  });

  it("parses multiple parameters from one file", () => {
    const result = parseBDDXml(MULTI_PARAMETER_XML, "PARAMETER");

    expect(result.parameters).toHaveLength(3);
    expect(result.parameterIds).toEqual(["MP-001", "MP-002", "MP-003"]);

    expect(result.parameters![0].name).toBe("clarity");
    expect(result.parameters![1].name).toBe("empathy");
    expect(result.parameters![2].name).toBe("professionalism");
  });

  it("falls back to parameter IDs for name when no title", () => {
    const xml = `<parameter_measurement_guide version="1.0">
      <parameter id="X-001"><metadata><n>alpha</n></metadata><description>A</description></parameter>
      <parameter id="X-002"><metadata><n>beta</n></metadata><description>B</description></parameter>
    </parameter_measurement_guide>`;
    const result = parseBDDXml(xml, "PARAMETER");
    expect(result.name).toBe("Parameters: X-001, X-002");
  });

  it("handles parameter with no metadata block", () => {
    const xml = `<parameter_measurement_guide version="1.0">
      <title>No Metadata</title>
      <parameter id="NM-001">
        <description>A standalone parameter</description>
      </parameter>
    </parameter_measurement_guide>`;
    const result = parseBDDXml(xml, "PARAMETER");
    const param = result.parameters![0];

    expect(param.id).toBe("NM-001");
    expect(param.name).toBe("NM-001"); // Falls back to id
    expect(param.definition).toBe("A standalone parameter");
    expect(param.targetRange).toBeUndefined();
    expect(param.formula).toBeUndefined();
  });
});

// =====================================================
// parseBDDXml — Edge Cases
// =====================================================

describe("parseBDDXml — edge cases", () => {
  it("handles empty XML content for STORY", () => {
    const result = parseBDDXml("", "STORY");
    expect(result.story).toBeDefined();
    expect(result.story!.title).toBe("Untitled Story");
    expect(result.story!.acceptanceCriteria).toEqual([]);
  });

  it("handles empty XML content for PARAMETER", () => {
    const result = parseBDDXml("", "PARAMETER");
    expect(result.parameters).toEqual([]);
    expect(result.parameterIds).toEqual([]);
  });

  it("returns parameterIds as empty array for STORY without refs", () => {
    const result = parseBDDXml(MINIMAL_STORY_XML, "STORY");
    expect(result.parameterIds).toEqual([]);
  });

  it("extracts version with single quotes", () => {
    const xml = `<bdd_story id='SQ-001' version='3.5'>
      <metadata><title>Quoted</title></metadata>
      <user_story><as_a>x</as_a><i_want>y</i_want><so_that>z</so_that></user_story>
    </bdd_story>`;
    const result = parseBDDXml(xml, "STORY");
    expect(result.version).toBe("3.5");
  });

  it("does not set version when attribute is missing", () => {
    const xml = `<bdd_story id="NO-VER">
      <metadata><title>No Version</title></metadata>
      <user_story><as_a>x</as_a><i_want>y</i_want><so_that>z</so_that></user_story>
    </bdd_story>`;
    const result = parseBDDXml(xml, "STORY");
    expect(result.version).toBeUndefined();
  });
});
