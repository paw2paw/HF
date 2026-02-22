/**
 * Snapshot Configuration
 *
 * Single source of truth for snapshot layer definitions, table ordering,
 * and types. Tables are referenced by Prisma model name (PascalCase).
 *
 * For raw SQL operations, use TABLE_NAME_MAP to get the actual PostgreSQL
 * table name (some models have @@map overrides).
 */

import path from "node:path";

// ─── Snapshot directory ─────────────────────────────────────────────
export const SNAPSHOTS_DIR = path.join(process.cwd(), "prisma", "snapshots");

// ─── Types ──────────────────────────────────────────────────────────

export interface SnapshotMetadata {
  name: string;
  description?: string;
  version: string; // "1.0"
  createdAt: string; // ISO timestamp
  layers: number[]; // [0,1,2] or [0,1,2,3]
  withLearners: boolean;
  stats: Record<string, number>; // model name → row count
  totalRows: number;
}

export interface SnapshotFile {
  metadata: SnapshotMetadata;
  data: Record<string, any[]>; // model name → array of rows
}

export interface SnapshotInfo {
  name: string;
  filePath: string;
  fileSize: number; // bytes
  metadata: SnapshotMetadata;
}

export interface TakeSnapshotOptions {
  name: string;
  description?: string;
  withLearners?: boolean;
}

export interface RestoreSnapshotOptions {
  name: string;
  dryRun?: boolean;
}

export interface RestoreResult {
  success: boolean;
  tablesCleared: string[];
  tablesInserted: Record<string, number>;
  errors: string[];
  dryRun: boolean;
}

export type ProgressCallback = (info: {
  table: string;
  index: number;
  total: number;
  phase?: "exporting" | "clearing" | "inserting" | "writing";
}) => void | Promise<void>;

// ─── Layer definitions ──────────────────────────────────────────────

/** Layer 0: System Foundation — users, settings, AI config */
export const LAYER_0_TABLES = [
  "User",
  "SystemSetting",
  "AIConfig",
  "AIModel",
  "InstitutionType",
  "ChannelConfig",
] as const;

/** Layer 1: Specs & Platform — analysis specs, parameters, prompts */
export const LAYER_1_TABLES = [
  "Tag",
  "Parameter",
  "ParameterTag",
  "ParameterScoringAnchor",
  "ParameterKnowledgeLink",
  "AnalysisSpec",
  "AnalysisTrigger",
  "AnalysisAction",
  "AnalysisProfile",
  "AnalysisProfileParameter",
  "BDDFeatureSet",
  "PromptTemplate",
  "PromptBlock",
  "PromptSlug",
  "PromptSlugParameter",
  "PromptSlugRange",
] as const;

/** Layer 2: Organisation & Curriculum — institutions, domains, content */
export const LAYER_2_TABLES = [
  "Institution",
  "Domain",
  "Segment",
  "Playbook",
  "PlaybookItem",
  "Subject",
  "SubjectSource",
  "SubjectDomain",
  "SubjectMedia",
  "Curriculum",
  "KnowledgeDoc",
  "KnowledgeChunk",
  "ContentSource",
  "ContentAssertion",
  "ContentQuestion",
  "ContentVocabulary",
  "BehaviorTarget", // SYSTEM/PLAYBOOK scope rows only when Layer 3 excluded
] as const;

/** Layer 3: Learner Data — callers, calls, memories (opt-in) */
export const LAYER_3_TABLES = [
  "Caller",
  "CallerPlaybook",
  "CallerAttribute",
  "CallerIdentity",
  "CohortGroup",
  "CallerCohortMembership",
  "CohortPlaybook",
  "Call",
  "CallMessage",
  "CallScore",
  "CallAction",
  "CallerMemory",
  "CallerPersonality",
  "PersonalityObservation",
  "Goal",
  "ComposedPrompt",
  "OnboardingSession",
  "BehaviorMeasurement",
  "ConversationArtifact",
] as const;

/** Tables always skipped — derived, temporal, or session data */
export const SKIPPED_TABLES = [
  "Session",
  "Account",
  "CallerMemorySummary",
  "CallerPersonalityProfile",
  "CallerTarget",
  "CallTarget",
  "PipelineRun",
  "PipelineStep",
  "AgentInstance",
  "AgentRun",
  "UsageEvent",
  "UsageRollup",
  "UsageCostRate",
  "AuditLog",
  "PromptSlugSelection",
  "RewardScore",
  "VectorEmbedding",
  "FailedCall",
  "ProcessedFile",
  "Invite",
  "ExcludedCaller",
  "Message",
  "Ticket",
  "TicketComment",
  "UserTask",
  "MediaAsset",
  "InboundMessage",
  "BDDUpload",
] as const;

// ─── Prisma model → PostgreSQL table name mapping ───────────────────
// Only models with @@map overrides need explicit entries.
// All others use the model name directly as the table name.

export const TABLE_NAME_MAP: Record<string, string> = {
  AnalysisProfile: "ParameterSet",
  AnalysisProfileParameter: "ParameterSetParameter",
  CallerPersonality: "UserPersonality",
  CallerPersonalityProfile: "UserPersonalityProfile",
  CallerMemory: "UserMemory",
  CallerMemorySummary: "UserMemorySummary",
  AnalysisSpec: "BddFeature",
  AnalysisTrigger: "BddScenario",
  AnalysisAction: "BddAcceptanceCriteria",
};

/** Get the actual PostgreSQL table name for a Prisma model */
export function getTableName(modelName: string): string {
  return TABLE_NAME_MAP[modelName] || modelName;
}

/** Get the Prisma client accessor key (camelCase) for a model name */
export function getPrismaKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

// ─── FK-safe ordering ───────────────────────────────────────────────
// Truncation order: children first, parents last.
// Insertion order: parents first, children last (reversed).
//
// This covers all tables across all 4 layers.
// Reference: prisma/reset.ts lines 22-120, prisma/seed-clean.ts lines 41-77

export const TRUNCATION_ORDER: string[] = [
  // ── Layer 3: Leaf tables (deepest children first) ──
  "BehaviorMeasurement",
  "ConversationArtifact",
  "CallAction",
  "CallMessage",
  "CallScore",
  "ComposedPrompt",
  "OnboardingSession",
  "PersonalityObservation",
  "CallerPersonality",
  "CallerMemory",
  "CallerAttribute",
  "Goal",
  "CallerPlaybook",
  "CallerCohortMembership",
  "CohortPlaybook",
  "CallerIdentity",
  "Call",
  "Caller",
  "CohortGroup",

  // ── Layer 2: Organisation & Content ──
  "ContentVocabulary",
  "ContentQuestion",
  "ContentAssertion",
  "ContentSource",
  "SubjectSource",
  "SubjectDomain",
  "SubjectMedia",
  "KnowledgeChunk",
  "KnowledgeDoc",
  "Curriculum",
  "Subject",
  "PlaybookItem",
  "BehaviorTarget",
  "Playbook",
  "Segment",
  "Domain",
  "Institution",

  // ── Layer 1: Specs & Platform ──
  "PromptSlugRange",
  "PromptSlugParameter",
  "PromptSlug",
  "PromptBlock",
  "PromptTemplate",
  "ParameterScoringAnchor",
  "ParameterKnowledgeLink",
  "AnalysisAction",
  "AnalysisTrigger",
  "AnalysisProfileParameter",
  "AnalysisProfile",
  "AnalysisSpec",
  "BDDFeatureSet",
  "ParameterTag",
  "Parameter",
  "Tag",

  // ── Layer 0: System Foundation ──
  "ChannelConfig",
  "AIConfig",
  "AIModel",
  "InstitutionType",
  "SystemSetting",
  "User",
];

/** Insertion order: parents first, children last */
export const INSERTION_ORDER: string[] = [...TRUNCATION_ORDER].reverse();

// ─── Helpers ────────────────────────────────────────────────────────

/** Get all tables for the given layers */
export function getTablesForLayers(withLearners: boolean): string[] {
  const tables = [
    ...LAYER_0_TABLES,
    ...LAYER_1_TABLES,
    ...LAYER_2_TABLES,
  ] as string[];

  if (withLearners) {
    tables.push(...(LAYER_3_TABLES as unknown as string[]));
  }

  return tables;
}

/**
 * Filter TRUNCATION_ORDER to only include tables in the given layer set.
 * Preserves FK-safe ordering.
 */
export function getTruncationOrderForLayers(withLearners: boolean): string[] {
  const included = new Set(getTablesForLayers(withLearners));
  return TRUNCATION_ORDER.filter((t) => included.has(t));
}

/**
 * Filter INSERTION_ORDER to only include tables in the given layer set.
 * Preserves FK-safe ordering.
 */
export function getInsertionOrderForLayers(withLearners: boolean): string[] {
  const included = new Set(getTablesForLayers(withLearners));
  return INSERTION_ORDER.filter((t) => included.has(t));
}

/** Validate snapshot name: alphanumeric, hyphens, underscores */
export function isValidSnapshotName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0 && name.length <= 100;
}
