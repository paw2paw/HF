/**
 * Identity & Content Spec Transforms
 * Extracted from route.ts lines 692-790, 2337-2414
 */

import { prisma } from "@/lib/prisma";
import { registerTransform } from "../TransformRegistry";
import type { AssembledContext, PlaybookData, SystemSpecData, ResolvedSpecs, ResolvedSpec } from "../types";

/**
 * Resolve identity, content, and voice specs from playbook items + system specs.
 * Extracted from route.ts lines 692-790.
 * Called once during executor setup (not a registered transform).
 */
export function resolveSpecs(
  playbook: PlaybookData | null,
  systemSpecs: SystemSpecData[],
): ResolvedSpecs {
  let identitySpec: ResolvedSpec | null = null;
  let contentSpec: ResolvedSpec | null = null;
  let voiceSpec: ResolvedSpec | null = null;

  if (playbook) {
    // 1. Check PlaybookItems for IDENTITY/CONTENT/VOICE specs
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
 * Load VOICE-001 directly if not found in playbook or system specs.
 * Extracted from route.ts lines 769-790.
 */
export async function resolveVoiceSpecFallback(
  current: ResolvedSpecs,
): Promise<ResolvedSpecs> {
  if (current.voiceSpec) return current;

  const systemVoiceSpec = await prisma.analysisSpec.findFirst({
    where: {
      OR: [
        { slug: "VOICE-001" },
        { slug: "voice-001" },
        { slug: { contains: "voice" }, specRole: "IDENTITY", domain: "voice" },
      ],
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

  const config = identitySpec.config as any;

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
    role: config?.roleStatement || config?.tutor_role?.roleStatement || null,
    primaryGoal: config?.primaryGoal || null,
    secondaryGoals: config?.secondaryGoals || [],
    techniques: (config?.techniques || []).map((t: any) => ({
      name: t.name,
      description: t.description,
      when: t.when,
    })),
    styleDefaults: config?.defaults || null,
    styleGuidelines: config?.styleGuidelines || [],
    responsePatterns: config?.patterns || null,
    boundaries: {
      does: config?.does || [],
      doesNot: config?.doesNot || [],
    },
    sessionStructure: config?.opening || config?.main || config?.closing ? {
      opening: config?.opening,
      main: config?.main,
      closing: config?.closing,
    } : null,
    assessmentApproach: config?.principles || config?.methods ? {
      principles: config?.principles || [],
      methods: config?.methods || [],
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
