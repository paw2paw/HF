/**
 * Pipeline Stage Configuration Loader
 *
 * Single source of truth for loading pipeline stages from specs.
 * Tries PIPELINE-001 first, falls back to GUARD-001, then defaults.
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

// =====================================================
// TYPES
// =====================================================

export interface PipelineStage {
  name: string;
  order: number;
  outputTypes: string[];
  description?: string;
  batched?: boolean;
  requiresMode?: "prep" | "prompt";
}

type Logger = {
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  debug: (msg: string, data?: any) => void;
};

// =====================================================
// DEFAULT FALLBACK
// =====================================================

/**
 * Default pipeline stages - used when no spec is found in database.
 * Matches the structure in PIPELINE-001 spec.
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  {
    name: "EXTRACT",
    order: 10,
    outputTypes: ["LEARN", "MEASURE"],
    description: "Extract caller data: memories and personality scores",
    batched: true,
  },
  {
    name: "SCORE_AGENT",
    order: 20,
    outputTypes: ["MEASURE_AGENT"],
    description: "Score agent behavior in the call",
    batched: true,
  },
  {
    name: "AGGREGATE",
    order: 30,
    outputTypes: ["AGGREGATE"],
    description: "Aggregate scores into personality profiles",
  },
  {
    name: "REWARD",
    order: 40,
    outputTypes: ["REWARD"],
    description: "Compute reward scores from measurements",
  },
  {
    name: "ADAPT",
    order: 50,
    outputTypes: ["ADAPT"],
    description: "Compute personalized targets for next call",
  },
  {
    name: "SUPERVISE",
    order: 60,
    outputTypes: ["SUPERVISE"],
    description: "Validate and clamp targets to safe ranges",
  },
  {
    name: "COMPOSE",
    order: 100,
    outputTypes: ["COMPOSE"],
    description: "Build the final prompt from gathered context",
    requiresMode: "prompt",
  },
];

// =====================================================
// LOADER
// =====================================================

/**
 * Load pipeline stages from specs.
 *
 * Priority:
 * 1. PIPELINE-001 spec (or env-configured spec via PIPELINE_SPEC_SLUG)
 * 2. GUARD-001 spec (backward compatibility, or env-configured via PIPELINE_FALLBACK_SPEC_SLUG)
 * 3. DEFAULT_PIPELINE_STAGES (hardcoded fallback)
 */
export async function loadPipelineStages(log?: Logger): Promise<PipelineStage[]> {
  const logInfo = log?.info ?? console.log;
  const logDebug = log?.debug ?? (() => {});

  // Get spec slugs from config (env-configurable)
  const pipelineSlug = config.specs.pipeline;
  const fallbackSlug = config.specs.pipelineFallback;

  // 1. Try configured pipeline spec first (default: PIPELINE-001)
  const pipelineSpec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: pipelineSlug.toLowerCase(), mode: "insensitive" },
      isActive: true,
      isDirty: false,
    },
    select: { slug: true, config: true },
  });

  if (pipelineSpec) {
    const stages = extractStagesFromConfig(pipelineSpec.config);
    if (stages) {
      logInfo(`Pipeline stages loaded from "${pipelineSpec.slug}"`, { stageCount: stages.length });
      return stages;
    }
  }

  // 2. Fall back to configured fallback spec (default: GUARD-001)
  const guardSpec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: fallbackSlug.toLowerCase(), mode: "insensitive" },
      isActive: true,
      isDirty: false,
    },
    select: { slug: true, config: true },
  });

  if (guardSpec) {
    const stages = extractStagesFromConfig(guardSpec.config);
    if (stages) {
      logInfo(`Pipeline stages loaded from "${guardSpec.slug}" (fallback)`, { stageCount: stages.length });
      return stages;
    }
  }

  // 3. Fall back to defaults
  logInfo("No pipeline spec found - using default stages", { stageCount: DEFAULT_PIPELINE_STAGES.length });
  return DEFAULT_PIPELINE_STAGES;
}

/**
 * Extract and normalize stages from spec config.
 */
function extractStagesFromConfig(config: any): PipelineStage[] | null {
  if (!config) return null;

  const parameters = config.parameters || [];
  const pipelineConfig = parameters.find((p: any) => p.id === "pipeline_stages")?.config;

  if (!pipelineConfig?.stages || !Array.isArray(pipelineConfig.stages)) {
    return null;
  }

  const stages: PipelineStage[] = pipelineConfig.stages.map((s: any) => ({
    name: s.name,
    order: s.order,
    outputTypes: s.outputTypes || [],
    description: s.description,
    batched: s.batched,
    requiresMode: s.requiresMode,
  }));

  // Sort by order
  stages.sort((a, b) => a.order - b.order);

  return stages;
}

/**
 * Get stage by name.
 */
export function getStageByName(stages: PipelineStage[], name: string): PipelineStage | undefined {
  return stages.find((s) => s.name === name);
}

/**
 * Get stages that process a given outputType.
 */
export function getStagesForOutputType(stages: PipelineStage[], outputType: string): PipelineStage[] {
  return stages.filter((s) => s.outputTypes.includes(outputType));
}
