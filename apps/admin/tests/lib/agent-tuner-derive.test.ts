/**
 * Tests for lib/agent-tuner/derive.ts
 *
 * Pure function tests — no mocks needed.
 */

import { describe, it, expect } from "vitest";
import { deriveParameterMap } from "../../lib/agent-tuner/derive";
import type { AgentTunerPill } from "../../lib/agent-tuner/types";

// =====================================================
// HELPERS
// =====================================================

function pill(overrides: Partial<AgentTunerPill> & { parameters: AgentTunerPill["parameters"] }): AgentTunerPill {
  return {
    id: "test-pill",
    label: "Test",
    description: "Test pill",
    intensity: 0.7,
    source: "intent",
    ...overrides,
  };
}

// =====================================================
// TESTS
// =====================================================

describe("deriveParameterMap", () => {
  it("should return empty map for empty pills array", () => {
    const result = deriveParameterMap([]);
    expect(result).toEqual({});
  });

  it("should derive value from a single pill with single parameter", () => {
    const pills = [
      pill({
        intensity: 1.0,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 0.9, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);
    // effective = 0.5 + 1.0 * (0.9 - 0.5) = 0.9
    expect(result["BEH-WARMTH"]).toBeCloseTo(0.9);
  });

  it("should scale by intensity", () => {
    const pills = [
      pill({
        intensity: 0.5,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 1.0, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);
    // effective = 0.5 + 0.5 * (1.0 - 0.5) = 0.75
    expect(result["BEH-WARMTH"]).toBeCloseTo(0.75);
  });

  it("should return atZero when intensity is very low (near zero)", () => {
    const pills = [
      pill({
        intensity: 0.01,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 1.0, atZero: 0.3 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);
    // effective = 0.3 + 0.01 * (1.0 - 0.3) = 0.307
    expect(result["BEH-WARMTH"]).toBeCloseTo(0.307);
  });

  it("should skip pills with intensity 0", () => {
    const pills = [
      pill({
        intensity: 0,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 1.0, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);
    expect(result).toEqual({});
  });

  it("should blend multiple pills on the same parameter using intensity-weighted average", () => {
    const pills = [
      pill({
        id: "warm",
        intensity: 0.8,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 0.9, atZero: 0.5 },
        ],
      }),
      pill({
        id: "cool",
        intensity: 0.4,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 0.3, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);

    // Pill 1: effective = 0.5 + 0.8 * (0.9 - 0.5) = 0.82, weighted = 0.82 * 0.8 = 0.656
    // Pill 2: effective = 0.5 + 0.4 * (0.3 - 0.5) = 0.42, weighted = 0.42 * 0.4 = 0.168
    // totalWeight = 0.8 + 0.4 = 1.2
    // result = (0.656 + 0.168) / 1.2 = 0.6867
    expect(result["BEH-WARMTH"]).toBeCloseTo(0.6867, 3);
  });

  it("should handle multiple parameters across multiple pills independently", () => {
    const pills = [
      pill({
        id: "warm",
        intensity: 1.0,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 0.9, atZero: 0.5 },
          { parameterId: "BEH-PATIENCE", parameterName: "Patience", atFull: 0.8, atZero: 0.5 },
        ],
      }),
      pill({
        id: "formal",
        intensity: 0.6,
        parameters: [
          { parameterId: "BEH-FORMALITY", parameterName: "Formality", atFull: 0.7, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result["BEH-WARMTH"]).toBeCloseTo(0.9);
    expect(result["BEH-PATIENCE"]).toBeCloseTo(0.8);
    // effective = 0.5 + 0.6 * (0.7 - 0.5) = 0.62
    expect(result["BEH-FORMALITY"]).toBeCloseTo(0.62);
  });

  it("should clamp result to [0, 1] when effective value would exceed bounds", () => {
    const pills = [
      pill({
        intensity: 1.0,
        parameters: [
          // atFull > 1 shouldn't happen, but clamp anyway
          { parameterId: "BEH-HIGH", parameterName: "High", atFull: 1.5, atZero: 0.5 },
          // atFull < 0 shouldn't happen, but clamp anyway
          { parameterId: "BEH-LOW", parameterName: "Low", atFull: -0.5, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);
    expect(result["BEH-HIGH"]).toBe(1);
    expect(result["BEH-LOW"]).toBe(0);
  });

  it("should handle a realistic multi-pill scenario", () => {
    const pills = [
      pill({
        id: "warm-tone",
        label: "Warm Tone",
        intensity: 0.75,
        parameters: [
          { parameterId: "BEH-WARMTH", parameterName: "Warmth", atFull: 0.9, atZero: 0.5 },
          { parameterId: "BEH-PATIENCE", parameterName: "Patience", atFull: 0.85, atZero: 0.5 },
          { parameterId: "BEH-ENCOURAGEMENT", parameterName: "Encouragement", atFull: 0.95, atZero: 0.5 },
        ],
      }),
      pill({
        id: "challenging",
        label: "Challenging",
        intensity: 0.6,
        parameters: [
          { parameterId: "BEH-CHALLENGE", parameterName: "Challenge", atFull: 0.8, atZero: 0.5 },
          { parameterId: "BEH-PATIENCE", parameterName: "Patience", atFull: 0.6, atZero: 0.5 },
        ],
      }),
    ];

    const result = deriveParameterMap(pills);

    // BEH-WARMTH: only pill 1 at 0.75 intensity
    // effective = 0.5 + 0.75 * (0.9 - 0.5) = 0.8
    expect(result["BEH-WARMTH"]).toBeCloseTo(0.8);

    // BEH-PATIENCE: both pills overlap
    // Pill 1: effective = 0.5 + 0.75 * (0.85 - 0.5) = 0.7625, weighted = 0.7625 * 0.75 = 0.571875
    // Pill 2: effective = 0.5 + 0.6 * (0.6 - 0.5) = 0.56, weighted = 0.56 * 0.6 = 0.336
    // total = 0.75 + 0.6 = 1.35
    // result = (0.571875 + 0.336) / 1.35 = 0.6728
    expect(result["BEH-PATIENCE"]).toBeCloseTo(0.6728, 3);

    // BEH-ENCOURAGEMENT: only pill 1
    expect(result["BEH-ENCOURAGEMENT"]).toBeCloseTo(0.8375);

    // BEH-CHALLENGE: only pill 2
    // effective = 0.5 + 0.6 * (0.8 - 0.5) = 0.68
    expect(result["BEH-CHALLENGE"]).toBeCloseTo(0.68);
  });
});
