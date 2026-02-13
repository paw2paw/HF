/**
 * Tests for teaching-content transform
 *
 * Verifies:
 * - Assertion grouping by category and chapter
 * - Module-based assertion filtering via learningOutcomeRef
 * - Fallback to all assertions when no matches
 * - Rendering of teaching points text
 */
import { describe, it, expect } from "vitest";
import { getTransform } from "@/lib/prompt/composition/TransformRegistry";
import type {
  AssembledContext,
  CompositionSectionDef,
  CurriculumAssertionData,
  SharedComputedState,
  ModuleData,
} from "@/lib/prompt/composition/types";

// Trigger transform registration
import "@/lib/prompt/composition/transforms/teaching-content";

// =====================================================
// HELPERS
// =====================================================

function makeAssertion(overrides: Partial<CurriculumAssertionData> = {}): CurriculumAssertionData {
  return {
    assertion: "The danger zone is 8°C to 63°C",
    category: "fact",
    chapter: "Chapter 1: Food Safety",
    section: null,
    pageRef: "p.12",
    tags: ["temperature"],
    trustLevel: "ACCREDITED_MATERIAL",
    examRelevance: 0.9,
    learningOutcomeRef: null,
    sourceName: "Level 2 Food Hygiene",
    sourceTrustLevel: "ACCREDITED_MATERIAL",
    ...overrides,
  };
}

function makeModule(overrides: Partial<ModuleData> = {}): ModuleData {
  return {
    id: "MOD-3",
    slug: "MOD-3",
    name: "Food Safety Hazards",
    description: "Learn about food safety hazards",
    sequence: 2,
    sortOrder: 2,
    learningOutcomes: [
      "LO2: Identify biological, chemical, physical and allergenic hazards",
      "LO2-AC2.1: List the main types of food safety hazards",
      "LO2-AC2.2: Give examples of contamination",
    ],
    content: {},
    ...overrides,
  };
}

function makeContext(overrides: {
  assertions?: CurriculumAssertionData[];
  nextModule?: ModuleData | null;
  moduleToReview?: ModuleData | null;
} = {}): AssembledContext {
  const sharedState: SharedComputedState = {
    modules: [],
    isFirstCall: false,
    daysSinceLastCall: 1,
    completedModules: new Set(),
    estimatedProgress: 0,
    lastCompletedIndex: -1,
    moduleToReview: overrides.moduleToReview ?? null,
    nextModule: overrides.nextModule ?? null,
    reviewType: "quick_recall",
    reviewReason: "Brief recall",
    thresholds: { high: 0.65, low: 0.35 },
  };

  return {
    loadedData: {
      caller: null,
      memories: [],
      personality: null,
      learnerProfile: null,
      recentCalls: [],
      callCount: 0,
      behaviorTargets: [],
      callerTargets: [],
      callerAttributes: [],
      goals: [],
      playbooks: [],
      systemSpecs: [],
      onboardingSpec: null,
      curriculumAssertions: overrides.assertions ?? [],
    },
    sections: {},
    resolvedSpecs: {
      identitySpec: null,
      contentSpec: null,
      voiceSpec: null,
    },
    sharedState,
    specConfig: {},
  };
}

const sectionDef: CompositionSectionDef = {
  id: "teaching_content",
  name: "Teaching Content",
  priority: 5,
  dataSource: "curriculumAssertions",
  activateWhen: { condition: "dataExists" },
  fallback: { action: "omit" },
  transform: "renderTeachingContent",
  outputKey: "teachingContent",
};

// =====================================================
// TESTS
// =====================================================

describe("renderTeachingContent transform", () => {
  const transform = getTransform("renderTeachingContent")!;

  it("is registered in the transform registry", () => {
    expect(transform).toBeDefined();
    expect(typeof transform).toBe("function");
  });

  describe("empty assertions", () => {
    it("returns hasTeachingContent=false when no assertions", () => {
      const ctx = makeContext({ assertions: [] });
      const result = transform(null, ctx, sectionDef);
      expect(result.hasTeachingContent).toBe(false);
      expect(result.totalAssertions).toBe(0);
      expect(result.teachingPoints).toBeNull();
    });
  });

  describe("all assertions (no module filter)", () => {
    it("renders all assertions when no current module", () => {
      const assertions = [
        makeAssertion({ assertion: "Point A", category: "fact" }),
        makeAssertion({ assertion: "Point B", category: "definition" }),
        makeAssertion({ assertion: "Point C", category: "rule" }),
      ];
      const ctx = makeContext({ assertions });
      const result = transform(null, ctx, sectionDef);

      expect(result.hasTeachingContent).toBe(true);
      expect(result.totalAssertions).toBe(3);
      expect(result.teachingPoints).toContain("Point A");
      expect(result.teachingPoints).toContain("Point B");
      expect(result.teachingPoints).toContain("Point C");
    });

    it("groups assertions by category", () => {
      const assertions = [
        makeAssertion({ assertion: "Def 1", category: "definition" }),
        makeAssertion({ assertion: "Def 2", category: "definition" }),
        makeAssertion({ assertion: "Rule 1", category: "rule" }),
      ];
      const ctx = makeContext({ assertions });
      const result = transform(null, ctx, sectionDef);

      expect(result.categories).toEqual({
        definition: 2,
        rule: 1,
      });
    });

    it("includes source citations in rendered text", () => {
      const assertions = [
        makeAssertion({ assertion: "Test point", sourceName: "My Source", pageRef: "p.42" }),
      ];
      const ctx = makeContext({ assertions });
      const result = transform(null, ctx, sectionDef);

      expect(result.teachingPoints).toContain("[My Source, p.42]");
    });

    it("includes LO refs in rendered text", () => {
      const assertions = [
        makeAssertion({ assertion: "Test", learningOutcomeRef: "R04-LO2-AC2.1" }),
      ];
      const ctx = makeContext({ assertions });
      const result = transform(null, ctx, sectionDef);

      expect(result.teachingPoints).toContain("(R04-LO2-AC2.1)");
    });

    it("collects unique sources", () => {
      const assertions = [
        makeAssertion({ sourceName: "Source A" }),
        makeAssertion({ sourceName: "Source B" }),
        makeAssertion({ sourceName: "Source A" }), // duplicate
      ];
      const ctx = makeContext({ assertions });
      const result = transform(null, ctx, sectionDef);

      expect(result.sources).toHaveLength(2);
      expect(result.sources).toContain("Source A");
      expect(result.sources).toContain("Source B");
    });
  });

  describe("module-based filtering", () => {
    it("filters assertions to current module's LOs", () => {
      const mod = makeModule({
        learningOutcomes: ["LO2: Identify hazards", "LO2-AC2.1: List hazard types"],
      });
      const assertions = [
        makeAssertion({ assertion: "LO2 relevant", learningOutcomeRef: "R04-LO2-AC2.1" }),
        makeAssertion({ assertion: "LO2 also relevant", learningOutcomeRef: "R04-LO2" }),
        makeAssertion({ assertion: "LO3 not relevant", learningOutcomeRef: "R04-LO3-AC3.1" }),
        makeAssertion({ assertion: "No ref", learningOutcomeRef: null }),
      ];
      const ctx = makeContext({ assertions, nextModule: mod });
      const result = transform(null, ctx, sectionDef);

      expect(result.totalAssertions).toBe(2);
      expect(result.teachingPoints).toContain("LO2 relevant");
      expect(result.teachingPoints).toContain("LO2 also relevant");
      expect(result.teachingPoints).not.toContain("LO3 not relevant");
      expect(result.teachingPoints).not.toContain("No ref");
    });

    it("falls back to all assertions when no LO matches", () => {
      const mod = makeModule({
        learningOutcomes: ["LO99: Something nonexistent"],
      });
      const assertions = [
        makeAssertion({ assertion: "Only point", learningOutcomeRef: "R04-LO2-AC2.1" }),
      ];
      const ctx = makeContext({ assertions, nextModule: mod });
      const result = transform(null, ctx, sectionDef);

      // No assertions match LO99, so all should be returned
      expect(result.totalAssertions).toBe(1);
      expect(result.teachingPoints).toContain("Only point");
    });

    it("uses moduleToReview as fallback when nextModule is null", () => {
      const reviewMod = makeModule({
        id: "MOD-2",
        learningOutcomes: ["LO1: Basic concepts"],
      });
      const assertions = [
        makeAssertion({ assertion: "LO1 match", learningOutcomeRef: "R01-LO1" }),
        makeAssertion({ assertion: "LO2 no match", learningOutcomeRef: "R04-LO2" }),
      ];
      const ctx = makeContext({ assertions, nextModule: null, moduleToReview: reviewMod });
      const result = transform(null, ctx, sectionDef);

      expect(result.totalAssertions).toBe(1);
      expect(result.teachingPoints).toContain("LO1 match");
    });

    it("handles AC-style LO references", () => {
      const mod = makeModule({
        learningOutcomes: ["AC2.3: Describe cross-contamination prevention"],
      });
      const assertions = [
        makeAssertion({ assertion: "AC match", learningOutcomeRef: "R04-AC2.3" }),
        makeAssertion({ assertion: "Wrong AC", learningOutcomeRef: "R04-AC3.1" }),
      ];
      const ctx = makeContext({ assertions, nextModule: mod });
      const result = transform(null, ctx, sectionDef);

      expect(result.totalAssertions).toBe(1);
      expect(result.teachingPoints).toContain("AC match");
    });

    it("includes currentModule metadata in output", () => {
      const mod = makeModule({
        id: "MOD-3",
        name: "Food Safety Hazards",
        learningOutcomes: ["LO2: Hazards"],
      });
      const assertions = [
        makeAssertion({ learningOutcomeRef: "R04-LO2" }),
      ];
      const ctx = makeContext({ assertions, nextModule: mod });
      const result = transform(null, ctx, sectionDef);

      expect(result.currentModule).toBeDefined();
      expect(result.currentModule.id).toBe("MOD-3");
      expect(result.currentModule.name).toBe("Food Safety Hazards");
      expect(result.currentModule.learningOutcomes).toHaveLength(1);
    });
  });

  describe("exam relevance counting", () => {
    it("counts high exam relevance assertions (> 0.7)", () => {
      const assertions = [
        makeAssertion({ examRelevance: 0.9 }),
        makeAssertion({ examRelevance: 0.5 }),
        makeAssertion({ examRelevance: 0.8 }),
        makeAssertion({ examRelevance: null }),
      ];
      const ctx = makeContext({ assertions });
      const result = transform(null, ctx, sectionDef);

      expect(result.highExamRelevanceCount).toBe(2); // 0.9 and 0.8
    });
  });
});
