/**
 * Module & Curriculum Transforms
 * Extracted from route.ts lines 1397-1458, 1776-1857
 *
 * computeSharedState() is the CRITICAL function — it computes
 * shared module state used by _quickStart, curriculum, session_pedagogy,
 * and curriculum_guidance. Called once during executor setup.
 */

import { registerTransform } from "../TransformRegistry";
import { getAttributeValue } from "../types";
import type {
  LoadedDataContext,
  ResolvedSpecs,
  SharedComputedState,
  ModuleData,
  AssembledContext,
  CallerAttributeData,
} from "../types";

/**
 * Compute shared module state from loaded data.
 * Extracted from route.ts lines 1397-1458.
 * Called once in executor setup, stored in AssembledContext.sharedState.
 */
export function computeSharedState(
  data: LoadedDataContext,
  resolvedSpecs: ResolvedSpecs,
  specConfig: Record<string, any>,
): SharedComputedState {
  const contentCfg = resolvedSpecs.contentSpec?.config as Record<string, any> | null;
  const modules: ModuleData[] = contentCfg?.modules || contentCfg?.curriculum?.modules || [];
  const isFirstCall = data.recentCalls.length === 0;
  const lastCall = data.recentCalls[0];
  const daysSinceLastCall = lastCall
    ? Math.floor((Date.now() - new Date(lastCall.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Track completed modules from callerAttributes
  const completedModules = new Set<string>();
  data.callerAttributes
    .filter(a => a.key.includes("mastery_") || a.key.includes("completed_"))
    .forEach(a => {
      const val = getAttributeValue(a);
      if (val === true || (typeof val === "number" && val >= 0.7)) {
        const slug = a.key.replace("mastery_", "").replace("completed_", "");
        completedModules.add(slug);
      }
    });

  // Estimate progress: if no explicit tracking, assume ~1 module per 2 calls
  const estimatedProgress = completedModules.size > 0
    ? completedModules.size
    : Math.min(Math.floor(data.recentCalls.length / 2), modules.length - 1);

  const lastCompletedIndex = completedModules.size > 0
    ? Math.max(...modules.map((m: any, i: number) => completedModules.has(m.slug) ? i : -1))
    : Math.max(0, estimatedProgress - 1);

  // Module to review = last completed (or first if no progress)
  const moduleToReview = modules[lastCompletedIndex] || modules[0] || null;
  // Next module = one after last completed
  const nextModuleIndex = lastCompletedIndex + 1;
  const nextModule = nextModuleIndex < modules.length ? modules[nextModuleIndex] : null;

  // Determine review intensity based on time gap
  let reviewType = "quick_recall";
  let reviewReason = "Brief recall to activate prior knowledge";
  if (daysSinceLastCall >= 14) {
    reviewType = "reintroduce";
    reviewReason = `${daysSinceLastCall} days since last session - rebuild understanding`;
  } else if (daysSinceLastCall >= 7) {
    reviewType = "deep_review";
    reviewReason = `${daysSinceLastCall} days gap - full review with new example`;
  } else if (daysSinceLastCall >= 3) {
    reviewType = "application";
    reviewReason = `${daysSinceLastCall} days gap - application question to check retention`;
  }

  const thresholds = specConfig.thresholds || { high: 0.65, low: 0.35 };

  return {
    modules,
    isFirstCall,
    daysSinceLastCall,
    completedModules,
    estimatedProgress,
    lastCompletedIndex,
    moduleToReview,
    nextModule,
    reviewType,
    reviewReason,
    thresholds,
  };
}

/**
 * Build the curriculum section for llmPrompt.
 * Extracted from route.ts lines 1776-1857.
 */
registerTransform("computeModuleProgress", (
  _rawData: any,
  context: AssembledContext,
) => {
  const { sharedState, loadedData, resolvedSpecs } = context;
  const { modules, completedModules, estimatedProgress, lastCompletedIndex, nextModule } = sharedState;
  const contentCfg = resolvedSpecs.contentSpec?.config as Record<string, any> | null;
  const callerAttributes = loadedData.callerAttributes;
  const totalCallCount = loadedData.callCount;

  const curriculumAttrs = callerAttributes.filter((a: CallerAttributeData) =>
    a.key.includes("module") ||
    a.key.includes("curriculum") ||
    a.key.includes("mastery") ||
    a.key.includes("comprehension") ||
    a.key.includes("progress") ||
    a.sourceSpecSlug?.includes("CURR")
  );

  const nextContentAttrs = callerAttributes.filter((a: CallerAttributeData) =>
    a.key.includes("next_") ||
    a.key.includes("ready_for") ||
    a.key.includes("prerequisite")
  );

  const completedModulesList = Array.from(completedModules);
  const coveredModules = completedModulesList.length > 0
    ? completedModulesList
    : modules.slice(0, Math.max(0, estimatedProgress)).map((m: any) => m.slug);

  const getModuleStatus = (m: any, idx: number): "completed" | "in_progress" | "not_started" => {
    if (completedModules.has(m.slug)) return "completed";
    if (idx <= lastCompletedIndex && totalCallCount > 0) return "in_progress";
    return "not_started";
  };

  return {
    name: contentCfg?.curriculum?.name || resolvedSpecs.contentSpec?.name || null,
    hasData: curriculumAttrs.length > 0 || modules.length > 0,
    totalModules: modules.length,
    completedModules: completedModulesList,
    coveredModules,
    completedCount: completedModules.size,
    estimatedProgress,
    modules: modules.map((m: any, idx: number) => ({
      slug: m.slug,
      name: m.name,
      description: m.description,
      order: m.sortOrder,
      prerequisites: m.prerequisites,
      masteryThreshold: m.masteryThreshold,
      isCompleted: completedModules.has(m.slug),
      status: getModuleStatus(m, idx),
    })),
    nextModule: nextModule ? {
      slug: nextModule.slug,
      name: nextModule.name,
      description: nextModule.description,
    } : null,
    currentProgress: curriculumAttrs.map((a: CallerAttributeData) => ({
      key: a.key,
      value: getAttributeValue(a),
      confidence: a.confidence,
      source: a.sourceSpecSlug,
    })),
    nextContent: nextContentAttrs.map((a: CallerAttributeData) => ({
      key: a.key,
      value: getAttributeValue(a),
    })),
  };
});
