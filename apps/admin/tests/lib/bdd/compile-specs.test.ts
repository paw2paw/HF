/**
 * Tests for lib/bdd/compile-specs.ts
 *
 * Tests the spec-to-template compiler that generates LLM-ready
 * promptTemplate strings from BDD spec JSON. Routes specs by
 * specRole and outputType to specialized compilers.
 *
 * Covers:
 * - compileSpecToTemplate(): main routing function
 * - IDENTITY spec compilation (role, traits, techniques, boundaries, session structure)
 * - CONTENT spec compilation (source metadata, core argument, case studies, modules)
 * - MEASURE spec compilation (parameters, scoring anchors, interpretation)
 * - ADAPT spec compilation (adaptation parameters, triggers)
 * - LEARN spec compilation (memory extraction, constraints)
 * - REWARD spec compilation (reward formulas)
 * - COMPOSE spec compilation (system instructions, section guides, execution rules)
 * - Generic fallback compilation
 * - compileAllSpecs(): batch compilation
 */

import { describe, it, expect } from "vitest";
import { compileSpecToTemplate, compileAllSpecs } from "@/lib/bdd/compile-specs";
import type { CompileResult } from "@/lib/bdd/compile-specs";
import type { JsonFeatureSpec, JsonParameter } from "@/lib/bdd/ai-parser";

// =====================================================
// HELPERS
// =====================================================

function makeSpec(overrides: Partial<JsonFeatureSpec> & { id?: string }): JsonFeatureSpec {
  return {
    id: overrides.id || "TEST-001",
    title: overrides.title || "Test Spec",
    version: overrides.version || "1.0",
    story: overrides.story || {
      asA: "system",
      iWant: "to test compilation",
      soThat: "specs compile correctly",
    },
    parameters: overrides.parameters || [],
    specRole: overrides.specRole,
    outputType: overrides.outputType,
    ...overrides,
  };
}

function makeParam(overrides: Partial<JsonParameter> & { id?: string }): JsonParameter {
  return {
    id: overrides.id || "P-001",
    name: overrides.name || "Test Parameter",
    description: overrides.description || "A test parameter",
    ...overrides,
  };
}

// =====================================================
// compileSpecToTemplate — Routing
// =====================================================

describe("compileSpecToTemplate — routing", () => {
  it("routes IDENTITY specRole to identity compiler", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Agent Identity",
      parameters: [
        makeParam({
          id: "role",
          name: "Agent Role",
          config: { role: "Language Tutor", name: "Mabel", corePurpose: "Teach languages" },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("AGENT IDENTITY");
    expect(result.promptTemplate).toContain("Language Tutor");
    expect(result.promptTemplate).toContain("Mabel");
    expect(result.sections).toContain("role");
    expect(result.sections).toContain("corePurpose");
  });

  it("routes CONTENT specRole to content compiler", () => {
    const spec = makeSpec({
      specRole: "CONTENT",
      title: "Course Content",
      parameters: [
        makeParam({
          id: "source",
          name: "Source Metadata",
          config: { title: "The Art of Learning", authors: ["Josh Waitzkin"], year: 2007 },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("COURSE CONTENT");
    expect(result.promptTemplate).toContain("The Art of Learning");
    expect(result.promptTemplate).toContain("Josh Waitzkin");
    expect(result.sections).toContain("sourceMetadata");
  });

  it("routes VOICE specRole to identity compiler", () => {
    const spec = makeSpec({
      specRole: "VOICE",
      title: "Voice Settings",
      parameters: [
        makeParam({
          id: "role",
          name: "Voice Role",
          config: { role: "Friendly Assistant" },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("VOICE SETTINGS");
    expect(result.promptTemplate).toContain("Friendly Assistant");
  });

  it("routes MEASURE outputType to measure compiler", () => {
    const spec = makeSpec({
      outputType: "MEASURE",
      title: "Scoring Parameters",
      parameters: [
        makeParam({
          id: "warmth",
          name: "Warmth Score",
          description: "Conversational warmth measurement",
          targetRange: { min: 0, max: 1 },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("SCORING PARAMETERS");
    expect(result.promptTemplate).toContain("Warmth Score");
    expect(result.promptTemplate).toContain("0 - 1");
    expect(result.sections).toContain("warmth");
  });

  it("routes ADAPT outputType to adapt compiler", () => {
    const spec = makeSpec({
      outputType: "ADAPT",
      title: "Adaptation Rules",
      parameters: [
        makeParam({
          id: "openness",
          name: "Openness Adaptation",
          description: "Adapt based on openness level",
          promptGuidance: {
            whenHigh: "Use exploratory language",
            whenLow: "Use structured approaches",
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("ADAPTATION RULES");
    expect(result.promptTemplate).toContain("Use exploratory language");
    expect(result.promptTemplate).toContain("Use structured approaches");
    expect(result.sections).toContain("openness");
  });

  it("routes LEARN outputType to learn compiler", () => {
    const spec = makeSpec({
      outputType: "LEARN",
      title: "Memory Extraction",
      parameters: [
        makeParam({
          id: "facts",
          name: "Fact Extraction",
          description: "Extract facts from conversation",
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("MEMORY EXTRACTION");
    expect(result.promptTemplate).toContain("Fact Extraction");
  });

  it("routes REWARD outputType to reward compiler", () => {
    const spec = makeSpec({
      outputType: "REWARD",
      title: "Reward Calculation",
      parameters: [
        makeParam({
          id: "reward",
          name: "Engagement Reward",
          description: "Reward signal for engagement",
          formula: "0.5 * score + 0.5 * progress",
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("REWARD CALCULATION");
    expect(result.promptTemplate).toContain("`0.5 * score + 0.5 * progress`");
  });

  it("routes MEASURE_AGENT outputType to measure_agent compiler", () => {
    const spec = makeSpec({
      outputType: "MEASURE_AGENT",
      title: "Agent Evaluation",
      parameters: [
        makeParam({
          id: "adherence",
          name: "Script Adherence",
          description: "How well the agent follows the script",
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("AGENT EVALUATION");
    expect(result.promptTemplate).toContain("Evaluating agent responses against targets");
    expect(result.promptTemplate).toContain("Script Adherence");
  });

  it("routes COMPOSE outputType to compose compiler", () => {
    const spec = makeSpec({
      outputType: "COMPOSE",
      title: "Prompt Composition",
      parameters: [
        makeParam({
          id: "compose",
          name: "Composition Guide",
          description: "How to compose prompts",
          config: {
            systemInstruction: "You are an AI tutor",
            executionRules: ["Rule 1", "Rule 2"],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("PROMPT COMPOSITION");
    expect(result.promptTemplate).toContain("You are an AI tutor");
    expect(result.promptTemplate).toContain("Rule 1");
  });

  it("falls back to generic compiler for unknown outputType", () => {
    const spec = makeSpec({
      outputType: "AGGREGATE" as any,
      title: "Unknown Type",
      parameters: [
        makeParam({ id: "p1", name: "Param", description: "Desc" }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("UNKNOWN TYPE");
    expect(result.warnings).toContain("Using generic template for AGGREGATE spec");
  });

  it("defaults to MEASURE outputType when specRole is not IDENTITY/CONTENT/VOICE", () => {
    const spec = makeSpec({
      title: "Default Test",
      parameters: [
        makeParam({
          id: "p1",
          name: "Default Param",
          description: "Test desc",
          targetRange: { min: 0, max: 10 },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    // Defaults to MEASURE (which includes scale display)
    expect(result.promptTemplate).toContain("DEFAULT TEST");
    expect(result.promptTemplate).toContain("0 - 10");
  });
});

// =====================================================
// compileSpecToTemplate — IDENTITY details
// =====================================================

describe("compileSpecToTemplate — IDENTITY details", () => {
  it("compiles traits from config", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Agent Config",
      parameters: [
        makeParam({
          name: "Personality Traits",
          config: {
            traits: [
              { name: "Warm", description: "Uses empathetic language" },
              { name: "Patient", description: "Never rushes the learner" },
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**Warm**: Uses empathetic language");
    expect(result.promptTemplate).toContain("**Patient**: Never rushes the learner");
    expect(result.sections).toContain("traits");
  });

  it("compiles traits as strings", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Agent Config",
      parameters: [
        makeParam({
          name: "Character Traits",
          config: { traits: ["Warm", "Patient", "Encouraging"] },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("- Warm");
    expect(result.promptTemplate).toContain("- Patient");
    expect(result.promptTemplate).toContain("- Encouraging");
  });

  it("compiles techniques from config", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Teaching Methods",
      parameters: [
        makeParam({
          name: "Teaching Techniques",
          config: {
            techniques: [
              { name: "Socratic", description: "Ask guiding questions" },
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**Socratic**: Ask guiding questions");
    expect(result.sections).toContain("techniques");
  });

  it("compiles boundaries (dos and donts)", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Agent Boundaries",
      parameters: [
        makeParam({
          name: "Boundary Rules",
          config: {
            dos: ["Encourage questions", "Give positive feedback"],
            donts: ["Provide medical advice", "Share personal opinions"],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("YOU DO:");
    expect(result.promptTemplate).toContain("- Encourage questions");
    expect(result.promptTemplate).toContain("YOU DO NOT:");
    expect(result.promptTemplate).toContain("- Provide medical advice");
    expect(result.sections).toContain("boundaries");
  });

  it("compiles response patterns", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Response Config",
      parameters: [
        makeParam({
          name: "Response Patterns",
          config: {
            responsePatterns: [
              { situation: "Confused learner", response: "Simplify and rephrase" },
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**Confused learner**: Simplify and rephrase");
    expect(result.sections).toContain("responsePatterns");
  });

  it("compiles session structure", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Session Flow",
      parameters: [
        makeParam({
          name: "Session Structure",
          config: {
            sessionStructure: {
              opening: { instruction: "Greet the learner warmly" },
              phases: [
                { name: "Review", description: "Review previous topics" },
                { name: "New Material", description: "Introduce new concepts" },
              ],
              closing: { instruction: "Summarize and assign homework" },
            },
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**Opening**: Greet the learner warmly");
    expect(result.promptTemplate).toContain("**Review**: Review previous topics");
    expect(result.promptTemplate).toContain("**New Material**: Introduce new concepts");
    expect(result.promptTemplate).toContain("**Closing**: Summarize and assign homework");
    expect(result.sections).toContain("sessionStructure");
  });

  it("adds prompt guidance from parameters", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "With Guidance",
      parameters: [
        makeParam({
          name: "Role Identity",
          config: { role: "Tutor" },
          promptGuidance: {
            whenHigh: "Be more casual",
            whenLow: "Be more formal",
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("High: Be more casual");
    expect(result.promptTemplate).toContain("Low: Be more formal");
    expect(result.sections).toContain("promptGuidance");
  });

  it("generates warning for empty IDENTITY spec", () => {
    const spec = makeSpec({
      specRole: "IDENTITY",
      title: "Empty Identity",
      parameters: [makeParam({ name: "nothing_useful", config: {} })],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.warnings).toContain(
      "IDENTITY spec has no extractable config - using generic template"
    );
    expect(result.promptTemplate).toContain("This is Empty Identity.");
  });
});

// =====================================================
// compileSpecToTemplate — CONTENT details
// =====================================================

describe("compileSpecToTemplate — CONTENT details", () => {
  it("compiles core argument with supporting points", () => {
    const spec = makeSpec({
      specRole: "CONTENT",
      title: "Book Content",
      parameters: [
        makeParam({
          name: "Core Argument",
          config: {
            mainThesis: "Practice makes perfect with deliberate focus",
            supportingPoints: [
              "Focus on weaknesses",
              "Seek constant feedback",
              "Set stretch goals",
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("### Core Argument");
    expect(result.promptTemplate).toContain("Practice makes perfect with deliberate focus");
    expect(result.promptTemplate).toContain("- Focus on weaknesses");
    expect(result.promptTemplate).toContain("- Set stretch goals");
    expect(result.sections).toContain("coreArgument");
  });

  it("compiles case studies", () => {
    const spec = makeSpec({
      specRole: "CONTENT",
      title: "Cases",
      parameters: [
        makeParam({
          name: "Case Studies",
          config: {
            studies: [
              { name: "Chess Master", lesson: "Pattern recognition is key" },
              { name: "Language Learner", lesson: "Immersion accelerates learning" },
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**Chess Master**: Pattern recognition is key");
    expect(result.promptTemplate).toContain("**Language Learner**: Immersion accelerates learning");
    expect(result.sections).toContain("caseStudies");
  });

  it("compiles discussion questions", () => {
    const spec = makeSpec({
      specRole: "CONTENT",
      title: "Discussion",
      parameters: [
        makeParam({
          name: "Discussion Questions",
          config: {
            questions: [
              "What motivates you to learn?",
              "How do you handle frustration?",
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("- What motivates you to learn?");
    expect(result.promptTemplate).toContain("- How do you handle frustration?");
    expect(result.sections).toContain("discussionQuestions");
  });

  it("compiles curriculum modules", () => {
    const spec = makeSpec({
      specRole: "CONTENT",
      title: "Curriculum",
      parameters: [
        makeParam({
          name: "Module List",
          config: {
            modules: [
              { name: "Foundations", objective: "Build core understanding" },
              { name: "Advanced", objective: "Develop mastery" },
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("1. **Foundations**: Build core understanding");
    expect(result.promptTemplate).toContain("2. **Advanced**: Develop mastery");
    expect(result.sections).toContain("modules");
  });

  it("generates warning for empty CONTENT spec", () => {
    const spec = makeSpec({
      specRole: "CONTENT",
      title: "Empty Content",
      parameters: [makeParam({ name: "nothing", config: {} })],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.warnings).toContain(
      "CONTENT spec has no extractable config - using story"
    );
  });
});

// =====================================================
// compileSpecToTemplate — MEASURE details
// =====================================================

describe("compileSpecToTemplate — MEASURE details", () => {
  it("includes story context", () => {
    const spec = makeSpec({
      outputType: "MEASURE",
      title: "Scoring",
      story: { asA: "scorer", iWant: "to score calls", soThat: "quality improves" },
      parameters: [makeParam({ name: "Quality", description: "Quality score" })],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("*quality improves*");
  });

  it("includes scoring anchors", () => {
    const spec = makeSpec({
      outputType: "MEASURE",
      title: "Calibration",
      parameters: [
        makeParam({
          name: "Warmth",
          description: "Warmth level",
          scoringAnchors: [
            { score: 1.0, example: "Great warmth shown throughout", rationale: "Consistent empathy" },
            { score: 0.2, example: "Cold and distant throughout", rationale: "No empathy" },
          ],
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("Score 1: \"Great warmth shown throughout\"");
    expect(result.promptTemplate).toContain("*Consistent empathy*");
    expect(result.promptTemplate).toContain("Score 0.2:");
  });

  it("includes interpretation scale", () => {
    const spec = makeSpec({
      outputType: "MEASURE",
      title: "Interpretation",
      parameters: [
        makeParam({
          name: "Engagement",
          description: "Engagement level",
          interpretationScale: [
            { min: 0, max: 0.3, label: "Low", implication: "Disengaged" },
            { min: 0.7, max: 1, label: "High", implication: "Fully engaged" },
          ],
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("Low (0-0.3): Disengaged");
    expect(result.promptTemplate).toContain("High (0.7-1): Fully engaged");
  });

  it("includes prompt guidance (whenHigh/whenLow)", () => {
    const spec = makeSpec({
      outputType: "MEASURE",
      title: "Guidance",
      parameters: [
        makeParam({
          name: "Score",
          description: "Score desc",
          promptGuidance: {
            whenHigh: "Reinforce positive behavior",
            whenLow: "Suggest improvement areas",
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**High Score Guidance**: Reinforce positive behavior");
    expect(result.promptTemplate).toContain("**Low Score Guidance**: Suggest improvement areas");
  });
});

// =====================================================
// compileSpecToTemplate — COMPOSE details
// =====================================================

describe("compileSpecToTemplate — COMPOSE details", () => {
  it("renders system instruction", () => {
    const spec = makeSpec({
      outputType: "COMPOSE",
      title: "Composition",
      parameters: [
        makeParam({
          name: "Preamble",
          description: "System preamble",
          config: { systemInstruction: "You are an AI-powered language tutor" },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("> You are an AI-powered language tutor");
  });

  it("renders execution rules as numbered list", () => {
    const spec = makeSpec({
      outputType: "COMPOSE",
      title: "Rules",
      parameters: [
        makeParam({
          name: "Execution",
          description: "Execution rules",
          config: {
            executionRules: [
              "Always greet first",
              "Check understanding regularly",
              "End with summary",
            ],
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("1. Always greet first");
    expect(result.promptTemplate).toContain("2. Check understanding regularly");
    expect(result.promptTemplate).toContain("3. End with summary");
  });

  it("renders adaptation rules with readable keys", () => {
    const spec = makeSpec({
      outputType: "COMPOSE",
      title: "Adapt",
      parameters: [
        makeParam({
          name: "Adapt Rules",
          description: "Adaptation rules",
          config: {
            adaptationRules: {
              whenReviewFails: "Simplify the content",
              whenLearnerStruggles: "Offer more examples",
            },
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("Simplify the content");
    expect(result.promptTemplate).toContain("Offer more examples");
  });

  it("renders config flags and thresholds", () => {
    const spec = makeSpec({
      outputType: "COMPOSE",
      title: "Config",
      parameters: [
        makeParam({
          name: "Settings",
          description: "Config settings",
          config: {
            enableCache: true,
            maxRetries: 3,
            thresholds: { minScore: 0.5, maxLatency: 1000 },
          },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("enableCache: `true`");
    expect(result.promptTemplate).toContain("maxRetries: `3`");
    expect(result.promptTemplate).toContain("minScore=0.5");
    expect(result.promptTemplate).toContain("maxLatency=1000");
  });

  it("renders constraints section", () => {
    const spec = makeSpec({
      outputType: "COMPOSE",
      title: "Constrained Composition",
      parameters: [makeParam({ name: "P", description: "D" })],
      constraints: [
        { id: "C1", description: "Max 2000 tokens", severity: "warning" },
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("Composition Constraints");
    expect(result.promptTemplate).toContain("Max 2000 tokens");
    expect(result.sections).toContain("constraints");
  });
});

// =====================================================
// compileSpecToTemplate — LEARN details
// =====================================================

describe("compileSpecToTemplate — LEARN details", () => {
  it("renders constraints first", () => {
    const spec = makeSpec({
      outputType: "LEARN",
      title: "Memory Guide",
      parameters: [makeParam({ name: "Facts", description: "Extract facts" })],
      constraints: [
        { id: "C1", description: "Never extract PII", severity: "critical" },
      ],
    });

    const result = compileSpecToTemplate(spec);
    const constraintIndex = result.promptTemplate.indexOf("Never extract PII");
    const paramIndex = result.promptTemplate.indexOf("Extract facts");
    expect(constraintIndex).toBeLessThan(paramIndex);
    expect(result.sections).toContain("constraints");
  });

  it("renders sub-metrics with weights", () => {
    const spec = makeSpec({
      outputType: "LEARN",
      title: "Learning",
      parameters: [
        makeParam({
          name: "Fact Quality",
          description: "Quality of extracted facts",
          subMetrics: [
            { id: "acc", name: "Accuracy", weight: 0.6, description: "How accurate the fact is" },
            { id: "rel", name: "Relevance", weight: 0.4, description: "How relevant the fact is" },
          ],
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**Accuracy** (60%)");
    expect(result.promptTemplate).toContain("**Relevance** (40%)");
  });
});

// =====================================================
// compileSpecToTemplate — Generic fallback
// =====================================================

describe("compileSpecToTemplate — generic fallback", () => {
  it("renders story as user story sentence", () => {
    const spec = makeSpec({
      outputType: "AGGREGATE" as any,
      title: "Aggregate Spec",
      story: {
        asA: "system",
        iWant: "To aggregate data",
        soThat: "Summaries are accurate",
      },
      parameters: [makeParam({ name: "Agg", description: "Aggregation" })],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("As system, to aggregate data so that summaries are accurate.");
  });

  it("includes prompt guidance in generic output", () => {
    const spec = makeSpec({
      outputType: "AGGREGATE" as any,
      title: "Generic",
      parameters: [
        makeParam({
          name: "Metric",
          description: "A metric",
          promptGuidance: { whenHigh: "Summarize broadly", whenLow: "Focus on details" },
        }),
      ],
    });

    const result = compileSpecToTemplate(spec);
    expect(result.promptTemplate).toContain("**High**: Summarize broadly");
    expect(result.promptTemplate).toContain("**Low**: Focus on details");
  });
});

// =====================================================
// compileAllSpecs
// =====================================================

describe("compileAllSpecs", () => {
  it("compiles multiple specs and returns a map keyed by spec ID", () => {
    const specs = [
      makeSpec({ id: "SPEC-A", title: "Spec A", outputType: "MEASURE", parameters: [] }),
      makeSpec({ id: "SPEC-B", title: "Spec B", specRole: "IDENTITY", parameters: [] }),
    ];

    const results = compileAllSpecs(specs);

    expect(results.size).toBe(2);
    expect(results.has("SPEC-A")).toBe(true);
    expect(results.has("SPEC-B")).toBe(true);

    const specA = results.get("SPEC-A")!;
    expect(specA.promptTemplate).toContain("SPEC A");

    const specB = results.get("SPEC-B")!;
    expect(specB.promptTemplate).toContain("SPEC B");
  });

  it("returns empty map for empty input", () => {
    const results = compileAllSpecs([]);
    expect(results.size).toBe(0);
  });
});
