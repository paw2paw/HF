/**
 * adapt-runner.ts
 *
 * Generic ADAPT phase runner that reads ADAPT specs and applies adaptation rules.
 * Reads learner profile from CallerAttribute and writes adjusted targets to CallerTarget.
 *
 * Contract-based - NO HARDCODING of profile keys or parameters.
 */

import { prisma } from "@/lib/prisma";
import { getLearnerProfile } from "@/lib/learner/profile";

interface AdaptationRule {
  condition: {
    profileKey: string;
    value: string | number;
  };
  actions: AdaptationAction[];
}

interface AdaptationAction {
  targetParameter: string;
  adjustment: "set" | "increase" | "decrease";
  value?: number;
  delta?: number;
  rationale: string;
}

interface AdaptParameter {
  id: string;
  config: {
    adaptationRules: AdaptationRule[];
  };
}

/**
 * Run all ADAPT specs for a caller
 * Reads learner profile and applies adaptation rules to behavior targets
 */
export async function runAdaptSpecs(callerId: string): Promise<{
  specsRun: number;
  targetsCreated: number;
  targetsUpdated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let specsRun = 0;
  let targetsCreated = 0;
  let targetsUpdated = 0;

  try {
    // Get all active ADAPT specs
    const adaptSpecs = await prisma.analysisSpec.findMany({
      where: {
        outputType: "ADAPT",
        isActive: true,
      },
    });

    if (adaptSpecs.length === 0) {
      return { specsRun: 0, targetsCreated: 0, targetsUpdated: 0, errors: [] };
    }

    // Get learner profile
    const learnerProfile = await getLearnerProfile(callerId);

    // Run each ADAPT spec
    for (const spec of adaptSpecs) {
      try {
        const config = spec.config as any;
        const parameters: AdaptParameter[] = config.parameters || [];

        // Find parameters with adaptationRules
        for (const param of parameters) {
          if (param.config?.adaptationRules) {
            const result = await applyAdaptationRules(
              callerId,
              spec.slug,
              learnerProfile,
              param.config.adaptationRules
            );

            targetsCreated += result.created;
            targetsUpdated += result.updated;
          }
        }

        specsRun++;
      } catch (error: any) {
        errors.push(`Error running spec ${spec.slug}: ${error.message}`);
      }
    }

    return { specsRun, targetsCreated, targetsUpdated, errors };
  } catch (error: any) {
    errors.push(`Error in runAdaptSpecs: ${error.message}`);
    return { specsRun, targetsCreated, targetsUpdated, errors };
  }
}

/**
 * Apply adaptation rules from a spec parameter
 */
async function applyAdaptationRules(
  callerId: string,
  specSlug: string,
  learnerProfile: any,
  rules: AdaptationRule[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Group rules by condition to process efficiently
  for (const rule of rules) {
    // Check if condition matches profile
    const profileValue = getProfileValue(learnerProfile, rule.condition.profileKey);

    if (profileValue === null || profileValue !== rule.condition.value) {
      continue; // Condition not met
    }

    // Condition met - apply all actions
    for (const action of rule.actions) {
      try {
        // Get or create the parameter
        const parameter = await prisma.parameter.findUnique({
          where: { parameterId: action.targetParameter },
        });

        if (!parameter) {
          console.warn(`[adapt-runner] Parameter not found: ${action.targetParameter}`);
          continue;
        }

        // Get current target value (if exists)
        const existingTarget = await prisma.callerTarget.findUnique({
          where: {
            callerId_parameterId: {
              callerId,
              parameterId: action.targetParameter,
            },
          },
        });

        // Compute target value based on adjustment method
        let targetValue: number;
        if (action.adjustment === "set") {
          targetValue = action.value ?? 0.5;
        } else if (action.adjustment === "increase") {
          const currentValue = existingTarget?.targetValue ?? 0.5;
          targetValue = Math.min(1.0, currentValue + (action.delta ?? 0.1));
        } else if (action.adjustment === "decrease") {
          const currentValue = existingTarget?.targetValue ?? 0.5;
          targetValue = Math.max(0.0, currentValue - (action.delta ?? 0.1));
        } else {
          targetValue = 0.5; // fallback
        }

        // Clamp to [0, 1]
        targetValue = Math.max(0.0, Math.min(1.0, targetValue));

        // Write to CallerTarget
        const result = await prisma.callerTarget.upsert({
          where: {
            callerId_parameterId: {
              callerId,
              parameterId: action.targetParameter,
            },
          },
          create: {
            callerId,
            parameterId: action.targetParameter,
            targetValue,
            confidence: 0.8, // Adaptation confidence
            sourceSpecSlug: specSlug,
            reasoning: action.rationale,
          },
          update: {
            targetValue,
            confidence: 0.8,
            sourceSpecSlug: specSlug,
            reasoning: action.rationale,
          },
        });

        if (existingTarget) {
          updated++;
        } else {
          created++;
        }
      } catch (error: any) {
        console.error(`[adapt-runner] Error applying action for ${action.targetParameter}:`, error);
      }
    }
  }

  return { created, updated };
}

/**
 * Get profile value by key (camelCase or snake_case)
 * Maps between profile object keys and contract keys
 */
function getProfileValue(profile: any, key: string): string | number | null {
  if (!profile) return null;

  // Direct key match
  if (profile[key] !== undefined && profile[key] !== null) {
    return profile[key];
  }

  // Try camelCase conversion
  const camelKey = toCamelCase(key);
  if (profile[camelKey] !== undefined && profile[camelKey] !== null) {
    return profile[camelKey];
  }

  // Try snake_case conversion
  const snakeKey = toSnakeCase(key);
  if (profile[snakeKey] !== undefined && profile[snakeKey] !== null) {
    return profile[snakeKey];
  }

  return null;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}
