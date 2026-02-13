/**
 * Load COMPOSE spec configuration from database.
 *
 * Reads COMP-001 (or equivalent) spec and builds the full config
 * needed by executeComposition(). Shared by both the compose-prompt
 * API route and the pipeline COMPOSE stage.
 *
 * NO HARDCODING — all values come from the spec. Structural defaults only.
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getDefaultSections } from "./CompositionExecutor";
import type { CompositionSectionDef } from "./types";

export interface ComposeConfig {
  specSlug: string | null;
  fullSpecConfig: Record<string, any>;
  sections: CompositionSectionDef[];
}

/**
 * Load COMPOSE spec from DB and build the full config object.
 *
 * @param overrides - Optional preview overrides
 * @returns Config ready to pass to executeComposition()
 */
export async function loadComposeConfig(overrides?: {
  targetOverrides?: Record<string, number>;
  playbookIds?: string[];
}): Promise<ComposeConfig> {
  // Try exact slug first (from config), then fallback to any active COMPOSE/SYSTEM spec
  const composeSpec = await prisma.analysisSpec.findFirst({
    where: { slug: config.specs.compose, isActive: true },
  }) || await prisma.analysisSpec.findFirst({
    where: {
      outputType: "COMPOSE",
      isActive: true,
      scope: "SYSTEM",
      domain: { not: "prompt-slugs" },
    },
  });

  const specConfig = (composeSpec?.config as any) || {};
  const specParameters: Array<{ id: string; config?: any }> = specConfig.parameters || [];

  const getParamConfig = (paramId: string): any => {
    const param = specParameters.find((p: any) => p.id === paramId);
    return param?.config || {};
  };

  // Extract spec-driven config values from parameter sections
  const personalityConfig = getParamConfig("personality_section");
  const memoryConfig = getParamConfig("memory_section");
  const sessionConfig = getParamConfig("session_context_section");
  const historyConfig = getParamConfig("recent_history_section");

  const thresholds = personalityConfig.thresholds || specConfig.thresholds || { high: 0.65, low: 0.35 };
  const memoriesLimit = memoryConfig.memoriesLimit || specConfig.memoriesLimit || 50;
  const memoriesPerCategory = memoryConfig.memoriesPerCategory || specConfig.memoriesPerCategory || 5;
  const recentCallsLimit = sessionConfig.recentCallsLimit || specConfig.recentCallsLimit || 5;
  const maxTokens = historyConfig.maxTokens || specConfig.maxTokens || 1500;
  const temperature = historyConfig.temperature || specConfig.temperature || 0.7;

  return {
    specSlug: composeSpec?.slug || null,
    fullSpecConfig: {
      ...specConfig,
      thresholds,
      memoriesLimit,
      memoriesPerCategory,
      recentCallsLimit,
      maxTokens,
      temperature,
      targetOverrides: overrides?.targetOverrides || {},
      playbookIds: overrides?.playbookIds || undefined,
    },
    sections: specConfig.sections || getDefaultSections(),
  };
}
