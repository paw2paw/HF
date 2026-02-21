/**
 * Agent Tuning — Boston Matrix Types + Derivation Engine
 *
 * Pure functions that map 2D matrix positions to behavioral parameters.
 * Matrix STRUCTURE (axes, presets, weights) comes from SystemSettings.
 * Parameter DEFAULT VALUES come from identity specs (TUT-001 etc.) in the DB.
 *
 * Storage depends on context (see applyBehaviorTargets):
 *   Quick Launch  → BehaviorTarget rows (scope=PLAYBOOK)
 *   Course Setup  → Domain.onboardingDefaultTargets + BehaviorTarget rows
 *   Content Sources OnboardStep → Domain.onboardingDefaultTargets only
 */

import { prisma } from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────

export interface MatrixAxisDef {
  label: string;
  lowLabel: string;
  highLabel: string;
  primaryParam: string;
}

export interface MatrixDerivedParam {
  parameterId: string;
  weights: { x: number; y: number; bias: number };
  invert?: boolean;
}

export interface MatrixPreset {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  traits: string[];
}

export interface MatrixDef {
  id: string;
  name: string;
  description: string;
  xAxis: MatrixAxisDef;
  yAxis: MatrixAxisDef;
  derivedParams: MatrixDerivedParam[];
  presets: MatrixPreset[];
}

export interface AgentTuningSettings {
  matrices: MatrixDef[];
  derivedConfidence: number;
}

export interface MatrixPosition {
  x: number;
  y: number;
}

export interface DerivedParam {
  value: number;
  confidence: number;
}

// ── Defaults (matrix STRUCTURE only, not parameter values) ──

export const AGENT_TUNING_DEFAULTS: AgentTuningSettings = {
  derivedConfidence: 0.5,
  matrices: [
    {
      id: "communication-style",
      name: "Communication Style",
      description: "How the agent communicates — from cold and casual to warm and formal",
      xAxis: {
        label: "Warmth",
        lowLabel: "Cool",
        highLabel: "Warm",
        primaryParam: "BEH-WARMTH",
      },
      yAxis: {
        label: "Formality",
        lowLabel: "Casual",
        highLabel: "Formal",
        primaryParam: "BEH-FORMALITY",
      },
      derivedParams: [
        { parameterId: "BEH-EMPATHY-EXPRESSION", weights: { x: 0.8, y: 0.0, bias: 0.1 } },
        { parameterId: "BEH-RESPONSE-LEN", weights: { x: 0.0, y: 0.6, bias: 0.2 } },
        { parameterId: "BEH-CONVERSATIONAL-TONE", weights: { x: 0.2, y: 0.7, bias: 0.1 }, invert: true },
      ],
      presets: [
        {
          id: "friendly-professor",
          name: "Friendly Professor",
          description: "Warm and knowledgeable with a professional demeanour",
          x: 0.8,
          y: 0.7,
          traits: ["Warm", "Formal", "Approachable"],
        },
        {
          id: "socratic-mentor",
          name: "Socratic Mentor",
          description: "Warm and conversational, guides through questions",
          x: 0.7,
          y: 0.4,
          traits: ["Warm", "Conversational", "Thoughtful"],
        },
        {
          id: "drill-instructor",
          name: "Drill Instructor",
          description: "Cool and formal, focused on precision and standards",
          x: 0.3,
          y: 0.8,
          traits: ["Precise", "Formal", "Authoritative"],
        },
        {
          id: "casual-peer",
          name: "Casual Peer",
          description: "Relaxed and informal, like a helpful friend",
          x: 0.4,
          y: 0.2,
          traits: ["Relaxed", "Informal", "Friendly"],
        },
      ],
    },
    {
      id: "teaching-approach",
      name: "Teaching Approach",
      description: "How the agent teaches — from facilitative and gentle to directive and demanding",
      xAxis: {
        label: "Directness",
        lowLabel: "Facilitative",
        highLabel: "Directive",
        primaryParam: "BEH-DIRECTNESS",
      },
      yAxis: {
        label: "Challenge",
        lowLabel: "Gentle",
        highLabel: "Demanding",
        primaryParam: "BEH-CHALLENGE-LEVEL",
      },
      derivedParams: [
        { parameterId: "BEH-PRODUCTIVE-STRUGGLE", weights: { x: 0.0, y: 0.7, bias: 0.15 } },
        { parameterId: "BEH-SCAFFOLDING", weights: { x: 0.0, y: 0.7, bias: 0.15 }, invert: true },
        { parameterId: "BEH-PROBING-QUESTIONS", weights: { x: 0.6, y: 0.0, bias: 0.2 }, invert: true },
      ],
      presets: [
        {
          id: "discovery-guide",
          name: "Discovery Guide",
          description: "Lets learners explore, offers gentle support",
          x: 0.2,
          y: 0.3,
          traits: ["Facilitative", "Patient", "Exploratory"],
        },
        {
          id: "stretch-mentor",
          name: "Stretch Mentor",
          description: "Asks probing questions, pushes learners beyond comfort zone",
          x: 0.2,
          y: 0.8,
          traits: ["Challenging", "Questioning", "Growth-oriented"],
        },
        {
          id: "clear-instructor",
          name: "Clear Instructor",
          description: "Direct explanations, gentle pace, minimal ambiguity",
          x: 0.8,
          y: 0.3,
          traits: ["Direct", "Clear", "Supportive"],
        },
        {
          id: "tough-love-coach",
          name: "Tough Love Coach",
          description: "High expectations, direct feedback, pushes hard",
          x: 0.8,
          y: 0.8,
          traits: ["Demanding", "Direct", "Results-driven"],
        },
      ],
    },
  ],
};

// ── Derivation Engine (pure functions) ──────────────────

/**
 * Derive all parameter values from matrix positions.
 * Returns a map of parameterId → { value, confidence }.
 *
 * For each matrix:
 *   - Primary axis params get the raw x/y value
 *   - Derived params use weighted linear formula: value = clamp(x*wx + y*wy + bias)
 *   - If invert, value = 1 - computed
 */
export function deriveParametersFromMatrices(
  settings: AgentTuningSettings,
  positions: Record<string, MatrixPosition>,
): Record<string, DerivedParam> {
  const result: Record<string, DerivedParam> = {};
  const confidence = settings.derivedConfidence;

  for (const matrix of settings.matrices) {
    const pos = positions[matrix.id];
    if (!pos) continue;

    // Primary axis params get the raw position value
    result[matrix.xAxis.primaryParam] = { value: clamp01(pos.x), confidence };
    result[matrix.yAxis.primaryParam] = { value: clamp01(pos.y), confidence };

    // Derived params use weighted formula
    for (const dp of matrix.derivedParams) {
      let value = pos.x * dp.weights.x + pos.y * dp.weights.y + dp.weights.bias;
      value = clamp01(value);
      if (dp.invert) value = 1 - value;
      result[dp.parameterId] = { value: round2(value), confidence };
    }
  }

  return result;
}

/**
 * Derive tone trait strings from matrix positions.
 * Uses nearest preset match; if no preset is close, generates from axis descriptions.
 */
export function deriveTraitsFromPositions(
  settings: AgentTuningSettings,
  positions: Record<string, MatrixPosition>,
  tolerance = 0.15,
): string[] {
  const traits: string[] = [];

  for (const matrix of settings.matrices) {
    const pos = positions[matrix.id];
    if (!pos) continue;

    const nearest = getPresetForPosition(matrix, pos.x, pos.y, tolerance);
    if (nearest) {
      traits.push(...nearest.traits);
    } else {
      // Generate descriptive traits from axis values
      if (pos.x > 0.6) traits.push(matrix.xAxis.highLabel);
      else if (pos.x < 0.4) traits.push(matrix.xAxis.lowLabel);

      if (pos.y > 0.6) traits.push(matrix.yAxis.highLabel);
      else if (pos.y < 0.4) traits.push(matrix.yAxis.lowLabel);
    }
  }

  // Deduplicate
  return [...new Set(traits)];
}

/**
 * Find the nearest preset within tolerance distance.
 * Returns null if no preset is close enough.
 */
export function getPresetForPosition(
  matrix: MatrixDef,
  x: number,
  y: number,
  tolerance = 0.15,
): MatrixPreset | null {
  let best: MatrixPreset | null = null;
  let bestDist = Infinity;

  for (const preset of matrix.presets) {
    const dist = Math.sqrt((x - preset.x) ** 2 + (y - preset.y) ** 2);
    if (dist <= tolerance && dist < bestDist) {
      best = preset;
      bestDist = dist;
    }
  }

  return best;
}

/**
 * Reverse-derive matrix positions from existing parameter values.
 * Used when opening the matrix for a domain that already has targets set.
 *
 * For each matrix: x = value of xAxis.primaryParam, y = value of yAxis.primaryParam.
 * Falls back to 0.5 (center) if a param isn't found.
 */
export function reverseDerive(
  settings: AgentTuningSettings,
  paramValues: Record<string, number>,
): Record<string, MatrixPosition> {
  const positions: Record<string, MatrixPosition> = {};

  for (const matrix of settings.matrices) {
    positions[matrix.id] = {
      x: paramValues[matrix.xAxis.primaryParam] ?? 0.5,
      y: paramValues[matrix.yAxis.primaryParam] ?? 0.5,
    };
  }

  return positions;
}

// ── Helpers ──────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Snap to 5% increments (matching VerticalSlider pattern) */
export function snap5(v: number): number {
  return Math.round(v * 20) / 20;
}

// ── Persistence ─────────────────────────────────────────

/**
 * Apply a parameter map as PLAYBOOK-scoped BehaviorTarget rows.
 *
 * Creates or updates BehaviorTarget records for the given playbook.
 * Existing targets for the same parameterId+playbookId are superseded
 * (effectiveUntil set) rather than deleted, preserving audit trail.
 *
 * Used by:
 *   - Quick Launch commit (page → commit/route → quickLaunchCommit → here)
 *   - Course Setup (CourseDoneStep → courseSetup → configure_onboarding → here)
 *
 * @param playbookId - The playbook to set targets for
 * @param parameterMap - Record<parameterId, targetValue> (all values 0-1)
 * @param confidence - Confidence level for derived targets (default 0.5)
 * @returns Number of targets applied
 */
export async function applyBehaviorTargets(
  playbookId: string,
  parameterMap: Record<string, number>,
  confidence = 0.5,
): Promise<number> {
  const entries = Object.entries(parameterMap);
  if (entries.length === 0) return 0;

  const now = new Date();
  let applied = 0;

  // Validate parameter IDs exist in the DB
  const validParams = await prisma.parameter.findMany({
    where: {
      parameterId: { in: entries.map(([id]) => id) },
      parameterType: "BEHAVIOR",
    },
    select: { parameterId: true },
  });
  const validIds = new Set(validParams.map((p) => p.parameterId));

  for (const [parameterId, targetValue] of entries) {
    if (!validIds.has(parameterId)) {
      console.warn(`[applyBehaviorTargets] Skipping unknown parameter: ${parameterId}`);
      continue;
    }

    const clamped = Math.max(0, Math.min(1, targetValue));

    // Supersede any existing active target for this param+playbook
    const existing = await prisma.behaviorTarget.findFirst({
      where: {
        parameterId,
        playbookId,
        scope: "PLAYBOOK",
        effectiveUntil: null,
      },
    });

    if (existing) {
      // If value is effectively the same, skip
      if (Math.abs(existing.targetValue - clamped) < 0.005) continue;

      await prisma.behaviorTarget.update({
        where: { id: existing.id },
        data: { effectiveUntil: now },
      });
    }

    await prisma.behaviorTarget.create({
      data: {
        parameterId,
        playbookId,
        scope: "PLAYBOOK",
        targetValue: clamped,
        confidence,
        source: "MANUAL",
      },
    });

    applied++;
  }

  if (applied > 0) {
    console.log(`[applyBehaviorTargets] Applied ${applied} targets to playbook ${playbookId}`);
  }

  return applied;
}
