/**
 * Identity & Content Spec Transforms
 * Extracted from route.ts lines 692-790, 2337-2414
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { registerTransform } from "../TransformRegistry";
import type { AssembledContext, PlaybookData, SystemSpecData, ResolvedSpecs, ResolvedSpec } from "../types";

/**
 * Resolve identity, content, and voice specs from stacked playbooks + system specs.
 * Playbooks are ordered by sortOrder - first playbook's spec wins on conflicts.
 * Called once during executor setup (not a registered transform).
 */
export function resolveSpecs(
  playbooks: PlaybookData[],
  systemSpecs: SystemSpecData[],
): ResolvedSpecs {
  let identitySpec: ResolvedSpec | null = null;
  let contentSpec: ResolvedSpec | null = null;
  let voiceSpec: ResolvedSpec | null = null;

  // 1. Check PlaybookItems from ALL playbooks (first playbook wins on conflicts)
  for (const playbook of playbooks) {
    for (const item of playbook.items || []) {
      if (item.spec) {
        if (!identitySpec && item.spec.specRole === "IDENTITY" && item.spec.domain !== "voice") {
          identitySpec = {
            name: item.spec.name,
            config: item.spec.config,
            description: item.spec.description,
          };
        }
        if (!contentSpec && item.spec.specRole === "CONTENT") {
          contentSpec = {
            name: item.spec.name,
            config: item.spec.config,
            description: item.spec.description,
          };
        }
        if (!voiceSpec && (item.spec.specRole === "VOICE" || (item.spec.specRole === "IDENTITY" && item.spec.domain === "voice"))) {
          voiceSpec = {
            name: item.spec.name,
            config: item.spec.config,
            description: item.spec.description,
          };
        }
      }
    }
  }

  // 2. Check System Specs as fallback
  if (!identitySpec || !contentSpec || !voiceSpec) {
    for (const spec of systemSpecs) {
      const role = spec.specRole as string;

      if (!identitySpec && role === "IDENTITY" && spec.domain !== "voice") {
        identitySpec = { name: spec.name, config: spec.config, description: spec.description };
      }
      if (!contentSpec && role === "CONTENT") {
        contentSpec = { name: spec.name, config: spec.config, description: spec.description };
      }
      if (!voiceSpec && (role === "VOICE" || (role === "IDENTITY" && spec.domain === "voice"))) {
        voiceSpec = { name: spec.name, config: spec.config, description: spec.description };
      }
    }
  }

  return { identitySpec, contentSpec, voiceSpec };
}

/**
 * Load voice spec directly if not found in playbook or system specs.
 * Uses config.specs.voicePattern for slug matching (default: "voice").
 */
export async function resolveVoiceSpecFallback(
  current: ResolvedSpecs,
): Promise<ResolvedSpecs> {
  if (current.voiceSpec) return current;

  const voicePattern = config.specs.voicePattern;
  const systemVoiceSpec = await prisma.analysisSpec.findFirst({
    where: {
      slug: { contains: voicePattern, mode: "insensitive" },
      specRole: "IDENTITY",
      domain: "voice",
      isActive: true,
    },
  });

  if (systemVoiceSpec) {
    return {
      ...current,
      voiceSpec: {
        name: systemVoiceSpec.name,
        config: systemVoiceSpec.config,
        description: systemVoiceSpec.description,
      },
    };
  }

  return current;
}

/**
 * Extract identity spec into llmPrompt output.
 * Extracted from route.ts lines 2337-2373.
 */
registerTransform("extractIdentitySpec", (
  _rawData: any,
  context: AssembledContext,
) => {
  const identitySpec = context.resolvedSpecs.identitySpec;
  const callerDomain = context.loadedData.caller?.domain;

  if (!identitySpec) return null;

  const specConfig = identitySpec.config as any;

  return {
    specName: (() => {
      const name = identitySpec.name;
      if (name.toLowerCase().includes("generic") && callerDomain?.name) {
        return `${callerDomain.name} Tutor Identity`;
      }
      return name;
    })(),
    domain: callerDomain?.name || null,
    description: identitySpec.description,
    role: specConfig?.roleStatement || specConfig?.tutor_role?.roleStatement || null,
    primaryGoal: specConfig?.primaryGoal || null,
    secondaryGoals: specConfig?.secondaryGoals || [],
    techniques: (specConfig?.techniques || []).map((t: any) => ({
      name: t.name,
      description: t.description,
      when: t.when,
    })),
    styleDefaults: specConfig?.defaults || null,
    styleGuidelines: specConfig?.styleGuidelines || [],
    responsePatterns: specConfig?.patterns || null,
    boundaries: {
      does: specConfig?.does || [],
      doesNot: specConfig?.doesNot || [],
    },
    sessionStructure: specConfig?.opening || specConfig?.main || specConfig?.closing ? {
      opening: specConfig?.opening,
      main: specConfig?.main,
      closing: specConfig?.closing,
    } : null,
    assessmentApproach: specConfig?.principles || specConfig?.methods ? {
      principles: specConfig?.principles || [],
      methods: specConfig?.methods || [],
    } : null,
  };
});

/**
 * Extract content spec into llmPrompt output.
 * Extracted from route.ts lines 2376-2414.
 */
registerTransform("extractContentSpec", (
  _rawData: any,
  context: AssembledContext,
) => {
  const contentSpec = context.resolvedSpecs.contentSpec;
  if (!contentSpec) return null;

  const specConfig = contentSpec.config as any;
  const modulesSource = specConfig?.modules || specConfig?.curriculum?.modules || [];

  return {
    specName: contentSpec.name,
    description: contentSpec.description,
    curriculumName: specConfig?.curriculum?.name || specConfig?.name || null,
    curriculumDescription: specConfig?.description || null,
    targetAudience: specConfig?.targetAudience || null,
    learningObjectives: specConfig?.learningObjectives || [],
    modules: modulesSource.map((m: any) => ({
      id: m.id,
      slug: m.slug || m.id,
      name: m.name,
      description: m.description,
      prerequisites: m.prerequisites || [],
      concepts: m.concepts || [],
      learningOutcomes: m.learningOutcomes || [],
      sortOrder: m.sortOrder,
      masteryThreshold: m.masteryThreshold,
    })),
    totalModules: modulesSource.length,
    conceptLibrary: specConfig?.concepts || null,
    deliveryRules: {
      pacing: specConfig?.pacing || null,
      sequencing: specConfig?.sequencing || null,
      personalization: specConfig?.personalization || null,
      practiceRatio: specConfig?.practiceRatio || null,
    },
    activityTypes: specConfig?.activityTypes || [],
    assessmentCriteria: {
      comprehension: specConfig?.comprehensionIndicators || [],
      application: specConfig?.applicationIndicators || [],
      mastery: specConfig?.masteryIndicators || [],
    },
  };
});
