/**
 * aggregate-runner.ts
 *
 * Runs AGGREGATE specs to compute derived attributes from measurements
 * Contract-based: reads aggregationRules from spec config, NO hardcoding
 *
 * Responsibilities:
 * - Find active AGGREGATE specs
 * - Read recent CallScores for source parameters
 * - Apply aggregation rules (thresholds, weighted average)
 * - Update CallerAttribute using contract-based helpers
 *
 * Example: LEARN-PROF-001 aggregates learning behavior scores into learner profile
 */

import { prisma } from "@/lib/prisma";
import { updateLearnerProfile } from "@/lib/learner/profile";
import type { SpecConfig } from "@/lib/types/json-fields";

interface AggregationRule {
  sourceParameter: string;
  targetProfileKey: string;
  method: 'threshold_mapping' | 'weighted_average' | 'consensus';
  thresholds?: Array<{
    min?: number;
    max?: number;
    value: string;
    confidence?: number;
  }>;
  windowSize?: number;
  recencyWeight?: number;
}

interface AggregateConfig {
  aggregationRules: AggregationRule[];
  windowSize?: number;
  recencyWeight?: number;
  minimumObservations?: number;
}

/**
 * Run all active AGGREGATE specs for a caller
 */
export async function runAggregateSpecs(callerId: string): Promise<{
  specsRun: number;
  profileUpdates: number;
  errors: string[];
}> {
  const results = {
    specsRun: 0,
    profileUpdates: 0,
    errors: [] as string[],
  };

  // Find all active AGGREGATE specs
  const aggregateSpecs = await prisma.analysisSpec.findMany({
    where: {
      outputType: 'AGGREGATE',
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      config: true,
    },
  });

  console.log(`[aggregate-runner] Found ${aggregateSpecs.length} AGGREGATE specs`);

  for (const spec of aggregateSpecs) {
    try {
      console.log(`[aggregate-runner] Running ${spec.slug}...`);

      const config = (spec.config as SpecConfig) || {};
      const parameters = (config.parameters as Array<{ config?: AggregateConfig }>) || [];

      // Find the aggregate parameter with config
      const aggregateParam = parameters.find((p) =>
        p.config?.aggregationRules && p.config.aggregationRules.length > 0
      );

      if (!aggregateParam) {
        console.warn(`[aggregate-runner] ${spec.slug} has no aggregationRules, skipping`);
        continue;
      }

      const aggregateConfig = aggregateParam.config as AggregateConfig;

      // Run aggregation
      await runAggregation(callerId, spec.slug, aggregateConfig);

      results.specsRun++;

    } catch (error: any) {
      const errorMsg = `Error running ${spec.slug}: ${error.message}`;
      console.error(`[aggregate-runner] ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }

  return results;
}

/**
 * Run aggregation for a specific spec
 */
async function runAggregation(
  callerId: string,
  specSlug: string,
  config: AggregateConfig
): Promise<void> {
  const {
    aggregationRules,
    windowSize = 5,
    minimumObservations = 3,
  } = config;

  console.log(`[aggregate-runner] Processing ${aggregationRules.length} rules for ${specSlug}`);

  // Collect all profile updates
  const profileUpdates: Record<string, any> = {};
  let overallConfidence = 0;
  let ruleCount = 0;

  for (const rule of aggregationRules) {
    try {
      const result = await applyAggregationRule(
        callerId,
        rule,
        windowSize,
        minimumObservations
      );

      if (result) {
        // Convert targetProfileKey to camelCase field name
        const fieldName = toCamelCase(rule.targetProfileKey);
        profileUpdates[fieldName] = result.value;
        overallConfidence += result.confidence;
        ruleCount++;

        console.log(
          `[aggregate-runner] ${rule.sourceParameter} → ${rule.targetProfileKey} = ${result.value} ` +
          `(confidence: ${result.confidence.toFixed(2)})`
        );
      }
    } catch (error: any) {
      console.error(`[aggregate-runner] Error in rule ${rule.sourceParameter}:`, error.message);
    }
  }

  // Update profile if we have any updates
  if (Object.keys(profileUpdates).length > 0) {
    const avgConfidence = overallConfidence / ruleCount;

    // Check if this is a learner profile update (by checking target keys)
    const isLearnerProfile = aggregationRules.some(r =>
      r.targetProfileKey.includes('learning_style') ||
      r.targetProfileKey.includes('pace_preference') ||
      r.targetProfileKey.includes('interaction_style')
    );

    if (isLearnerProfile) {
      await updateLearnerProfile(callerId, profileUpdates, avgConfidence);
      console.log(`[aggregate-runner] Updated learner profile with ${Object.keys(profileUpdates).length} fields`);
    } else {
      // Generic CallerAttribute update for other profile types
      console.log(`[aggregate-runner] Non-learner profile update: ${Object.keys(profileUpdates).join(', ')}`);
      // TODO: Add generic profile update helper if needed
    }
  } else {
    console.log(`[aggregate-runner] No profile updates for ${specSlug} (insufficient data)`);
  }
}

/**
 * Apply a single aggregation rule
 */
async function applyAggregationRule(
  callerId: string,
  rule: AggregationRule,
  windowSize: number,
  minimumObservations: number
): Promise<{ value: string; confidence: number } | null> {
  // Get recent scores for the source parameter
  const scores = await prisma.callScore.findMany({
    where: {
      call: { callerId },
      parameterId: rule.sourceParameter,
    },
    orderBy: { scoredAt: 'desc' },
    take: windowSize,
    select: {
      score: true,
      confidence: true,
      scoredAt: true,
    },
  });

  if (scores.length < minimumObservations) {
    console.log(
      `[aggregate-runner] Insufficient observations for ${rule.sourceParameter}: ` +
      `${scores.length} < ${minimumObservations}`
    );
    return null;
  }

  // Apply aggregation method
  switch (rule.method) {
    case 'threshold_mapping':
      return applyThresholdMapping(scores, rule);

    case 'weighted_average':
      return applyWeightedAverage(scores, rule);

    case 'consensus':
      return applyConsensus(scores, rule);

    default:
      console.warn(`[aggregate-runner] Unknown aggregation method: ${rule.method}`);
      return null;
  }
}

/**
 * Apply threshold mapping: map average score to value based on thresholds
 */
function applyThresholdMapping(
  scores: Array<{ score: number; confidence: number; scoredAt: Date }>,
  rule: AggregationRule
): { value: string; confidence: number } | null {
  if (!rule.thresholds || rule.thresholds.length === 0) {
    return null;
  }

  // Compute weighted average score (recent scores weighted more)
  const totalWeight = scores.reduce((sum, _, i) => sum + (1 / (i + 1)), 0);
  const weightedScore = scores.reduce(
    (sum, s, i) => sum + (s.score * (1 / (i + 1))),
    0
  ) / totalWeight;

  // Find matching threshold
  for (const threshold of rule.thresholds) {
    const minMatch = threshold.min === undefined || weightedScore >= threshold.min;
    const maxMatch = threshold.max === undefined || weightedScore < threshold.max;

    if (minMatch && maxMatch) {
      // Compute confidence as average of score confidences
      const avgConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;
      const thresholdConfidence = threshold.confidence || avgConfidence;

      return {
        value: threshold.value,
        confidence: Math.min(thresholdConfidence, avgConfidence),
      };
    }
  }

  console.warn(`[aggregate-runner] No threshold matched for score ${weightedScore.toFixed(2)}`);
  return null;
}

/**
 * Apply weighted average: compute weighted average and return as value
 */
function applyWeightedAverage(
  scores: Array<{ score: number; confidence: number; scoredAt: Date }>,
  rule: AggregationRule
): { value: string; confidence: number } {
  const totalWeight = scores.reduce((sum, _, i) => sum + (1 / (i + 1)), 0);
  const weightedScore = scores.reduce(
    (sum, s, i) => sum + (s.score * (1 / (i + 1))),
    0
  ) / totalWeight;

  const avgConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;

  return {
    value: weightedScore.toFixed(2),
    confidence: avgConfidence,
  };
}

/**
 * Apply consensus: find most common value (for categorical scores)
 */
function applyConsensus(
  scores: Array<{ score: number; confidence: number; scoredAt: Date }>,
  rule: AggregationRule
): { value: string; confidence: number } | null {
  // Round scores to nearest 0.1 to group similar values
  const rounded = scores.map(s => Math.round(s.score * 10) / 10);

  // Count occurrences
  const counts = new Map<number, number>();
  for (const val of rounded) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }

  // Find most common
  let maxCount = 0;
  let consensusValue = 0;
  for (const [val, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      consensusValue = val;
    }
  }

  // Confidence is proportion that agree
  const confidence = maxCount / scores.length;

  return {
    value: consensusValue.toString(),
    confidence,
  };
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
