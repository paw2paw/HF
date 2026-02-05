import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAICompletion, AIEngine, getDefaultEngine } from "@/lib/ai/client";
import { renderTemplate } from "@/lib/prompt/PromptTemplateCompiler";
import { getMemoriesByCategory } from "@/lib/constants";
import { composeCurriculumSection } from "@/lib/prompt/compose-curriculum-section";
import { getLearnerProfile } from "@/lib/learner/profile";

export const runtime = "nodejs";

/**
 * Helper function to get emoji for goal type
 */
function getGoalTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    LEARN: "📚",
    ACHIEVE: "🏆",
    CHANGE: "🔄",
    CONNECT: "🤝",
    SUPPORT: "💚",
    CREATE: "🎨",
  };
  return emojiMap[type] || "🎯";
}

/**
 * POST /api/callers/[callerId]/compose-prompt
 *
 * Compose a personalized next-call prompt for a caller using AI.
 * Gathers all available context (memories, personality, recent calls, behavior targets)
 * and sends to AI to generate a tailored agent guidance prompt.
 *
 * Request body:
 * - engine?: "mock" | "claude" | "openai" - AI engine to use (default: first available)
 * - triggerType?: string - What triggered this composition (default: "manual")
 * - triggerCallId?: string - Optional call ID that triggered this
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await request.json();
    const {
      engine = getDefaultEngine(),
      triggerType = "manual",
      triggerCallId,
    } = body;

    // Load COMPOSE spec config - specifically look for the system compose spec
    // (not the prompt-slugs which also have outputType COMPOSE)
    const composeSpec = await prisma.analysisSpec.findFirst({
      where: {
        slug: "system-compose-next-prompt",
        isActive: true,
      },
    }) || await prisma.analysisSpec.findFirst({
      where: {
        outputType: "COMPOSE",
        isActive: true,
        scope: "SYSTEM",
        domain: { not: "prompt-slugs" },
      },
    });

    // Extract config from spec - specs define behavior, not hardcoded values
    // The spec has a `parameters` array where each parameter has its own config
    const specConfig = (composeSpec?.config as any) || {};
    const specParameters: Array<{ id: string; config?: any }> = specConfig.parameters || [];

    // Helper to get config from a specific parameter by ID
    const getParamConfig = (paramId: string): any => {
      const param = specParameters.find(p => p.id === paramId);
      return param?.config || {};
    };

    // Extract configs from spec parameters (spec is source of truth)
    const personalityConfig = getParamConfig("personality_section");
    const learnerProfileConfig = getParamConfig("learner_profile_section");
    const memoryConfig = getParamConfig("memory_section");
    const sessionConfig = getParamConfig("session_context_section");
    const historyConfig = getParamConfig("recent_history_section");
    const curriculumConfig = getParamConfig("curriculum_section");
    const behaviorConfig = getParamConfig("behavior_targets_section");
    const goalsConfig = getParamConfig("learner_goals_section");
    const domainConfig = getParamConfig("domain_context_section");

    // Use spec-defined values (with minimal fallbacks for missing specs)
    const thresholds = personalityConfig.thresholds || specConfig.thresholds || { high: 0.65, low: 0.35 };
    const memoriesLimit = memoryConfig.memoriesLimit || specConfig.memoriesLimit || 50;
    const memoriesPerCategory = memoryConfig.memoriesPerCategory || specConfig.memoriesPerCategory || 5;
    const recentCallsLimit = sessionConfig.recentCallsLimit || specConfig.recentCallsLimit || 5;
    const maxTokens = historyConfig.maxTokens || specConfig.maxTokens || 1500;
    const temperature = historyConfig.temperature || specConfig.temperature || 0.7;
    const includePersonality = personalityConfig.includePersonality !== false;
    const includeLearnerProfile = learnerProfileConfig.includeLearnerProfile !== false;
    const includeMemories = memoryConfig.includeMemories !== false;
    const includeBehaviorTargets = behaviorConfig.includeBehaviorTargets !== false;
    const includeRecentCalls = sessionConfig.includeRecentCalls !== false;
    const includeCurriculum = curriculumConfig.includeCurriculum !== false;
    const includeSessionPlanning = domainConfig.includeSessionPlanning !== false;
    const includeLearnerGoals = goalsConfig.includeLearnerGoals !== false;

    // Use promptTemplate from spec if available, otherwise use default
    const promptTemplate = composeSpec?.promptTemplate || null;

    // Fetch caller with all relevant context
    const [caller, memories, personality, learnerProfile, recentCalls, totalCallCount, behaviorTargets, callerTargets, callerAttributes, learnerGoals, publishedPlaybook, allSystemSpecs] = await Promise.all([
      prisma.caller.findUnique({
        where: { id: callerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          externalId: true,
          domain: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      }),

      // Active memories (limit from spec config)
      prisma.callerMemory.findMany({
        where: {
          callerId,
          supersededById: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ category: "asc" }, { confidence: "desc" }],
        take: memoriesLimit,
        select: {
          category: true,
          key: true,
          value: true,
          confidence: true,
          evidence: true,
        },
      }),

      // Personality profile
      prisma.callerPersonality.findUnique({
        where: { callerId },
        select: {
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
          preferredTone: true,
          preferredLength: true,
          technicalLevel: true,
          confidenceScore: true,
        },
      }),

      // Learner profile (learning preferences inferred from behavior)
      (async () => {
        try {
          return await getLearnerProfile(callerId);
        } catch (error) {
          console.error('[compose-prompt] Failed to load learner profile:', error);
          return null;
        }
      })(),

      // Recent calls for context (limit from spec config)
      prisma.call.findMany({
        where: { callerId },
        orderBy: { createdAt: "desc" },
        take: recentCallsLimit,
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
      }),

      // Total call count (not limited by recentCallsLimit)
      prisma.call.count({
        where: { callerId },
      }),

      // Behavior targets - load all scopes (SYSTEM, DOMAIN, PLAYBOOK, CALLER)
      // We'll filter by playbook later if available
      prisma.behaviorTarget.findMany({
        where: {
          effectiveUntil: null,
        },
        include: {
          parameter: {
            select: {
              name: true,
              interpretationLow: true,
              interpretationHigh: true,
              domainGroup: true, // For data-driven grouping fallback
            },
          },
        },
      }),

      // CallerTargets - personalized behavior targets computed by ADAPT specs
      // These take precedence over static BehaviorTargets
      prisma.callerTarget.findMany({
        where: {
          callerId,
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
      }),

      // Caller attributes (curriculum state, session planning, domain-specific data)
      prisma.callerAttribute.findMany({
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
      }),

      // Learner goals - fetch from Goal model
      // Includes both playbook goals and caller-expressed goals
      prisma.goal.findMany({
        where: {
          callerId,
          status: { in: ['ACTIVE', 'PAUSED'] }, // Don't include ARCHIVED or COMPLETED
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
          { priority: 'desc' },     // Higher priority first
          { progress: 'asc' },      // Lower progress = needs more attention
          { startedAt: 'desc' },    // Recent goals first
        ],
        take: 10, // Limit to top 10 goals for prompt
      }),

      // Get caller's domain and playbook with IDENTITY and CONTENT specs
      // Priority: PUBLISHED > DRAFT (for development/testing)
      (async () => {
        // First get the caller's domain
        const callerWithDomain = await prisma.caller.findUnique({
          where: { id: callerId },
          select: { domainId: true },
        });

        if (!callerWithDomain?.domainId) return null;

        // Get playbook for this domain - prefer PUBLISHED, fall back to DRAFT
        const playbook = await prisma.playbook.findFirst({
          where: {
            domainId: callerWithDomain.domainId,
            status: { in: ["PUBLISHED", "DRAFT"] },
          },
          orderBy: {
            // PUBLISHED comes before DRAFT alphabetically, so this works
            status: "asc",
          },
          include: {
            // ⚠️ Agent FK relation removed (deprecated) - identity now comes from:
            // 1) PlaybookItems with specRole=IDENTITY, or 2) System Specs
            // curriculum: removed - FK relation no longer exists on Playbook model
            // Curriculum data now comes from CONTENT specs' config
            domain: true,
            // PlaybookItems (DOMAIN specs)
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
                  },
                },
              },
            },
            // specs: removed - PlaybookSystemSpec model no longer exists
            // System specs are now implicitly included
          },
        });

        return playbook;
      })(),

      // All active SYSTEM specs - these are implicitly included in all playbooks
      // PlaybookSystemSpec entries are only for overrides (disabling specific system specs)
      prisma.analysisSpec.findMany({
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
        },
      }),
    ]);

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Merge CallerTargets (personalized) with BehaviorTargets (static defaults)
    // Priority: CallerTarget > PLAYBOOK > DOMAIN > SYSTEM scope BehaviorTarget
    const filteredBehaviorTargets = (() => {
      // Normalized target type that works for both CallerTarget and BehaviorTarget
      type NormalizedTarget = {
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
      };

      const byParameter = new Map<string, NormalizedTarget>();

      // First, add CallerTargets (highest priority - personalized values from ADAPT specs)
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

      // Then fill in with BehaviorTargets for any missing parameters
      const scopePriority: Record<string, number> = {
        CALLER: 4,
        PLAYBOOK: 3,
        DOMAIN: 2,
        SYSTEM: 1,
      };

      for (const target of behaviorTargets) {
        // Skip if we already have a CallerTarget for this parameter
        if (byParameter.has(target.parameterId) && byParameter.get(target.parameterId)?.source === "CallerTarget") {
          continue;
        }

        const existing = byParameter.get(target.parameterId);
        const currentPriority = scopePriority[target.scope] || 0;
        const existingPriority = existing ? (scopePriority[existing.scope] || 0) : 0;

        // If this playbook is loaded, only include PLAYBOOK-scoped targets for that playbook
        if (target.scope === "PLAYBOOK" && publishedPlaybook) {
          if (target.playbookId === publishedPlaybook.id && currentPriority > existingPriority) {
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
    })();

    const callerTargetCount = filteredBehaviorTargets.filter(t => t.source === "CallerTarget").length;
    console.log(`[compose-prompt] Behavior targets: ${behaviorTargets.length} static, ${callerTargets.length} personalized (CallerTarget)`);
    console.log(`[compose-prompt] Merged targets: ${filteredBehaviorTargets.length} total (${callerTargetCount} personalized, ${filteredBehaviorTargets.length - callerTargetCount} from playbook)`);

    // Helper function to convert score to level using spec thresholds
    const scoreToLevel = (score: number): string => {
      if (score >= thresholds.high) return "high";
      if (score <= thresholds.low) return "low";
      return "moderate";
    };

    // Build context for AI (respecting spec config for what to include)
    const contextParts: string[] = [];

    // Caller identification (always included)
    contextParts.push("## Caller Information");
    if (caller.name) contextParts.push(`- Name: ${caller.name}`);
    if (caller.email) contextParts.push(`- Email: ${caller.email}`);
    if (caller.phone) contextParts.push(`- Phone: ${caller.phone}`);

    // Personality profile (if enabled in spec)
    if (includePersonality && personality) {
      contextParts.push("\n## Personality Profile");
      if (personality.openness !== null) {
        contextParts.push(`- Openness: ${scoreToLevel(personality.openness)} (${(personality.openness * 100).toFixed(0)}%)`);
      }
      if (personality.conscientiousness !== null) {
        contextParts.push(`- Conscientiousness: ${scoreToLevel(personality.conscientiousness)} (${(personality.conscientiousness * 100).toFixed(0)}%)`);
      }
      if (personality.extraversion !== null) {
        contextParts.push(`- Extraversion: ${scoreToLevel(personality.extraversion)} (${(personality.extraversion * 100).toFixed(0)}%)`);
      }
      if (personality.agreeableness !== null) {
        contextParts.push(`- Agreeableness: ${scoreToLevel(personality.agreeableness)} (${(personality.agreeableness * 100).toFixed(0)}%)`);
      }
      if (personality.neuroticism !== null) {
        contextParts.push(`- Neuroticism: ${scoreToLevel(personality.neuroticism)} (${(personality.neuroticism * 100).toFixed(0)}%)`);
      }
      if (personality.preferredTone) contextParts.push(`- Preferred Tone: ${personality.preferredTone}`);
      if (personality.preferredLength) contextParts.push(`- Preferred Response Length: ${personality.preferredLength}`);
      if (personality.technicalLevel) contextParts.push(`- Technical Level: ${personality.technicalLevel}`);
    }

    // Learner profile (if enabled in spec and profile exists)
    if (includeLearnerProfile && learnerProfile) {
      const hasAnyProfileData =
        learnerProfile.learningStyle ||
        learnerProfile.pacePreference ||
        learnerProfile.interactionStyle ||
        learnerProfile.preferredModality ||
        learnerProfile.questionFrequency ||
        learnerProfile.feedbackStyle ||
        Object.keys(learnerProfile.priorKnowledge).length > 0;

      if (hasAnyProfileData) {
        contextParts.push("\n## Learner Profile");

        if (learnerProfile.learningStyle) {
          contextParts.push(`- Learning Style: ${learnerProfile.learningStyle}`);
        }
        if (learnerProfile.pacePreference) {
          contextParts.push(`- Pace Preference: ${learnerProfile.pacePreference}`);
        }
        if (learnerProfile.interactionStyle) {
          contextParts.push(`- Interaction Style: ${learnerProfile.interactionStyle}`);
        }
        if (learnerProfile.preferredModality) {
          contextParts.push(`- Preferred Modality: ${learnerProfile.preferredModality}`);
        }
        if (learnerProfile.questionFrequency) {
          contextParts.push(`- Question Frequency: ${learnerProfile.questionFrequency}`);
        }
        if (learnerProfile.feedbackStyle) {
          contextParts.push(`- Feedback Style: ${learnerProfile.feedbackStyle}`);
        }

        // Prior knowledge by domain
        if (Object.keys(learnerProfile.priorKnowledge).length > 0) {
          contextParts.push("- Prior Knowledge:");
          for (const [domain, level] of Object.entries(learnerProfile.priorKnowledge)) {
            contextParts.push(`  - ${domain}: ${level}`);
          }
        }
      }
    }

    // Memories (if enabled in spec)
    if (includeMemories && memories.length > 0) {
      contextParts.push("\n## Key Memories");
      const memsByCategory = memories.reduce((acc, m) => {
        if (!acc[m.category]) acc[m.category] = [];
        acc[m.category].push(m);
        return acc;
      }, {} as Record<string, typeof memories>);

      for (const [category, mems] of Object.entries(memsByCategory)) {
        contextParts.push(`\n### ${category}`);
        for (const m of mems.slice(0, memoriesPerCategory)) {
          contextParts.push(`- ${m.key}: ${m.value}`);
        }
      }
    }

    // Behavior targets (if enabled in spec) - use filtered targets
    if (includeBehaviorTargets && filteredBehaviorTargets.length > 0) {
      contextParts.push("\n## Agent Behavior Targets");
      for (const target of filteredBehaviorTargets) {
        contextParts.push(`- ${target.parameter?.name || target.parameterId}: ${scoreToLevel(target.targetValue)} (${(target.targetValue * 100).toFixed(0)}%)`);
      }
    }

    // Recent call summaries (if enabled in spec)
    if (includeRecentCalls && recentCalls.length > 0) {
      contextParts.push("\n## Recent Interaction Summary");
      contextParts.push(`${recentCalls.length} previous calls on record.`);
      const latestCall = recentCalls[0];
      if (latestCall) {
        contextParts.push(`Most recent call: ${new Date(latestCall.createdAt).toLocaleDateString()}`);
        if (latestCall.scores.length > 0) {
          const avgScore = latestCall.scores.reduce((sum, s) => sum + s.score, 0) / latestCall.scores.length;
          contextParts.push(`Average score on last call: ${(avgScore * 100).toFixed(0)}%`);
        }
      }
    }

    // Helper to extract attribute value regardless of type
    const getAttributeValue = (attr: typeof callerAttributes[0]): any => {
      switch (attr.valueType) {
        case "STRING": return attr.stringValue;
        case "NUMBER": return attr.numberValue;
        case "BOOLEAN": return attr.booleanValue;
        case "JSON": return attr.jsonValue;
        default: return attr.stringValue || attr.numberValue || attr.booleanValue || attr.jsonValue;
      }
    };

    // Curriculum & Learning Progress (if enabled)
    // GENERIC CURRICULUM COMPOSER - works for any content spec
    let curriculumSection: Awaited<ReturnType<typeof composeCurriculumSection>> | null = null;
    if (includeCurriculum && caller.domainId) {
      try {
        curriculumSection = await composeCurriculumSection(callerId, caller.domainId);

        if (curriculumSection.hasData) {
          contextParts.push("\n## Curriculum Progress");
          contextParts.push(`- Curriculum: ${curriculumSection.name}`);
          contextParts.push(`- Total Modules: ${curriculumSection.totalModules}`);
          contextParts.push(`- Completed: ${curriculumSection.completedCount}/${curriculumSection.totalModules}`);
          contextParts.push(`- Progress: ${(curriculumSection.estimatedProgress * 100).toFixed(0)}%`);

          if (curriculumSection.nextModule) {
            const nextMod = curriculumSection.modules.find(m => m.id === curriculumSection.nextModule);
            if (nextMod) {
              contextParts.push(`\n- **NEXT MODULE**: ${nextMod.name}`);
              if (nextMod.description) {
                contextParts.push(`  ${nextMod.description}`);
              }
            }
          }

          if (curriculumSection.completedModules.length > 0) {
            contextParts.push(`- Completed Modules: ${curriculumSection.completedModules.join(", ")}`);
          }
        }
      } catch (error) {
        console.error("[compose-prompt] Error composing curriculum section:", error);
      }
    }

    // Session Planning (if enabled)
    if (includeSessionPlanning && callerAttributes.length > 0) {
      const sessionAttrs = callerAttributes.filter(a =>
        a.key.includes("session_") ||
        a.key.includes("arc_") ||
        a.key.includes("continuity") ||
        a.key.includes("thread") ||
        a.sourceSpecSlug?.includes("SESSION")
      );

      if (sessionAttrs.length > 0) {
        contextParts.push("\n## Session Planning");
        for (const attr of sessionAttrs) {
          const value = getAttributeValue(attr);
          contextParts.push(`- ${attr.key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
        }
      }
    }

    // Learner Goals (if enabled)
    if (includeLearnerGoals && learnerGoals.length > 0) {
      contextParts.push("\n## Learner Goals");

      // Separate playbook goals from caller-expressed goals
      const playbookGoals = learnerGoals.filter(g => g.playbookId !== null);
      const callerGoals = learnerGoals.filter(g => g.playbookId === null);

      if (playbookGoals.length > 0) {
        contextParts.push("\n### Strategic Goals (from playbook):");
        for (const goal of playbookGoals) {
          const progressStr = goal.progress > 0 ? ` [${Math.round(goal.progress * 100)}% complete]` : "";
          const typeEmoji = getGoalTypeEmoji(goal.type);
          const priorityStr = goal.priority > 7 ? " (HIGH PRIORITY)" : "";
          contextParts.push(`- ${typeEmoji} ${goal.name}${progressStr}${priorityStr}`);
          if (goal.description) {
            contextParts.push(`  └─ ${goal.description}`);
          }
        }
      }

      if (callerGoals.length > 0) {
        contextParts.push("\n### Caller-Expressed Goals:");
        for (const goal of callerGoals) {
          const progressStr = goal.progress > 0 ? ` [${Math.round(goal.progress * 100)}% complete]` : "";
          const typeEmoji = getGoalTypeEmoji(goal.type);
          contextParts.push(`- ${typeEmoji} ${goal.name}${progressStr}`);
          if (goal.description) {
            contextParts.push(`  └─ "${goal.description}"`);
          }
        }
      }
    }

    // Domain Context (if caller has a domain)
    if (caller.domain) {
      contextParts.push("\n## Domain Context");
      contextParts.push(`- Domain: ${caller.domain.name}`);
      if (caller.domain.description) {
        contextParts.push(`- Description: ${caller.domain.description}`);
      }

      // Domain-specific attributes
      const domainAttrs = callerAttributes.filter(a =>
        a.scope === "DOMAIN" && a.domain === caller.domain?.name
      );
      if (domainAttrs.length > 0) {
        contextParts.push("- Domain-specific data:");
        for (const attr of domainAttrs) {
          const value = getAttributeValue(attr);
          contextParts.push(`  - ${attr.key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
        }
      }
    }

    // Extract IDENTITY, CONTENT, and VOICE specs from playbook (compositional identity model)
    // IMPORTANT: Do this BEFORE building callerContext so identity/content is included
    // Priority: 1) playbook.items (DOMAIN specs), 2) System Specs (implicitly included)
    // Note: Agent FK relation and Curriculum FK have been deprecated
    let identitySpec: { name: string; config: any; description?: string | null } | null = null;
    let contentSpec: { name: string; config: any; description?: string | null } | null = null;
    let voiceSpec: { name: string; config: any; description?: string | null } | null = null;

    if (publishedPlaybook) {
      // 1. Check PlaybookItems for IDENTITY/CONTENT/VOICE specs
      for (const item of publishedPlaybook.items || []) {
        if (item.spec) {
          if (!identitySpec && item.spec.specRole === "IDENTITY" && item.spec.domain !== "voice") {
            identitySpec = {
              name: item.spec.name,
              config: item.spec.config,
              description: item.spec.description,
            };
            console.log(`[compose-prompt] Found IDENTITY from PlaybookItem: ${item.spec.name}`);
          }
          if (!contentSpec && item.spec.specRole === "CONTENT") {
            contentSpec = {
              name: item.spec.name,
              config: item.spec.config,
              description: item.spec.description,
            };
            console.log(`[compose-prompt] Found CONTENT from PlaybookItem: ${item.spec.name}`);
          }
          // VOICE spec has specRole=IDENTITY but domain=voice, or specRole=VOICE
          if (!voiceSpec && (item.spec.specRole === "VOICE" || (item.spec.specRole === "IDENTITY" && item.spec.domain === "voice"))) {
            voiceSpec = {
              name: item.spec.name,
              config: item.spec.config,
              description: item.spec.description,
            };
            console.log(`[compose-prompt] Found VOICE from PlaybookItem: ${item.spec.name}`);
          }
        }
      }

      // 2. Check System Specs as fallback (all system specs are implicitly enabled)
      if (!identitySpec || !contentSpec || !voiceSpec) {
        for (const spec of allSystemSpecs) {

          const role = spec.specRole as string;

          // Check for IDENTITY spec (not VOICE domain)
          if (!identitySpec && role === "IDENTITY" && spec.domain !== "voice") {
            identitySpec = {
              name: spec.name,
              config: spec.config,
              description: spec.description,
            };
            console.log(`[compose-prompt] Found IDENTITY from SystemSpec: ${spec.name}`);
          }
          // Check for CONTENT spec
          if (!contentSpec && role === "CONTENT") {
            contentSpec = {
              name: spec.name,
              config: spec.config,
              description: spec.description,
            };
            console.log(`[compose-prompt] Found CONTENT from SystemSpec: ${spec.name}`);
          }
          // Check for VOICE spec (specRole=VOICE or legacy: specRole=IDENTITY + domain=voice)
          if (!voiceSpec && (role === "VOICE" || (role === "IDENTITY" && spec.domain === "voice"))) {
            voiceSpec = {
              name: spec.name,
              config: spec.config,
              description: spec.description,
            };
            console.log(`[compose-prompt] Found VOICE from SystemSpec: ${spec.name}`);
          }
        }
      }

      console.log(`[compose-prompt] Playbook: ${publishedPlaybook.name} (${publishedPlaybook.status})`);
      console.log(`[compose-prompt] Identity: ${identitySpec?.name || 'NONE'}`);
      console.log(`[compose-prompt] Content: ${contentSpec?.name || 'NONE'}`);
      console.log(`[compose-prompt] Voice: ${voiceSpec?.name || 'NONE (checking system specs...)'}`);
    } else {
      console.log(`[compose-prompt] No playbook found for caller's domain`);
    }

    // 4. If no voice spec found yet, load VOICE-001 directly as system-level default
    if (!voiceSpec) {
      const systemVoiceSpec = await prisma.analysisSpec.findFirst({
        where: {
          OR: [
            { slug: "VOICE-001" },
            { slug: "voice-001" },
            { slug: { contains: "voice" }, specRole: "IDENTITY", domain: "voice" }
          ],
          isActive: true,
        },
      });
      if (systemVoiceSpec) {
        voiceSpec = {
          name: systemVoiceSpec.name,
          config: systemVoiceSpec.config,
          description: systemVoiceSpec.description,
        };
        console.log(`[compose-prompt] Found VOICE from system specs: ${systemVoiceSpec.name}`);
      } else {
        console.log(`[compose-prompt] No VOICE spec found - using hardcoded defaults`);
      }
    }

    // Add identity context if available (WHO the agent is)
    if (identitySpec) {
      contextParts.push("\n## Agent Identity (WHO)");
      contextParts.push(`- Identity Spec: ${identitySpec.name}`);
      if (identitySpec.description) {
        contextParts.push(`- Role: ${identitySpec.description}`);
      }
      const config = identitySpec.config as any;
      if (config?.roleStatement) {
        contextParts.push(`- Core Role: ${config.roleStatement}`);
      }
      if (config?.primaryGoal) {
        contextParts.push(`- Primary Goal: ${config.primaryGoal}`);
      }
      if (config?.techniques && Array.isArray(config.techniques)) {
        contextParts.push(`- Teaching Techniques:`);
        for (const t of config.techniques.slice(0, 6)) {
          contextParts.push(`  - ${t.name}: ${t.description} (Use when: ${t.when})`);
        }
      }
      if (config?.patterns) {
        contextParts.push(`- Response Patterns:`);
        for (const [situation, pattern] of Object.entries(config.patterns).slice(0, 4)) {
          const p = pattern as any;
          contextParts.push(`  - ${situation}: ${p.approach}`);
        }
      }
      if (config?.does && Array.isArray(config.does)) {
        contextParts.push(`- Agent DOES: ${config.does.slice(0, 4).join("; ")}`);
      }
      if (config?.doesNot && Array.isArray(config.doesNot)) {
        contextParts.push(`- Agent DOES NOT: ${config.doesNot.slice(0, 3).join("; ")}`);
      }
    }

    // Add content context if available (WHAT the agent knows/teaches)
    if (contentSpec) {
      contextParts.push("\n## Curriculum/Content (WHAT)");
      contextParts.push(`- Content Spec: ${contentSpec.name}`);
      if (contentSpec.description) {
        contextParts.push(`- Content: ${contentSpec.description}`);
      }
      const config = contentSpec.config as any;
      if (config?.name) {
        contextParts.push(`- Curriculum: ${config.name}`);
      }
      if (config?.description) {
        contextParts.push(`- Description: ${config.description}`);
      }
      if (config?.learningObjectives && Array.isArray(config.learningObjectives)) {
        contextParts.push(`- Learning Objectives: ${config.learningObjectives.join("; ")}`);
      }
      if (config?.modules && Array.isArray(config.modules)) {
        contextParts.push(`- Curriculum Modules (${config.modules.length} total):`);
        for (const m of config.modules.slice(0, 5)) {
          const concepts = m.concepts?.slice(0, 3).join(", ") || "";
          contextParts.push(`  - ${m.id} ${m.name}: ${m.description} [Concepts: ${concepts}]`);
        }
      }
      if (config?.concepts) {
        const conceptNames = Object.keys(config.concepts).slice(0, 5).join(", ");
        contextParts.push(`- Key Concepts: ${conceptNames}`);
      }
      // Delivery rules
      if (config?.pacing) {
        contextParts.push(`- Pacing: Max ${config.pacing.maxNewConceptsPerSession || 3} new concepts/session`);
      }
    }

    // Detailed curriculum modules - handled by generic curriculum composer above
    // This section is now redundant and removed to avoid duplication
    // The composeCurriculumSection() call earlier provides complete curriculum data

    // NOW build the callerContext (after identity/content is added)
    const callerContext = contextParts.join("\n");

    // Build AI prompt - use spec template if available
    let systemPrompt: string;
    let userPrompt: string;

    if (promptTemplate) {
      // Build template context for Mustache-style rendering
      const scoreToLabel = (score: number | null): string => {
        if (score === null) return "unknown";
        if (score >= thresholds.high) return "high";
        if (score <= thresholds.low) return "low";
        return "moderate";
      };

      const templateContext: Record<string, any> = {
        // Caller info
        caller: {
          id: caller.id,
          name: caller.name || "Unknown",
          callCount: recentCalls.length,
          lastCallDate: recentCalls[0] ? new Date(recentCalls[0].createdAt).toLocaleDateString() : "N/A",
        },

        // Personality profile
        personality: personality ? {
          openness: personality.openness !== null ? (personality.openness * 100).toFixed(0) + "%" : null,
          opennessLabel: scoreToLabel(personality.openness),
          conscientiousness: personality.conscientiousness !== null ? (personality.conscientiousness * 100).toFixed(0) + "%" : null,
          conscientiousnessLabel: scoreToLabel(personality.conscientiousness),
          extraversion: personality.extraversion !== null ? (personality.extraversion * 100).toFixed(0) + "%" : null,
          extraversionLabel: scoreToLabel(personality.extraversion),
          agreeableness: personality.agreeableness !== null ? (personality.agreeableness * 100).toFixed(0) + "%" : null,
          agreeablenessLabel: scoreToLabel(personality.agreeableness),
          neuroticism: personality.neuroticism !== null ? (personality.neuroticism * 100).toFixed(0) + "%" : null,
          neuroticismLabel: scoreToLabel(personality.neuroticism),
        } : null,

        // Behavior targets grouped by category - uses spec config.parameterGroups if available
        // Falls back to grouping by parameter domainGroup from database
        // Uses filteredBehaviorTargets (PLAYBOOK > DOMAIN > SYSTEM priority)
        targets: (() => {
          const parameterGroups = (composeSpec?.config as any)?.parameterGroups;

          if (parameterGroups) {
            // Use spec-defined parameter groups (data-driven)
            return {
              communicationStyle: filteredBehaviorTargets
                .filter(t => (parameterGroups.communicationStyle || []).includes(t.parameterId))
                .map(t => ({
                  name: t.parameter?.name || t.parameterId,
                  level: scoreToLabel(t.targetValue),
                  qualifier: t.parameter?.interpretationHigh || "",
                })),
              engagementApproach: filteredBehaviorTargets
                .filter(t => (parameterGroups.engagementApproach || []).includes(t.parameterId))
                .map(t => ({
                  name: t.parameter?.name || t.parameterId,
                  level: scoreToLabel(t.targetValue),
                  qualifier: t.parameter?.interpretationHigh || "",
                })),
              adaptability: filteredBehaviorTargets
                .filter(t => (parameterGroups.adaptability || []).includes(t.parameterId))
                .map(t => ({
                  name: t.parameter?.name || t.parameterId,
                  level: scoreToLabel(t.targetValue),
                  qualifier: t.parameter?.interpretationHigh || "",
                })),
            };
          } else {
            // Fallback: Group by parameter's domainGroup from database
            const groupedByDomain: Record<string, typeof filteredBehaviorTargets> = {};
            for (const t of filteredBehaviorTargets) {
              const group = (t.parameter as any)?.domainGroup || "other";
              if (!groupedByDomain[group]) groupedByDomain[group] = [];
              groupedByDomain[group].push(t);
            }

            // Map common domain groups to expected template keys
            const mapToTarget = (targets: typeof filteredBehaviorTargets) => targets.map(t => ({
              name: t.parameter?.name || t.parameterId,
              level: scoreToLabel(t.targetValue),
              qualifier: t.parameter?.interpretationHigh || "",
            }));

            return {
              communicationStyle: mapToTarget(groupedByDomain["Communication Style"] || groupedByDomain["communication"] || []),
              engagementApproach: mapToTarget(groupedByDomain["Engagement"] || groupedByDomain["engagement"] || []),
              adaptability: mapToTarget(groupedByDomain["Adaptability"] || groupedByDomain["adaptability"] || []),
              // Include all other groups as well for templates that use them
              ...Object.fromEntries(
                Object.entries(groupedByDomain)
                  .filter(([k]) => !["Communication Style", "communication", "Engagement", "engagement", "Adaptability", "adaptability"].includes(k))
                  .map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ''), mapToTarget(v)])
              ),
            };
          }
        })(),

        // Memories organized by type - using centralized helper
        memories: getMemoriesByCategory(memories, memoriesPerCategory),
        hasMemories: memories.length > 0,

        // Also include the plain text context as fallback
        callerContext,
      };

      // Render the template with Mustache-style syntax
      const renderedTemplate = renderTemplate(promptTemplate, templateContext);

      // Debug log the rendered template (remove in production)
      console.log("[compose-prompt] Rendered template preview (first 500 chars):", renderedTemplate.substring(0, 500));

      // Split template into system and user parts if it contains a separator
      const parts = renderedTemplate.split("---\n");
      if (parts.length >= 2) {
        systemPrompt = parts[0].trim();
        userPrompt = parts.slice(1).join("---\n").trim();
      } else {
        // If no separator, use the whole template as the user prompt
        systemPrompt = "You are an expert at creating personalized agent guidance prompts.";
        userPrompt = renderedTemplate;
      }
    } else {
      // Default prompts (fallback if no spec configured)
      systemPrompt = `You are an expert at creating personalized agent guidance prompts.
Your task is to compose a prompt that will guide a conversational AI agent on how to best communicate with a specific caller.

The prompt should:
1. Be written as direct instructions to an AI agent (e.g., "Use a warm, friendly tone...")
2. Incorporate the caller's personality traits and adapt communication style accordingly
3. Reference specific memories and facts about the caller naturally
4. Follow the behavior targets for tone, length, formality, etc.
5. Be actionable and specific, not vague
6. Be between 200-500 words

Format the output as a clean, well-structured agent guidance prompt with clear sections.`;

      userPrompt = `Based on the following caller context, compose a personalized agent guidance prompt for the next conversation with this caller.

${callerContext}

Generate a complete agent guidance prompt that will help the AI agent provide the best possible experience for this specific caller.`;
    }

    // Call AI with spec-configured parameters
    const aiResult = await getAICompletion({
      engine: engine as AIEngine,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens,
      temperature,
    });

    // Build LLM-friendly structured prompt (JSON with explicit data)
    // This format is more reliable for AI consumption than prose
    const llmPrompt = buildLlmFriendlyPrompt({
      caller: caller ? {
        id: caller.id,
        name: caller.name,
        email: caller.email,
        phone: caller.phone,
        externalId: caller.externalId,
      } : null,
      memories,
      personality,
      recentCalls,
      totalCallCount,
      behaviorTargets: filteredBehaviorTargets, // Use filtered targets
      callerAttributes,
      learnerGoals,
      callerDomain: caller?.domain || null,
      thresholds,
      memoriesPerCategory,
      identitySpec,
      contentSpec,
      voiceSpec,
      publishedPlaybook,
    });

    // Store the composed prompt
    const composedPrompt = await prisma.composedPrompt.create({
      data: {
        callerId,
        prompt: aiResult.content,
        llmPrompt, // LLM-friendly structured JSON version
        triggerType,
        triggerCallId: triggerCallId || null,
        model: aiResult.model,
        status: "active",
        inputs: {
          callerContext,
          memoriesCount: memories.length,
          personalityAvailable: !!personality,
          recentCallsCount: recentCalls.length,
          behaviorTargetsCount: filteredBehaviorTargets.length,
          behaviorTargetsTotalCount: behaviorTargets.length,
          playbookUsed: publishedPlaybook?.name || null,
          playbookStatus: publishedPlaybook?.status || null,
          identitySpec: identitySpec?.name || null,
          contentSpec: contentSpec?.name || null,
          specUsed: composeSpec?.slug || "(defaults)",
          specConfig: {
            thresholds,
            memoriesLimit,
            memoriesPerCategory,
            recentCallsLimit,
            maxTokens,
            temperature,
          },
        },
      },
    });

    // Mark previous prompts as superseded
    await prisma.composedPrompt.updateMany({
      where: {
        callerId,
        id: { not: composedPrompt.id },
        status: "active",
      },
      data: {
        status: "superseded",
      },
    });

    return NextResponse.json({
      ok: true,
      prompt: composedPrompt,
      metadata: {
        engine: aiResult.engine,
        model: aiResult.model,
        usage: aiResult.usage,
        inputContext: {
          memoriesCount: memories.length,
          personalityAvailable: !!personality,
          recentCallsCount: recentCalls.length,
          behaviorTargetsCount: filteredBehaviorTargets.length,
          playbookName: publishedPlaybook?.name || null,
          identitySpec: identitySpec?.name || null,
          contentSpec: contentSpec?.name || null,
        },
      },
    });
  } catch (error: any) {
    console.error("Error composing prompt:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compose prompt" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/callers/[callerId]/compose-prompt
 *
 * Get all composed prompts for a caller (history)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status"); // "active" | "superseded" | "all"

    const prompts = await prisma.composedPrompt.findMany({
      where: {
        callerId,
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: { composedAt: "desc" },
      take: limit,
      include: {
        triggerCall: {
          select: {
            id: true,
            createdAt: true,
            source: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      prompts,
      count: prompts.length,
    });
  } catch (error: any) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

/**
 * Build an LLM-friendly structured prompt (JSON format)
 * This is more reliable for AI consumption than prose:
 * - Explicit data types and values
 * - Clear categorization
 * - No ambiguity in parsing
 * - Easier for models to extract and use specific data
 */
interface LlmPromptInput {
  caller: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    externalId: string | null;
  } | null;
  memories: Array<{
    category: string;
    key: string;
    value: string;
    confidence: number;
    evidence: string | null;
  }>;
  personality: {
    openness: number | null;
    conscientiousness: number | null;
    extraversion: number | null;
    agreeableness: number | null;
    neuroticism: number | null;
    preferredTone: string | null;
    preferredLength: string | null;
    technicalLevel: string | null;
    confidenceScore: number | null;
  } | null;
  recentCalls: Array<{
    id: string;
    createdAt: Date;
    scores: Array<{
      parameterId: string;
      score: number;
      parameter: { name: string } | null;
    }>;
  }>;
  totalCallCount: number;
  behaviorTargets: Array<{
    parameterId: string;
    targetValue: number;
    scope: string;
    parameter: {
      name: string | null;
      interpretationLow: string | null;
      interpretationHigh: string | null;
      domainGroup: string | null;
    } | null;
  }>;
  callerAttributes: Array<{
    key: string;
    scope: string;
    domain: string | null;
    valueType: string;
    stringValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    jsonValue: any;
    confidence: number | null;
    sourceSpecSlug: string | null;
  }>;
  learnerGoals: Array<{
    id: string;
    type: string;
    name: string;
    description: string | null;
    status: string;
    priority: number;
    progress: number;
    playbookId: string | null;
    contentSpec: {
      id: string;
      name: string;
      slug: string;
    } | null;
    playbook: {
      id: string;
      name: string;
    } | null;
    startedAt: Date | null;
  }>;
  callerDomain: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  thresholds: { high: number; low: number };
  memoriesPerCategory: number;
  // Compositional identity specs
  identitySpec: { name: string; config: any; description?: string | null } | null;
  contentSpec: { name: string; config: any; description?: string | null } | null;
  voiceSpec: { name: string; config: any; description?: string | null } | null;
  // Published playbook with curriculum modules
  publishedPlaybook: {
    curriculum?: {
      name: string;
      modules: Array<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        sortOrder: number;
        masteryThreshold: number | null;
        prerequisites: string[];
      }>;
    } | null;
  } | null;
}

function buildLlmFriendlyPrompt(input: LlmPromptInput): Record<string, any> {
  const { caller, memories, personality, recentCalls, totalCallCount, behaviorTargets, callerAttributes, learnerGoals, callerDomain, thresholds, memoriesPerCategory, identitySpec, contentSpec, voiceSpec, publishedPlaybook } = input;

  // Helper to classify values
  const classifyValue = (value: number | null): string | null => {
    if (value === null) return null;
    if (value >= thresholds.high) return "HIGH";
    if (value <= thresholds.low) return "LOW";
    return "MODERATE";
  };

  // Deduplicate memories by normalized key (handle case differences like interest_in_China vs interest_in_china)
  const deduplicatedMemories = (() => {
    const seen = new Map<string, typeof memories[0]>();
    for (const m of memories) {
      // Normalize key: lowercase, replace spaces with underscores
      const normalizedKey = `${m.category}:${m.key.toLowerCase().replace(/\s+/g, '_')}`;
      const existing = seen.get(normalizedKey);
      // Keep the one with higher confidence, or the first one if equal
      if (!existing || m.confidence > existing.confidence) {
        seen.set(normalizedKey, m);
      }
    }
    return Array.from(seen.values());
  })();

  // Group memories by category (using deduplicated list)
  const memoryGroups: Record<string, Array<{ key: string; value: string; confidence: number }>> = {};
  for (const m of deduplicatedMemories) {
    if (!memoryGroups[m.category]) memoryGroups[m.category] = [];
    if (memoryGroups[m.category].length < memoriesPerCategory) {
      memoryGroups[m.category].push({
        key: m.key,
        value: m.value,
        confidence: m.confidence,
      });
    }
  }

  // Group behavior targets by domain (use filtered targets)
  const targetGroups: Record<string, Array<{
    parameterId: string;
    name: string;
    targetValue: number;
    targetLevel: string;
    interpretationHigh: string | null;
    interpretationLow: string | null;
  }>> = {};
  for (const t of behaviorTargets) {
    const domain = t.parameter?.domainGroup || "Other";
    if (!targetGroups[domain]) targetGroups[domain] = [];
    targetGroups[domain].push({
      parameterId: t.parameterId,
      name: t.parameter?.name || t.parameterId,
      targetValue: t.targetValue,
      targetLevel: classifyValue(t.targetValue) || "MODERATE",
      interpretationHigh: t.parameter?.interpretationHigh || null,
      interpretationLow: t.parameter?.interpretationLow || null,
    });
  }

  // Build recent calls summary
  const callHistory = recentCalls.map((call) => ({
    callId: call.id,
    date: call.createdAt.toISOString().split("T")[0],
    scores: call.scores.map((s) => ({
      parameter: s.parameter?.name || s.parameterId,
      score: s.score,
      level: classifyValue(s.score),
    })),
  }));

  // ============================================================
  // SHARED MODULE CALCULATION (used by _quickStart and session_pedagogy)
  // Aligns both sections so they reference the same modules
  // ============================================================
  // Curriculum modules now come from CONTENT spec config (curriculum FK was removed from Playbook)
  const contentCfg = contentSpec?.config as Record<string, any> | null;
  const modules = contentCfg?.modules || contentCfg?.curriculum?.modules || [];
  const isFirstCall = recentCalls.length === 0;
  const lastCall = recentCalls[0];
  const daysSinceLastCall = lastCall
    ? Math.floor((Date.now() - new Date(lastCall.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Track completed modules from callerAttributes
  const completedModules = new Set<string>();
  callerAttributes
    .filter(a => a.key.includes("mastery_") || a.key.includes("completed_"))
    .forEach(a => {
      const val = (() => {
        switch (a.valueType) {
          case "STRING": return a.stringValue;
          case "NUMBER": return a.numberValue;
          case "BOOLEAN": return a.booleanValue;
          case "JSON": return a.jsonValue;
          default: return a.stringValue || a.numberValue || a.booleanValue || a.jsonValue;
        }
      })();
      if (val === true || (typeof val === "number" && val >= 0.7)) {
        const slug = a.key.replace("mastery_", "").replace("completed_", "");
        completedModules.add(slug);
      }
    });

  // Estimate progress: if no explicit tracking, assume ~1 module per 2 calls
  const estimatedProgress = completedModules.size > 0
    ? completedModules.size
    : Math.min(Math.floor(recentCalls.length / 2), modules.length - 1);

  const lastCompletedIndex = completedModules.size > 0
    ? Math.max(...modules.map((m, i) => completedModules.has(m.slug) ? i : -1))
    : Math.max(0, estimatedProgress - 1);

  // Module to review = last completed (or first if no progress)
  const moduleToReview = modules[lastCompletedIndex] || modules[0];
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

  // Extract identity role from config (tutor_role is stored directly by ID)
  const getRoleStatement = (): string => {
    const config = identitySpec?.config as any;
    if (!config) return "A helpful voice assistant";
    // Check for tutor_role stored by ID (new format from seed-from-specs)
    if (config.tutor_role?.roleStatement) {
      return config.tutor_role.roleStatement;
    }
    // Fallback to direct roleStatement
    if (config.roleStatement) return config.roleStatement;
    // Fallback to description
    return identitySpec?.description || "A helpful voice assistant";
  };

  return {
    // ============================================================
    // QUICK START - Instant context for voice AI (read first!)
    // ============================================================
    _quickStart: {
      you_are: (() => {
        let role = getRoleStatement();
        // Add domain context if role is generic
        if (callerDomain?.name && (role === "A helpful voice assistant" || role.toLowerCase().includes("generic"))) {
          role = `A ${callerDomain.name} tutor and voice assistant`;
        }
        // Smart truncation: find last complete sentence within 200 chars
        if (role.length <= 200) return role;
        const truncated = role.substring(0, 200);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastExclaim = truncated.lastIndexOf('!');
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
        if (lastSentenceEnd > 100) {
          return role.substring(0, lastSentenceEnd + 1);
        }
        // Fallback: truncate at last space to avoid mid-word cut
        const lastSpace = truncated.lastIndexOf(' ');
        return lastSpace > 100 ? role.substring(0, lastSpace) + '...' : truncated + '...';
      })(),
      this_caller: `${caller?.name || "Unknown"} (call #${totalCallCount + 1})`,
      this_session: (() => {
        if (isFirstCall && modules[0]) {
          return `First session - introduce ${modules[0].name}`;
        }
        if (moduleToReview && nextModule && moduleToReview.slug !== nextModule.slug) {
          return `Review ${moduleToReview.name} → Introduce ${nextModule.name}`;
        }
        if (nextModule) {
          return `Continue with ${nextModule.name}`;
        }
        if (moduleToReview) {
          return `Deepen mastery of ${moduleToReview.name}`;
        }
        return "Continue conversation";
      })(),
      // LEARNER GOALS - What the learner wants to achieve (prominent placement)
      learner_goals: (() => {
        if (learnerGoals.length === 0) {
          return "No specific goals yet - discover what they want to learn in this session";
        }
        // Prioritize high-priority and low-progress goals (need more attention)
        const topGoals = learnerGoals.slice(0, 3);
        return topGoals.map(g => {
          const progressStr = g.progress > 0 ? ` (${Math.round(g.progress * 100)}% complete)` : "";
          return `${g.name}${progressStr}`;
        }).join("; ");
      })(),
      // Curriculum progress summary for quick reference
      curriculum_progress: modules.length > 0 ? (() => {
        const completed = completedModules.size;
        const total = modules.length;
        const currentModuleName = moduleToReview?.name || nextModule?.name;
        if (completed === 0 && total > 0) {
          return `Starting curriculum (0/${total} modules) - begin with ${modules[0]?.name || "first module"}`;
        }
        if (completed === total) {
          return `Curriculum complete (${total}/${total}) - review and reinforce`;
        }
        return `Progress: ${completed}/${total} modules mastered${currentModuleName ? ` | Current: ${currentModuleName}` : ""}`;
      })() : null,
      key_memory: deduplicatedMemories[0] ? `${deduplicatedMemories[0].key}: ${deduplicatedMemories[0].value}` : null,
      voice_style: (() => {
        const warmth = behaviorTargets.find(t => t.parameterId === "BEH-WARMTH");
        const questions = behaviorTargets.find(t => t.parameterId === "BEH-QUESTION-RATE");
        const responseLength = behaviorTargets.find(t => t.parameterId === "BEH-RESPONSE-LENGTH");
        const warmthLevel = classifyValue(warmth?.targetValue ?? 0.5) || "MODERATE";
        const questionLevel = classifyValue(questions?.targetValue ?? 0.5) || "MODERATE";
        const responseLengthLevel = classifyValue(responseLength?.targetValue ?? 0.5) || "MODERATE";
        return `${warmthLevel} warmth, ${questionLevel} questions, ${responseLengthLevel} response length`;
      })(),
      // Critical voice behaviors for immediate reference (don't need to dig into behaviorTargets)
      critical_voice: (() => {
        const responseLength = behaviorTargets.find(t => t.parameterId === "BEH-RESPONSE-LENGTH");
        const turnLength = behaviorTargets.find(t => t.parameterId === "BEH-TURN-LENGTH");
        const pauseTolerance = behaviorTargets.find(t => t.parameterId === "BEH-PAUSE-TOLERANCE");
        const rl = classifyValue(responseLength?.targetValue ?? 0.5);
        const tl = classifyValue(turnLength?.targetValue ?? 0.5);
        const pt = classifyValue(pauseTolerance?.targetValue ?? 0.5);
        return {
          sentences_per_turn: rl === "LOW" ? "1-2" : rl === "HIGH" ? "3-4" : "2-3",
          max_seconds: tl === "LOW" ? 10 : tl === "HIGH" ? 20 : 15,
          silence_wait: pt === "HIGH" ? "4-5s, don't fill" : pt === "LOW" ? "2s then prompt" : "3s then prompt",
        };
      })(),
      first_line: (() => {
        // Use identity spec's opening instruction if available
        const identityOpening = (identitySpec?.config as any)?.sessionStructure?.opening?.instruction;
        if (identityOpening) return identityOpening;
        // Generate contextual opening based on session type
        if (isFirstCall) {
          return "Good to have you. Let's just ease into this... no rush.";
        }
        return `Good to reconnect. Let's pick up where we left off.`;
      })(),
    },

    _version: "1.1",
    _format: "LLM_STRUCTURED",

    // ============================================================
    // PREAMBLE - How to interpret and use this prompt package
    // ============================================================
    _preamble: {
      systemInstruction: "You are receiving a structured context package for your next conversation. This data has been assembled specifically for this caller based on their history, personality, and learning progress. Use it to deliver a personalized, effective session.",

      readingOrder: [
        "1. SCAN _quickStart first - this is your instant context",
        "2. CHECK instructions.voice - this is HOW you speak",
        "3. FOLLOW instructions.session_pedagogy - this is your session roadmap",
        "4. USE identity - this is WHO you are",
        "5. REFERENCE content.modules - this is WHAT you teach",
        "6. APPLY behaviorTargets for style calibration",
        "7. PERSONALIZE with memories and personality"
      ],

      sectionGuide: {
        "_quickStart": {
          priority: "READ FIRST",
          what: "Instant context - caller, session goal, opening line",
          action: "Scan in <1 second. This orients you immediately."
        },
        "instructions.voice": {
          priority: "HIGHEST",
          what: "Voice-specific rules - response length, pacing, turn-taking",
          action: "Follow these for natural conversation. Never monologue."
        },
        "instructions.session_pedagogy": {
          priority: "HIGH",
          what: "Your step-by-step session plan",
          action: "Follow flow steps in order. reviewFirst → bridge → newMaterial"
        },
        "identity": {
          priority: "HIGH",
          what: "WHO you are - role, techniques, style, boundaries",
          action: "Use techniques when appropriate. Never violate boundaries."
        },
        "content": {
          priority: "MEDIUM",
          what: "WHAT you teach - curriculum modules in sequence",
          action: "Stay within current/next module. Don't skip ahead."
        },
        "behaviorTargets": {
          priority: "MEDIUM",
          what: "HOW you communicate - style calibration",
          action: "HIGH targets → follow when_high. LOW → follow when_low. MODERATE → blend both."
        },
        "memories": {
          priority: "LOW",
          what: "Facts/preferences from previous calls",
          action: "Reference naturally. Don't force. Shows you remember them."
        }
      },

      criticalRules: [
        "If RETURNING_CALLER: ALWAYS review before new material",
        "If review fails (caller can't recall): Don't proceed. Re-teach foundation first.",
        "If caller struggles: Back up. Different example. Don't push forward.",
        "If caller wants to skip review: Only allow if they PROVE they know it.",
        "End at natural stopping point, never mid-concept."
      ],

      voiceRules: (() => {
        // Get voice rules from voiceSpec config (stored by ID)
        const voiceConfig = voiceSpec?.config as any;
        if (voiceConfig?.voice_rules?.rules) {
          return voiceConfig.voice_rules.rules;
        }
        // Fallback to defaults
        return [
          "MAX 3 sentences per turn - then ask a question or pause",
          "If caller is silent for 3+ seconds after a question, wait. Don't fill.",
          "Use natural speech: 'So...', 'Right...', 'Here's the thing...'",
          "Check understanding every 2-3 turns: 'Does that track?'",
          "If interrupted, stop immediately. Acknowledge. Let them speak.",
          "End responses with engagement: question, or invitation to respond"
        ];
      })()
    },

    // ============================================================
    // CALLER CONTEXT
    // ============================================================
    caller: {
      id: caller?.id || null,
      name: caller?.name || null,
      contactInfo: {
        email: caller?.email || null,
        phone: caller?.phone || null,
      },
      externalId: caller?.externalId || null,
    },

    personality: personality ? {
      traits: {
        openness: {
          score: personality.openness,
          level: classifyValue(personality.openness),
          description: personality.openness !== null && personality.openness >= thresholds.high
            ? "Open to new experiences, curious, creative"
            : personality.openness !== null && personality.openness <= thresholds.low
              ? "Prefers routine, practical, conventional"
              : "Balanced between tradition and novelty",
        },
        conscientiousness: {
          score: personality.conscientiousness,
          level: classifyValue(personality.conscientiousness),
          description: personality.conscientiousness !== null && personality.conscientiousness >= thresholds.high
            ? "Organized, reliable, goal-oriented"
            : personality.conscientiousness !== null && personality.conscientiousness <= thresholds.low
              ? "Flexible, spontaneous, adaptable"
              : "Balances planning with flexibility",
        },
        extraversion: {
          score: personality.extraversion,
          level: classifyValue(personality.extraversion),
          description: personality.extraversion !== null && personality.extraversion >= thresholds.high
            ? "Outgoing, energetic, talkative"
            : personality.extraversion !== null && personality.extraversion <= thresholds.low
              ? "Reserved, reflective, quiet"
              : "Comfortable in both social and solitary settings",
        },
        agreeableness: {
          score: personality.agreeableness,
          level: classifyValue(personality.agreeableness),
          description: personality.agreeableness !== null && personality.agreeableness >= thresholds.high
            ? "Cooperative, trusting, helpful"
            : personality.agreeableness !== null && personality.agreeableness <= thresholds.low
              ? "Direct, skeptical, competitive"
              : "Balanced between cooperation and assertiveness",
        },
        neuroticism: {
          score: personality.neuroticism,
          level: classifyValue(personality.neuroticism),
          description: personality.neuroticism !== null && personality.neuroticism >= thresholds.high
            ? "Emotionally sensitive, may need reassurance"
            : personality.neuroticism !== null && personality.neuroticism <= thresholds.low
              ? "Emotionally stable, calm under pressure"
              : "Generally stable with normal emotional range",
        },
      },
      preferences: {
        tone: personality.preferredTone,
        responseLength: personality.preferredLength,
        technicalLevel: personality.technicalLevel,
      },
      confidence: personality.confidenceScore,
    } : null,

    learnerProfile: learnerProfile && (
      learnerProfile.learningStyle ||
      learnerProfile.pacePreference ||
      learnerProfile.interactionStyle ||
      learnerProfile.preferredModality ||
      learnerProfile.questionFrequency ||
      learnerProfile.feedbackStyle ||
      Object.keys(learnerProfile.priorKnowledge).length > 0
    ) ? {
      learningStyle: learnerProfile.learningStyle,
      pacePreference: learnerProfile.pacePreference,
      interactionStyle: learnerProfile.interactionStyle,
      preferredModality: learnerProfile.preferredModality,
      questionFrequency: learnerProfile.questionFrequency,
      feedbackStyle: learnerProfile.feedbackStyle,
      priorKnowledge: learnerProfile.priorKnowledge,
      lastUpdated: learnerProfile.lastUpdated,
    } : null,

    memories: {
      totalCount: deduplicatedMemories.length,
      byCategory: memoryGroups,
      // Flattened list for easy access (deduplicated)
      all: deduplicatedMemories.slice(0, 20).map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
      })),
    },

    behaviorTargets: {
      totalCount: behaviorTargets.length,
      byDomain: targetGroups,
      // Flattened list with target values (filtered by scope priority)
      all: behaviorTargets.map((t) => ({
        parameterId: t.parameterId,
        name: t.parameter?.name || t.parameterId,
        targetValue: t.targetValue,
        targetLevel: classifyValue(t.targetValue),
        scope: t.scope,
        when_high: t.parameter?.interpretationHigh,
        when_low: t.parameter?.interpretationLow,
      })),
    },

    // Curriculum & Learning Progress
    // Uses shared module calculations (completedModules, estimatedProgress, moduleToReview, nextModule)
    // computed at the top of buildLlmFriendlyPrompt for consistency with session_pedagogy
    curriculum: (() => {
      const getAttrValue = (attr: typeof callerAttributes[0]): any => {
        switch (attr.valueType) {
          case "STRING": return attr.stringValue;
          case "NUMBER": return attr.numberValue;
          case "BOOLEAN": return attr.booleanValue;
          case "JSON": return attr.jsonValue;
          default: return attr.stringValue || attr.numberValue || attr.booleanValue || attr.jsonValue;
        }
      };

      const curriculumAttrs = callerAttributes.filter(a =>
        a.key.includes("module") ||
        a.key.includes("curriculum") ||
        a.key.includes("mastery") ||
        a.key.includes("comprehension") ||
        a.key.includes("progress") ||
        a.sourceSpecSlug?.includes("CURR")
      );

      const nextContentAttrs = callerAttributes.filter(a =>
        a.key.includes("next_") ||
        a.key.includes("ready_for") ||
        a.key.includes("prerequisite")
      );

      // Build list of completed/covered modules (explicit + estimated)
      // Uses the shared `completedModules` Set and `estimatedProgress` from above
      const completedModulesList = Array.from(completedModules);

      // If no explicit tracking but we have estimated progress, add those modules as "covered"
      const coveredModules = completedModulesList.length > 0
        ? completedModulesList
        : modules.slice(0, Math.max(0, estimatedProgress)).map(m => m.slug);

      // Determine module status - clear, unambiguous states
      // "completed" = mastery confirmed (>= threshold)
      // "in_progress" = currently being worked on (introduced but not mastered)
      // "not_started" = not yet introduced
      const getModuleStatus = (m: typeof modules[0], idx: number): "completed" | "in_progress" | "not_started" => {
        if (completedModules.has(m.slug)) return "completed";
        // Current module or any previously touched but not mastered = in_progress
        if (idx <= lastCompletedIndex && totalCallCount > 0) return "in_progress";
        return "not_started";
      };

      return {
        name: contentCfg?.curriculum?.name || contentSpec?.name || null,
        hasData: curriculumAttrs.length > 0 || modules.length > 0,
        totalModules: modules.length,
        // Show both explicit completions and estimated coverage
        completedModules: completedModulesList,
        coveredModules: coveredModules, // Modules that have been at least introduced
        completedCount: completedModules.size,
        estimatedProgress: estimatedProgress, // For transparency about estimation
        modules: modules.map((m, idx) => ({
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
        currentProgress: curriculumAttrs.map(a => ({
          key: a.key,
          value: getAttrValue(a),
          confidence: a.confidence,
          source: a.sourceSpecSlug,
        })),
        nextContent: nextContentAttrs.map(a => ({
          key: a.key,
          value: getAttrValue(a),
        })),
      };
    })(),

    // Session Planning (from SESSION-001)
    sessionPlanning: (() => {
      const getAttrValue = (attr: typeof callerAttributes[0]): any => {
        switch (attr.valueType) {
          case "STRING": return attr.stringValue;
          case "NUMBER": return attr.numberValue;
          case "BOOLEAN": return attr.booleanValue;
          case "JSON": return attr.jsonValue;
          default: return attr.stringValue || attr.numberValue || attr.booleanValue || attr.jsonValue;
        }
      };

      const sessionAttrs = callerAttributes.filter(a =>
        a.key.includes("session_") ||
        a.key.includes("arc_") ||
        a.key.includes("continuity") ||
        a.key.includes("thread") ||
        a.sourceSpecSlug?.includes("SESSION")
      );

      return {
        hasData: sessionAttrs.length > 0,
        context: sessionAttrs.map(a => ({
          key: a.key,
          value: getAttrValue(a),
          confidence: a.confidence,
        })),
      };
    })(),

    // Learner Goals (from Goal model)
    learnerGoals: {
      hasData: learnerGoals.length > 0,
      goals: learnerGoals.map(g => ({
        type: g.type,
        name: g.name,
        description: g.description,
        progress: g.progress,
        priority: g.priority,
        isPlaybookGoal: g.playbookId !== null,
      })),
    },

    // Domain Context
    domain: callerDomain ? {
      name: callerDomain.name,
      description: callerDomain.description,
      domainSpecificData: callerAttributes
        .filter(a => a.scope === "DOMAIN" && a.domain === callerDomain.name)
        .map(a => ({
          key: a.key,
          value: (() => {
            switch (a.valueType) {
              case "STRING": return a.stringValue;
              case "NUMBER": return a.numberValue;
              case "BOOLEAN": return a.booleanValue;
              case "JSON": return a.jsonValue;
              default: return a.stringValue || a.numberValue || a.booleanValue || a.jsonValue;
            }
          })(),
        })),
    } : null,

    callHistory: {
      totalCalls: totalCallCount,
      mostRecent: callHistory[0] || null,
      recent: callHistory.slice(0, 3),
    },

    // Explicit instructions for the AI
    instructions: {
      use_memories: (() => {
        // Collect factual/relational/contextual memories for natural reference
        const allMemoryStrings: string[] = [];
        const facts = memoryGroups["FACT"]?.slice(0, 3) || [];
        const relationships = memoryGroups["RELATIONSHIP"]?.slice(0, 2) || [];
        const context = memoryGroups["CONTEXT"]?.slice(0, 2) || [];
        [...facts, ...relationships, ...context].forEach(m => {
          allMemoryStrings.push(`${m.key}="${m.value}"`);
        });

        if (allMemoryStrings.length > 0) {
          return `Reference naturally in conversation: ${allMemoryStrings.join(", ")}`;
        }

        // Check if we have other types of memories (preferences, topics)
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
      use_preferences: (() => {
        const prefs = memoryGroups["PREFERENCE"]?.slice(0, 4) || [];
        if (prefs.length === 0) {
          return "No preferences recorded yet. Observe their communication style.";
        }
        return `Respect caller preferences: ${prefs.map(m => `${m.key}="${m.value}"`).join(", ")}`;
      })(),
      use_topics: (() => {
        // Pull from both TOPIC category AND interest-related PREFERENCE items
        const topics = memoryGroups["TOPIC"]?.slice(0, 3) || [];
        const interestPrefs = (memoryGroups["PREFERENCE"] || [])
          .filter(m => m.key.toLowerCase().includes("interest"))
          .slice(0, 2);
        const allTopics = [...topics.map(m => m.value), ...interestPrefs.map(m => m.value)];
        if (allTopics.length === 0) {
          return "No specific topics of interest recorded yet.";
        }
        return `Topics of interest to explore: ${allTopics.join(", ")}`;
      })(),

      // Handle tension between caller interests and curriculum sequence
      interest_handling: (() => {
        // Find interests that might relate to future modules
        const interestPrefs = (memoryGroups["PREFERENCE"] || [])
          .filter(m => m.key.toLowerCase().includes("interest"));

        if (interestPrefs.length === 0 || modules.length === 0) {
          return null;
        }

        // Check if any interest keywords appear in future module names/descriptions
        const currentModuleIndex = moduleToReview ? modules.findIndex(m => m.slug === moduleToReview.slug) : 0;
        const futureModules = modules.slice(currentModuleIndex + 1);

        const futureInterests: string[] = [];
        for (const pref of interestPrefs) {
          const interestValue = pref.value.toLowerCase();
          const interestKey = pref.key.toLowerCase();
          for (const mod of futureModules) {
            const modName = mod.name.toLowerCase();
            const modDesc = (mod.description || "").toLowerCase();
            // Check if interest matches a future module
            if (modName.includes(interestValue) || modDesc.includes(interestValue) ||
                interestValue.includes(modName) || interestKey.includes(mod.slug)) {
              futureInterests.push(`"${pref.value}" relates to module "${mod.name}" (coming later)`);
            }
          }
        }

        if (futureInterests.length === 0) {
          return null;
        }

        return {
          tension: futureInterests,
          guidance: "When caller asks about these future topics: acknowledge their interest, note it connects to upcoming material, then gently redirect: 'Great question - we'll dig into that when we get to [module]. For now, let's build the foundation with [current topic].'",
          avoid: "Don't ignore their interest or dismiss it. Don't skip ahead. Don't give a detailed answer that requires context they don't have yet."
        };
      })(),

      personality_adaptation: personality ? (() => {
        const adaptations: string[] = [];

        // Extraversion
        if (personality.extraversion !== null) {
          if (personality.extraversion >= thresholds.high) {
            adaptations.push("HIGH extraversion: Match their energy - be engaging and conversational");
          } else if (personality.extraversion <= thresholds.low) {
            adaptations.push("LOW extraversion: Give them space - be concise, allow pauses");
          } else {
            adaptations.push("MODERATE extraversion: Balanced engagement - read their energy level each turn");
          }
        }

        // Openness
        if (personality.openness !== null) {
          if (personality.openness >= thresholds.high) {
            adaptations.push("HIGH openness: Explore ideas - they enjoy intellectual discussion and tangents");
          } else if (personality.openness <= thresholds.low) {
            adaptations.push("LOW openness: Stay practical - focus on concrete topics and proven approaches");
          } else {
            adaptations.push("MODERATE openness: Mix practical examples with some conceptual exploration");
          }
        }

        // Conscientiousness
        if (personality.conscientiousness !== null) {
          if (personality.conscientiousness >= thresholds.high) {
            adaptations.push("HIGH conscientiousness: Provide structured approach - they appreciate organization");
          } else if (personality.conscientiousness <= thresholds.low) {
            adaptations.push("LOW conscientiousness: Be flexible - allow spontaneous direction changes");
          } else {
            adaptations.push("MODERATE conscientiousness: Balance structure with flexibility");
          }
        }

        // Agreeableness
        if (personality.agreeableness !== null) {
          if (personality.agreeableness >= thresholds.high) {
            adaptations.push("HIGH agreeableness: They're cooperative - gentle guidance works well");
          } else if (personality.agreeableness <= thresholds.low) {
            adaptations.push("LOW agreeableness: Be direct - they appreciate straightforward communication and may push back");
          } else {
            adaptations.push("MODERATE agreeableness: Direct but warm - they'll engage in healthy debate");
          }
        }

        // Neuroticism
        if (personality.neuroticism !== null) {
          if (personality.neuroticism >= thresholds.high) {
            adaptations.push("HIGH neuroticism: Extra reassurance - acknowledge their concerns, slower pace");
          } else if (personality.neuroticism <= thresholds.low) {
            adaptations.push("LOW neuroticism: Emotionally stable - can handle challenge and critique well");
          }
          // No adaptation needed for moderate neuroticism
        }

        return adaptations.length > 0 ? adaptations : ["No specific personality adaptations - use balanced approach"];
      })() : ["No personality data available - observe and adapt during conversation"],
      behavior_targets_summary: behaviorTargets.slice(0, 5).map((t) => ({
        what: t.parameter?.name || t.parameterId,
        target: classifyValue(t.targetValue),
        meaning: t.targetValue >= thresholds.high
          ? t.parameter?.interpretationHigh
          : t.targetValue <= thresholds.low
            ? t.parameter?.interpretationLow
            // For MODERATE: blend high and low interpretations
            : t.parameter?.interpretationHigh && t.parameter?.interpretationLow
              ? `Balance: ${t.parameter.interpretationHigh.split(',')[0].trim()} while also ${t.parameter.interpretationLow.split(',')[0].toLowerCase().trim()}`
              : t.parameter?.interpretationHigh || t.parameter?.interpretationLow || "balanced approach",
      })),

      // Curriculum & Learning Guidance
      // NOTE: Uses pre-computed moduleToReview/nextModule from session_pedagogy for consistency
      curriculum_guidance: (() => {
        const getAttrValue = (attr: typeof callerAttributes[0]): any => {
          switch (attr.valueType) {
            case "STRING": return attr.stringValue;
            case "NUMBER": return attr.numberValue;
            case "BOOLEAN": return attr.booleanValue;
            case "JSON": return attr.jsonValue;
            default: return attr.stringValue || attr.numberValue || attr.booleanValue || attr.jsonValue;
          }
        };

        const parts: string[] = [];

        // Use shared module calculations for consistency with session_pedagogy
        if (modules.length > 0) {
          parts.push(`Curriculum: ${contentCfg?.curriculum?.name || contentSpec?.name || "Learning"} (${modules.length} modules)`);
          parts.push(`Progress: ${completedModules.size}/${modules.length} completed`);

          // Session-aware guidance (matches session_pedagogy flow)
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

        // Check for caller attributes about curriculum state
        const nextContent = callerAttributes.filter(a =>
          a.key.includes("next_") || a.key.includes("ready_for")
        );
        const currentModule = callerAttributes.find(a =>
          a.key.includes("current_module") || a.key.includes("active_module")
        );
        const mastery = callerAttributes.find(a => a.key.includes("mastery") && !a.key.includes("mastery_"));

        if (currentModule) {
          parts.push(`Current module: ${getAttrValue(currentModule)}`);
        }
        if (mastery) {
          const masteryVal = getAttrValue(mastery);
          parts.push(`Mastery level: ${typeof masteryVal === "number" ? (masteryVal * 100).toFixed(0) + "%" : masteryVal}`);
        }
        if (nextContent.length > 0) {
          parts.push(`Next content to cover: ${nextContent.map(a => getAttrValue(a)).join(", ")}`);
        }

        if (parts.length === 0) {
          return "No curriculum progress tracked yet - start with first module.";
        }
        return parts.join(". ");
      })(),

      // Session Planning Guidance
      session_guidance: (() => {
        const goals = learnerGoals.slice(0, 3);
        if (goals.length === 0) {
          return "No specific session goals set - explore learner interests and set goals collaboratively.";
        }
        return `Session goals: ${goals.map(g => g.name).join("; ")}`;
      })(),

      // Session Pedagogy - Review vs New Material (uses shared module calculation)
      // Note: moduleToReview, nextModule, reviewType, reviewReason are computed above _quickStart
      session_pedagogy: (() => {
        // Build actionable session plan using shared module calculations
        const plan: {
          sessionType: string;
          flow: string[];
          reviewFirst?: { module: string; reason: string; technique: string };
          newMaterial?: { module: string; approach: string };
          principles: string[];
        } = {
          sessionType: isFirstCall ? "FIRST_CALL" : "RETURNING_CALLER",
          flow: [],
          principles: [],
        };

        if (isFirstCall) {
          // First call flow
          const firstModule = modules[0];
          plan.flow = [
            "1. Welcome & set expectations",
            "2. Probe existing knowledge with open questions",
            `3. Introduce foundation: ${firstModule?.name || 'first concept'}`,
            "4. Check understanding with application question",
            "5. Summarize & preview next session"
          ];
          if (firstModule) {
            plan.newMaterial = {
              module: firstModule.name,
              approach: `Start with ${firstModule.description || 'foundational concepts'}. Use concrete examples before abstractions.`
            };
          }
        } else {
          // Returning caller - use pre-computed values
          plan.flow = [
            `1. Reconnect - reference last session specifically`,
            `2. Spaced retrieval (${reviewType}) - recall question on ${moduleToReview?.name || 'previous concept'}`,
            "3. Reinforce or correct based on their recall",
            `4. Bridge - connect ${moduleToReview?.name || 'old'} to ${nextModule?.name || 'new material'}`,
            `5. New material - introduce ${nextModule?.name || 'next concept'}`,
            "6. Integrate - question using both old and new",
            "7. Close with summary and preview"
          ];

          if (moduleToReview) {
            plan.reviewFirst = {
              module: moduleToReview.name,
              reason: reviewReason,
              technique: reviewType === "quick_recall"
                ? "Ask one recall question, wait for their attempt before proceeding"
                : reviewType === "application"
                  ? "Give a scenario requiring them to apply the concept"
                  : "Walk through the concept again with a fresh example"
            };
          }

          if (nextModule) {
            plan.newMaterial = {
              module: nextModule.name,
              approach: `After confirming ${moduleToReview?.name || 'previous'} understanding, introduce ${nextModule.description || 'new concepts'}`
            };
          }
        }

        // Add pedagogy principles
        plan.principles = [
          "Review BEFORE new material - never skip unless learner explicitly confirms mastery",
          "One main new concept per session - depth over breadth",
          "If review reveals gaps, stay on review - don't accumulate confusion",
          "Connection questions ('How does X relate to Y?') are more valuable than isolated recall"
        ];

        return plan;
      })(),

      // Voice-specific guidance for VAPI/voice AI
      // Uses voiceSpec config when available, falls back to defaults
      voice: (() => {
        // Voice config is stored with parameters as direct keys (from seed-from-specs)
        const voiceConfig = voiceSpec?.config as any;

        // Get configs from spec (or use defaults)
        const responseLengthConfig = voiceConfig?.response_length || null;
        const pacingConfig = voiceConfig?.pacing || null;
        const naturalSpeechConfig = voiceConfig?.natural_speech || null;
        const interruptionsConfig = voiceConfig?.interruptions || null;
        const turnTakingConfig = voiceConfig?.turn_taking || null;
        const voiceAdaptationConfig = voiceConfig?.voice_adaptation || null;
        const voiceRulesConfig = voiceConfig?.voice_rules || null;

        // Compute personality-based pace adaptation dynamically
        const computePaceMatch = () => {
          const extraversion = personality?.extraversion;
          if (pacingConfig?.paceAdaptation) {
            if (extraversion !== null && extraversion !== undefined && extraversion <= thresholds.low) {
              return pacingConfig.paceAdaptation.introvert || "Slower pace - give them space";
            }
            if (extraversion !== null && extraversion !== undefined && extraversion >= thresholds.high) {
              return pacingConfig.paceAdaptation.extrovert || "Match their energy - quicker exchanges OK";
            }
            return pacingConfig.paceAdaptation.default || "Moderate pace - read their cues";
          }
          // Fallback
          if (extraversion !== null && extraversion !== undefined) {
            if (extraversion <= thresholds.low) return "Slower pace - give them space";
            if (extraversion >= thresholds.high) return "Match their energy - quicker exchanges OK";
          }
          return "Moderate pace - read their cues";
        };

        // Compute personality-based voice adaptations dynamically
        const computeVoiceAdaptation = () => {
          const adaptations: string[] = [];
          const adaptConfig = voiceAdaptationConfig?.adaptations;
          const extraversion = personality?.extraversion;
          const neuroticism = personality?.neuroticism;
          const openness = personality?.openness;
          const agreeableness = personality?.agreeableness;

          if (extraversion !== null && extraversion !== undefined && extraversion <= thresholds.low) {
            const cfg = adaptConfig?.lowExtraversion;
            adaptations.push(cfg ? `${cfg.label}: ${cfg.guidance}` : "INTROVERT: Shorter turns, more pauses, don't fill silence");
          }
          if (neuroticism !== null && neuroticism !== undefined && neuroticism >= thresholds.high) {
            const cfg = adaptConfig?.highNeuroticism;
            adaptations.push(cfg ? `${cfg.label}: ${cfg.guidance}` : "ANXIOUS: Extra warmth, slower pace, more reassurance");
          }
          if (openness !== null && openness !== undefined && openness >= thresholds.high) {
            const cfg = adaptConfig?.highOpenness;
            adaptations.push(cfg ? `${cfg.label}: ${cfg.guidance}` : "CURIOUS: Can explore tangents briefly, enjoy intellectual play");
          }
          if (agreeableness !== null && agreeableness !== undefined && agreeableness <= thresholds.low) {
            const cfg = adaptConfig?.lowAgreeableness;
            adaptations.push(cfg ? `${cfg.label}: ${cfg.guidance}` : "DIRECT: Skip pleasantries, get to the point, they'll push back - that's OK");
          }

          return adaptations.length > 0 ? adaptations : ["No special voice adaptations needed"];
        };

        return {
          _source: voiceSpec ? voiceSpec.name : "hardcoded defaults",

          response_length: {
            target: responseLengthConfig?.target || "2-3 sentences per turn",
            max_seconds: responseLengthConfig?.maxSeconds || 15,
            rule: responseLengthConfig?.rule || "If you're about to say more than 3 sentences, STOP and ask a question instead"
          },

          pacing: {
            pauses_after_questions: pacingConfig?.pausesAfterQuestions || "2-3 seconds - let them think",
            rushing: pacingConfig?.silenceRule || "Never fill silence. Silence is thinking time.",
            pace_match: computePaceMatch()
          },

          natural_speech: {
            use_fillers: naturalSpeechConfig?.fillers || ["So...", "Now...", "Right, so...", "Here's the thing..."],
            use_backchannels: naturalSpeechConfig?.backchannels || ["Mm-hmm", "I see", "Right", "Got it"],
            transitions: naturalSpeechConfig?.transitions || ["Okay, let's...", "So here's where it gets interesting...", "Now, thinking about..."],
            confirmations: naturalSpeechConfig?.confirmations || ["Does that make sense?", "What do you think?", "Does that track?"]
          },

          interruptions: {
            allow: interruptionsConfig?.allow ?? true,
            recovery: interruptionsConfig?.recovery || "If interrupted mid-sentence, acknowledge ('Sure, go ahead') and let them speak. Don't restart your point - pick up where relevant."
          },

          turn_taking: {
            check_understanding: turnTakingConfig?.checkUnderstanding || "Every 2-3 exchanges, check in: 'Make sense so far?' or 'What's your take?'",
            avoid_monologues: turnTakingConfig?.avoidMonologues || "If you've been talking for 10+ seconds without a question, you're lecturing. Stop and engage.",
            invitation_phrases: turnTakingConfig?.invitationPhrases || ["What do you think about that?", "How does that land for you?", "Any questions so far?"]
          },

          // NOTE: Canonical voice_rules are in _preamble.voiceRules - this field kept for backwards compat
          voice_rules: "_preamble.voiceRules",

          voice_adaptation: computeVoiceAdaptation()
        };
      })(),
    },

    // Compositional Identity - WHO the agent is (from IDENTITY spec + Domain context)
    identity: identitySpec ? {
      // Enhance generic identity names with domain context
      specName: (() => {
        const name = identitySpec.name;
        // If identity is generic and we have a domain, make it domain-specific
        if (name.toLowerCase().includes("generic") && callerDomain?.name) {
          return `${callerDomain.name} Tutor Identity`;
        }
        return name;
      })(),
      domain: callerDomain?.name || null,
      description: identitySpec.description,
      role: (identitySpec.config as any)?.roleStatement || null,
      primaryGoal: (identitySpec.config as any)?.primaryGoal || null,
      secondaryGoals: (identitySpec.config as any)?.secondaryGoals || [],
      techniques: ((identitySpec.config as any)?.techniques || []).map((t: any) => ({
        name: t.name,
        description: t.description,
        when: t.when,
      })),
      styleDefaults: (identitySpec.config as any)?.defaults || null,
      styleGuidelines: (identitySpec.config as any)?.styleGuidelines || [],
      responsePatterns: (identitySpec.config as any)?.patterns || null,
      boundaries: {
        does: (identitySpec.config as any)?.does || [],
        doesNot: (identitySpec.config as any)?.doesNot || [],
      },
      sessionStructure: (identitySpec.config as any)?.opening || (identitySpec.config as any)?.main || (identitySpec.config as any)?.closing ? {
        opening: (identitySpec.config as any)?.opening,
        main: (identitySpec.config as any)?.main,
        closing: (identitySpec.config as any)?.closing,
      } : null,
      assessmentApproach: (identitySpec.config as any)?.principles || (identitySpec.config as any)?.methods ? {
        principles: (identitySpec.config as any)?.principles || [],
        methods: (identitySpec.config as any)?.methods || [],
      } : null,
    } : null,

    // Compositional Identity - WHAT the agent knows/teaches (from CONTENT spec config)
    content: contentSpec ? (() => {
      // Curriculum data now comes from contentSpec.config (curriculum FK was removed from Playbook)
      const specConfig = contentSpec.config as any;
      const modulesSource = specConfig?.modules || specConfig?.curriculum?.modules || [];

      return {
        specName: contentSpec.name,
        description: contentSpec.description,
        curriculumName: specConfig?.curriculum?.name || specConfig?.name || null,
        curriculumDescription: (contentSpec.config as any)?.description || null,
        targetAudience: (contentSpec.config as any)?.targetAudience || null,
        learningObjectives: (contentSpec.config as any)?.learningObjectives || [],
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
        conceptLibrary: (contentSpec.config as any)?.concepts || null,
        deliveryRules: {
          pacing: (contentSpec.config as any)?.pacing || null,
          sequencing: (contentSpec.config as any)?.sequencing || null,
          personalization: (contentSpec.config as any)?.personalization || null,
          practiceRatio: (contentSpec.config as any)?.practiceRatio || null,
        },
        activityTypes: (contentSpec.config as any)?.activityTypes || [],
        assessmentCriteria: {
          comprehension: (contentSpec.config as any)?.comprehensionIndicators || [],
          application: (contentSpec.config as any)?.applicationIndicators || [],
          mastery: (contentSpec.config as any)?.masteryIndicators || [],
        },
      };
    })() : null,

    // Summary of compositional identity
    agentIdentitySummary: (() => {
      if (!identitySpec && !contentSpec) {
        return "No identity or content specs - using default conversational style.";
      }
      const parts: string[] = [];
      if (identitySpec) {
        parts.push(`WHO: ${identitySpec.name}`);
        const role = (identitySpec.config as any)?.roleStatement;
        if (role) parts.push(`Role: ${role.substring(0, 100)}...`);
      }
      if (contentSpec) {
        parts.push(`WHAT: ${contentSpec.name}`);
        const curriculum = (contentSpec.config as any)?.name;
        if (curriculum) parts.push(`Curriculum: ${curriculum}`);
      }
      return parts.join(". ");
    })(),
  };
}
