/**
 * Tests for lib/bdd/spec-generator.ts
 *
 * Tests the scoring spec generator that takes compiled BDD feature data
 * and generates structured scoring specifications for LLM-based transcript
 * analysis.
 *
 * Covers:
 * - generateScoringSpec(): main generation function
 * - Parameter spec generation (submetrics, interpretation scale, target range)
 * - Instruction generation (parameters, constraints, output format)
 * - Output schema generation (JSON Schema for LLM output)
 * - generateParameterPrompt(): compact single-parameter prompt
 * - Metadata generation
 * - Edge cases (empty parameters, no constraints, no submetrics)
 */

import { describe, it, expect } from "vitest";
import { generateScoringSpec, generateParameterPrompt } from "@/lib/bdd/spec-generator";
import type { ScoringSpec, ParameterSpec } from "@/lib/bdd/spec-generator";

// =====================================================
// FIXTURES
// =====================================================

function makeFeatureSet(overrides: Record<string, any> = {}) {
  return {
    featureId: overrides.featureId || "FEAT-001",
    name: overrides.name || "Test Feature",
    version: overrides.version || "2.0",
    description: overrides.description,
    parameters: overrides.parameters || [],
    constraints: overrides.constraints || [],
    ...overrides,
  };
}

function makeParameter(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "PARAM-001",
    name: overrides.name || "test_param",
    definition: overrides.definition || "A test parameter description",
    description: overrides.description,
    formula: overrides.formula,
    targetRange: overrides.targetRange,
    submetrics: overrides.submetrics || [],
    interpretationScale: overrides.interpretationScale || [],
    ...overrides,
  };
}

function makeSubmetric(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "SM-001",
    name: overrides.name || "sub_metric",
    weight: overrides.weight ?? 0.5,
    description: overrides.description || "A submetric",
    formula: overrides.formula || "x * weight",
    inputs: overrides.inputs || [{ name: "x" }],
    ...overrides,
  };
}

function makeConstraint(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "CON-001",
    description: overrides.description || "Must meet requirement",
    severity: overrides.severity || "warning",
    ...overrides,
  };
}

const FULL_FEATURE_SET = makeFeatureSet({
  featureId: "ENG-001",
  name: "Engagement Scoring",
  version: "3.0",
  description: "Score caller engagement from transcripts",
  parameters: [
    makeParameter({
      id: "ENG-TOTAL",
      name: "total_engagement",
      definition: "Overall engagement score combining verbal and behavioral signals",
      formula: "0.6 * verbal + 0.4 * behavioral",
      targetRange: { min: 0, max: 1 },
      submetrics: [
        makeSubmetric({
          id: "ENG-V",
          name: "verbal_engagement",
          weight: 0.6,
          description: "Engagement through speech patterns",
          formula: "word_ratio * topic_relevance",
          inputs: [{ name: "word_ratio" }, { name: "topic_relevance" }],
        }),
        makeSubmetric({
          id: "ENG-B",
          name: "behavioral_engagement",
          weight: 0.4,
          description: "Engagement through behavioral cues",
          formula: "response_time_score * follow_up_rate",
          inputs: [{ name: "response_time_score" }, { name: "follow_up_rate" }],
        }),
      ],
      interpretationScale: [
        { min: 0, max: 0.3, label: "Low", implication: "Caller is disengaged" },
        { min: 0.3, max: 0.7, label: "Moderate", implication: "Average engagement" },
        { min: 0.7, max: 1.0, label: "High", implication: "Fully engaged caller" },
      ],
    }),
    makeParameter({
      id: "TONE-001",
      name: "tone_warmth",
      definition: "Warmth of conversational tone",
      targetRange: { min: 0, max: 1 },
    }),
  ],
  constraints: [
    makeConstraint({ id: "C-001", description: "Score within 5 seconds", severity: "critical" }),
    makeConstraint({ id: "C-002", description: "Minimum 30 words in transcript", severity: "warning" }),
  ],
});

// =====================================================
// generateScoringSpec — Basic Structure
// =====================================================

describe("generateScoringSpec — basic structure", () => {
  it("returns a scoring spec with all required fields", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);

    expect(spec.version).toBe("3.0");
    expect(spec.featureId).toBe("ENG-001");
    expect(spec.name).toBe("Engagement Scoring");
    expect(spec.description).toBe("Score caller engagement from transcripts");
    expect(spec.instruction).toBeDefined();
    expect(spec.parameterSpecs).toBeDefined();
    expect(spec.outputSchema).toBeDefined();
    expect(spec.metadata).toBeDefined();
  });

  it("generates metadata with counts and timestamp", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);

    expect(spec.metadata.parameterCount).toBe(2);
    expect(spec.metadata.constraintCount).toBe(2);
    expect(spec.metadata.generatedAt).toBeDefined();
    // Timestamp should be a valid ISO string
    expect(new Date(spec.metadata.generatedAt).toISOString()).toBe(spec.metadata.generatedAt);
  });

  it("defaults version to 1.0 when not provided", () => {
    const spec = generateScoringSpec(makeFeatureSet({ version: undefined }));
    expect(spec.version).toBe("1.0");
  });
});

// =====================================================
// generateScoringSpec — Parameter Specs
// =====================================================

describe("generateScoringSpec — parameter specs", () => {
  it("generates parameter specs from feature parameters", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);

    expect(spec.parameterSpecs).toHaveLength(2);

    const engParam = spec.parameterSpecs[0];
    expect(engParam.id).toBe("ENG-TOTAL");
    expect(engParam.name).toBe("total_engagement");
    expect(engParam.description).toBe("Overall engagement score combining verbal and behavioral signals");
    expect(engParam.formula).toBe("0.6 * verbal + 0.4 * behavioral");
    expect(engParam.targetRange).toEqual({ min: 0, max: 1 });
  });

  it("generates submetric specs with input names", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const engParam = spec.parameterSpecs[0];

    expect(engParam.submetrics).toHaveLength(2);

    expect(engParam.submetrics[0].id).toBe("ENG-V");
    expect(engParam.submetrics[0].name).toBe("verbal_engagement");
    expect(engParam.submetrics[0].weight).toBe(0.6);
    expect(engParam.submetrics[0].description).toBe("Engagement through speech patterns");
    expect(engParam.submetrics[0].formula).toBe("word_ratio * topic_relevance");
    expect(engParam.submetrics[0].inputs).toEqual(["word_ratio", "topic_relevance"]);

    expect(engParam.submetrics[1].id).toBe("ENG-B");
    expect(engParam.submetrics[1].weight).toBe(0.4);
  });

  it("generates interpretation scale with action from implication", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const engParam = spec.parameterSpecs[0];

    expect(engParam.interpretationScale).toHaveLength(3);
    expect(engParam.interpretationScale[0]).toEqual({
      min: 0,
      max: 0.3,
      label: "Low",
      action: "Caller is disengaged",
    });
    expect(engParam.interpretationScale[2]).toEqual({
      min: 0.7,
      max: 1.0,
      label: "High",
      action: "Fully engaged caller",
    });
  });

  it("handles parameters with no submetrics", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const toneParam = spec.parameterSpecs[1];

    expect(toneParam.id).toBe("TONE-001");
    expect(toneParam.submetrics).toEqual([]);
    expect(toneParam.interpretationScale).toEqual([]);
  });

  it("handles parameter with no formula", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter({ formula: undefined })],
    }));

    expect(spec.parameterSpecs[0].formula).toBe("");
  });

  it("sets targetRange to null when not provided", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter({ targetRange: undefined })],
    }));

    expect(spec.parameterSpecs[0].targetRange).toBeNull();
  });

  it("prefers definition over description for parameter description", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter({ definition: "Main definition", description: "Alt description" })],
    }));

    expect(spec.parameterSpecs[0].description).toBe("Main definition");
  });

  it("falls back to description when definition is missing", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter({ definition: undefined, description: "Fallback desc" })],
    }));

    expect(spec.parameterSpecs[0].description).toBe("Fallback desc");
  });
});

// =====================================================
// generateScoringSpec — Instruction Generation
// =====================================================

describe("generateScoringSpec — instruction generation", () => {
  it("includes scoring specification title", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("# Scoring Specification: Engagement Scoring");
  });

  it("includes context section when description provided", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("## Context");
    expect(spec.instruction).toContain("Score caller engagement from transcripts");
  });

  it("omits context section when no description", () => {
    const spec = generateScoringSpec(makeFeatureSet({ description: undefined }));
    expect(spec.instruction).not.toContain("## Context");
  });

  it("includes task description", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("## Task");
    expect(spec.instruction).toContain("Analyze the provided transcript");
    expect(spec.instruction).toContain("calculate scores for each parameter");
  });

  it("includes constraints section with severity icons", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("## Constraints");
    expect(spec.instruction).toContain("CRITICAL");
    expect(spec.instruction).toContain("Score within 5 seconds");
    expect(spec.instruction).toContain("WARNING");
    expect(spec.instruction).toContain("Minimum 30 words in transcript");
  });

  it("omits constraints section when none exist", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter()],
      constraints: [],
    }));
    expect(spec.instruction).not.toContain("## Constraints");
  });

  it("includes parameter sections with IDs and names", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("### ENG-TOTAL: total_engagement");
    expect(spec.instruction).toContain("### TONE-001: tone_warmth");
  });

  it("includes parameter description", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("**Description:** Overall engagement score");
  });

  it("includes target range", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("**Target Range:** 0 - 1");
  });

  it("includes formula in code block", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("**Formula:**");
    expect(spec.instruction).toContain("0.6 * verbal + 0.4 * behavioral");
  });

  it("includes submetric details", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("**Submetrics:**");
    expect(spec.instruction).toContain("#### ENG-V: verbal_engagement (weight: 0.6)");
    expect(spec.instruction).toContain("Formula: `word_ratio * topic_relevance`");
    expect(spec.instruction).toContain("Inputs: word_ratio, topic_relevance");
  });

  it("includes interpretation scale as table", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("**Interpretation Scale:**");
    expect(spec.instruction).toContain("| Range | Label | Action |");
    expect(spec.instruction).toContain("| 0 - 0.3 | Low | Caller is disengaged |");
    expect(spec.instruction).toContain("| 0.7 - 1 | High | Fully engaged caller |");
  });

  it("includes output format JSON example", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain("## Output Format");
    expect(spec.instruction).toContain('"scores"');
    expect(spec.instruction).toContain('"ENG-TOTAL"');
    expect(spec.instruction).toContain('"TONE-001"');
    expect(spec.instruction).toContain('"constraintViolations"');
    expect(spec.instruction).toContain('"overallAssessment"');
    expect(spec.instruction).toContain('"recommendations"');
  });

  it("includes submetric IDs in output format", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    expect(spec.instruction).toContain('"ENG-V"');
    expect(spec.instruction).toContain('"ENG-B"');
  });
});

// =====================================================
// generateScoringSpec — Output Schema
// =====================================================

describe("generateScoringSpec — output schema", () => {
  it("generates valid JSON Schema structure", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const schema = spec.outputSchema;

    expect(schema.type).toBe("object");
    expect(schema.required).toContain("scores");
    expect(schema.required).toContain("constraintViolations");
    expect(schema.required).toContain("overallAssessment");
    expect(schema.required).toContain("recommendations");
  });

  it("generates score properties for each parameter", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const scores = spec.outputSchema.properties.scores;

    expect(scores.required).toContain("ENG-TOTAL");
    expect(scores.required).toContain("TONE-001");

    const engSchema = scores.properties["ENG-TOTAL"];
    expect(engSchema.type).toBe("object");
    expect(engSchema.required).toContain("value");
    expect(engSchema.required).toContain("interpretation");
    expect(engSchema.required).toContain("submetrics");
    expect(engSchema.required).toContain("reasoning");
  });

  it("includes submetric properties in score schema", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const engSchema = spec.outputSchema.properties.scores.properties["ENG-TOTAL"];
    const submetrics = engSchema.properties.submetrics.properties;

    expect(submetrics["ENG-V"]).toEqual({ type: "number", minimum: 0, maximum: 1 });
    expect(submetrics["ENG-B"]).toEqual({ type: "number", minimum: 0, maximum: 1 });
  });

  it("generates value property with number constraints", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const engSchema = spec.outputSchema.properties.scores.properties["ENG-TOTAL"];

    expect(engSchema.properties.value).toEqual({ type: "number", minimum: 0, maximum: 1 });
  });

  it("generates constraintViolations as string array", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const cv = spec.outputSchema.properties.constraintViolations;

    expect(cv.type).toBe("array");
    expect(cv.items.type).toBe("string");
  });

  it("generates recommendations as string array", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const recs = spec.outputSchema.properties.recommendations;

    expect(recs.type).toBe("array");
    expect(recs.items.type).toBe("string");
  });

  it("handles parameters with no submetrics in schema", () => {
    const spec = generateScoringSpec(FULL_FEATURE_SET);
    const toneSchema = spec.outputSchema.properties.scores.properties["TONE-001"];

    expect(toneSchema.properties.submetrics.properties).toEqual({});
  });
});

// =====================================================
// generateScoringSpec — Edge Cases
// =====================================================

describe("generateScoringSpec — edge cases", () => {
  it("handles empty parameters array", () => {
    const spec = generateScoringSpec(makeFeatureSet());

    expect(spec.parameterSpecs).toEqual([]);
    expect(spec.metadata.parameterCount).toBe(0);
    expect(spec.instruction).toContain("## Parameters to Score");
  });

  it("handles empty constraints array", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter()],
    }));

    expect(spec.metadata.constraintCount).toBe(0);
    expect(spec.instruction).not.toContain("## Constraints");
  });

  it("handles parameter with submetric that has no inputs", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [
        makeParameter({
          submetrics: [
            makeSubmetric({ inputs: undefined }),
          ],
        }),
      ],
    }));

    expect(spec.parameterSpecs[0].submetrics[0].inputs).toEqual([]);
  });

  it("handles parameter with empty description", () => {
    const spec = generateScoringSpec(makeFeatureSet({
      parameters: [makeParameter({ definition: undefined, description: undefined })],
    }));

    expect(spec.parameterSpecs[0].description).toBe("");
  });
});

// =====================================================
// generateParameterPrompt
// =====================================================

describe("generateParameterPrompt", () => {
  it("generates a compact parameter prompt", () => {
    const paramSpec: ParameterSpec = {
      id: "WRM-001",
      name: "warmth_score",
      description: "Measures conversational warmth",
      targetRange: { min: 0, max: 1 },
      formula: "0.5 * verbal_warmth + 0.5 * tonal_warmth",
      submetrics: [
        {
          id: "WRM-V",
          name: "verbal_warmth",
          weight: 0.5,
          description: "Warmth in speech",
          formula: "warm_words / total_words",
          inputs: ["warm_words", "total_words"],
        },
        {
          id: "WRM-T",
          name: "tonal_warmth",
          weight: 0.5,
          description: "Warmth in tone",
          formula: "tone_analysis_score",
          inputs: ["tone_analysis_score"],
        },
      ],
      interpretationScale: [],
    };

    const prompt = generateParameterPrompt(paramSpec);

    expect(prompt).toContain("# Score: WRM-001 (warmth_score)");
    expect(prompt).toContain("Measures conversational warmth");
    expect(prompt).toContain("Target: 0 - 1");
    expect(prompt).toContain("Formula: 0.5 * verbal_warmth + 0.5 * tonal_warmth");
    expect(prompt).toContain("## Submetrics");
    expect(prompt).toContain("**verbal_warmth** (weight 0.5): Warmth in speech");
    expect(prompt).toContain("Formula: warm_words / total_words");
    expect(prompt).toContain("**tonal_warmth** (weight 0.5): Warmth in tone");
    expect(prompt).toContain("Return: { value: 0-1, interpretation: string, submetrics: {...}, reasoning: string }");
  });

  it("omits target range when not provided", () => {
    const paramSpec: ParameterSpec = {
      id: "P-1",
      name: "test",
      description: "Test",
      targetRange: null,
      formula: "",
      submetrics: [],
      interpretationScale: [],
    };

    const prompt = generateParameterPrompt(paramSpec);
    expect(prompt).not.toContain("Target:");
  });

  it("omits formula when empty", () => {
    const paramSpec: ParameterSpec = {
      id: "P-1",
      name: "test",
      description: "Test",
      targetRange: null,
      formula: "",
      submetrics: [],
      interpretationScale: [],
    };

    const prompt = generateParameterPrompt(paramSpec);
    expect(prompt).not.toContain("Formula:");
  });

  it("omits submetrics section when no submetrics", () => {
    const paramSpec: ParameterSpec = {
      id: "P-1",
      name: "test",
      description: "Test",
      targetRange: null,
      formula: "",
      submetrics: [],
      interpretationScale: [],
    };

    const prompt = generateParameterPrompt(paramSpec);
    expect(prompt).not.toContain("## Submetrics");
  });

  it("includes submetric formula when present", () => {
    const paramSpec: ParameterSpec = {
      id: "P-1",
      name: "test",
      description: "Test",
      targetRange: null,
      formula: "",
      submetrics: [
        { id: "S-1", name: "sub", weight: 1.0, description: "Sub desc", formula: "a + b", inputs: [] },
      ],
      interpretationScale: [],
    };

    const prompt = generateParameterPrompt(paramSpec);
    expect(prompt).toContain("Formula: a + b");
  });
});
