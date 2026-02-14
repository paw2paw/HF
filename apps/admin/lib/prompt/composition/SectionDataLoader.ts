/**
 * Section Data Loader
 *
 * Registry of named data loader functions that fetch from Prisma.
 * Each loader mirrors exactly one query from the original compose-prompt route.
 * Spec sections reference loaders by name: "dataSource": "memories"
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getLearnerProfile } from "@/lib/learner/profile";
import type { LoadedDataContext } from "./types";

type LoaderFn = (callerId: string, config?: any) => Promise<any>;

const loaderRegistry = new Map<string, LoaderFn>();

function registerLoader(name: string, fn: LoaderFn) {
  loaderRegistry.set(name, fn);
}

export function getLoader(name: string): LoaderFn | undefined {
  return loaderRegistry.get(name);
}

/**
 * Load all data sources in parallel.
 * Mirrors the Promise.all() block from route.ts lines 109-355.
 */
export async function loadAllData(
  callerId: string,
  specConfig: Record<string, any>,
): Promise<LoadedDataContext> {
  const memoriesLimit = specConfig.memoriesLimit || 50;
  const recentCallsLimit = specConfig.recentCallsLimit || 5;

  const [
    caller,
    memories,
    personality,
    learnerProfile,
    recentCalls,
    callCount,
    behaviorTargets,
    callerTargets,
    callerAttributes,
    goals,
    playbooks,
    systemSpecs,
    onboardingSpec,
    onboardingSession,
    subjectSources,
    curriculumAssertions,
  ] = await Promise.all([
    loaderRegistry.get("caller")!(callerId),
    loaderRegistry.get("memories")!(callerId, { limit: memoriesLimit }),
    loaderRegistry.get("personality")!(callerId),
    loaderRegistry.get("learnerProfile")!(callerId),
    loaderRegistry.get("recentCalls")!(callerId, { limit: recentCallsLimit }),
    loaderRegistry.get("callCount")!(callerId),
    loaderRegistry.get("behaviorTargets")!(callerId),
    loaderRegistry.get("callerTargets")!(callerId),
    loaderRegistry.get("callerAttributes")!(callerId),
    loaderRegistry.get("goals")!(callerId),
    loaderRegistry.get("playbooks")!(callerId, { playbookIds: specConfig.playbookIds }),
    loaderRegistry.get("systemSpecs")!(callerId),
    loaderRegistry.get("onboardingSpec")!(callerId),
    loaderRegistry.get("onboardingSession")!(callerId),
    loaderRegistry.get("subjectSources")!(callerId),
    loaderRegistry.get("curriculumAssertions")!(callerId),
  ]);

  return {
    caller,
    memories: memories || [],
    personality,
    learnerProfile,
    recentCalls: recentCalls || [],
    callCount: callCount || 0,
    behaviorTargets: behaviorTargets || [],
    callerTargets: callerTargets || [],
    callerAttributes: callerAttributes || [],
    goals: goals || [],
    playbooks: playbooks || [],
    systemSpecs: systemSpecs || [],
    onboardingSpec: onboardingSpec || null,
    onboardingSession: onboardingSession || null,
    subjectSources: subjectSources || null,
    curriculumAssertions: curriculumAssertions || [],
  };
}

// =============================================================
// INDIVIDUAL LOADERS (extracted from route.ts lines 109-355)
// =============================================================

registerLoader("caller", async (callerId) => {
  return prisma.caller.findUnique({
    where: { id: callerId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      externalId: true,
      domainId: true,
      previousDomainId: true,
      domainSwitchCount: true,
      domain: {
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          // Onboarding configuration (from merged Persona concept)
          onboardingWelcome: true,
          onboardingIdentitySpecId: true,
          onboardingFlowPhases: true,
          onboardingDefaultTargets: true,
          onboardingIdentitySpec: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });
});

registerLoader("memories", async (callerId, config) => {
  return prisma.callerMemory.findMany({
    where: {
      callerId,
      supersededById: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ category: "asc" }, { confidence: "desc" }],
    take: config?.limit || 50,
    select: {
      category: true,
      key: true,
      value: true,
      confidence: true,
      evidence: true,
      extractedAt: true,
      decayFactor: true,
    },
  });
});

registerLoader("personality", async (callerId) => {
  // Load from CallerPersonalityProfile for dynamic parameter values (Big Five, VARK, etc.)
  const profile = await prisma.callerPersonalityProfile.findUnique({
    where: { callerId },
    select: {
      parameterValues: true,
      lastUpdatedAt: true,
    },
  });

  // Also load legacy CallerPersonality for backward compatibility fields
  const legacy = await prisma.callerPersonality.findUnique({
    where: { callerId },
    select: {
      preferredTone: true,
      preferredLength: true,
      technicalLevel: true,
      confidenceScore: true,
    },
  });

  // Merge profile parameter values with legacy fields
  return {
    ...(profile?.parameterValues as Record<string, number> || {}),
    preferredTone: legacy?.preferredTone,
    preferredLength: legacy?.preferredLength,
    technicalLevel: legacy?.technicalLevel,
    confidenceScore: legacy?.confidenceScore,
    lastUpdatedAt: profile?.lastUpdatedAt,
  };
});

registerLoader("learnerProfile", async (callerId) => {
  try {
    return await getLearnerProfile(callerId);
  } catch (error) {
    console.error("[compose-prompt] Failed to load learner profile:", error);
    return null;
  }
});

registerLoader("recentCalls", async (callerId, config) => {
  return prisma.call.findMany({
    where: { callerId },
    orderBy: { createdAt: "desc" },
    take: config?.limit || 5,
    select: {
      id: true,
      transcript: true,
      createdAt: true,
      scores: {
        select: {
          parameterId: true,
          score: true,
          parameter: { select: { name: true } },
        },
      },
    },
  });
});

registerLoader("callCount", async (callerId) => {
  return prisma.call.count({
    where: { callerId },
  });
});

registerLoader("behaviorTargets", async (_callerId) => {
  return prisma.behaviorTarget.findMany({
    where: {
      effectiveUntil: null,
    },
    include: {
      parameter: {
        select: {
          name: true,
          interpretationLow: true,
          interpretationHigh: true,
          domainGroup: true,
        },
      },
    },
  });
});

registerLoader("callerTargets", async (callerId) => {
  return prisma.callerTarget.findMany({
    where: { callerId },
    include: {
      parameter: {
        select: {
          name: true,
          interpretationLow: true,
          interpretationHigh: true,
          domainGroup: true,
        },
      },
    },
  });
});

registerLoader("callerAttributes", async (callerId) => {
  return prisma.callerAttribute.findMany({
    where: {
      callerId,
      OR: [
        { validUntil: null },
        { validUntil: { gt: new Date() } },
      ],
    },
    orderBy: [{ scope: "asc" }, { key: "asc" }],
    select: {
      key: true,
      scope: true,
      domain: true,
      valueType: true,
      stringValue: true,
      numberValue: true,
      booleanValue: true,
      jsonValue: true,
      confidence: true,
      sourceSpecSlug: true,
    },
  });
});

registerLoader("goals", async (callerId) => {
  return prisma.goal.findMany({
    where: {
      callerId,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    include: {
      contentSpec: {
        select: { id: true, name: true, slug: true },
      },
      playbook: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { priority: "desc" },
      { progress: "asc" },
      { startedAt: "desc" },
    ],
    take: 10,
  });
});

registerLoader("playbooks", async (callerId, config?: { playbookIds?: string[] }) => {
  // Get caller's domain, then find ALL published playbooks (stacked)
  const callerWithDomain = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true },
  });

  if (!callerWithDomain?.domainId) return [];

  // Build where clause - optionally filter to specific playbooks
  const whereClause: any = {
    domainId: callerWithDomain.domainId,
    status: "PUBLISHED", // Only PUBLISHED playbooks stack
  };

  // If playbookIds specified, filter to only those playbooks
  if (config?.playbookIds && config.playbookIds.length > 0) {
    whereClause.id = { in: config.playbookIds };
  }

  // Load all PUBLISHED playbooks for domain, ordered by sortOrder (lower = higher priority)
  return prisma.playbook.findMany({
    where: whereClause,
    orderBy: { sortOrder: "asc" }, // First playbook wins on conflicts
    include: {
      domain: true,
      items: {
        where: {
          isEnabled: true,
          itemType: "SPEC",
        },
        orderBy: { sortOrder: "asc" },
        include: {
          spec: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              specRole: true,
              outputType: true,
              config: true,
              promptTemplate: true,
              domain: true,
              extendsAgent: true,
            },
          },
        },
      },
    },
  });
});

registerLoader("systemSpecs", async (_callerId) => {
  return prisma.analysisSpec.findMany({
    where: {
      scope: "SYSTEM",
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      specRole: true,
      outputType: true,
      config: true,
      domain: true,
      extendsAgent: true,
    },
  });
});

/**
 * Load the onboarding/bootstrap spec for first-call defaults.
 * Uses env-configurable spec slug (default: INIT-001, configurable via ONBOARDING_SPEC_SLUG).
 * Returns the spec config with default targets and first-call flow.
 * NOTE: This is now a FALLBACK - Domain.onboarding* fields take precedence.
 */
registerLoader("onboardingSpec", async (_callerId) => {
  // Get onboarding spec slug from config (env-configurable)
  const onboardingSlug = config.specs.onboarding;

  const spec = await prisma.analysisSpec.findFirst({
    where: {
      OR: [
        { slug: { contains: onboardingSlug.toLowerCase(), mode: "insensitive" } },
        { slug: { contains: "onboarding" } },
        { domain: "onboarding" },
      ],
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      config: true,
    },
  });
  return spec;
});

/**
 * Load the caller's OnboardingSession for their current domain.
 * Used to determine if this is their first call in the domain.
 */
registerLoader("onboardingSession", async (callerId) => {
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true },
  });

  if (!caller?.domainId) {
    return null;
  }

  return prisma.onboardingSession.findUnique({
    where: {
      callerId_domainId: {
        callerId,
        domainId: caller.domainId,
      },
    },
    select: {
      id: true,
      currentPhase: true,
      completedPhases: true,
      isComplete: true,
      wasSkipped: true,
      discoveredGoals: true,
      createdAt: true,
      completedAt: true,
    },
  });
});

/**
 * Load subject-based sources for the caller's domain.
 * Returns all subjects linked to the domain, with their sources and curricula.
 */
registerLoader("subjectSources", async (callerId) => {
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true },
  });

  if (!caller?.domainId) return null;

  // Find all subjects linked to this domain
  const subjectDomains = await prisma.subjectDomain.findMany({
    where: { domainId: caller.domainId },
    include: {
      subject: {
        include: {
          sources: {
            include: {
              source: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  trustLevel: true,
                  publisherOrg: true,
                  accreditingBody: true,
                  qualificationRef: true,
                  validUntil: true,
                  isActive: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          curricula: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              notableInfo: true,
              deliveryConfig: true,
              trustLevel: true,
              qualificationBody: true,
              qualificationNumber: true,
              qualificationLevel: true,
            },
          },
        },
      },
    },
  });

  if (subjectDomains.length === 0) return null;

  return {
    subjects: subjectDomains.map((sd) => ({
      id: sd.subject.id,
      slug: sd.subject.slug,
      name: sd.subject.name,
      defaultTrustLevel: sd.subject.defaultTrustLevel,
      qualificationRef: sd.subject.qualificationRef,
      sources: sd.subject.sources.map((ss) => ({
        slug: ss.source.slug,
        name: ss.source.name,
        trustLevel: ss.trustLevelOverride || ss.source.trustLevel,
        tags: ss.tags || ["content"],
        publisherOrg: ss.source.publisherOrg,
        accreditingBody: ss.source.accreditingBody,
        qualificationRef: ss.source.qualificationRef,
        validUntil: ss.source.validUntil,
        isActive: ss.source.isActive,
      })),
      curriculum: sd.subject.curricula[0] || null,
    })),
  };
});

/**
 * Load curriculum assertions (approved teaching points) for the caller's domain.
 * Fetches from ContentAssertion table, filtered by domain's linked content sources.
 * Returns assertions grouped-ready with source metadata for the teaching-content transform.
 */
registerLoader("curriculumAssertions", async (callerId) => {
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true },
  });

  if (!caller?.domainId) return [];

  // Find all content sources linked to the domain via subjects
  const subjectDomains = await prisma.subjectDomain.findMany({
    where: { domainId: caller.domainId },
    select: {
      subject: {
        select: {
          sources: {
            select: { sourceId: true },
          },
        },
      },
    },
  });

  const sourceIds = subjectDomains.flatMap((sd) =>
    sd.subject.sources.map((s) => s.sourceId)
  );

  if (sourceIds.length === 0) {
    // Fallback: try to find any active content sources directly (not linked via subjects)
    // This covers the case where content sources were created but not yet linked to a subject
    const domainSources = await prisma.contentSource.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 10,
    });
    if (domainSources.length === 0) return [];
    sourceIds.push(...domainSources.map((s) => s.id));
  }

  // Fetch assertions from these sources (limit to prevent prompt bloat)
  const assertions = await prisma.contentAssertion.findMany({
    where: {
      sourceId: { in: [...new Set(sourceIds)] },
    },
    orderBy: [
      { examRelevance: "desc" },
      { category: "asc" },
    ],
    take: 100, // Limit to top 100 assertions by relevance
    select: {
      assertion: true,
      category: true,
      chapter: true,
      section: true,
      pageRef: true,
      tags: true,
      trustLevel: true,
      examRelevance: true,
      learningOutcomeRef: true,
      source: {
        select: {
          name: true,
          trustLevel: true,
        },
      },
    },
  });

  return assertions.map((a) => ({
    assertion: a.assertion,
    category: a.category,
    chapter: a.chapter,
    section: a.section,
    pageRef: a.pageRef,
    tags: a.tags,
    trustLevel: a.trustLevel,
    examRelevance: a.examRelevance,
    learningOutcomeRef: a.learningOutcomeRef,
    sourceName: a.source.name,
    sourceTrustLevel: a.source.trustLevel,
  }));
});
