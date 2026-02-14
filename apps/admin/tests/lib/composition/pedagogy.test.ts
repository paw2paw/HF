import { describe, it, expect } from "vitest";
import { getTransform } from "@/lib/prompt/composition/TransformRegistry";
import type { AssembledContext, CompositionSectionDef } from "@/lib/prompt/composition/types";

// Trigger transform registration
import "@/lib/prompt/composition/transforms/pedagogy";

// --- helpers ---

function makeContext(overrides: Partial<AssembledContext> = {}): AssembledContext {
  return {
    loadedData: {
      caller: { id: "c1", name: "Paul", email: null, phone: null, externalId: null, domain: null },
      memories: [],
      personality: null,
      learnerProfile: null,
      recentCalls: [],
      callCount: 5,
      behaviorTargets: [],
      callerTargets: [],
      callerAttributes: [],
      goals: [],
      playbooks: [],
      systemSpecs: [],
      onboardingSpec: null,
    },
    sections: {},
    resolvedSpecs: { identitySpec: null, contentSpec: null, voiceSpec: null },
    sharedState: {
      modules: [
        { slug: "m1", name: "Introduction", description: "First module" },
        { slug: "m2", name: "Advanced", description: "Second module" },
      ],
      isFirstCall: false,
      daysSinceLastCall: 3,
      completedModules: new Set(["m1"]),
      estimatedProgress: 0.5,
      lastCompletedIndex: 0,
      moduleToReview: { slug: "m1", name: "Introduction" },
      nextModule: { slug: "m2", name: "Advanced" },
      reviewType: "quick_recall",
      reviewReason: "Last session covered Introduction",
      thresholds: { high: 0.65, low: 0.35 },
    },
    specConfig: {},
    ...overrides,
  };
}

function makeSectionDef(): CompositionSectionDef {
  return {
    id: "pedagogy",
    name: "Session Pedagogy",
    priority: 3,
    dataSource: "_assembled",
    activateWhen: { condition: "always" },
    fallback: { action: "omit" },
    transform: "computeSessionPedagogy",
    outputKey: "instructions.session_pedagogy",
  };
}

// =====================================================
// computeSessionPedagogy transform
// =====================================================

describe("computeSessionPedagogy transform", () => {
  it("is registered", () => {
    expect(getTransform("computeSessionPedagogy")).toBeDefined();
  });

  describe("RETURNING_CALLER flow", () => {
    it("sets sessionType to RETURNING_CALLER", () => {
      const ctx = makeContext();
      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.sessionType).toBe("RETURNING_CALLER");
    });

    it("includes review step referencing the module to review", () => {
      const ctx = makeContext();
      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());

      const flowText = result.flow.join(" ");
      expect(flowText).toContain("Introduction");
      expect(flowText).toContain("Advanced");
    });

    it("includes reviewFirst with technique for quick_recall", () => {
      const ctx = makeContext();
      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());

      expect(result.reviewFirst).toBeDefined();
      expect(result.reviewFirst.module).toBe("Introduction");
      expect(result.reviewFirst.technique).toContain("recall question");
    });

    it("uses application technique for application review type", () => {
      const ctx = makeContext({
        sharedState: {
          ...makeContext().sharedState,
          reviewType: "application",
        },
      });

      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.reviewFirst.technique).toContain("scenario");
    });

    it("includes newMaterial section with approach", () => {
      const ctx = makeContext();
      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());

      expect(result.newMaterial).toBeDefined();
      expect(result.newMaterial.module).toBe("Advanced");
      expect(result.newMaterial.approach).toContain("Introduction");
    });

    it("includes universal pedagogy principles", () => {
      const ctx = makeContext();
      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());

      expect(result.principles.length).toBeGreaterThan(0);
      expect(result.principles.some((p: string) => p.includes("Review BEFORE"))).toBe(true);
    });
  });

  describe("FIRST_CALL flow", () => {
    it("sets sessionType to FIRST_CALL", () => {
      const ctx = makeContext({
        sharedState: {
          ...makeContext().sharedState,
          isFirstCall: true,
        },
      });

      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.sessionType).toBe("FIRST_CALL");
    });

    it("uses default first-call flow when no INIT-001 spec", () => {
      const ctx = makeContext({
        sharedState: {
          ...makeContext().sharedState,
          isFirstCall: true,
        },
      });

      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.flow.length).toBe(5);
      expect(result.flow[0]).toContain("Welcome");
    });

    it("uses INIT-001 phases when available", () => {
      const ctx = makeContext({
        loadedData: {
          ...makeContext().loadedData,
          onboardingSpec: {
            id: "init-1",
            slug: "INIT-001",
            name: "Onboarding",
            config: {
              firstCallFlow: {
                phases: [
                  { phase: "warm-up", duration: "2 min", priority: "HIGH", goals: ["Build rapport"], avoid: ["rushing"] },
                  { phase: "explore", duration: "5 min", priority: "MEDIUM", goals: ["Find knowledge level"], avoid: ["lecturing"] },
                ],
                successMetrics: ["Caller feels comfortable"],
              },
            },
          },
        },
        sharedState: {
          ...makeContext().sharedState,
          isFirstCall: true,
        },
      });

      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.firstCallPhases).toHaveLength(2);
      expect(result.firstCallPhases![0].phase).toBe("warm-up");
      expect(result.successMetrics).toContain("Caller feels comfortable");
      expect(result.flow[0]).toContain("Warm-up");
    });

    it("uses Domain onboarding flow over INIT-001 when available", () => {
      const ctx = makeContext({
        loadedData: {
          ...makeContext().loadedData,
          caller: {
            id: "c1", name: "Paul", email: null, phone: null, externalId: null,
            domain: {
              id: "d1", slug: "qm", name: "QM", description: null,
              onboardingFlowPhases: {
                phases: [
                  { phase: "domain-intro", duration: "3 min", priority: "HIGH", goals: ["Intro to QM"], avoid: [] },
                ],
                successMetrics: ["Domain confidence"],
              },
            },
          },
          onboardingSpec: {
            id: "init-1",
            slug: "INIT-001",
            name: "Onboarding",
            config: {
              firstCallFlow: {
                phases: [{ phase: "generic", duration: "2 min", priority: "LOW", goals: ["Generic"], avoid: [] }],
              },
            },
          },
        },
        sharedState: {
          ...makeContext().sharedState,
          isFirstCall: true,
        },
      });

      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.firstCallPhases![0].phase).toBe("domain-intro");
    });

    it("includes newMaterial for first module on first call", () => {
      const ctx = makeContext({
        sharedState: {
          ...makeContext().sharedState,
          isFirstCall: true,
        },
      });

      const result = getTransform("computeSessionPedagogy")!(null, ctx, makeSectionDef());
      expect(result.newMaterial).toBeDefined();
      expect(result.newMaterial.module).toBe("Introduction");
    });
  });
});
