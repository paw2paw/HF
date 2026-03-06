/**
 * Tests for teaching-style transform
 *
 * Verifies:
 * - Archetype-aware style resolution (TUT, COACH, COMPANION, COMMUNITY)
 * - Returns null when no interactionPattern is set
 * - Falls back across all style maps for unknown archetypes
 * - Output shape matches TeachingStyleOutput
 */
import { describe, it, expect } from "vitest";
import { getTransform } from "@/lib/prompt/composition/TransformRegistry";
import type { AssembledContext, CompositionSectionDef } from "@/lib/prompt/composition/types";

// Trigger transform registration
import "@/lib/prompt/composition/transforms/teaching-style";

// =====================================================
// HELPERS
// =====================================================

function makeContext(overrides: {
  interactionPattern?: string;
  archetype?: string | null;
} = {}): AssembledContext {
  return {
    loadedData: {
      playbooks: overrides.interactionPattern !== undefined
        ? [{ config: { interactionPattern: overrides.interactionPattern } }]
        : [],
    },
    resolvedSpecs: {
      identitySpec: overrides.archetype !== undefined
        ? { extendsAgent: overrides.archetype }
        : {},
    },
    sharedState: {},
    sections: {},
  } as unknown as AssembledContext;
}

const SECTION_DEF = {
  id: "teaching_style",
  name: "Teaching Style",
  priority: 12.8,
  dataSource: "_assembled",
  activateWhen: { condition: "always" },
  fallback: { action: "null" },
  transform: "computeTeachingStyle",
  outputKey: "teachingStyle",
  dependsOn: ["identity"],
} as CompositionSectionDef;

// =====================================================
// TESTS
// =====================================================

describe("computeTeachingStyle", () => {
  const transform = getTransform("computeTeachingStyle");

  it("is registered", () => {
    expect(transform).toBeDefined();
  });

  // --- Tutor styles (TUT-001) ---

  it("returns socratic style for TUT archetype + socratic pattern", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "socratic",
      archetype: "TUT-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "socratic",
      label: expect.stringContaining("Socratic"),
      approach: expect.stringContaining("questions"),
    });
  });

  it("returns directive style for TUT archetype + directive pattern", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "directive",
      archetype: "TUT-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "directive",
      label: expect.stringContaining("Directive"),
      approach: expect.stringContaining("explanations"),
    });
  });

  it("returns reflective style for TUT archetype + reflective pattern", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "reflective",
      archetype: "TUT-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "reflective",
      label: expect.stringContaining("Reflective"),
      approach: expect.stringContaining("metacognition"),
    });
  });

  it("returns open style for TUT archetype + open pattern", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "open",
      archetype: "TUT-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "open",
      label: expect.stringContaining("Open"),
      approach: expect.stringContaining("Adapt"),
    });
  });

  // --- Coach styles (COACH-001) ---

  it("returns advisory style for COACH archetype", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "advisory",
      archetype: "COACH-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "advisory",
      label: expect.stringContaining("Advisory"),
      approach: expect.stringContaining("perspective"),
    });
  });

  it("returns coaching style for COACH archetype", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "coaching",
      archetype: "COACH-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "coaching",
      label: expect.stringContaining("Coaching"),
      approach: expect.stringContaining("coaching stance"),
    });
  });

  // --- Companion & Community ---

  it("returns companion style for COMPANION archetype", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "companion",
      archetype: "COMPANION-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "companion",
      label: expect.stringContaining("Companion"),
      approach: expect.stringContaining("equal"),
    });
  });

  it("returns facilitation style for COMMUNITY archetype", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "facilitation",
      archetype: "COMMUNITY-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "facilitation",
      label: expect.stringContaining("Facilitation"),
      approach: expect.stringContaining("conversation"),
    });
  });

  // --- Conversational Guide (CONVGUIDE-001) ---

  it("returns conversational-guide style for CONVGUIDE archetype", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "conversational-guide",
      archetype: "CONVGUIDE-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "conversational-guide",
      label: expect.stringContaining("Conversational Guide"),
      approach: expect.stringContaining("curious"),
    });
  });

  // --- Edge cases ---

  it("returns null when no interactionPattern is set", () => {
    const result = transform!({}, makeContext({}), SECTION_DEF);
    expect(result).toBeNull();
  });

  it("returns null when pattern does not match archetype", () => {
    // coaching pattern on TUT archetype — no match in TUTOR_STYLES
    const result = transform!({}, makeContext({
      interactionPattern: "coaching",
      archetype: "TUT-001",
    }), SECTION_DEF);
    expect(result).toBeNull();
  });

  it("falls back to cross-archetype lookup when archetype is unknown", () => {
    // Unknown archetype, valid pattern — should find in tutor styles fallback
    const result = transform!({}, makeContext({
      interactionPattern: "socratic",
      archetype: "UNKNOWN-001",
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "socratic",
      label: expect.stringContaining("Socratic"),
    });
  });

  it("falls back when archetype is null", () => {
    const result = transform!({}, makeContext({
      interactionPattern: "directive",
      archetype: null,
    }), SECTION_DEF);
    expect(result).toMatchObject({
      pattern: "directive",
      label: expect.stringContaining("Directive"),
    });
  });
});
