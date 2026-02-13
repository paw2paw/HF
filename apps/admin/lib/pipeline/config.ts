/**
 * Pipeline Stage Configuration Loader
 *
 * Single source of truth for loading pipeline stages from specs.
 * FULLY SPEC-DRIVEN - no hardcoded fallbacks.
 * PIPELINE-001 spec MUST exist in database or pipeline will error.
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
// LOADER
// =====================================================

/**
 * Load pipeline stages from PIPELINE-001 spec (env-configurable via PIPELINE_SPEC_SLUG).
 *
 * NO FALLBACKS - spec MUST exist in database or this throws an error.
 * This prevents silent fallbacks that can diverge from the source of truth.
 */
export async function loadPipelineStages(log?: Logger): Promise<PipelineStage[]> {
  const logInfo = log?.info ?? console.log;
  const logWarn = log?.warn ?? console.warn;

  // Get spec slug from config (env-configurable, default: PIPELINE-001)
  const pipelineSlug = config.specs.pipeline;

  // Load pipeline spec from database
  const pipelineSpec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: pipelineSlug.toLowerCase(), mode: "insensitive" },
      isActive: true,
      isDirty: false,
    },
    select: { slug: true, config: true },
  });

  if (!pipelineSpec) {
    throw new Error(
      `Pipeline spec not found: "${pipelineSlug}". ` +
      `Run "Import All" on /x/admin/spec-sync to import PIPELINE-001 from spec files.`
    );
  }

  const stages = extractStagesFromConfig(pipelineSpec.config);
  if (!stages || stages.length === 0) {
    throw new Error(
      `Pipeline spec "${pipelineSpec.slug}" exists but has no valid stage configuration. ` +
      `Check spec.config.parameters[].config.stages array.`
    );
  }

  logInfo(`Pipeline stages loaded from "${pipelineSpec.slug}"`, { stageCount: stages.length });
  return stages;
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
