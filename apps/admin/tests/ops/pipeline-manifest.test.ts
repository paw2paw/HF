/**
 * Tests for lib/ops/pipeline-manifest.ts
 *
 * Tests the static pipeline manifest structure and helper functions:
 * - getStepsForPhase: retrieve steps by phase ID
 * - getStepById: find a step across all phases
 * - getSectionsInOrder: topological sort of composition sections
 * - isSpecConfigured: check if step uses spec config
 * - getAllSpecKeys: collect all unique spec keys
 * - PIPELINE_MANIFEST: structural integrity of the manifest data
 */

import { describe, it, expect } from "vitest";
import {
  PIPELINE_MANIFEST,
  getStepsForPhase,
  getStepById,
  getSectionsInOrder,
  isSpecConfigured,
  getAllSpecKeys,
  type PipelineStepManifest,
  type CompositionSectionManifest,
} from "@/lib/ops/pipeline-manifest";

// =============================================================================
// MANIFEST STRUCTURE
// =============================================================================

describe("PIPELINE_MANIFEST structure", () => {
  it("has a version string", () => {
    expect(PIPELINE_MANIFEST.version).toBeDefined();
    expect(typeof PIPELINE_MANIFEST.version).toBe("string");
    expect(PIPELINE_MANIFEST.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has a generatedAt timestamp", () => {
    expect(PIPELINE_MANIFEST.generatedAt).toBeDefined();
    // Should be a valid ISO date string
    const date = new Date(PIPELINE_MANIFEST.generatedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it("has exactly two phases (learn and adapt)", () => {
    expect(PIPELINE_MANIFEST.phases).toHaveLength(2);
    const phaseIds = PIPELINE_MANIFEST.phases.map((p) => p.id);
    expect(phaseIds).toContain("learn");
    expect(phaseIds).toContain("adapt");
  });

  it("learn phase has steps", () => {
    const learnPhase = PIPELINE_MANIFEST.phases.find((p) => p.id === "learn");
    expect(learnPhase).toBeDefined();
    expect(learnPhase!.steps.length).toBeGreaterThan(0);
  });

  it("adapt phase has steps", () => {
    const adaptPhase = PIPELINE_MANIFEST.phases.find((p) => p.id === "adapt");
    expect(adaptPhase).toBeDefined();
    expect(adaptPhase!.steps.length).toBeGreaterThan(0);
  });

  it("all steps have required fields", () => {
    for (const phase of PIPELINE_MANIFEST.phases) {
      for (const step of phase.steps) {
        expect(step.id).toBeDefined();
        expect(step.label).toBeDefined();
        expect(step.description).toBeDefined();
        expect(step.phase).toBe(phase.id);
        expect(step.sourceFile).toBeDefined();
        expect(["code", "spec", "hybrid"]).toContain(step.configSource);
        expect(Array.isArray(step.inputs)).toBe(true);
        expect(Array.isArray(step.outputs)).toBe(true);
      }
    }
  });

  it("all step IDs are unique across phases", () => {
    const allIds: string[] = [];
    for (const phase of PIPELINE_MANIFEST.phases) {
      for (const step of phase.steps) {
        allIds.push(step.id);
      }
    }
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it("composition sections have required fields", () => {
    for (const section of PIPELINE_MANIFEST.compositionSections) {
      expect(section.id).toBeDefined();
      expect(section.label).toBeDefined();
      expect(section.loader).toBeDefined();
      expect(["always", "dataExists", "contentSpecExists", "identitySpecExists", "custom"]).toContain(section.activateWhen);
      expect(["null", "emptyObject", "omit"]).toContain(section.fallback);
      expect(section.sourceFile).toBeDefined();
    }
  });

  it("all composition section IDs are unique", () => {
    const ids = PIPELINE_MANIFEST.compositionSections.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("composition section dependencies reference valid section IDs", () => {
    const validIds = new Set(PIPELINE_MANIFEST.compositionSections.map((s) => s.id));
    for (const section of PIPELINE_MANIFEST.compositionSections) {
      for (const depId of section.dependsOn ?? []) {
        expect(validIds.has(depId)).toBe(true);
      }
    }
  });

  it("step dependsOn references point to valid step IDs within the same phase", () => {
    for (const phase of PIPELINE_MANIFEST.phases) {
      const stepIds = new Set(phase.steps.map((s) => s.id));
      for (const step of phase.steps) {
        for (const depId of step.dependsOn ?? []) {
          expect(stepIds.has(depId)).toBe(true);
        }
      }
    }
  });
});

// =============================================================================
// getStepsForPhase
// =============================================================================

describe("getStepsForPhase", () => {
  it("returns learn phase steps", () => {
    const steps = getStepsForPhase("learn");
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.phase).toBe("learn");
    }
  });

  it("returns adapt phase steps", () => {
    const steps = getStepsForPhase("adapt");
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.phase).toBe("adapt");
    }
  });

  it("returns empty array for unknown phase", () => {
    const steps = getStepsForPhase("unknown" as any);
    expect(steps).toEqual([]);
  });

  it("learn phase includes transcript processing step", () => {
    const steps = getStepsForPhase("learn");
    const transcriptStep = steps.find((s) => s.id === "transcripts:process");
    expect(transcriptStep).toBeDefined();
    expect(transcriptStep!.label).toBe("Process Transcripts");
  });

  it("learn phase includes personality analysis step", () => {
    const steps = getStepsForPhase("learn");
    const personalityStep = steps.find((s) => s.id === "personality:analyze");
    expect(personalityStep).toBeDefined();
  });

  it("learn phase includes memory extraction step", () => {
    const steps = getStepsForPhase("learn");
    const memoryStep = steps.find((s) => s.id === "memory:extract");
    expect(memoryStep).toBeDefined();
  });

  it("learn phase includes reward computation step", () => {
    const steps = getStepsForPhase("learn");
    const rewardStep = steps.find((s) => s.id === "reward:compute");
    expect(rewardStep).toBeDefined();
  });

  it("adapt phase includes prompt composition step", () => {
    const steps = getStepsForPhase("adapt");
    const composeStep = steps.find((s) => s.id === "prompt:compose");
    expect(composeStep).toBeDefined();
  });
});

// =============================================================================
// getStepById
// =============================================================================

describe("getStepById", () => {
  it("finds learn phase steps by ID", () => {
    const step = getStepById("transcripts:process");
    expect(step).toBeDefined();
    expect(step!.id).toBe("transcripts:process");
    expect(step!.phase).toBe("learn");
  });

  it("finds adapt phase steps by ID", () => {
    const step = getStepById("prompt:compose");
    expect(step).toBeDefined();
    expect(step!.id).toBe("prompt:compose");
    expect(step!.phase).toBe("adapt");
  });

  it("returns undefined for unknown step ID", () => {
    const step = getStepById("nonexistent:step");
    expect(step).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    const step = getStepById("");
    expect(step).toBeUndefined();
  });

  it("finds personality:analyze", () => {
    const step = getStepById("personality:analyze");
    expect(step).toBeDefined();
    expect(step!.configSource).toBe("spec");
    expect(step!.specKeys).toContain("personality");
  });

  it("finds reward:compute", () => {
    const step = getStepById("reward:compute");
    expect(step).toBeDefined();
    expect(step!.dependsOn).toContain("agent:measure");
  });

  it("finds agent:measure", () => {
    const step = getStepById("agent:measure");
    expect(step).toBeDefined();
    expect(step!.outputs).toContain("BehaviorMeasurement");
  });
});

// =============================================================================
// getSectionsInOrder (topological sort)
// =============================================================================

describe("getSectionsInOrder", () => {
  it("returns all sections", () => {
    const ordered = getSectionsInOrder();
    expect(ordered.length).toBe(PIPELINE_MANIFEST.compositionSections.length);
  });

  it("returns sections with no duplicates", () => {
    const ordered = getSectionsInOrder();
    const ids = ordered.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("places dependencies before dependents", () => {
    const ordered = getSectionsInOrder();
    const indexMap = new Map<string, number>();
    ordered.forEach((s, i) => indexMap.set(s.id, i));

    for (const section of ordered) {
      for (const depId of section.dependsOn ?? []) {
        const depIndex = indexMap.get(depId);
        const sectionIndex = indexMap.get(section.id);
        expect(depIndex).toBeDefined();
        expect(sectionIndex).toBeDefined();
        expect(depIndex!).toBeLessThan(sectionIndex!);
      }
    }
  });

  it("caller_info appears before behavior_targets", () => {
    const ordered = getSectionsInOrder();
    const callerIndex = ordered.findIndex((s) => s.id === "caller_info");
    const targetsIndex = ordered.findIndex((s) => s.id === "behavior_targets");
    // behavior_targets depends on caller_info
    if (callerIndex !== -1 && targetsIndex !== -1) {
      expect(callerIndex).toBeLessThan(targetsIndex);
    }
  });

  it("identity appears before instructions_voice", () => {
    const ordered = getSectionsInOrder();
    const identityIndex = ordered.findIndex((s) => s.id === "identity");
    const voiceIndex = ordered.findIndex((s) => s.id === "instructions_voice");
    if (identityIndex !== -1 && voiceIndex !== -1) {
      expect(identityIndex).toBeLessThan(voiceIndex);
    }
  });

  it("instructions_voice and instructions_pedagogy appear before instructions", () => {
    const ordered = getSectionsInOrder();
    const voiceIndex = ordered.findIndex((s) => s.id === "instructions_voice");
    const pedagogyIndex = ordered.findIndex((s) => s.id === "instructions_pedagogy");
    const instructionsIndex = ordered.findIndex((s) => s.id === "instructions");

    if (voiceIndex !== -1 && instructionsIndex !== -1) {
      expect(voiceIndex).toBeLessThan(instructionsIndex);
    }
    if (pedagogyIndex !== -1 && instructionsIndex !== -1) {
      expect(pedagogyIndex).toBeLessThan(instructionsIndex);
    }
  });

  it("personality, memories, and behavior_targets appear before quick_start", () => {
    const ordered = getSectionsInOrder();
    const quickStartIndex = ordered.findIndex((s) => s.id === "quick_start");

    for (const depId of ["personality", "memories", "behavior_targets"]) {
      const depIndex = ordered.findIndex((s) => s.id === depId);
      if (depIndex !== -1 && quickStartIndex !== -1) {
        expect(depIndex).toBeLessThan(quickStartIndex);
      }
    }
  });
});

// =============================================================================
// isSpecConfigured
// =============================================================================

describe("isSpecConfigured", () => {
  it("returns true for spec-configured step", () => {
    const step = getStepById("personality:analyze");
    expect(step).toBeDefined();
    expect(isSpecConfigured(step!)).toBe(true);
  });

  it("returns true for hybrid-configured step", () => {
    const step = getStepById("prompt:compose");
    expect(step).toBeDefined();
    expect(isSpecConfigured(step!)).toBe(true);
  });

  it("returns false for code-only step", () => {
    const step = getStepById("transcripts:process");
    expect(step).toBeDefined();
    expect(isSpecConfigured(step!)).toBe(false);
  });

  it("returns false for a synthetic code-only step", () => {
    const syntheticStep: PipelineStepManifest = {
      id: "test:step",
      label: "Test",
      description: "Test step",
      phase: "learn",
      sourceFile: "test.ts",
      configSource: "code",
      inputs: [],
      outputs: [],
    };
    expect(isSpecConfigured(syntheticStep)).toBe(false);
  });

  it("returns true for a synthetic spec step", () => {
    const syntheticStep: PipelineStepManifest = {
      id: "test:step",
      label: "Test",
      description: "Test step",
      phase: "learn",
      sourceFile: "test.ts",
      configSource: "spec",
      specKeys: ["test-spec"],
      inputs: [],
      outputs: [],
    };
    expect(isSpecConfigured(syntheticStep)).toBe(true);
  });

  it("returns true for a synthetic hybrid step", () => {
    const syntheticStep: PipelineStepManifest = {
      id: "test:step",
      label: "Test",
      description: "Test step",
      phase: "learn",
      sourceFile: "test.ts",
      configSource: "hybrid",
      inputs: [],
      outputs: [],
    };
    expect(isSpecConfigured(syntheticStep)).toBe(true);
  });
});

// =============================================================================
// getAllSpecKeys
// =============================================================================

describe("getAllSpecKeys", () => {
  it("returns a non-empty array of strings", () => {
    const keys = getAllSpecKeys();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(typeof key).toBe("string");
    }
  });

  it("returns unique keys only", () => {
    const keys = getAllSpecKeys();
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("includes personality spec key", () => {
    const keys = getAllSpecKeys();
    expect(keys).toContain("personality");
  });

  it("includes reward-compute spec key", () => {
    const keys = getAllSpecKeys();
    expect(keys).toContain("reward-compute");
  });

  it("includes compose-prompt spec key", () => {
    const keys = getAllSpecKeys();
    expect(keys).toContain("compose-prompt");
  });

  it("includes memory-related spec keys", () => {
    const keys = getAllSpecKeys();
    const hasMemoryKey = keys.some((k) => k.includes("memory"));
    expect(hasMemoryKey).toBe(true);
  });

  it("includes measure-agent spec key", () => {
    const keys = getAllSpecKeys();
    expect(keys).toContain("measure-agent");
  });

  it("does not include empty strings", () => {
    const keys = getAllSpecKeys();
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
    }
  });
});
