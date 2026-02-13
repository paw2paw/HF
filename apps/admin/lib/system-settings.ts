/**
 * System Settings Helper
 *
 * Reads from the SystemSetting table (key-value store with JSON values).
 * Provides typed accessors with defaults and in-memory caching (30s TTL).
 *
 * Settings taxonomy:
 *   pipeline.*      — Pipeline & scoring behaviour
 *   scoring.*       — Score calculation parameters
 *   memory.*        — Memory extraction & retention
 *   goals.*         — Goal detection thresholds
 *   trust.*         — Content trust weights
 *   ai_learning.*   — AI pattern learning rates
 *   cache.*         — Cache TTL tuning
 */

import { prisma } from "@/lib/prisma";

// ── Cache ──────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; expiry: number }>();

export function clearSystemSettingsCache() {
  cache.clear();
}

// ── Generic accessor ───────────────────────────────────

export async function getSystemSetting<T>(key: string, defaultValue: T): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiry > now) return cached.value as T;

  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (!row) {
      cache.set(key, { value: defaultValue, expiry: now + CACHE_TTL_MS });
      return defaultValue;
    }
    const parsed = JSON.parse(row.value) as T;
    cache.set(key, { value: parsed, expiry: now + CACHE_TTL_MS });
    return parsed;
  } catch (err) {
    console.warn(`[system-settings] Failed to load "${key}", using default`, err);
    return defaultValue;
  }
}

// Helper to load a group of settings in parallel
async function loadGroup<T extends object>(
  keyMap: { [K in keyof T]: string },
  defaults: T,
): Promise<T> {
  const keys = Object.keys(defaults) as Array<keyof T>;
  const values = await Promise.all(
    keys.map((k) => getSystemSetting(keyMap[k], defaults[k]))
  );
  const result = { ...defaults };
  keys.forEach((k, i) => { (result as any)[k] = values[i]; });
  return result;
}

// ═══════════════════════════════════════════════════════
// 1. PIPELINE & SCORING
// ═══════════════════════════════════════════════════════

export interface PipelineSettings {
  minTranscriptWords: number;
  shortTranscriptThresholdWords: number;
  shortTranscriptConfidenceCap: number;
  maxRetries: number;
  mockMode: boolean;
  personalityDecayHalfLifeDays: number;
  mockScoreBase: number;
  mockScoreRange: number;
}

export const PIPELINE_DEFAULTS: PipelineSettings = {
  minTranscriptWords: 20,
  shortTranscriptThresholdWords: 50,
  shortTranscriptConfidenceCap: 0.3,
  maxRetries: 2,
  mockMode: false,
  personalityDecayHalfLifeDays: 30,
  mockScoreBase: 0.3,
  mockScoreRange: 0.4,
};

const PIPELINE_KEYS: Record<keyof PipelineSettings, string> = {
  minTranscriptWords: "pipeline.min_transcript_words",
  shortTranscriptThresholdWords: "pipeline.short_transcript_threshold_words",
  shortTranscriptConfidenceCap: "pipeline.short_transcript_confidence_cap",
  maxRetries: "pipeline.max_retries",
  mockMode: "pipeline.mock_mode",
  personalityDecayHalfLifeDays: "scoring.personality_decay_half_life_days",
  mockScoreBase: "scoring.mock_score_base",
  mockScoreRange: "scoring.mock_score_range",
};

export async function getPipelineSettings(): Promise<PipelineSettings> {
  return loadGroup(PIPELINE_KEYS, PIPELINE_DEFAULTS);
}

// Back-compat alias used by pipeline route & measure-agent
export type PipelineGates = Pick<PipelineSettings, "minTranscriptWords" | "shortTranscriptThresholdWords" | "shortTranscriptConfidenceCap">;
export async function getPipelineGates(): Promise<PipelineGates> {
  const s = await getPipelineSettings();
  return {
    minTranscriptWords: s.minTranscriptWords,
    shortTranscriptThresholdWords: s.shortTranscriptThresholdWords,
    shortTranscriptConfidenceCap: s.shortTranscriptConfidenceCap,
  };
}

// ═══════════════════════════════════════════════════════
// 2. MEMORY & LEARNING
// ═══════════════════════════════════════════════════════

export interface MemorySettings {
  confidenceDefault: number;
  confidenceHigh: number;
  confidenceLow: number;
  summaryRecentLimit: number;
  summaryTopLimit: number;
  transcriptLimitChars: number;
}

export const MEMORY_DEFAULTS: MemorySettings = {
  confidenceDefault: 0.5,
  confidenceHigh: 0.8,
  confidenceLow: 0.3,
  summaryRecentLimit: 10,
  summaryTopLimit: 5,
  transcriptLimitChars: 8000,
};

const MEMORY_KEYS: Record<keyof MemorySettings, string> = {
  confidenceDefault: "memory.confidence_default",
  confidenceHigh: "memory.confidence_high",
  confidenceLow: "memory.confidence_low",
  summaryRecentLimit: "memory.summary_recent_limit",
  summaryTopLimit: "memory.summary_top_limit",
  transcriptLimitChars: "memory.transcript_limit_chars",
};

export async function getMemorySettings(): Promise<MemorySettings> {
  return loadGroup(MEMORY_KEYS, MEMORY_DEFAULTS);
}

// ═══════════════════════════════════════════════════════
// 3. GOALS & DETECTION
// ═══════════════════════════════════════════════════════

export interface GoalSettings {
  confidenceThreshold: number;
  similarityThreshold: number;
  transcriptMinChars: number;
  transcriptLimitChars: number;
}

export const GOAL_DEFAULTS: GoalSettings = {
  confidenceThreshold: 0.5,
  similarityThreshold: 0.8,
  transcriptMinChars: 100,
  transcriptLimitChars: 4000,
};

const GOAL_KEYS: Record<keyof GoalSettings, string> = {
  confidenceThreshold: "goals.confidence_threshold",
  similarityThreshold: "goals.similarity_threshold",
  transcriptMinChars: "goals.transcript_min_chars",
  transcriptLimitChars: "goals.transcript_limit_chars",
};

export async function getGoalSettings(): Promise<GoalSettings> {
  return loadGroup(GOAL_KEYS, GOAL_DEFAULTS);
}

// ═══════════════════════════════════════════════════════
// 4. CONTENT TRUST
// ═══════════════════════════════════════════════════════

export interface TrustSettings {
  weightL5Regulatory: number;
  weightL4Accredited: number;
  weightL3Published: number;
  weightL2Expert: number;
  weightL1AiAssisted: number;
  weightL0Unverified: number;
  certificationMinWeight: number;
  extractionMaxChunkChars: number;
}

export const TRUST_DEFAULTS: TrustSettings = {
  weightL5Regulatory: 1.0,
  weightL4Accredited: 0.95,
  weightL3Published: 0.80,
  weightL2Expert: 0.60,
  weightL1AiAssisted: 0.30,
  weightL0Unverified: 0.05,
  certificationMinWeight: 0.80,
  extractionMaxChunkChars: 8000,
};

const TRUST_KEYS: Record<keyof TrustSettings, string> = {
  weightL5Regulatory: "trust.weight.L5_regulatory",
  weightL4Accredited: "trust.weight.L4_accredited",
  weightL3Published: "trust.weight.L3_published",
  weightL2Expert: "trust.weight.L2_expert",
  weightL1AiAssisted: "trust.weight.L1_ai_assisted",
  weightL0Unverified: "trust.weight.L0_unverified",
  certificationMinWeight: "trust.certification_min_weight",
  extractionMaxChunkChars: "trust.extraction_max_chunk_chars",
};

export async function getTrustSettings(): Promise<TrustSettings> {
  return loadGroup(TRUST_KEYS, TRUST_DEFAULTS);
}

// ═══════════════════════════════════════════════════════
// 5. AI PATTERN LEARNING
// ═══════════════════════════════════════════════════════

export interface AILearningSettings {
  initialConfidence: number;
  confidenceIncrement: number;
  minOccurrences: number;
}

export const AI_LEARNING_DEFAULTS: AILearningSettings = {
  initialConfidence: 0.3,
  confidenceIncrement: 0.05,
  minOccurrences: 3,
};

const AI_LEARNING_KEYS: Record<keyof AILearningSettings, string> = {
  initialConfidence: "ai_learning.initial_confidence",
  confidenceIncrement: "ai_learning.confidence_increment",
  minOccurrences: "ai_learning.min_occurrences",
};

export async function getAILearningSettings(): Promise<AILearningSettings> {
  return loadGroup(AI_LEARNING_KEYS, AI_LEARNING_DEFAULTS);
}

// ═══════════════════════════════════════════════════════
// 6. PERFORMANCE & CACHING
// ═══════════════════════════════════════════════════════

export interface CacheSettings {
  systemSettingsTtlMs: number;
  aiConfigTtlMs: number;
  costConfigTtlMs: number;
  dataPathsTtlMs: number;
}

export const CACHE_DEFAULTS: CacheSettings = {
  systemSettingsTtlMs: 30000,
  aiConfigTtlMs: 60000,
  costConfigTtlMs: 300000,
  dataPathsTtlMs: 5000,
};

const CACHE_KEYS: Record<keyof CacheSettings, string> = {
  systemSettingsTtlMs: "cache.system_settings_ttl_ms",
  aiConfigTtlMs: "cache.ai_config_ttl_ms",
  costConfigTtlMs: "cache.cost_config_ttl_ms",
  dataPathsTtlMs: "cache.data_paths_ttl_ms",
};

export async function getCacheSettings(): Promise<CacheSettings> {
  return loadGroup(CACHE_KEYS, CACHE_DEFAULTS);
}

// ═══════════════════════════════════════════════════════
// 7. DEMO CAPTURE
// ═══════════════════════════════════════════════════════

export interface DemoCaptureSettings {
  defaultCaller: string;
  defaultDomain: string;
  defaultPlaybook: string;
  defaultSpec: string;
}

export const DEMO_CAPTURE_DEFAULTS: DemoCaptureSettings = {
  defaultCaller: "Paul",
  defaultDomain: "qm-tutor",
  defaultPlaybook: "",
  defaultSpec: "PERS-001",
};

const DEMO_CAPTURE_KEYS: Record<keyof DemoCaptureSettings, string> = {
  defaultCaller: "demo.default_caller",
  defaultDomain: "demo.default_domain",
  defaultPlaybook: "demo.default_playbook",
  defaultSpec: "demo.default_spec",
};

export async function getDemoCaptureSettings(): Promise<DemoCaptureSettings> {
  return loadGroup(DEMO_CAPTURE_KEYS, DEMO_CAPTURE_DEFAULTS);
}

// ═══════════════════════════════════════════════════════
// SETTINGS REGISTRY (for UI rendering)
// ═══════════════════════════════════════════════════════

export interface SettingDef {
  key: string;
  label: string;
  description: string;
  type: "int" | "float" | "bool" | "text";
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface SettingGroup {
  id: string;
  label: string;
  icon: string;
  description: string;
  settings: SettingDef[];
}

export const SETTINGS_REGISTRY: SettingGroup[] = [
  {
    id: "pipeline",
    label: "Pipeline & Scoring",
    icon: "Activity",
    description: "Controls how the analysis pipeline processes calls",
    settings: [
      { key: "pipeline.min_transcript_words", label: "Min transcript length", description: "Skip scoring for transcripts shorter than this (words)", type: "int", default: 20, min: 0, max: 200 },
      { key: "pipeline.short_transcript_threshold_words", label: "Short transcript threshold", description: "Cap confidence for transcripts shorter than this (words)", type: "int", default: 50, min: 0, max: 500 },
      { key: "pipeline.short_transcript_confidence_cap", label: "Short transcript confidence cap", description: "Maximum confidence for short transcripts", type: "float", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "pipeline.max_retries", label: "Max AI retries", description: "Retry attempts for failed AI calls", type: "int", default: 2, min: 0, max: 5 },
      { key: "pipeline.mock_mode", label: "Force mock mode", description: "Use mock scoring instead of AI for all pipeline stages", type: "bool", default: false },
      { key: "scoring.personality_decay_half_life_days", label: "Personality decay half-life", description: "Days for trait scores to decay to 50% weight", type: "int", default: 30, min: 1, max: 365 },
      { key: "scoring.mock_score_base", label: "Mock score base", description: "Minimum mock score value", type: "float", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "scoring.mock_score_range", label: "Mock score range", description: "Random variance added to mock base", type: "float", default: 0.4, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: "memory",
    label: "Memory & Learning",
    icon: "Brain",
    description: "How memories are extracted, scored, and retained",
    settings: [
      { key: "memory.confidence_default", label: "Default confidence", description: "Default memory confidence score", type: "float", default: 0.5, min: 0, max: 1, step: 0.05 },
      { key: "memory.confidence_high", label: "High confidence threshold", description: "Threshold for high-confidence memories", type: "float", default: 0.8, min: 0, max: 1, step: 0.05 },
      { key: "memory.confidence_low", label: "Low confidence threshold", description: "Threshold for low-confidence memories", type: "float", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "memory.summary_recent_limit", label: "Recent memories in summary", description: "Number of recent memories included in summaries", type: "int", default: 10, min: 1, max: 50 },
      { key: "memory.summary_top_limit", label: "Top memories in summary", description: "Number of top-scored memories included", type: "int", default: 5, min: 1, max: 25 },
      { key: "memory.transcript_limit_chars", label: "Transcript limit", description: "Max characters sent to AI for memory extraction", type: "int", default: 8000, min: 1000, max: 20000 },
    ],
  },
  {
    id: "goals",
    label: "Goals & Detection",
    icon: "Target",
    description: "Thresholds for goal extraction and deduplication",
    settings: [
      { key: "goals.confidence_threshold", label: "Confidence threshold", description: "Minimum confidence to create a goal", type: "float", default: 0.5, min: 0, max: 1, step: 0.05 },
      { key: "goals.similarity_threshold", label: "Similarity threshold", description: "Cutoff for deduplicating similar goals", type: "float", default: 0.8, min: 0, max: 1, step: 0.05 },
      { key: "goals.transcript_min_chars", label: "Min transcript length", description: "Skip goal extraction for transcripts shorter than this (chars)", type: "int", default: 100, min: 0, max: 1000 },
      { key: "goals.transcript_limit_chars", label: "Transcript limit", description: "Max characters sent to AI for goal extraction", type: "int", default: 4000, min: 500, max: 20000 },
    ],
  },
  {
    id: "trust",
    label: "Content Trust",
    icon: "ShieldCheck",
    description: "Trust level weights and certification thresholds",
    settings: [
      { key: "trust.weight.L5_regulatory", label: "L5 Regulatory Standard", description: "Weight for regulatory/certified content", type: "float", default: 1.0, min: 0, max: 1, step: 0.05 },
      { key: "trust.weight.L4_accredited", label: "L4 Accredited Material", description: "Weight for accredited training materials", type: "float", default: 0.95, min: 0, max: 1, step: 0.05 },
      { key: "trust.weight.L3_published", label: "L3 Published Reference", description: "Weight for published reference materials", type: "float", default: 0.80, min: 0, max: 1, step: 0.05 },
      { key: "trust.weight.L2_expert", label: "L2 Expert Curated", description: "Weight for expert-curated content", type: "float", default: 0.60, min: 0, max: 1, step: 0.05 },
      { key: "trust.weight.L1_ai_assisted", label: "L1 AI Assisted", description: "Weight for AI-generated content", type: "float", default: 0.30, min: 0, max: 1, step: 0.05 },
      { key: "trust.weight.L0_unverified", label: "L0 Unverified", description: "Weight for unverified content", type: "float", default: 0.05, min: 0, max: 1, step: 0.05 },
      { key: "trust.certification_min_weight", label: "Certification min weight", description: "Minimum trust weight for certification readiness", type: "float", default: 0.80, min: 0, max: 1, step: 0.05 },
      { key: "trust.extraction_max_chunk_chars", label: "Extraction chunk size", description: "Max characters per document chunk for trust extraction", type: "int", default: 8000, min: 1000, max: 20000 },
    ],
  },
  {
    id: "ai_learning",
    label: "AI Learning",
    icon: "Sparkles",
    description: "How the AI knowledge system learns patterns from interactions",
    settings: [
      { key: "ai_learning.initial_confidence", label: "Initial confidence", description: "Starting confidence for newly detected patterns", type: "float", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "ai_learning.confidence_increment", label: "Confidence increment", description: "Confidence boost per additional occurrence", type: "float", default: 0.05, min: 0.01, max: 0.2, step: 0.01 },
      { key: "ai_learning.min_occurrences", label: "Min occurrences", description: "Occurrences needed before creating a pattern", type: "int", default: 3, min: 1, max: 20 },
    ],
  },
  {
    id: "cache",
    label: "Performance",
    icon: "Gauge",
    description: "Cache TTLs and system performance tuning",
    settings: [
      { key: "cache.system_settings_ttl_ms", label: "Settings cache TTL", description: "How long system settings are cached (ms)", type: "int", default: 30000, min: 1000, max: 600000 },
      { key: "cache.ai_config_ttl_ms", label: "AI config cache TTL", description: "How long AI config is cached (ms)", type: "int", default: 60000, min: 1000, max: 600000 },
      { key: "cache.cost_config_ttl_ms", label: "Cost config cache TTL", description: "How long cost rates are cached (ms)", type: "int", default: 300000, min: 1000, max: 600000 },
      { key: "cache.data_paths_ttl_ms", label: "Data paths cache TTL", description: "How long data paths are cached (ms)", type: "int", default: 5000, min: 1000, max: 60000 },
    ],
  },
  {
    id: "demo",
    label: "Demo Capture",
    icon: "Camera",
    description: "Default entities used when capturing demo screenshots (npm run snap)",
    settings: [
      { key: "demo.default_caller", label: "Default caller", description: "Caller name used for entity screenshots", type: "text", default: "Paul", placeholder: "e.g. Paul" },
      { key: "demo.default_domain", label: "Default domain", description: "Domain slug used for entity screenshots", type: "text", default: "qm-tutor", placeholder: "e.g. qm-tutor" },
      { key: "demo.default_playbook", label: "Default playbook", description: "Playbook name (leave empty for first available)", type: "text", default: "", placeholder: "e.g. QM Adaptive v1" },
      { key: "demo.default_spec", label: "Default spec", description: "Spec slug for spec-related screenshots", type: "text", default: "PERS-001", placeholder: "e.g. PERS-001" },
    ],
  },
];
