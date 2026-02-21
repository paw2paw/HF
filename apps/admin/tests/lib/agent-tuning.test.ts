/**
 * Tests for Agent Tuning — Boston Matrix derivation engine
 *
 * Verifies:
 *   - Forward derivation: matrix positions → parameter values
 *   - Clamping: edge positions stay within 0-1
 *   - Preset matching: positions near presets → correct preset returned
 *   - Trait generation: positions → tone trait strings
 *   - Reverse derivation: parameter values → matrix positions
 *   - snap5: values snap to 5% increments
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_TUNING_DEFAULTS,
  deriveParametersFromMatrices,
  deriveTraitsFromPositions,
  getPresetForPosition,
  reverseDerive,
  snap5,
} from "@/lib/domain/agent-tuning";

const settings = AGENT_TUNING_DEFAULTS;
const commStyle = settings.matrices[0]; // communication-style
const teachApproach = settings.matrices[1]; // teaching-approach

describe("deriveParametersFromMatrices", () => {
  it("sets primary axis params to raw position values", () => {
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 0.8, y: 0.3 },
      "teaching-approach": { x: 0.5, y: 0.7 },
    });

    expect(result[commStyle.xAxis.primaryParam].value).toBe(0.8);
    expect(result[commStyle.yAxis.primaryParam].value).toBe(0.3);
    expect(result[teachApproach.xAxis.primaryParam].value).toBe(0.5);
    expect(result[teachApproach.yAxis.primaryParam].value).toBe(0.7);
  });

  it("applies derivedConfidence to all params", () => {
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 0.5, y: 0.5 },
    });

    for (const dp of Object.values(result)) {
      expect(dp.confidence).toBe(settings.derivedConfidence);
    }
  });

  it("derives params using weighted linear formula", () => {
    // BEH-EMPATHY-EXPRESSION: weights { x: 0.8, y: 0.0, bias: 0.1 }
    // At position (1.0, 0.0): value = 1.0*0.8 + 0.0*0.0 + 0.1 = 0.9
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 1.0, y: 0.0 },
    });

    expect(result["BEH-EMPATHY-EXPRESSION"].value).toBe(0.9);
  });

  it("inverts derived params when invert=true", () => {
    // BEH-CONVERSATIONAL-TONE: weights { x: 0.2, y: 0.7, bias: 0.1 }, invert: true
    // At (0, 0): raw = 0*0.2 + 0*0.7 + 0.1 = 0.1, inverted = 0.9
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 0.0, y: 0.0 },
    });

    expect(result["BEH-CONVERSATIONAL-TONE"].value).toBe(0.9);
  });

  it("clamps all values to 0-1 at extreme positions", () => {
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 0, y: 0 },
      "teaching-approach": { x: 1, y: 1 },
    });

    for (const dp of Object.values(result)) {
      expect(dp.value).toBeGreaterThanOrEqual(0);
      expect(dp.value).toBeLessThanOrEqual(1);
    }
  });

  it("clamps input values that exceed 0-1", () => {
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 1.5, y: -0.3 },
    });

    expect(result[commStyle.xAxis.primaryParam].value).toBe(1);
    expect(result[commStyle.yAxis.primaryParam].value).toBe(0);
  });

  it("skips matrices with no position", () => {
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 0.5, y: 0.5 },
      // teaching-approach omitted
    });

    expect(result[commStyle.xAxis.primaryParam]).toBeDefined();
    expect(result[teachApproach.xAxis.primaryParam]).toBeUndefined();
  });

  it("derives all expected params for both matrices", () => {
    const result = deriveParametersFromMatrices(settings, {
      "communication-style": { x: 0.5, y: 0.5 },
      "teaching-approach": { x: 0.5, y: 0.5 },
    });

    // Communication: 2 primary + 3 derived = 5
    // Teaching: 2 primary + 3 derived = 5
    // Total: 10
    const expectedParamIds = [
      commStyle.xAxis.primaryParam,
      commStyle.yAxis.primaryParam,
      ...commStyle.derivedParams.map((d) => d.parameterId),
      teachApproach.xAxis.primaryParam,
      teachApproach.yAxis.primaryParam,
      ...teachApproach.derivedParams.map((d) => d.parameterId),
    ];

    for (const id of expectedParamIds) {
      expect(result[id]).toBeDefined();
    }
    expect(Object.keys(result).length).toBe(expectedParamIds.length);
  });
});

describe("getPresetForPosition", () => {
  it("returns exact preset match", () => {
    const preset = commStyle.presets[0]; // Friendly Professor (0.8, 0.7)
    const result = getPresetForPosition(commStyle, preset.x, preset.y);
    expect(result?.id).toBe(preset.id);
  });

  it("returns nearest preset within tolerance", () => {
    const preset = commStyle.presets[0]; // (0.8, 0.7)
    const result = getPresetForPosition(commStyle, preset.x + 0.05, preset.y - 0.05);
    expect(result?.id).toBe(preset.id);
  });

  it("returns null when outside tolerance", () => {
    const result = getPresetForPosition(commStyle, 0.5, 0.5, 0.15);
    expect(result).toBeNull();
  });

  it("returns closest preset when multiple are within tolerance", () => {
    // Place exactly at (0.8, 0.7) — should match Friendly Professor, not Socratic Mentor
    const result = getPresetForPosition(commStyle, 0.8, 0.7, 0.3);
    expect(result?.id).toBe("friendly-professor");
  });
});

describe("deriveTraitsFromPositions", () => {
  it("returns preset traits when near a preset", () => {
    const result = deriveTraitsFromPositions(settings, {
      "communication-style": { x: 0.8, y: 0.7 }, // Near Friendly Professor
    });

    expect(result).toContain("Warm");
    expect(result).toContain("Formal");
    expect(result).toContain("Approachable");
  });

  it("generates axis-based traits when far from presets", () => {
    const result = deriveTraitsFromPositions(settings, {
      "communication-style": { x: 0.1, y: 0.5 }, // Low warmth, mid formality
    });

    expect(result).toContain(commStyle.xAxis.lowLabel); // "Cool"
    // Mid-value (0.4-0.6) shouldn't generate traits for that axis
  });

  it("generates high-label traits for high positions", () => {
    const result = deriveTraitsFromPositions(settings, {
      "communication-style": { x: 0.9, y: 0.9 }, // Far from all presets
    }, 0.01); // Very tight tolerance — won't match presets

    expect(result).toContain(commStyle.xAxis.highLabel); // "Warm"
    expect(result).toContain(commStyle.yAxis.highLabel); // "Formal"
  });

  it("deduplicates traits across matrices", () => {
    const result = deriveTraitsFromPositions(settings, {
      "communication-style": { x: 0.8, y: 0.7 }, // Friendly Professor: [Warm, Formal, Approachable]
      "teaching-approach": { x: 0.8, y: 0.3 }, // Clear Instructor: [Direct, Clear, Supportive]
    });

    const uniqueCount = new Set(result).size;
    expect(result.length).toBe(uniqueCount);
  });

  it("returns empty array when no positions provided", () => {
    const result = deriveTraitsFromPositions(settings, {});
    expect(result).toEqual([]);
  });
});

describe("reverseDerive", () => {
  it("maps primary axis param values to positions", () => {
    const result = reverseDerive(settings, {
      "BEH-WARMTH": 0.8,
      "BEH-FORMALITY": 0.3,
      "BEH-DIRECTNESS": 0.6,
      "BEH-CHALLENGE-LEVEL": 0.9,
    });

    expect(result["communication-style"]).toEqual({ x: 0.8, y: 0.3 });
    expect(result["teaching-approach"]).toEqual({ x: 0.6, y: 0.9 });
  });

  it("defaults to center (0.5) for missing params", () => {
    const result = reverseDerive(settings, {});

    expect(result["communication-style"]).toEqual({ x: 0.5, y: 0.5 });
    expect(result["teaching-approach"]).toEqual({ x: 0.5, y: 0.5 });
  });

  it("round-trips with forward derivation for primary params", () => {
    const originalPositions = {
      "communication-style": { x: 0.7, y: 0.4 },
      "teaching-approach": { x: 0.3, y: 0.8 },
    };

    const derived = deriveParametersFromMatrices(settings, originalPositions);
    const paramValues: Record<string, number> = {};
    for (const [key, dp] of Object.entries(derived)) {
      paramValues[key] = dp.value;
    }

    const reversed = reverseDerive(settings, paramValues);

    expect(reversed["communication-style"].x).toBeCloseTo(0.7, 1);
    expect(reversed["communication-style"].y).toBeCloseTo(0.4, 1);
    expect(reversed["teaching-approach"].x).toBeCloseTo(0.3, 1);
    expect(reversed["teaching-approach"].y).toBeCloseTo(0.8, 1);
  });
});

describe("snap5", () => {
  it("snaps to nearest 5%", () => {
    expect(snap5(0.03)).toBe(0.05);
    expect(snap5(0.07)).toBe(0.05);
    expect(snap5(0.12)).toBe(0.10);
    expect(snap5(0.48)).toBe(0.50);
    expect(snap5(0.99)).toBe(1.0);
    expect(snap5(0.0)).toBe(0.0);
  });

  it("preserves exact 5% increments", () => {
    for (let i = 0; i <= 20; i++) {
      const val = i / 20;
      expect(snap5(val)).toBe(val);
    }
  });
});

describe("AGENT_TUNING_DEFAULTS structure", () => {
  it("has two matrices", () => {
    expect(settings.matrices.length).toBe(2);
  });

  it("each matrix has 4 presets", () => {
    for (const matrix of settings.matrices) {
      expect(matrix.presets.length).toBe(4);
    }
  });

  it("all preset positions are within 0-1", () => {
    for (const matrix of settings.matrices) {
      for (const preset of matrix.presets) {
        expect(preset.x).toBeGreaterThanOrEqual(0);
        expect(preset.x).toBeLessThanOrEqual(1);
        expect(preset.y).toBeGreaterThanOrEqual(0);
        expect(preset.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("all derivation weights produce values in 0-1 range at extremes", () => {
    // Test all four corners for each matrix
    const corners = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    for (const matrix of settings.matrices) {
      for (const corner of corners) {
        const positions = { [matrix.id]: corner };
        const result = deriveParametersFromMatrices(settings, positions);
        for (const [paramId, dp] of Object.entries(result)) {
          expect(dp.value).toBeGreaterThanOrEqual(0);
          expect(dp.value).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("derivedConfidence is a valid float between 0-1", () => {
    expect(settings.derivedConfidence).toBeGreaterThan(0);
    expect(settings.derivedConfidence).toBeLessThanOrEqual(1);
  });

  it("each preset has non-empty traits array", () => {
    for (const matrix of settings.matrices) {
      for (const preset of matrix.presets) {
        expect(preset.traits.length).toBeGreaterThan(0);
      }
    }
  });
});
