/**
 * Instructions Transform
 * Assembled from multiple sub-sections.
 * Extracted from route.ts lines 1929-2334
 *
 * This is the meta-transform that references prior section outputs
 * (memories, personality, targets, curriculum, goals, identity, content)
 * and assembles the `instructions` object.
 */

import { registerTransform } from "../TransformRegistry";
import { classifyValue, getAttributeValue } from "../types";
import { computePersonalityAdaptation } from "./personality";
import type { AssembledContext, CallerAttributeData } from "../types";

registerTransform("computeInstructions", (
  _rawData: any,
  context: AssembledContext,
) => {
  const { sections, loadedData, sharedState, resolvedSpecs } = context;
  const { thresholds, modules, isFirstCall, moduleToReview, nextModule, completedModules } = sharedState;
  const personality = loadedData.personality;
  const callerAttributes = loadedData.callerAttributes;
  const learnerGoals = loadedData.goals;
  const contentSpec = resolvedSpecs.contentSpec;
  const contentCfg = contentSpec?.config as Record<string, any> | null;

  // Get memory groups from the memories section output
  const memoryGroups = sections.memories?.byCategory || {};

  // Get merged targets from behavior_targets section
  const mergedTargets = sections.behaviorTargets?._merged || sections.behaviorTargets?.all || [];

  return {
    // Use memories (route.ts lines 1930-1956)
    use_memories: (() => {
      const allMemoryStrings: string[] = [];
      const facts = memoryGroups["FACT"]?.slice(0, 3) || [];
      const relationships = memoryGroups["RELATIONSHIP"]?.slice(0, 2) || [];
      const contextMems = memoryGroups["CONTEXT"]?.slice(0, 2) || [];
      [...facts, ...relationships, ...contextMems].forEach((m: any) => {
        allMemoryStrings.push(`${m.key}="${m.value}"`);
      });

      if (allMemoryStrings.length > 0) {
        return `Reference naturally in conversation: ${allMemoryStrings.join(", ")}`;
      }

      const hasPreferences = (memoryGroups["PREFERENCE"]?.length || 0) > 0;
      const hasTopics = (memoryGroups["TOPIC"]?.length || 0) > 0;

      if (hasPreferences || hasTopics) {
        const parts: string[] = [];
        if (hasPreferences) parts.push("preferences");
        if (hasTopics) parts.push("topics of interest");
        return `No biographical facts recorded yet. See ${parts.join(" and ")} below. Build rapport naturally.`;
      }

      return "No specific memories recorded yet. Build rapport and learn about them.";
    })(),

    // Use preferences (route.ts lines 1957-1963)
    use_preferences: (() => {
      const prefs = memoryGroups["PREFERENCE"]?.slice(0, 4) || [];
      if (prefs.length === 0) {
        return "No preferences recorded yet. Observe their communication style.";
      }
      return `Respect caller preferences: ${prefs.map((m: any) => `${m.key}="${m.value}"`).join(", ")}`;
    })(),

    // Use topics (route.ts lines 1964-1975)
    use_topics: (() => {
      const topics = memoryGroups["TOPIC"]?.slice(0, 3) || [];
      const interestPrefs = (memoryGroups["PREFERENCE"] || [])
        .filter((m: any) => m.key.toLowerCase().includes("interest"))
        .slice(0, 2);
      const allTopics = [...topics.map((m: any) => m.value), ...interestPrefs.map((m: any) => m.value)];
      if (allTopics.length === 0) {
        return "No specific topics of interest recorded yet.";
      }
      return `Topics of interest to explore: ${allTopics.join(", ")}`;
    })(),

    // Interest handling (route.ts lines 1977-2015)
    interest_handling: (() => {
      const interestPrefs = (memoryGroups["PREFERENCE"] || [])
        .filter((m: any) => m.key.toLowerCase().includes("interest"));

      if (interestPrefs.length === 0 || modules.length === 0) return null;

      const currentModuleIndex = moduleToReview ? modules.findIndex((m: any) => m.slug === moduleToReview.slug) : 0;
      const futureModules = modules.slice(currentModuleIndex + 1);

      const futureInterests: string[] = [];
      for (const pref of interestPrefs) {
        const interestValue = pref.value.toLowerCase();
        const interestKey = pref.key.toLowerCase();
        for (const mod of futureModules) {
          const modName = mod.name.toLowerCase();
          const modDesc = (mod.description || "").toLowerCase();
          if (modName.includes(interestValue) || modDesc.includes(interestValue) ||
              interestValue.includes(modName) || interestKey.includes(mod.slug)) {
            futureInterests.push(`"${pref.value}" relates to module "${mod.name}" (coming later)`);
          }
        }
      }

      if (futureInterests.length === 0) return null;

      return {
        tension: futureInterests,
        guidance: "When caller asks about these future topics: acknowledge their interest, note it connects to upcoming material, then gently redirect: 'Great question - we'll dig into that when we get to [module]. For now, let's build the foundation with [current topic].'",
        avoid: "Don't ignore their interest or dismiss it. Don't skip ahead. Don't give a detailed answer that requires context they don't have yet.",
      };
    })(),

    // Personality adaptation (route.ts lines 2017-2075)
    personality_adaptation: computePersonalityAdaptation(personality, thresholds),

    // Behavior targets summary (route.ts lines 2076-2087)
    behavior_targets_summary: mergedTargets.slice(0, 5).map((t: any) => ({
      what: t.parameter?.name || t.name || t.parameterId,
      target: classifyValue(t.targetValue, thresholds),
      meaning: t.targetValue >= thresholds.high
        ? (t.parameter?.interpretationHigh || t.when_high)
        : t.targetValue <= thresholds.low
          ? (t.parameter?.interpretationLow || t.when_low)
          : (t.parameter?.interpretationHigh || t.when_high) && (t.parameter?.interpretationLow || t.when_low)
            ? `Balance: ${((t.parameter?.interpretationHigh || t.when_high) as string).split(",")[0].trim()} while also ${((t.parameter?.interpretationLow || t.when_low) as string).split(",")[0].toLowerCase().trim()}`
            : (t.parameter?.interpretationHigh || t.when_high) || (t.parameter?.interpretationLow || t.when_low) || "balanced approach",
    })),

    // Curriculum guidance (route.ts lines 2091-2145)
    curriculum_guidance: (() => {
      const parts: string[] = [];

      if (modules.length > 0) {
        parts.push(`Curriculum: ${contentCfg?.curriculum?.name || contentSpec?.name || "Learning"} (${modules.length} modules)`);
        parts.push(`Progress: ${completedModules.size}/${modules.length} completed`);

        if (isFirstCall && modules[0]) {
          parts.push(`THIS SESSION: First call - introduce "${modules[0].name}"`);
        } else if (moduleToReview && nextModule && moduleToReview.slug !== nextModule.slug) {
          parts.push(`THIS SESSION: Review "${moduleToReview.name}" → Introduce "${nextModule.name}"`);
        } else if (nextModule) {
          parts.push(`THIS SESSION: Continue with "${nextModule.name}"`);
        } else if (moduleToReview) {
          parts.push(`THIS SESSION: Deepen mastery of "${moduleToReview.name}"`);
        }
      }

      const nextContent = callerAttributes.filter((a: CallerAttributeData) =>
        a.key.includes("next_") || a.key.includes("ready_for")
      );
      const currentModule = callerAttributes.find((a: CallerAttributeData) =>
        a.key.includes("current_module") || a.key.includes("active_module")
      );
      const mastery = callerAttributes.find((a: CallerAttributeData) =>
        a.key.includes("mastery") && !a.key.includes("mastery_")
      );

      if (currentModule) parts.push(`Current module: ${getAttributeValue(currentModule)}`);
      if (mastery) {
        const masteryVal = getAttributeValue(mastery);
        parts.push(`Mastery level: ${typeof masteryVal === "number" ? (masteryVal * 100).toFixed(0) + "%" : masteryVal}`);
      }
      if (nextContent.length > 0) {
        parts.push(`Next content to cover: ${nextContent.map((a: CallerAttributeData) => getAttributeValue(a)).join(", ")}`);
      }

      if (parts.length === 0) return "No curriculum progress tracked yet - start with first module.";
      return parts.join(". ");
    })(),

    // Session guidance (route.ts lines 2148-2154)
    session_guidance: (() => {
      const goals = learnerGoals.slice(0, 3);
      if (goals.length === 0) {
        return "No specific session goals set - explore learner interests and set goals collaboratively.";
      }
      return `Session goals: ${goals.map(g => g.name).join("; ")}`;
    })(),

    // Session pedagogy — delegates to separate transform (already computed)
    session_pedagogy: sections.instructions_pedagogy || null,

    // Voice — delegates to separate transform (already computed)
    voice: sections.instructions_voice || null,
  };
});
