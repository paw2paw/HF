/**
 * Typed interfaces for Prisma Json? fields.
 *
 * Prisma types all `Json?` columns as `Prisma.JsonValue` which loses
 * structure. These types let us cast once at the access site and get
 * autocompletion + safety downstream.
 *
 * Usage:
 *   import type { SpecConfig } from "@/lib/types/json-fields";
 *   const cfg = spec.config as SpecConfig;
 */

// ---------------------------------------------------------------------------
// AnalysisSpec.config — the most common Json? field
// ---------------------------------------------------------------------------

/**
 * Generic spec config — dynamic JSON blob whose shape varies per spec.
 * Using `any` for values because specs have deeply nested, variable structures
 * (tutor_role.roleStatement, sessionStructure.opening.instruction, etc.)
 * that can't be statically typed without per-spec interfaces.
 *
 * The value of this type is replacing naked `as any` casts with a named type
 * that documents intent: "this is a spec config JSON field".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SpecConfig = Record<string, any>;

// ---------------------------------------------------------------------------
// RewardScore Json? fields
// ---------------------------------------------------------------------------

export interface ParameterDiff {
  parameterId: string;
  target: number;
  actual: number;
  diff: number;
  withinTolerance?: boolean;
}

export interface OutcomeSignal {
  resolved?: boolean;
  sentiment_delta?: number;
  duration?: number;
  csat?: number;
  [key: string]: unknown;
}

export interface TargetUpdate {
  parameterId: string;
  oldTarget: number;
  newTarget: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Playbook.config
// ---------------------------------------------------------------------------

export interface PlaybookConfig {
  systemSpecToggles?: Record<string, { isEnabled: boolean }>;
  goals?: Array<Record<string, any>>;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// AIConfig — extra fields beyond Prisma-generated type
// ---------------------------------------------------------------------------

export interface AIConfigExtended {
  transcriptLimit?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ContentSource.notableInfo — curriculum modules
// ---------------------------------------------------------------------------

export interface CurriculumModule {
  id: string;
  title: string;
  description?: string;
  [key: string]: unknown;
}
