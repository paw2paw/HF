/**
 * Pipeline guardrails — loaded from the SUPERVISE spec (GUARD-001),
 * with sensible defaults if no spec is found.
 */

import { prisma } from "@/lib/prisma";
import { getPipelineSettings } from "@/lib/system-settings";
import type { PipelineLogger } from "./logger";
import type { SpecConfig } from "@/lib/types/json-fields";

export interface GuardrailsConfig {
  targetClamp: { minValue: number; maxValue: number };
  confidenceBounds: { minConfidence: number; maxConfidence: number; defaultConfidence: number };
  mockBehavior: { scoreRangeMin: number; scoreRangeMax: number; nudgeFactor: number };
  aiSettings: { temperature: number; maxRetries: number };
  aggregation: {
    decayHalfLifeDays: number;
    confidenceGrowthBase: number;
    confidenceGrowthPerCall: number;
    maxAggregatedConfidence: number;
  };
}

export const DEFAULT_GUARDRAILS: GuardrailsConfig = {
  targetClamp: { minValue: 0.2, maxValue: 0.8 },
  confidenceBounds: { minConfidence: 0.3, maxConfidence: 0.95, defaultConfidence: 0.7 },
  mockBehavior: { scoreRangeMin: 0.4, scoreRangeMax: 0.8, nudgeFactor: 0.2 },
  aiSettings: { temperature: 0.3, maxRetries: 2 },
  aggregation: {
    decayHalfLifeDays: 30,
    confidenceGrowthBase: 0.5,
    confidenceGrowthPerCall: 0.1,
    maxAggregatedConfidence: 0.95,
  },
};

/**
 * Load guardrails configuration from SUPERVISE spec (GUARD-001 or similar).
 * Falls back to defaults if no spec found.
 */
export async function loadGuardrails(log: PipelineLogger): Promise<GuardrailsConfig> {
  const ps = await getPipelineSettings();

  const superviseSpec = await prisma.analysisSpec.findFirst({
    where: {
      outputType: "SUPERVISE",
      isActive: true,
      isDirty: false,
    },
    select: { slug: true, config: true },
  });

  if (!superviseSpec) {
    log.info("No SUPERVISE spec found - using default guardrails");
    return DEFAULT_GUARDRAILS;
  }

  const specConfig = (superviseSpec.config as SpecConfig) || {};
  const parameters = (specConfig.parameters as Array<{ id: string; config?: Record<string, any> }>) || [];

  const getParamConfig = (paramId: string): Record<string, any> => {
    const param = parameters.find((p) => p.id === paramId);
    return param?.config || {};
  };

  const targetClampConfig = getParamConfig("target_clamp");
  const confidenceConfig = getParamConfig("confidence_bounds");
  const mockConfig = getParamConfig("mock_behavior");
  const aiConfig = getParamConfig("ai_settings");
  const aggConfig = getParamConfig("aggregation");

  const guardrails: GuardrailsConfig = {
    targetClamp: {
      minValue: targetClampConfig.minValue ?? DEFAULT_GUARDRAILS.targetClamp.minValue,
      maxValue: targetClampConfig.maxValue ?? DEFAULT_GUARDRAILS.targetClamp.maxValue,
    },
    confidenceBounds: {
      minConfidence: confidenceConfig.minConfidence ?? DEFAULT_GUARDRAILS.confidenceBounds.minConfidence,
      maxConfidence: confidenceConfig.maxConfidence ?? DEFAULT_GUARDRAILS.confidenceBounds.maxConfidence,
      defaultConfidence: confidenceConfig.defaultConfidence ?? DEFAULT_GUARDRAILS.confidenceBounds.defaultConfidence,
    },
    mockBehavior: {
      scoreRangeMin: mockConfig.scoreRangeMin ?? DEFAULT_GUARDRAILS.mockBehavior.scoreRangeMin,
      scoreRangeMax: mockConfig.scoreRangeMax ?? DEFAULT_GUARDRAILS.mockBehavior.scoreRangeMax,
      nudgeFactor: mockConfig.nudgeFactor ?? DEFAULT_GUARDRAILS.mockBehavior.nudgeFactor,
    },
    aiSettings: {
      temperature: aiConfig.temperature ?? DEFAULT_GUARDRAILS.aiSettings.temperature,
      maxRetries: aiConfig.maxRetries ?? ps.maxRetries,
    },
    aggregation: {
      decayHalfLifeDays: aggConfig.decayHalfLifeDays ?? ps.personalityDecayHalfLifeDays,
      confidenceGrowthBase: aggConfig.confidenceGrowthBase ?? DEFAULT_GUARDRAILS.aggregation.confidenceGrowthBase,
      confidenceGrowthPerCall: aggConfig.confidenceGrowthPerCall ?? DEFAULT_GUARDRAILS.aggregation.confidenceGrowthPerCall,
      maxAggregatedConfidence: aggConfig.maxAggregatedConfidence ?? DEFAULT_GUARDRAILS.aggregation.maxAggregatedConfidence,
    },
  };

  log.info(`Guardrails loaded from "${superviseSpec.slug}"`, {
    targetClamp: guardrails.targetClamp,
  });

  return guardrails;
}
