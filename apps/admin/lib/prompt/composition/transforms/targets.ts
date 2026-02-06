/**
 * Behavior Target Transforms
 * Extracted from route.ts lines 364-443, 1364-1384, 1758-1771
 */

import { registerTransform } from "../TransformRegistry";
import { classifyValue } from "../types";
import type { AssembledContext, BehaviorTargetData, CallerTargetData, CompositionSectionDef } from "../types";

/** Normalized target type that works for both CallerTarget and BehaviorTarget */
export interface NormalizedTarget {
  parameterId: string;
  targetValue: number;
  confidence: number;
  source: "CallerTarget" | "BehaviorTarget";
  scope: string;
  parameter: {
    name: string | null;
    interpretationLow: string | null;
    interpretationHigh: string | null;
    domainGroup: string | null;
  } | null;
}

/**
 * Merge CallerTargets + BehaviorTargets with scope priority,
 * then group by domainGroup.
 */
registerTransform("mergeAndGroupTargets", (
  rawData: { behaviorTargets: BehaviorTargetData[]; callerTargets: CallerTargetData[] },
  context: AssembledContext,
  _sectionDef: CompositionSectionDef,
) => {
  const { behaviorTargets, callerTargets } = rawData;
  const playbook = context.loadedData.playbook;

  // Merge with priority: CallerTarget > PLAYBOOK > DOMAIN > SYSTEM
  const merged = mergeTargets(behaviorTargets, callerTargets, playbook?.id || null);
  const { thresholds } = context.sharedState;

  // Group by domain
  const byDomain: Record<string, Array<{
    parameterId: string;
    name: string;
    targetValue: number;
    targetLevel: string;
    interpretationHigh: string | null;
    interpretationLow: string | null;
  }>> = {};

  for (const t of merged) {
    const domain = t.parameter?.domainGroup || "Other";
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push({
      parameterId: t.parameterId,
      name: t.parameter?.name || t.parameterId,
      targetValue: t.targetValue,
      targetLevel: classifyValue(t.targetValue, thresholds) || "MODERATE",
      interpretationHigh: t.parameter?.interpretationHigh || null,
      interpretationLow: t.parameter?.interpretationLow || null,
    });
  }

  return {
    totalCount: merged.length,
    byDomain,
    all: merged.map((t) => ({
      parameterId: t.parameterId,
      name: t.parameter?.name || t.parameterId,
      targetValue: t.targetValue,
      targetLevel: classifyValue(t.targetValue, thresholds),
      scope: t.scope,
      when_high: t.parameter?.interpretationHigh,
      when_low: t.parameter?.interpretationLow,
    })),
    // Store merged list for other transforms
    _merged: merged,
  };
});

/**
 * Merge CallerTargets with BehaviorTargets using scope priority.
 * Extracted from route.ts lines 364-438.
 */
export function mergeTargets(
  behaviorTargets: BehaviorTargetData[],
  callerTargets: CallerTargetData[],
  playbookId: string | null,
): NormalizedTarget[] {
  const byParameter = new Map<string, NormalizedTarget>();

  // CallerTargets first (highest priority)
  for (const ct of callerTargets) {
    byParameter.set(ct.parameterId, {
      parameterId: ct.parameterId,
      targetValue: ct.targetValue,
      confidence: ct.confidence,
      source: "CallerTarget",
      scope: "CALLER_PERSONALIZED",
      parameter: ct.parameter,
    });
  }

  const scopePriority: Record<string, number> = {
    CALLER: 4,
    PLAYBOOK: 3,
    DOMAIN: 2,
    SYSTEM: 1,
  };

  // Fill in with BehaviorTargets for missing parameters
  for (const target of behaviorTargets) {
    if (byParameter.has(target.parameterId) && byParameter.get(target.parameterId)?.source === "CallerTarget") {
      continue;
    }

    const existing = byParameter.get(target.parameterId);
    const currentPriority = scopePriority[target.scope] || 0;
    const existingPriority = existing ? (scopePriority[existing.scope] || 0) : 0;

    if (target.scope === "PLAYBOOK" && playbookId) {
      if (target.playbookId === playbookId && currentPriority > existingPriority) {
        byParameter.set(target.parameterId, {
          parameterId: target.parameterId,
          targetValue: target.targetValue,
          confidence: target.confidence,
          source: "BehaviorTarget",
          scope: target.scope,
          parameter: target.parameter,
        });
      }
    } else if (target.scope !== "PLAYBOOK" && currentPriority > existingPriority) {
      byParameter.set(target.parameterId, {
        parameterId: target.parameterId,
        targetValue: target.targetValue,
        confidence: target.confidence,
        source: "BehaviorTarget",
        scope: target.scope,
        parameter: target.parameter,
      });
    }
  }

  return Array.from(byParameter.values());
}
