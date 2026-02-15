/**
 * @api POST /api/calls/:callId/pipeline
 * @visibility public
 * @scope pipeline:execute
 * @auth session
 * @tags calls, pipeline
 * @description SPEC-DRIVEN pipeline endpoint that runs analysis in configurable stages. Pipeline stages are loaded from the PIPELINE-001 spec (or GUARD-001 fallback), not hardcoded. Each stage has a name, order, outputTypes, and optional requiresMode. Default stages: EXTRACT (10), SCORE_AGENT (20), AGGREGATE (30), REWARD (40), ADAPT (50), SUPERVISE (60), COMPOSE (100, prompt mode only).
 * @pathParam callId string - The call ID to run the pipeline on
 * @body callerId string - The caller ID (required)
 * @body mode string - Pipeline mode: "prep" (all stages except COMPOSE) or "prompt" (all stages including COMPOSE) (required)
 * @body engine string - AI engine to use: "mock" | "claude" | "openai" (default: "claude")
 * @response 200 { ok: true, mode: "prep" | "prompt", message: string, data: { scoresCreated, memoriesCreated, callTargetsCreated, agentMeasurements, ... }, prompt?: object, logs: LogEntry[], duration: number }
 * @response 400 { ok: false, error: "callerId is required" | "mode must be 'prep' or 'prompt'", logs: LogEntry[] }
 * @response 404 { ok: false, error: "Call not found", logs: LogEntry[] }
 * @response 500 { ok: false, error: string, logs: LogEntry[], duration: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { MemoryCategory } from "@prisma/client";
import { AIEngine, isEngineAvailable } from "@/lib/ai/client";
import { getConfiguredMeteredAICompletion, logMockAIUsage } from "@/lib/metering";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { runAggregateSpecs } from "@/lib/pipeline/aggregate-runner";
import { runAdaptSpecs as runRuleBasedAdapt } from "@/lib/pipeline/adapt-runner";
import { validateSpecDependencies } from "@/lib/pipeline/validate-dependencies";
import { trackGoalProgress } from "@/lib/goals/track-progress";
import { extractGoals } from "@/lib/goals/extract-goals";
import { extractArtifacts } from "@/lib/artifacts/extract-artifacts";
import { deliverArtifacts } from "@/lib/artifacts/deliver-artifacts";
import { extractActions } from "@/lib/actions/extract-actions";
import { config as appConfig } from "@/lib/config";
import { updateCurriculumProgress, getCurriculumProgress, completeModule } from "@/lib/curriculum/track-progress";
import { ContractRegistry } from "@/lib/contracts/registry";
import { loadPipelineStages, PipelineStage } from "@/lib/pipeline/config";
import { logAI } from "@/lib/logger";
import { TRAITS } from "@/lib/registry";
import { recoverBrokenJson } from "@/lib/utils/json-recovery";
import { executeComposition, persistComposedPrompt, loadComposeConfig } from "@/lib/prompt/composition";
import { renderPromptSummary } from "@/lib/prompt/composition/renderPromptSummary";
import { getPipelineGates, getPipelineSettings } from "@/lib/system-settings";
import { getTranscriptLimitsFallback } from "@/lib/fallback-settings";

// =====================================================
// TRANSCRIPT LIMITS (from AIConfig)
// =====================================================

// Loaded from SystemSettings at runtime (see fallback-settings.ts for hardcoded last-resort)

/**
 * Get transcript limit for a call point from AIConfig, with fallback to defaults
 */
async function getTranscriptLimit(callPoint: string): Promise<number> {
  try {
    const aiCfg = await prisma.aIConfig.findUnique({
      where: { callPoint },
    });
    // Use type assertion since Prisma types may be stale after migration
    const limit = (aiCfg as any)?.transcriptLimit;
    if (limit && typeof limit === "number") {
      return limit;
    }
  } catch {
    // Fallback to default on error
  }
  const limits = await getTranscriptLimitsFallback();
  return limits[callPoint] ?? 4000;
}

// =====================================================
// SPEC SELECTION BY TYPE
// =====================================================

/**
 * Get SYSTEM specs filtered by playbook toggle settings.
 * System specs can be toggled ON/OFF per playbook via PlaybookSystemSpec.isEnabled.
 * Defaults to enabled if no PlaybookSystemSpec record exists.
 */
async function getSystemSpecs(
  outputTypes: string[],
  playbookId: string | null,
  log: ReturnType<typeof createLogger>
): Promise<Array<{ id: string; slug: string; outputType: string }>> {
  // Get all active SYSTEM specs
  const allSystemSpecs = await prisma.analysisSpec.findMany({
    where: {
      scope: "SYSTEM",
      outputType: { in: outputTypes as any[] },
      isActive: true,
      isDirty: false,
    },
    select: { id: true, slug: true, outputType: true },
    orderBy: { priority: "desc" },
  });

  // If no playbook, return all system specs (default behavior)
  if (!playbookId) {
    log.info(`Loaded ${allSystemSpecs.length} SYSTEM specs (no playbook)`, { outputTypes });
    return allSystemSpecs;
  }

  // Filter system specs based on playbook's systemSpecToggles config
  const playbook = await prisma.playbook.findUnique({
    where: { id: playbookId },
    select: { config: true },
  });

  const playbookConfig = (playbook?.config as Record<string, any>) || {};
  const toggles = playbookConfig.systemSpecToggles || {};

  // If no toggles configured, return all system specs (default = enabled)
  if (Object.keys(toggles).length === 0) {
    log.info(`Loaded ${allSystemSpecs.length} SYSTEM specs (no toggles configured)`, { outputTypes, playbookId });
    return allSystemSpecs;
  }

  // Filter: exclude specs that are explicitly disabled
  const filtered = allSystemSpecs.filter(spec => {
    const toggle = toggles[spec.id] || toggles[spec.slug];
    if (toggle && toggle.isEnabled === false) {
      log.info(`SYSTEM spec "${spec.slug}" disabled by playbook toggle`);
      return false;
    }
    return true;
  });

  log.info(`Loaded ${filtered.length}/${allSystemSpecs.length} SYSTEM specs (${allSystemSpecs.length - filtered.length} disabled by playbook)`, {
    outputTypes,
    playbookId,
  });

  return filtered;
}

/**
 * Get specs by outputType for a specific pipeline stage.
 */
async function getSpecsByOutputType(
  outputType: string,
  log: ReturnType<typeof createLogger>
): Promise<Array<{ id: string; slug: string; outputType: string }>> {
  const specs = await prisma.analysisSpec.findMany({
    where: {
      outputType: outputType as any,
      isActive: true,
      isDirty: false,
    },
    select: { id: true, slug: true, outputType: true },
    orderBy: { priority: "desc" },
  });

  log.info(`Loaded ${specs.length} ${outputType} specs`);
  return specs;
}

// =====================================================
// PLAYBOOK-AWARE SPEC SELECTION (DOMAIN specs)
// =====================================================

/**
 * Get DOMAIN specs from the caller's domain's published playbook.
 * Only returns specs with scope=DOMAIN (not SYSTEM).
 * Falls back to all active DOMAIN specs if no playbook is published.
 */
async function getPlaybookSpecs(
  callerId: string,
  outputTypes: string[],
  log: ReturnType<typeof createLogger>
): Promise<{
  specs: Array<{ id: string; slug: string; outputType: string }>;
  playbookId: string | null;
  playbookName: string | null;
  fallback: boolean;
}> {
  // 1. Get caller's domain
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true, domain: { select: { slug: true, name: true } } },
  });

  if (!caller?.domainId) {
    log.warn("Caller has no domain assigned, using fallback (all active DOMAIN specs)");
    const allSpecs = await prisma.analysisSpec.findMany({
      where: {
        scope: "DOMAIN",
        outputType: { in: outputTypes as any[] },
        isActive: true,
        isDirty: false,
      },
      select: { id: true, slug: true, outputType: true },
    });
    return { specs: allSpecs, playbookId: null, playbookName: null, fallback: true };
  }

  // 2. Find PUBLISHED playbook for this domain
  const playbook = await prisma.playbook.findFirst({
    where: {
      domainId: caller.domainId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      name: true,
      items: {
        where: {
          itemType: "SPEC",
          isEnabled: true,
          spec: {
            scope: "DOMAIN",
            outputType: { in: outputTypes as any[] },
            isActive: true,
            isDirty: false,
          },
        },
        select: {
          spec: {
            select: { id: true, slug: true, outputType: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!playbook) {
    log.warn(`No published playbook for domain "${caller.domain?.slug}", using fallback (all active DOMAIN specs)`);
    const allSpecs = await prisma.analysisSpec.findMany({
      where: {
        scope: "DOMAIN",
        outputType: { in: outputTypes as any[] },
        isActive: true,
        isDirty: false,
      },
      select: { id: true, slug: true, outputType: true },
    });
    return { specs: allSpecs, playbookId: null, playbookName: null, fallback: true };
  }

  // 3. Extract specs from playbook items
  const specs = playbook.items
    .filter((item) => item.spec)
    .map((item) => item.spec!);

  log.info(`Using playbook "${playbook.name}" for domain "${caller.domain?.slug}"`, {
    playbookId: playbook.id,
    specCount: specs.length,
    outputTypes,
  });

  return {
    specs,
    playbookId: playbook.id,
    playbookName: playbook.name,
    fallback: false,
  };
}

// =====================================================
// BATCHED PARAMETER LOOKUP (OPTIMIZATION)
// =====================================================

/**
 * Batch-load parameters by IDs in a single query instead of N queries.
 * Reduces DB round-trips from O(N) to O(1).
 */
async function batchLoadParameters(
  specs: Array<{ triggers: Array<{ actions: Array<{ parameterId: string | null }> }> }>
): Promise<Map<string, { parameterId: string; name: string; definition: string | null }>> {
  // Collect unique parameter IDs first
  const paramIds = new Set<string>();
  for (const spec of specs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId) {
          paramIds.add(action.parameterId);
        }
      }
    }
  }

  if (paramIds.size === 0) {
    return new Map();
  }

  // Single batched query
  const params = await prisma.parameter.findMany({
    where: { parameterId: { in: Array.from(paramIds) } },
    select: { parameterId: true, name: true, definition: true },
  });

  // Build lookup map
  const paramMap = new Map<string, { parameterId: string; name: string; definition: string | null }>();
  for (const param of params) {
    paramMap.set(param.parameterId, param);
  }

  return paramMap;
}

// Category mappings for normalizing LLM output to valid MemoryCategory enum values
// Mirrors the taxonomy config from system-memory-taxonomy spec
const CATEGORY_MAPPINGS: Record<string, MemoryCategory> = {
  // Direct matches (uppercase)
  "FACT": MemoryCategory.FACT,
  "PREFERENCE": MemoryCategory.PREFERENCE,
  "EVENT": MemoryCategory.EVENT,
  "TOPIC": MemoryCategory.TOPIC,
  "RELATIONSHIP": MemoryCategory.RELATIONSHIP,
  "CONTEXT": MemoryCategory.CONTEXT,
  // Common variations LLM might return
  "INTEREST": MemoryCategory.TOPIC,
  "INTEREST_": MemoryCategory.TOPIC,
  "INTERESTS": MemoryCategory.TOPIC,
  "HOBBY": MemoryCategory.TOPIC,
  "HOBBIES": MemoryCategory.TOPIC,
  "LIKE": MemoryCategory.PREFERENCE,
  "LIKES": MemoryCategory.PREFERENCE,
  "DISLIKE": MemoryCategory.PREFERENCE,
  "DISLIKES": MemoryCategory.PREFERENCE,
  "PERSONAL": MemoryCategory.FACT,
  "PERSONAL_INFO": MemoryCategory.FACT,
  "DEMOGRAPHIC": MemoryCategory.FACT,
  "LOCATION": MemoryCategory.FACT,
  "EXPERIENCE": MemoryCategory.EVENT,
  "HISTORY": MemoryCategory.EVENT,
  "SITUATION": MemoryCategory.CONTEXT,
  "CURRENT": MemoryCategory.CONTEXT,
  "FAMILY": MemoryCategory.RELATIONSHIP,
  "FRIEND": MemoryCategory.RELATIONSHIP,
  "WORK": MemoryCategory.FACT,
  "JOB": MemoryCategory.FACT,
};

const DEFAULT_CATEGORY = MemoryCategory.FACT;

/**
 * Map LLM category output to valid MemoryCategory enum
 */
function mapToMemoryCategory(category: string): MemoryCategory {
  if (!category) return DEFAULT_CATEGORY;

  // Clean up the category string
  const cleaned = category.toUpperCase().trim().replace(/[^A-Z_]/g, '');

  // Direct enum match
  if (cleaned in MemoryCategory) {
    return cleaned as MemoryCategory;
  }

  // Lookup in mappings
  const mapped = CATEGORY_MAPPINGS[cleaned];
  if (mapped) {
    return mapped;
  }

  // Try partial match (e.g., "interest_" -> "INTEREST")
  for (const [key, value] of Object.entries(CATEGORY_MAPPINGS)) {
    if (cleaned.startsWith(key) || key.startsWith(cleaned)) {
      return value;
    }
  }

  return DEFAULT_CATEGORY;
}

// Log entry type
type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
};

// Logger helper
function createLogger() {
  const logs: LogEntry[] = [];
  const startTime = Date.now();

  return {
    info: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "info", message, data });
    },
    warn: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "warn", message, data });
    },
    error: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "error", message, data });
    },
    debug: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "debug", message, data });
    },
    getLogs: () => logs,
    getDuration: () => Date.now() - startTime,
  };
}

/**
 * Build a BATCHED prompt for all MEASURE + LEARN specs
 * This scores all caller parameters AND extracts memories in ONE AI call
 */
/**
 * Load current module context for learning assessment.
 * Tries CONTENT spec path first, then falls back to Subject curriculum.
 */
async function loadCurrentModuleContext(
  callerId: string,
  log: ReturnType<typeof createLogger>
): Promise<{
  specSlug: string;
  moduleId: string;
  moduleName: string;
  learningOutcomes: string[];
  masteryThreshold: number;
  allModuleIds: string[];
} | null> {
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true },
  });
  if (!caller?.domainId) return null;

  // Path 1: CONTENT spec via published playbook
  const playbook = await prisma.playbook.findFirst({
    where: { domainId: caller.domainId, status: "PUBLISHED" },
    select: {
      items: {
        where: {
          itemType: "SPEC",
          isEnabled: true,
          spec: { specRole: "CONTENT", isActive: true },
        },
        select: {
          spec: { select: { slug: true, config: true } },
        },
      },
    },
  });

  if (playbook?.items?.length) {
    for (const item of playbook.items) {
      const spec = item.spec;
      if (!spec) continue;
      const specConfig = spec.config as Record<string, any> | null;
      if (!specConfig) continue;

      const modules = specConfig.modules || specConfig.curriculum?.modules || [];
      if (modules.length === 0) continue;

      const progress = await getCurriculumProgress(callerId, spec.slug);
      const currentModuleId = progress.currentModuleId || modules[0]?.id || modules[0]?.slug;
      const currentModule = modules.find((m: any) => (m.id || m.slug) === currentModuleId) || modules[0];

      if (currentModule) {
        return {
          specSlug: spec.slug,
          moduleId: currentModule.id || currentModule.slug,
          moduleName: currentModule.name || currentModule.title || currentModule.id,
          learningOutcomes: currentModule.learningOutcomes || [],
          masteryThreshold: specConfig.metadata?.curriculum?.masteryThreshold ?? 0.7,
          allModuleIds: modules.map((m: any) => m.id || m.slug),
        };
      }
    }
  }

  // Path 2: Subject curriculum fallback
  const subjectDomains = await prisma.subjectDomain.findMany({
    where: { domainId: caller.domainId },
    include: {
      subject: {
        include: {
          curricula: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              slug: true,
              notableInfo: true,
            },
          },
        },
      },
    },
  });

  for (const sd of subjectDomains) {
    const curriculum = sd.subject.curricula[0];
    if (!curriculum?.notableInfo) continue;

    const rawModules = (curriculum.notableInfo as any)?.modules;
    if (!Array.isArray(rawModules) || rawModules.length === 0) continue;

    const progress = await getCurriculumProgress(callerId, curriculum.slug);
    const currentModuleId = progress.currentModuleId || rawModules[0]?.id;
    const currentModule = rawModules.find((m: any) => m.id === currentModuleId) || rawModules[0];

    if (currentModule) {
      log.info(`Module context from Subject curriculum`, {
        specSlug: curriculum.slug,
        moduleId: currentModule.id,
        loCount: (currentModule.learningOutcomes || []).length,
      });
      return {
        specSlug: curriculum.slug,
        moduleId: currentModule.id,
        moduleName: currentModule.title || currentModule.name || currentModule.id,
        learningOutcomes: currentModule.learningOutcomes || [],
        masteryThreshold: (await ContractRegistry.getThresholds('CURRICULUM_PROGRESS_V1'))?.masteryComplete ?? 0.7,
        allModuleIds: rawModules.map((m: any) => m.id),
      };
    }
  }

  return null;
}

function buildBatchedCallerPrompt(
  transcript: string,
  measureParams: Array<{ parameterId: string; name: string; definition: string | null }>,
  learnActions: Array<{ category: string; keyPrefix: string; keyHint: string; description: string }>,
  transcriptLimit: number = 4000,
  moduleContext?: { moduleId: string; moduleName: string; learningOutcomes: string[] } | null,
  assessmentPromptInstructions?: string | null,
): string {
  const paramList = measureParams.map(p => `${p.parameterId}:${p.name}`).join("|");
  const learnList = learnActions.map(a => `${a.category}:${a.description}`).join("|");

  let learningSection = "";
  let learningJsonHint = "";
  if (moduleContext?.learningOutcomes?.length) {
    const loList = moduleContext.learningOutcomes.map((lo, i) => `LO${i + 1}:${lo}`).join("|");
    const instructions = assessmentPromptInstructions
      || "Score caller's demonstrated understanding of each outcome 0-1 (0=no evidence, 0.5=partial, 1=full mastery).";
    learningSection = `\n\nLEARNING OUTCOMES TO ASSESS (module "${moduleContext.moduleName}"):\n${loList}\n${instructions}`;
    learningJsonHint = `,"learning":{"moduleId":"${moduleContext.moduleId}","outcomes":{"LO1":0.6},"overallMastery":0.7}`;
  }

  return `Analyze transcript. Score caller 0-1 on params, extract facts.

TRANSCRIPT (analyze this):
${transcript.slice(0, transcriptLimit)}

PARAMS TO SCORE: ${paramList}

FACTS TO FIND: ${learnList}${learningSection}

Return compact JSON:
{"scores":{"PARAM-ID":{"s":0.75,"c":0.8},...},"memories":[{"cat":"FACT","key":"k","val":"v","c":0.9},...]${learningJsonHint}}`;
}

/**
 * Build a BATCHED prompt for MEASURE specs
 * This scores all behaviour parameters in ONE AI call
 */
function buildBatchedAgentPrompt(
  transcript: string,
  agentParams: Array<{ parameterId: string; name: string; definition: string | null }>,
  transcriptLimit: number = 4000
): string {
  const paramList = agentParams.map(p => `${p.parameterId}:${p.name}`).join("|");

  return `Score AGENT behavior 0-1 (0=poor, 1=excellent).

TRANSCRIPT:
${transcript.slice(0, transcriptLimit)}

BEHAVIORS: ${paramList}

Return compact JSON:
{"scores":{"PARAM-ID":{"s":0.75,"c":0.8},...}}`;
}

/**
 * Run batched caller analysis (MEASURE + LEARN)
 */
async function runBatchedCallerAnalysis(
  call: { id: string; transcript: string | null },
  callerId: string,
  engine: AIEngine,
  log: ReturnType<typeof createLogger>
): Promise<{
  scoresCreated: number;
  memoriesCreated: number;
  playbookUsed: string | null;
  learningAssessment: {
    specSlug: string;
    moduleId: string;
    overallMastery: number;
    outcomes: Record<string, number>;
    masteryThreshold: number;
    allModuleIds: string[];
  } | null;
}> {
  const transcript = call.transcript || "";

  // Get DOMAIN specs from caller's domain playbook (or fallback to all active DOMAIN specs)
  // Need playbookId first to filter system specs
  const { specs: playbookSpecs, playbookId, playbookName, fallback } = await getPlaybookSpecs(
    callerId,
    ["MEASURE", "LEARN"],
    log
  );

  // Get SYSTEM specs filtered by playbook toggle settings
  const systemSpecs = await getSystemSpecs(["MEASURE", "LEARN"], playbookId, log);

  // Combine SYSTEM + DOMAIN specs (deduplicate by ID)
  const allSpecIds = new Set<string>();
  const combinedSpecs: Array<{ id: string; slug: string; outputType: string }> = [];

  for (const spec of [...systemSpecs, ...playbookSpecs]) {
    if (!allSpecIds.has(spec.id)) {
      allSpecIds.add(spec.id);
      combinedSpecs.push(spec);
    }
  }

  log.info(`Combined specs for caller analysis`, {
    systemCount: systemSpecs.length,
    playbookCount: playbookSpecs.length,
    totalUnique: combinedSpecs.length
  });

  const measureSpecIds = combinedSpecs.filter(s => s.outputType === "MEASURE").map(s => s.id);
  const learnSpecIds = combinedSpecs.filter(s => s.outputType === "LEARN").map(s => s.id);

  // Load full MEASURE specs with triggers/actions
  const measureSpecs = measureSpecIds.length > 0
    ? await prisma.analysisSpec.findMany({
        where: { id: { in: measureSpecIds } },
        include: { triggers: { include: { actions: true } } },
      })
    : [];

  // Load full LEARN specs with triggers/actions
  const learnSpecs = learnSpecIds.length > 0
    ? await prisma.analysisSpec.findMany({
        where: { id: { in: learnSpecIds } },
        include: { triggers: { include: { actions: true } } },
      })
    : [];

  if (fallback) {
    log.warn("Running in fallback mode - no playbook constraint");
  }

  // Collect unique parameters to score (batched lookup - O(1) instead of O(N))
  const paramMap = await batchLoadParameters(measureSpecs);

  // Collect LEARN actions
  const learnActions: Array<{ category: string; keyPrefix: string; keyHint: string; description: string }> = [];
  for (const spec of learnSpecs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.learnCategory) {
          learnActions.push({
            category: action.learnCategory,
            keyPrefix: action.learnKeyPrefix || "",
            keyHint: action.learnKeyHint || "",
            description: action.description,
          });
        }
      }
    }
  }

  const measureParams = Array.from(paramMap.values());

  // Check if LEARN-ASSESS-001 (or any spec with assessmentMode) is active
  const assessmentSpec = learnSpecs.find(
    (s) => (s.config as any)?.assessmentMode === "curriculum_mastery"
  );
  let moduleContext: Awaited<ReturnType<typeof loadCurrentModuleContext>> = null;

  if (assessmentSpec) {
    const assessConfig = assessmentSpec.config as Record<string, any>;
    try {
      moduleContext = await loadCurrentModuleContext(callerId, log);
      if (moduleContext) {
        // Use mastery threshold from spec config (overrides default)
        moduleContext.masteryThreshold = assessConfig.masteryThreshold ?? moduleContext.masteryThreshold;
        log.info(`LEARN-ASSESS spec active (${assessmentSpec.slug}): module context loaded`, {
          specSlug: moduleContext.specSlug,
          moduleId: moduleContext.moduleId,
          loCount: moduleContext.learningOutcomes.length,
          threshold: moduleContext.masteryThreshold,
        });
      }
    } catch (err: any) {
      log.warn(`Failed to load module context (non-blocking): ${err.message}`);
    }
  }

  log.info(`Batched caller analysis`, {
    params: measureParams.length,
    learnActions: learnActions.length,
    assessmentSpec: assessmentSpec?.slug || null,
    hasModuleContext: !!moduleContext,
  });

  if (measureParams.length === 0 && learnActions.length === 0 && !moduleContext) {
    log.warn("No MEASURE or LEARN specs found and no assessment spec active");
    return { scoresCreated: 0, memoriesCreated: 0, playbookUsed: playbookName, learningAssessment: null };
  }

  let scoresCreated = 0;
  let memoriesCreated = 0;
  let learningAssessment: {
    specSlug: string;
    moduleId: string;
    overallMastery: number;
    outcomes: Record<string, number>;
    masteryThreshold: number;
    allModuleIds: string[];
  } | null = null;

  if (engine === "mock") {
    // Mock: generate random scores and no memories
    for (const param of measureParams) {
      const score = 0.4 + Math.random() * 0.4;
      // Check if score already exists for this call+parameter
      const existing = await prisma.callScore.findFirst({
        where: { callId: call.id, parameterId: param.parameterId },
      });
      if (existing) {
        await prisma.callScore.update({
          where: { id: existing.id },
          data: {
            score,
            confidence: 0.7,
            evidence: ["Mock batched scoring"],
            scoredBy: "mock_batched_v1",
            scoredAt: new Date(),
          },
        });
      } else {
        await prisma.callScore.create({
          data: {
            callId: call.id,
            callerId,
            parameterId: param.parameterId,
            score,
            confidence: 0.7,
            evidence: ["Mock batched scoring"],
            scoredBy: "mock_batched_v1",
          },
        });
      }
      scoresCreated++;
    }
    // Log mock usage for visibility in metering dashboard
    logMockAIUsage({
      callId: call.id,
      callerId,
      sourceOp: "pipeline:extract",
      reason: "requested",
      metadata: { scoresCreated, paramsProcessed: measureParams.length },
    }).catch((e) => log.warn("Failed to log mock usage", { error: e.message }));
    log.info(`Mock caller analysis complete`, { scoresCreated });
  } else {
    // @ai-call pipeline.measure — Score caller parameters from transcript | config: /x/ai-config
    const transcriptLimit = await getTranscriptLimit("pipeline.measure");
    const assessPromptInstructions = assessmentSpec ? (assessmentSpec.config as any)?.promptInstructions : null;
    const prompt = buildBatchedCallerPrompt(transcript, measureParams, learnActions, transcriptLimit, moduleContext, assessPromptInstructions);

    try {
      const result = await getConfiguredMeteredAICompletion({
        callPoint: "pipeline.measure",
        engineOverride: engine,
        messages: [
          { role: "system", content: "You are an expert behavioral analyst. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        maxTokens: 2048,
        temperature: 0.3,
      }, { callId: call.id, callerId, sourceOp: "pipeline:extract" });

      logAI("pipeline:extract", prompt, result.content, { usage: result.usage, callId: call.id, callerId });
      log.debug("AI caller analysis response", { model: result.model, tokens: result.usage });

      // Parse response with recovery for truncated LLM output
      const { parsed, recovered, fixesApplied } = recoverBrokenJson(result.content, "pipeline:extract");
      if (recovered) {
        log.info("EXTRACT JSON recovery applied", { fixesApplied });
      }

      // Store scores (handle both full and compact keys: score/s, confidence/c)
      if (parsed.scores) {
        for (const [parameterId, scoreData] of Object.entries(parsed.scores as Record<string, any>)) {
          const score = Math.max(0, Math.min(1, scoreData.score ?? scoreData.s ?? 0.5));
          const confidence = Math.max(0, Math.min(1, scoreData.confidence ?? scoreData.c ?? 0.7));

          // Check if score already exists for this call+parameter
          const existing = await prisma.callScore.findFirst({
            where: { callId: call.id, parameterId },
          });
          if (existing) {
            await prisma.callScore.update({
              where: { id: existing.id },
              data: {
                score,
                confidence,
                evidence: ["AI batched analysis"],
                scoredBy: `${engine}_batched_v2`,
                scoredAt: new Date(),
              },
            });
          } else {
            await prisma.callScore.create({
              data: {
                callId: call.id,
                callerId,
                parameterId,
                score,
                confidence,
                evidence: ["AI batched analysis"],
                scoredBy: `${engine}_batched_v2`,
              },
            });
          }
          scoresCreated++;
        }
      }

      // Store memories (handle both full and compact keys: category/cat, value/val, confidence/c)
      if (parsed.memories && Array.isArray(parsed.memories)) {
        for (const mem of parsed.memories) {
          const category = mem.category || mem.cat;
          const key = mem.key;
          const value = mem.value || mem.val;
          const confidence = mem.confidence ?? mem.c ?? 0.8;

          if (category && key && value) {
            const mappedCategory = mapToMemoryCategory(category);

            await prisma.callerMemory.create({
              data: {
                callerId,
                callId: call.id,
                category: mappedCategory,
                key,
                value: String(value),
                evidence: "AI extraction",
                confidence,
                extractedBy: `${engine}_batched_v2`,
              },
            });
            memoriesCreated++;
          }
        }
      }

      // Parse learning assessment from AI response
      if (parsed.learning && moduleContext) {
        const learning = parsed.learning;
        const overallMastery = Math.max(0, Math.min(1, learning.overallMastery ?? 0));
        const outcomes: Record<string, number> = {};
        if (learning.outcomes) {
          for (const [key, value] of Object.entries(learning.outcomes)) {
            outcomes[key] = Math.max(0, Math.min(1, Number(value) || 0));
          }
        }
        learningAssessment = {
          specSlug: moduleContext.specSlug,
          moduleId: learning.moduleId || moduleContext.moduleId,
          overallMastery,
          outcomes,
          masteryThreshold: moduleContext.masteryThreshold,
          allModuleIds: moduleContext.allModuleIds,
        };
        log.info(`Learning assessment parsed`, {
          moduleId: learningAssessment.moduleId,
          mastery: learningAssessment.overallMastery,
          outcomesScored: Object.keys(outcomes).length,
        });
      }

      log.info(`AI caller analysis complete`, { scoresCreated, memoriesCreated, hasLearning: !!learningAssessment });
    } catch (error: any) {
      log.error("AI caller analysis failed", { error: error.message });
      throw error;
    }
  }

  return { scoresCreated, memoriesCreated, playbookUsed: playbookName, learningAssessment };
}

/**
 * Run batched agent analysis (MEASURE)
 */
async function runBatchedAgentAnalysis(
  call: { id: string; transcript: string | null },
  callerId: string,
  engine: AIEngine,
  log: ReturnType<typeof createLogger>
): Promise<{ measurementsCreated: number }> {
  const transcript = call.transcript || "";

  // Transcript length gate — skip or cap confidence for short transcripts
  const gates = await getPipelineGates();
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < gates.minTranscriptWords) {
    log.info("Skipping agent scoring - transcript too short", {
      wordCount,
      min: gates.minTranscriptWords,
    });
    return { measurementsCreated: 0 };
  }

  const isShortTranscript = wordCount < gates.shortTranscriptThresholdWords;
  const confidenceCap = isShortTranscript ? gates.shortTranscriptConfidenceCap : 1.0;
  if (isShortTranscript) {
    log.info("Short transcript - capping confidence", { wordCount, cap: confidenceCap });
  }

  // Get DOMAIN MEASURE specs from caller's domain playbook (or fallback)
  // Need playbookId first to filter system specs
  const { specs: playbookSpecs, playbookId, fallback } = await getPlaybookSpecs(
    callerId,
    ["MEASURE"],
    log
  );

  // Get SYSTEM MEASURE specs filtered by playbook toggle settings
  const systemSpecs = await getSystemSpecs(["MEASURE"], playbookId, log);

  // Combine SYSTEM + DOMAIN specs (deduplicate by ID)
  const allSpecIds = new Set<string>();
  const combinedSpecs: Array<{ id: string; slug: string; outputType: string }> = [];

  for (const spec of [...systemSpecs, ...playbookSpecs]) {
    if (!allSpecIds.has(spec.id)) {
      allSpecIds.add(spec.id);
      combinedSpecs.push(spec);
    }
  }

  log.info(`Combined specs for agent analysis`, {
    systemCount: systemSpecs.length,
    playbookCount: playbookSpecs.length,
    totalUnique: combinedSpecs.length
  });

  const agentSpecIds = combinedSpecs.map(s => s.id);

  // Load full specs with triggers/actions
  const agentSpecs = agentSpecIds.length > 0
    ? await prisma.analysisSpec.findMany({
        where: { id: { in: agentSpecIds } },
        include: { triggers: { include: { actions: true } } },
      })
    : [];

  if (fallback) {
    log.debug("Agent analysis running in fallback mode");
  }

  // Collect unique agent parameters (batched lookup - O(1) instead of O(N))
  const paramMap = await batchLoadParameters(agentSpecs);

  const agentParams = Array.from(paramMap.values());
  log.info(`Batched agent analysis`, { params: agentParams.length });

  if (agentParams.length === 0) {
    log.warn("No MEASURE specs found");
    return { measurementsCreated: 0 };
  }

  let measurementsCreated = 0;

  if (engine === "mock") {
    // Mock scoring
    for (const param of agentParams) {
      const actualValue = 0.5 + Math.random() * 0.3;
      const existing = await prisma.behaviorMeasurement.findFirst({
        where: { callId: call.id, parameterId: param.parameterId },
      });

      if (existing) {
        await prisma.behaviorMeasurement.update({
          where: { id: existing.id },
          data: { actualValue, confidence: Math.min(0.75, confidenceCap), evidence: ["Mock batched"] },
        });
      } else {
        await prisma.behaviorMeasurement.create({
          data: { callId: call.id, parameterId: param.parameterId, actualValue, confidence: Math.min(0.75, confidenceCap), evidence: ["Mock batched"] },
        });
      }
      measurementsCreated++;
    }
    // Log mock usage for visibility in metering dashboard
    logMockAIUsage({
      callId: call.id,
      callerId,
      sourceOp: "pipeline:score_agent",
      reason: "requested",
      metadata: { measurementsCreated, paramsProcessed: agentParams.length },
    }).catch((e) => log.warn("Failed to log mock usage", { error: e.message }));
  } else {
    // @ai-call pipeline.score_agent — Evaluate agent behavior against targets | config: /x/ai-config
    const transcriptLimit = await getTranscriptLimit("pipeline.score_agent");
    const prompt = buildBatchedAgentPrompt(transcript, agentParams, transcriptLimit);

    try {
      // More tokens for agent analysis with many parameters
      // ~100 tokens per param (score + confidence + evidence array)
      // Add 25% buffer to prevent truncation
      const estimatedTokens = Math.max(2048, Math.ceil(agentParams.length * 150));

      const result = await getConfiguredMeteredAICompletion({
        callPoint: "pipeline.score_agent",
        engineOverride: engine,
        messages: [
          { role: "system", content: "You are an expert at evaluating conversational AI behavior. Always respond with valid JSON. Keep evidence arrays brief (1-2 short quotes max per parameter)." },
          { role: "user", content: prompt },
        ],
        maxTokens: estimatedTokens,
        temperature: 0.3,
      }, { callId: call.id, callerId, sourceOp: "pipeline:score_agent" });

      logAI("pipeline:score_agent", prompt, result.content, { usage: result.usage, callId: call.id, callerId });
      log.debug("AI agent analysis response", { model: result.model, contentLength: result.content.length });

      // Parse response with recovery for truncated LLM output
      const { parsed, recovered: scoreRecovered, fixesApplied: scoreFixes } = recoverBrokenJson(result.content, "pipeline:score_agent");
      if (scoreRecovered) {
        log.info("SCORE_AGENT JSON recovery applied", { fixesApplied: scoreFixes });
      }

      if (parsed.scores) {
        for (const [parameterId, scoreData] of Object.entries(parsed.scores as Record<string, any>)) {
          // Handle both full and compact keys: score/s, confidence/c, evidence/e
          const actualValue = Math.max(0, Math.min(1, scoreData.score ?? scoreData.s ?? 0.5));
          const confidence = Math.max(0, Math.min(confidenceCap, scoreData.confidence ?? scoreData.c ?? 0.7));
          const rawEvidence = scoreData.evidence ?? scoreData.e;
          const evidence = Array.isArray(rawEvidence) ? rawEvidence : [rawEvidence || "AI analysis"];

          const existing = await prisma.behaviorMeasurement.findFirst({
            where: { callId: call.id, parameterId },
          });

          if (existing) {
            await prisma.behaviorMeasurement.update({
              where: { id: existing.id },
              data: { actualValue, confidence, evidence },
            });
          } else {
            await prisma.behaviorMeasurement.create({
              data: { callId: call.id, parameterId, actualValue, confidence, evidence },
            });
          }
          measurementsCreated++;
        }
      }

      log.info(`AI agent analysis complete`, { measurementsCreated });
    } catch (error: any) {
      log.error("AI agent analysis failed", { error: error.message });
      throw error;
    }
  }

  return { measurementsCreated };
}

/**
 * Compute reward score
 */
async function computeReward(
  callId: string,
  log: ReturnType<typeof createLogger>
): Promise<{ overallScore: number }> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { behaviorMeasurements: true },
  });

  if (!call || call.behaviorMeasurements.length === 0) {
    log.warn("No behavior measurements for reward");
    return { overallScore: 0.5 };
  }

  // Load system targets
  const targets = await prisma.behaviorTarget.findMany({
    where: { scope: "SYSTEM" },
  });

  const diffs: any[] = [];
  for (const measurement of call.behaviorMeasurements) {
    const target = targets.find((t) => t.parameterId === measurement.parameterId);
    const targetValue = target?.targetValue ?? 0.5;
    const diff = Math.abs(measurement.actualValue - targetValue);
    diffs.push({ parameterId: measurement.parameterId, target: targetValue, actual: measurement.actualValue, diff });
  }

  const avgDiff = diffs.length > 0 ? diffs.reduce((sum, d) => sum + d.diff, 0) / diffs.length : 0;
  const overallScore = Math.max(0, 1 - avgDiff);

  // Store reward
  await prisma.rewardScore.upsert({
    where: { callId },
    create: { callId, overallScore, modelVersion: "batched_v1", parameterDiffs: diffs },
    update: { overallScore, parameterDiffs: diffs, scoredAt: new Date() },
  });

  log.info(`Reward computed`, { overallScore, diffs: diffs.length });
  return { overallScore };
}

/**
 * Aggregate caller personality from call scores
 * Creates/updates PersonalityObservation for the call and CallerPersonality aggregate
 *
 * Loads configuration from system-personality-aggregate AnalysisSpec:
 * - traitMapping: Maps parameter IDs to personality field names
 * - halfLifeDays: Decay half-life for time-weighted averaging
 * - defaultConfidence: Default confidence for observations
 */
async function aggregatePersonality(
  callId: string,
  callerId: string,
  log: ReturnType<typeof createLogger>
): Promise<{ observationCreated: boolean; profileUpdated: boolean }> {
  // Load AGGREGATE spec config
  const aggregateSpec = await prisma.analysisSpec.findFirst({
    where: {
      outputType: "AGGREGATE",
      isActive: true,
      scope: "SYSTEM",
    },
  });

  // Extract config with defaults
  const specConfig = (aggregateSpec?.config as any) || {};
  const traitMapping: Record<string, string> = specConfig.traitMapping || {
    [TRAITS.B5_O]: "openness",
    [TRAITS.B5_C]: "conscientiousness",
    [TRAITS.B5_E]: "extraversion",
    [TRAITS.B5_A]: "agreeableness",
    [TRAITS.B5_N]: "neuroticism",
  };
  const halfLifeDays: number = specConfig.halfLifeDays || 30;
  const defaultConfidence: number = specConfig.defaultConfidence || 0.7;
  const defaultDecayFactor: number = specConfig.defaultDecayFactor || 1.0;

  log.debug("AGGREGATE spec config", {
    specSlug: aggregateSpec?.slug || "(defaults)",
    traitCount: Object.keys(traitMapping).length,
    halfLifeDays,
    defaultConfidence,
  });

  // Get scores for this specific call (to create PersonalityObservation)
  const callScores = await prisma.callScore.findMany({
    where: { callId },
    select: { parameterId: true, score: true, confidence: true },
  });

  if (callScores.length === 0) {
    log.warn("No call scores for personality observation");
    return { observationCreated: false, profileUpdated: false };
  }

  // Initialize trait scores for all mapped traits
  const traitScores: Record<string, number | null> = {};
  for (const traitName of Object.values(traitMapping)) {
    traitScores[traitName] = null;
  }

  let observationCreated = false;

  for (const score of callScores) {
    const traitName = traitMapping[score.parameterId];
    if (traitName) {
      traitScores[traitName] = score.score;
    }
  }

  // Check if any mapped trait scores were found
  const hasMappedScores = Object.values(traitScores).some((v) => v !== null);

  if (hasMappedScores) {
    // Create or update PersonalityObservation for this call
    const existing = await prisma.personalityObservation.findUnique({
      where: { callId },
    });

    if (existing) {
      await prisma.personalityObservation.update({
        where: { callId },
        data: {
          ...traitScores,
          confidence: defaultConfidence,
          observedAt: new Date(),
        },
      });
    } else {
      await prisma.personalityObservation.create({
        data: {
          callId,
          callerId,
          ...traitScores,
          observedAt: new Date(),
          confidence: defaultConfidence,
          decayFactor: defaultDecayFactor,
        },
      });
    }
    observationCreated = true;
    log.info("PersonalityObservation created/updated", { traitScores });
  }

  // Now aggregate all scores into CallerPersonality
  const allScores = await prisma.callScore.findMany({
    where: { callerId },
    include: { call: { select: { createdAt: true } } },
    orderBy: { scoredAt: "desc" },
  });

  if (allScores.length === 0) {
    return { observationCreated, profileUpdated: false };
  }

  // Group by parameter and compute weighted average with time decay
  const byParameter: Record<string, Array<{ score: number; confidence: number; date: Date }>> = {};

  for (const s of allScores) {
    if (!byParameter[s.parameterId]) {
      byParameter[s.parameterId] = [];
    }
    byParameter[s.parameterId].push({
      score: s.score,
      confidence: s.confidence,
      date: s.call?.createdAt || s.scoredAt,
    });
  }

  const now = new Date();
  const aggregatedValues: Record<string, number> = {};

  for (const [parameterId, paramScores] of Object.entries(byParameter)) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const ps of paramScores) {
      const ageMs = now.getTime() - ps.date.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decayWeight = Math.exp((-Math.log(2) * ageDays) / halfLifeDays);
      const weight = decayWeight * ps.confidence;

      weightedSum += ps.score * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      aggregatedValues[parameterId] = weightedSum / totalWeight;
    }
  }

  // Update CallerPersonality using trait mapping from spec
  // Build profile data dynamically from trait mapping
  const profileData: Record<string, any> = {
    lastAggregatedAt: now,
    observationsUsed: allScores.length,
    confidenceScore: defaultConfidence,
    decayHalfLife: halfLifeDays,
  };

  // Map aggregated values to personality fields using the spec's trait mapping
  for (const [parameterId, fieldName] of Object.entries(traitMapping)) {
    profileData[fieldName] = aggregatedValues[parameterId] ?? null;
  }

  await prisma.callerPersonality.upsert({
    where: { callerId },
    create: { callerId, ...profileData },
    update: profileData,
  });

  // Update CallerPersonalityProfile with ALL parameter values
  await prisma.callerPersonalityProfile.upsert({
    where: { callerId },
    create: {
      callerId,
      parameterValues: aggregatedValues,
      lastUpdatedAt: now,
    },
    update: {
      parameterValues: aggregatedValues,
      lastUpdatedAt: now,
    },
  });

  // Build log output for mapped traits
  const mappedTraits: Record<string, string | undefined> = {};
  for (const [parameterId, fieldName] of Object.entries(traitMapping)) {
    mappedTraits[fieldName] = aggregatedValues[parameterId]?.toFixed(2);
  }

  log.info("Personality aggregated", {
    scoresUsed: allScores.length,
    parametersAggregated: Object.keys(aggregatedValues).length,
    mappedTraits,
  });

  return { observationCreated, profileUpdated: true };
}

/**
 * Compute adapt (deltas from previous call)
 */
async function computeAdapt(
  callId: string,
  callerId: string,
  log: ReturnType<typeof createLogger>
): Promise<{ deltasComputed: number }> {
  const currentCall = await prisma.call.findUnique({
    where: { id: callId },
    include: { scores: true },
  });

  if (!currentCall) {
    return { deltasComputed: 0 };
  }

  const previousCall = await prisma.call.findFirst({
    where: { callerId, createdAt: { lt: currentCall.createdAt } },
    orderBy: { createdAt: "desc" },
    include: { scores: true },
  });

  if (!previousCall) {
    log.info("First call for caller - no deltas");
    return { deltasComputed: 0 };
  }

  let deltasComputed = 0;
  for (const currentScore of currentCall.scores) {
    const previousScore = previousCall.scores.find((s) => s.parameterId === currentScore.parameterId);
    if (previousScore) {
      const delta = currentScore.score - previousScore.score;
      const deltaParameterId = `${currentScore.parameterId}-DELTA`;

      // Check if delta parameter exists
      const deltaParam = await prisma.parameter.findUnique({ where: { parameterId: deltaParameterId } });
      if (deltaParam) {
        const deltaScore = (delta + 1) / 2; // Normalize -1..1 to 0..1
        // Check if score already exists
        const existing = await prisma.callScore.findFirst({
          where: { callId, parameterId: deltaParameterId },
        });
        if (existing) {
          await prisma.callScore.update({
            where: { id: existing.id },
            data: { score: deltaScore, scoredAt: new Date() },
          });
        } else {
          await prisma.callScore.create({
            data: { callId, callerId, parameterId: deltaParameterId, score: deltaScore, confidence: 0.9, scoredBy: "adapt_v1" },
          });
        }
        deltasComputed++;
      }
    }
  }

  log.info(`Adapt computed`, { deltasComputed });
  return { deltasComputed };
}

// =====================================================
// PIPELINE STAGE CONFIGURATION
// =====================================================

// PipelineStage type imported from @/lib/pipeline/config

// =====================================================
// GUARDRAILS LOADER
// =====================================================

/**
 * Guardrails configuration loaded from GUARD-001 spec
 */
interface GuardrailsConfig {
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

// Default guardrails if no SUPERVISE spec found
const DEFAULT_GUARDRAILS: GuardrailsConfig = {
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
 * Load guardrails configuration from SUPERVISE spec (GUARD-001 or similar)
 * Falls back to defaults if no spec found
 */
async function loadGuardrails(log: ReturnType<typeof createLogger>): Promise<GuardrailsConfig> {
  // Load system settings for fallback defaults
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

  const specConfig = (superviseSpec.config as any) || {};
  const parameters: Array<{ id: string; config?: any }> = specConfig.parameters || [];

  // Helper to get parameter config by ID
  const getParamConfig = (paramId: string): any => {
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

// =====================================================
// ADAPT & SUPERVISE SPEC RUNNERS
// =====================================================

/**
 * Build prompt for ADAPT specs to compute personalized targets
 */
function buildAdaptPrompt(
  transcript: string,
  callScores: Array<{ parameterId: string; score: number; confidence: number }>,
  callerProfile: Record<string, any> | null,
  targetParams: Array<{ parameterId: string; name: string; definition: string | null }>,
  transcriptLimit: number = 2500
): string {
  const scoreList = callScores.map(s => `${s.parameterId}:${s.score.toFixed(2)}`).join("|");
  const paramList = targetParams.map(p => `${p.parameterId}:${p.name}`).join("|");
  const profileStr = callerProfile ? JSON.stringify(callerProfile).slice(0, 500) : "";

  return `Compute agent behavior targets (0-1) for next call based on caller profile.

TRANSCRIPT:
${transcript.slice(0, transcriptLimit)}

CALLER SCORES: ${scoreList}
${profileStr ? `PROFILE: ${profileStr}` : ""}

PARAMS: ${paramList}

Return compact JSON:
{"targets":{"PARAM-ID":{"v":0.65,"c":0.8},...}}`;
}

/**
 * Run ADAPT specs to compute personalized CallTargets
 * These specs compute what target values the agent should aim for based on caller profile
 */
async function runAdaptSpecs(
  callId: string,
  callerId: string,
  engine: AIEngine,
  guardrails: GuardrailsConfig,
  log: ReturnType<typeof createLogger>
): Promise<{ targetsCreated: number }> {
  // Load ADAPT specs (by outputType, not specType)
  const adaptSpecs = await getSpecsByOutputType("ADAPT", log);

  if (adaptSpecs.length === 0) {
    log.info("No ADAPT specs configured - using defaults");
    return { targetsCreated: 0 };
  }

  // Load call scores for this call
  const callScores = await prisma.callScore.findMany({
    where: { callId },
    select: { parameterId: true, score: true, confidence: true },
  });

  // Load caller personality profile
  const callerProfile = await prisma.callerPersonalityProfile.findUnique({
    where: { callerId },
    select: { parameterValues: true },
  });

  // Load full ADAPT specs with triggers/actions to get target parameters
  const fullSpecs = await prisma.analysisSpec.findMany({
    where: { id: { in: adaptSpecs.map(s => s.id) } },
    include: { triggers: { include: { actions: true } } },
  });

  // Collect unique parameters that ADAPT specs compute targets for (batched lookup - O(1) instead of O(N))
  const paramMap = await batchLoadParameters(fullSpecs);

  const targetParams = Array.from(paramMap.values());
  log.info(`Running ADAPT specs`, { specCount: adaptSpecs.length, targetParams: targetParams.length });

  if (targetParams.length === 0) {
    log.warn("No target parameters found in ADAPT specs");
    return { targetsCreated: 0 };
  }

  let targetsCreated = 0;

  // Get call transcript
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { transcript: true },
  });

  const { mockBehavior, confidenceBounds, aiSettings } = guardrails;

  if (engine === "mock") {
    // Mock: compute targets as slight adjustments from call scores
    // Using guardrails config for mock behavior
    const center = (mockBehavior.scoreRangeMin + mockBehavior.scoreRangeMax) / 2;

    for (const param of targetParams) {
      const callScore = callScores.find(s => s.parameterId === param.parameterId);
      // Target is based on caller score with some adjustment toward center
      const baseValue = callScore?.score ?? center;
      const targetValue = baseValue + (center - baseValue) * mockBehavior.nudgeFactor;

      await prisma.callTarget.upsert({
        where: { callId_parameterId: { callId, parameterId: param.parameterId } },
        create: {
          callId,
          parameterId: param.parameterId,
          targetValue,
          confidence: confidenceBounds.defaultConfidence,
          sourceSpecSlug: "mock_adapt",
          reasoning: `Mock adaptation (nudge ${mockBehavior.nudgeFactor} toward ${center})`,
        },
        update: {
          targetValue,
          confidence: confidenceBounds.defaultConfidence,
          sourceSpecSlug: "mock_adapt",
          reasoning: `Mock adaptation (nudge ${mockBehavior.nudgeFactor} toward ${center})`,
        },
      });
      targetsCreated++;
    }
    // Log mock usage for visibility in metering dashboard
    logMockAIUsage({
      callId,
      callerId,
      sourceOp: "pipeline:adapt",
      reason: "requested",
      metadata: { targetsCreated, paramsProcessed: targetParams.length },
    }).catch((e) => console.warn("[pipeline] Failed to log mock usage:", e.message));
  } else {
    // @ai-call pipeline.adapt — Compute personalized behavior targets | config: /x/ai-config
    const transcriptLimit = await getTranscriptLimit("pipeline.adapt");
    const prompt = buildAdaptPrompt(
      call?.transcript || "",
      callScores,
      callerProfile?.parameterValues as Record<string, any> | null,
      targetParams,
      transcriptLimit
    );

    try {
      const result = await getConfiguredMeteredAICompletion({
        callPoint: "pipeline.adapt",
        engineOverride: engine,
        messages: [
          { role: "system", content: "You are an expert at personalizing AI behaviour based on caller profiles. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        maxTokens: 1024,
        temperature: aiSettings.temperature,
      }, { callId, callerId, sourceOp: "pipeline:adapt" });

      logAI("pipeline:adapt", prompt, result.content, { usage: result.usage, callId, callerId });

      // Parse response with recovery for truncated LLM output
      const { parsed, recovered: adaptRecovered, fixesApplied: adaptFixes } = recoverBrokenJson(result.content, "pipeline:adapt");
      if (adaptRecovered) {
        log.info("ADAPT JSON recovery applied", { fixesApplied: adaptFixes });
      }

      if (parsed.targets) {
        for (const [parameterId, targetData] of Object.entries(parsed.targets as Record<string, any>)) {
          // Handle both full and compact keys: value/v, confidence/c
          const targetValue = Math.max(0, Math.min(1, targetData.value ?? targetData.v ?? 0.5));
          const confidence = Math.max(0, Math.min(1, targetData.confidence ?? targetData.c ?? 0.7));

          await prisma.callTarget.upsert({
            where: { callId_parameterId: { callId, parameterId } },
            create: {
              callId,
              parameterId,
              targetValue,
              confidence,
              sourceSpecSlug: `${engine}_adapt`,
              reasoning: "AI-computed target",
            },
            update: {
              targetValue,
              confidence,
              sourceSpecSlug: `${engine}_adapt`,
              reasoning: "AI-computed target",
            },
          });
          targetsCreated++;
        }
      }

      log.info(`ADAPT specs complete`, { targetsCreated });
    } catch (error: any) {
      log.error("ADAPT specs failed", { error: error.message });
      throw error;
    }
  }

  return { targetsCreated };
}

/**
 * Validate/clamp targets to safe ranges using guardrails from SUPERVISE spec
 */
async function validateTargets(
  callId: string,
  guardrails: GuardrailsConfig,
  log: ReturnType<typeof createLogger>
): Promise<{ adjustments: number }> {
  const targets = await prisma.callTarget.findMany({
    where: { callId },
  });

  if (targets.length === 0) {
    return { adjustments: 0 };
  }

  const { minValue, maxValue } = guardrails.targetClamp;

  // Clamp targets to safe range (avoid extremes)
  let adjustments = 0;
  for (const target of targets) {
    let newValue = target.targetValue;
    let adjusted = false;

    if (newValue < minValue) {
      newValue = minValue;
      adjusted = true;
    } else if (newValue > maxValue) {
      newValue = maxValue;
      adjusted = true;
    }

    if (adjusted) {
      await prisma.callTarget.update({
        where: { id: target.id },
        data: {
          targetValue: newValue,
          reasoning: `${target.reasoning || ""} [clamped to ${minValue}-${maxValue}]`.trim(),
        },
      });
      adjustments++;
    }
  }

  log.info(`Targets validated`, { adjustments, clampRange: { minValue, maxValue } });
  return { adjustments };
}

/**
 * Aggregate CallTargets to CallerTargets (moving average for prompt composition)
 */
async function aggregateCallerTargets(
  callId: string,
  callerId: string,
  guardrails: GuardrailsConfig,
  log: ReturnType<typeof createLogger>
): Promise<{ aggregated: number }> {
  // Get all CallTargets for this caller's calls
  const callerCalls = await prisma.call.findMany({
    where: { callerId },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const callIds = callerCalls.map(c => c.id);

  // Get all CallTargets for these calls
  const allTargets = await prisma.callTarget.findMany({
    where: { callId: { in: callIds } },
    include: { call: { select: { createdAt: true } } },
  });

  if (allTargets.length === 0) {
    log.info("No CallTargets to aggregate");
    return { aggregated: 0 };
  }

  // Group by parameterId
  const byParameter: Record<string, Array<{ value: number; confidence: number; date: Date }>> = {};
  for (const target of allTargets) {
    if (!byParameter[target.parameterId]) {
      byParameter[target.parameterId] = [];
    }
    byParameter[target.parameterId].push({
      value: target.targetValue,
      confidence: target.confidence,
      date: target.call?.createdAt || target.createdAt,
    });
  }

  // Use aggregation settings from guardrails
  const { decayHalfLifeDays, confidenceGrowthBase, confidenceGrowthPerCall, maxAggregatedConfidence } = guardrails.aggregation;
  const now = new Date();
  let aggregated = 0;

  for (const [parameterId, targets] of Object.entries(byParameter)) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const t of targets) {
      const ageMs = now.getTime() - t.date.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decayWeight = Math.exp((-Math.log(2) * ageDays) / decayHalfLifeDays);
      const weight = decayWeight * t.confidence;

      weightedSum += t.value * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      const avgValue = weightedSum / totalWeight;

      // Confidence grows with more data: base + (calls * growthPerCall), capped at max
      const computedConfidence = Math.min(
        maxAggregatedConfidence,
        confidenceGrowthBase + targets.length * confidenceGrowthPerCall
      );

      await prisma.callerTarget.upsert({
        where: { callerId_parameterId: { callerId, parameterId } },
        create: {
          callerId,
          parameterId,
          targetValue: avgValue,
          confidence: computedConfidence,
          callsUsed: targets.length,
          lastUpdatedAt: now,
          decayHalfLife: decayHalfLifeDays,
        },
        update: {
          targetValue: avgValue,
          confidence: computedConfidence,
          callsUsed: targets.length,
          lastUpdatedAt: now,
        },
      });
      aggregated++;
    }
  }

  log.info(`CallerTargets aggregated`, { aggregated, totalCallTargets: allTargets.length });
  return { aggregated };
}

// =====================================================
// CURRICULUM PROGRESS TRACKING
// =====================================================

/**
 * Update curriculum progress after a call completes.
 * Finds CONTENT specs with curriculum modules via the caller's published playbook,
 * updates lastAccessedAt, and assigns Module 1 if this is the first curriculum call.
 */
async function trackCurriculumAfterCall(
  callerId: string,
  log: ReturnType<typeof createLogger>,
  learningAssessment?: {
    specSlug: string;
    moduleId: string;
    overallMastery: number;
    outcomes: Record<string, number>;
    masteryThreshold: number;
    allModuleIds: string[];
  } | null,
): Promise<boolean> {
  // If we have a learning assessment, write mastery and potentially advance
  if (learningAssessment) {
    const { specSlug, moduleId, overallMastery, masteryThreshold, allModuleIds } = learningAssessment;

    try {
      // Write mastery score for this module
      await updateCurriculumProgress(callerId, specSlug, {
        moduleMastery: { [moduleId]: overallMastery },
        lastAccessedAt: new Date(),
      });
      log.info(`Mastery written for ${specSlug}:${moduleId}`, { mastery: overallMastery, threshold: masteryThreshold });

      // Check if mastery meets threshold → advance to next module
      if (overallMastery >= masteryThreshold) {
        const currentIdx = allModuleIds.indexOf(moduleId);
        const nextModuleId = currentIdx >= 0 && currentIdx + 1 < allModuleIds.length
          ? allModuleIds[currentIdx + 1]
          : undefined;

        await completeModule(callerId, specSlug, moduleId, nextModuleId);
        log.info(`Module completed: ${moduleId}`, {
          nextModule: nextModuleId || "(curriculum complete)",
          mastery: overallMastery,
        });
      }

      return true;
    } catch (err: any) {
      log.warn(`Learning assessment write failed for ${specSlug}: ${err.message}`);
    }
  }

  // Fallback: no learning assessment — still assign first module if needed
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { domainId: true },
  });
  if (!caller?.domainId) return false;

  // Try CONTENT spec path
  const playbook = await prisma.playbook.findFirst({
    where: { domainId: caller.domainId, status: "PUBLISHED" },
    select: {
      items: {
        where: {
          itemType: "SPEC",
          isEnabled: true,
          spec: { specRole: "CONTENT", isActive: true },
        },
        select: {
          spec: { select: { slug: true, config: true } },
        },
      },
    },
  });

  let updated = false;

  if (playbook?.items?.length) {
    for (const item of playbook.items) {
      const spec = item.spec;
      if (!spec) continue;

      const specConfig = spec.config as Record<string, any> | null;
      if (!specConfig) continue;

      const modules = specConfig.modules || specConfig.curriculum?.modules || [];
      if (modules.length === 0 && !specConfig.metadata?.curriculum) continue;

      try {
        const progress = await getCurriculumProgress(callerId, spec.slug);
        if (!progress.currentModuleId && modules.length > 0) {
          const firstModule = modules[0];
          await updateCurriculumProgress(callerId, spec.slug, {
            currentModuleId: firstModule.id || firstModule.slug,
            lastAccessedAt: new Date(),
          });
          log.info(`Assigned caller to first module of ${spec.slug}`, {
            moduleId: firstModule.id || firstModule.slug,
          });
          updated = true;
        } else {
          await updateCurriculumProgress(callerId, spec.slug, { lastAccessedAt: new Date() });
          updated = true;
        }
      } catch (err: any) {
        log.warn(`Curriculum progress update failed for ${spec.slug}: ${err.message}`);
      }
    }
  }

  // Subject curriculum fallback — assign first module if no CONTENT spec found
  if (!updated) {
    try {
      const subjectDomains = await prisma.subjectDomain.findMany({
        where: { domainId: caller.domainId },
        include: {
          subject: {
            include: {
              curricula: {
                orderBy: { updatedAt: "desc" },
                take: 1,
                select: { slug: true, notableInfo: true },
              },
            },
          },
        },
      });

      for (const sd of subjectDomains) {
        const curriculum = sd.subject.curricula[0];
        if (!curriculum?.notableInfo) continue;

        const rawModules = (curriculum.notableInfo as any)?.modules;
        if (!Array.isArray(rawModules) || rawModules.length === 0) continue;

        const progress = await getCurriculumProgress(callerId, curriculum.slug);
        if (!progress.currentModuleId) {
          await updateCurriculumProgress(callerId, curriculum.slug, {
            currentModuleId: rawModules[0].id,
            lastAccessedAt: new Date(),
          });
          log.info(`Assigned caller to first module of Subject curriculum ${curriculum.slug}`, {
            moduleId: rawModules[0].id,
          });
          updated = true;
        } else {
          await updateCurriculumProgress(callerId, curriculum.slug, { lastAccessedAt: new Date() });
          updated = true;
        }
        break; // Only process first curriculum
      }
    } catch (err: any) {
      log.warn(`Subject curriculum fallback failed: ${err.message}`);
    }
  }

  return updated;
}

// =====================================================
// SPEC-DRIVEN PIPELINE EXECUTION
// =====================================================

/**
 * Pipeline execution context passed to all stage executors
 */
interface PipelineContext {
  callId: string;
  callerId: string;
  call: { id: string; transcript: string | null };
  engine: AIEngine;
  guardrails: GuardrailsConfig;
  pipelineStages: PipelineStage[];
  mode: "prep" | "prompt";
  force: boolean;
  log: ReturnType<typeof createLogger>;
  request: NextRequest;
  // Accumulated results from previous stages
  results: Record<string, any>;
}

/**
 * Stage executor function type
 */
type StageExecutor = (ctx: PipelineContext, stage: PipelineStage) => Promise<Record<string, any>>;

/**
 * Stage executor registry - maps stage names to executor functions
 * Each executor handles the specific logic for that stage
 */
const stageExecutors: Record<string, StageExecutor> = {
  // EXTRACT stage: Learn + Measure caller data (batched)
  EXTRACT: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);

    // Idempotency: skip AI call if scores already exist for this call
    if (!ctx.force) {
      const existingScores = await prisma.callScore.count({ where: { callId: ctx.callId } });
      if (existingScores > 0) {
        ctx.log.info(`EXTRACT skipped: ${existingScores} scores already exist for call ${ctx.callId} (use force=true to re-run)`);
        return { scoresCreated: 0, memoriesCreated: 0, skippedReason: "existing_scores" };
      }
    }

    const callerResult = await runBatchedCallerAnalysis(ctx.call, ctx.callerId, ctx.engine, ctx.log);
    const deltaResult = await computeAdapt(ctx.callId, ctx.callerId, ctx.log);

    // Update curriculum progress (non-blocking — errors logged but don't fail the stage)
    let curriculumUpdated = false;
    try {
      curriculumUpdated = await trackCurriculumAfterCall(ctx.callerId, ctx.log, callerResult.learningAssessment);
    } catch (err: any) {
      ctx.log.warn(`Curriculum progress tracking failed (non-blocking): ${err.message}`);
    }

    // Extract conversation artifacts (non-blocking — errors logged but don't fail the stage)
    let artifactsExtracted = 0;
    try {
      if (appConfig.artifacts.enabled) {
        const artifactResult = await extractArtifacts(ctx.call, ctx.callerId, ctx.engine, ctx.log);
        artifactsExtracted = artifactResult.artifactsCreated;
        if (artifactsExtracted > 0) {
          const deliveryResult = await deliverArtifacts(ctx.callId, ctx.callerId, ctx.log);
          ctx.log.info("Artifact delivery result", deliveryResult);
        }
      }
    } catch (err: any) {
      ctx.log.warn(`Artifact extraction failed (non-blocking): ${err.message}`);
    }

    // Extract call actions (non-blocking — errors logged but don't fail the stage)
    let actionsExtracted = 0;
    try {
      if (appConfig.actions.enabled) {
        const actionResult = await extractActions(ctx.call, ctx.callerId, ctx.engine, ctx.log);
        actionsExtracted = actionResult.actionsCreated;
      }
    } catch (err: any) {
      ctx.log.warn(`Action extraction failed (non-blocking): ${err.message}`);
    }

    return {
      playbookUsed: callerResult.playbookUsed,
      scoresCreated: callerResult.scoresCreated,
      memoriesCreated: callerResult.memoriesCreated,
      deltasComputed: deltaResult.deltasComputed,
      curriculumUpdated,
      artifactsExtracted,
      actionsExtracted,
      learningAssessment: callerResult.learningAssessment ? {
        moduleId: callerResult.learningAssessment.moduleId,
        mastery: callerResult.learningAssessment.overallMastery,
        advanced: curriculumUpdated && callerResult.learningAssessment.overallMastery >= callerResult.learningAssessment.masteryThreshold,
      } : null,
    };
  },

  // SCORE_AGENT stage: Score agent behavior (batched)
  SCORE_AGENT: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);

    // Idempotency: skip AI call if measurements already exist for this call
    if (!ctx.force) {
      const existingMeasurements = await prisma.behaviorMeasurement.count({ where: { callId: ctx.callId } });
      if (existingMeasurements > 0) {
        ctx.log.info(`SCORE_AGENT skipped: ${existingMeasurements} measurements already exist for call ${ctx.callId} (use force=true to re-run)`);
        return { agentMeasurements: 0, skippedReason: "existing_measurements" };
      }
    }

    const agentResult = await runBatchedAgentAnalysis(ctx.call, ctx.callerId, ctx.engine, ctx.log);
    return {
      agentMeasurements: agentResult.measurementsCreated,
    };
  },

  // AGGREGATE stage: Aggregate personality profiles and run AGGREGATE specs
  AGGREGATE: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);

    // 1. Aggregate personality (legacy hardcoded aggregation)
    const personalityResult = await aggregatePersonality(ctx.callId, ctx.callerId, ctx.log);

    // 2. Run generic AGGREGATE specs (learner profile, curriculum, etc.)
    const aggregateResult = await runAggregateSpecs(ctx.callerId);
    ctx.log.info(`Aggregate specs completed`, {
      specsRun: aggregateResult.specsRun,
      profileUpdates: aggregateResult.profileUpdates,
      errors: aggregateResult.errors
    });

    return {
      personalityObservationCreated: personalityResult.observationCreated,
      personalityProfileUpdated: personalityResult.profileUpdated,
      aggregateSpecsRun: aggregateResult.specsRun,
      profileUpdates: aggregateResult.profileUpdates,
    };
  },

  // REWARD stage: Compute reward scores
  REWARD: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);
    const rewardResult = await computeReward(ctx.callId, ctx.log);
    return {
      rewardScore: rewardResult.overallScore,
    };
  },

  // ADAPT stage: Compute personalized targets
  // Ops 1-3 are independent and run in parallel for latency savings
  ADAPT: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);

    // Idempotency: skip AI calls if targets already exist for this call
    if (!ctx.force) {
      const existingTargets = await prisma.callTarget.count({ where: { callId: ctx.callId } });
      if (existingTargets > 0) {
        ctx.log.info(`ADAPT skipped: ${existingTargets} targets already exist for call ${ctx.callId} (use force=true to re-run)`);
        return { callTargetsCreated: 0, skippedReason: "existing_targets" };
      }
    }

    const startTime = Date.now();

    // Run AI adapt, rule-based adapt, and goal extraction in parallel
    const [adaptSettled, ruleSettled, goalSettled] = await Promise.allSettled([
      // 1. AI-based adapt specs (creates CallTarget entries)
      runAdaptSpecs(ctx.callId, ctx.callerId, ctx.engine, ctx.guardrails, ctx.log),
      // 2. Rule-based adapt specs (creates/updates CallerTarget entries)
      runRuleBasedAdapt(ctx.callerId),
      // 3. Extract goals from transcript (GOAL-001)
      extractGoals(ctx.call, ctx.callerId, ctx.engine, ctx.log),
    ]);

    const adaptResult = adaptSettled.status === "fulfilled" ? adaptSettled.value : { targetsCreated: 0 };
    if (adaptSettled.status === "rejected") {
      ctx.log.error(`AI-based adapt failed (non-blocking)`, { error: adaptSettled.reason?.message || String(adaptSettled.reason) });
    }

    const ruleBasedResult = ruleSettled.status === "fulfilled" ? ruleSettled.value : { specsRun: 0, targetsCreated: 0, targetsUpdated: 0, errors: [] };
    if (ruleSettled.status === "rejected") {
      ctx.log.error(`Rule-based adapt failed (non-blocking)`, { error: ruleSettled.reason?.message || String(ruleSettled.reason) });
    } else {
      ctx.log.info(`Rule-based adapt completed`, {
        specsRun: ruleBasedResult.specsRun,
        targetsCreated: ruleBasedResult.targetsCreated,
        targetsUpdated: ruleBasedResult.targetsUpdated,
        errors: ruleBasedResult.errors
      });
    }

    const goalExtractionResult = goalSettled.status === "fulfilled" ? goalSettled.value : { goalsCreated: 0, goalsUpdated: 0, goalsSkipped: 0, errors: [] };
    if (goalSettled.status === "rejected") {
      ctx.log.error(`Goal extraction failed (non-blocking)`, { error: goalSettled.reason?.message || String(goalSettled.reason) });
    } else {
      ctx.log.info(`Goal extraction completed`, {
        goalsCreated: goalExtractionResult.goalsCreated,
        goalsUpdated: goalExtractionResult.goalsUpdated,
        goalsSkipped: goalExtractionResult.goalsSkipped,
        errors: goalExtractionResult.errors,
      });
    }

    // 4. Track goal progress — depends on extracted goals, runs after
    const goalResult = await trackGoalProgress(ctx.callerId, ctx.callId);
    ctx.log.info(`Goal tracking completed`, {
      goalsUpdated: goalResult.updated,
      goalsCompleted: goalResult.completed,
    });

    ctx.log.info(`ADAPT parallel ops completed in ${Date.now() - startTime}ms`);

    return {
      callTargetsCreated: adaptResult.targetsCreated,
      callerTargetsCreated: ruleBasedResult.targetsCreated,
      callerTargetsUpdated: ruleBasedResult.targetsUpdated,
      adaptSpecsRun: ruleBasedResult.specsRun,
      goalsExtracted: goalExtractionResult.goalsCreated,
      goalsUpdatedFromExtraction: goalExtractionResult.goalsUpdated,
      goalsSkipped: goalExtractionResult.goalsSkipped,
      goalsProgressUpdated: goalResult.updated,
      goalsCompleted: goalResult.completed,
    };
  },

  // SUPERVISE stage: Validate and clamp targets
  SUPERVISE: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);
    const validateResult = await validateTargets(ctx.callId, ctx.guardrails, ctx.log);
    const callerTargetResult = await aggregateCallerTargets(ctx.callId, ctx.callerId, ctx.guardrails, ctx.log);
    return {
      targetsValidated: validateResult.adjustments,
      callerTargetsAggregated: callerTargetResult.aggregated,
    };
  },

  // COMPOSE stage: Build final prompt
  COMPOSE: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);

    // Direct function call — no HTTP self-call
    const { fullSpecConfig, sections, specSlug } = await loadComposeConfig();
    const composition = await executeComposition(ctx.callerId, sections, fullSpecConfig);
    const promptSummary = renderPromptSummary(composition.llmPrompt);

    const persisted = await persistComposedPrompt(composition, promptSummary, {
      callerId: ctx.callerId,
      triggerType: "pipeline",
      triggerCallId: ctx.callId,
      composeSpecSlug: specSlug,
      specConfig: fullSpecConfig,
    });

    ctx.log.info(`COMPOSE complete: ${persisted.prompt.length} chars, id=${persisted.id}`);

    return {
      promptId: persisted.id,
      promptLength: persisted.prompt.length,
      prompt: persisted.prompt,
    };
  },
};

/**
 * Run the pipeline using spec-driven stage configuration
 */
async function runSpecDrivenPipeline(ctx: PipelineContext): Promise<{
  summary: Record<string, any>;
  prompt?: string;
}> {
  const { pipelineStages: stages, mode, log } = ctx;

  log.info(`Running spec-driven pipeline with ${stages.length} stages`, {
    stages: stages.map((s) => s.name),
    mode,
  });

  // Validate spec dependencies before executing any stages
  // Load all active spec slugs that will be used in this pipeline run
  const allActiveSpecs = await prisma.analysisSpec.findMany({
    where: { isActive: true, isDirty: false },
    select: { slug: true },
  });
  const depValidation = await validateSpecDependencies(allActiveSpecs.map(s => s.slug));
  if (!depValidation.valid) {
    for (const warning of depValidation.warnings) {
      log.warn(`[dependency] ${warning}`);
    }
    if (depValidation.skipped.length > 0) {
      log.warn(`[dependency] ${depValidation.skipped.length} spec(s) have unsatisfied dependencies — they may produce incomplete results`);
    }
  }

  // Stages that can run in parallel (no dependencies between them)
  const parallelStages = new Set(["EXTRACT", "SCORE_AGENT"]);
  const stageErrors: string[] = [];

  // Execute stages - parallelize where possible
  // Stages are RESILIENT: failures are logged but don't stop the pipeline.
  // This ensures COMPOSE always runs even if earlier stages fail.
  let i = 0;
  while (i < stages.length) {
    const stage = stages[i];

    // Skip stages that require a specific mode
    if (stage.requiresMode && stage.requiresMode !== mode) {
      log.debug(`Skipping stage ${stage.name} (requires mode=${stage.requiresMode})`);
      i++;
      continue;
    }

    // Check if this and next stages can run in parallel
    const canParallelize = parallelStages.has(stage.name);
    const parallelBatch: PipelineStage[] = [];

    if (canParallelize) {
      // Collect consecutive parallelizable stages
      while (i < stages.length && parallelStages.has(stages[i].name)) {
        const s = stages[i];
        if (!s.requiresMode || s.requiresMode === mode) {
          parallelBatch.push(s);
        }
        i++;
      }
    }

    if (parallelBatch.length > 1) {
      // Run stages in parallel using allSettled so one failure doesn't block others
      log.info(`Running ${parallelBatch.length} stages in parallel: ${parallelBatch.map(s => s.name).join(", ")}`);
      const startTime = Date.now();

      const settled = await Promise.allSettled(
        parallelBatch.map(async (s) => {
          const executor = stageExecutors[s.name];
          if (!executor) {
            log.warn(`No executor for stage ${s.name} - skipping`);
            return {};
          }
          return executor(ctx, s);
        })
      );

      // Merge results from fulfilled stages, log rejected ones
      for (let j = 0; j < settled.length; j++) {
        const outcome = settled[j];
        if (outcome.status === "fulfilled") {
          Object.assign(ctx.results, outcome.value);
        } else {
          const stageName = parallelBatch[j].name;
          log.error(`Stage ${stageName} failed (non-blocking)`, { error: outcome.reason?.message || String(outcome.reason) });
          stageErrors.push(`${stageName}: ${outcome.reason?.message || "unknown error"}`);
        }
      }

      log.info(`Parallel stages completed in ${Date.now() - startTime}ms`);
    } else {
      // Run single stage — catch errors and continue
      const executor = stageExecutors[stage.name];
      if (!executor) {
        log.warn(`No executor for stage ${stage.name} - skipping`);
        i++;
        continue;
      }

      try {
        const stageResults = await executor(ctx, stage);
        Object.assign(ctx.results, stageResults);
      } catch (error: any) {
        log.error(`Stage ${stage.name} failed (non-blocking)`, { error: error.message });
        stageErrors.push(`${stage.name}: ${error.message}`);
      }
      i++;
    }
  }

  if (stageErrors.length > 0) {
    ctx.results.stageErrors = stageErrors;
    log.warn(`Pipeline completed with ${stageErrors.length} stage error(s)`, { stageErrors });
  }

  return {
    summary: ctx.results,
    prompt: ctx.results.prompt,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const log = createLogger();

  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { callId } = await params;
    const body = await request.json().catch(() => ({}));
    const { callerId, mode, engine: requestedEngine, force = false } = body;

    if (!callerId) {
      return NextResponse.json({ ok: false, error: "callerId is required", logs: log.getLogs() }, { status: 400 });
    }

    if (!mode || !["prep", "prompt"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "mode must be 'prep' or 'prompt'", logs: log.getLogs() }, { status: 400 });
    }

    // Validate engine - default to claude for real AI inference
    let engine: AIEngine = "claude";
    if (requestedEngine && ["mock", "claude", "openai"].includes(requestedEngine)) {
      engine = requestedEngine as AIEngine;
    }

    // Verify the engine is available (has API key configured)
    if (!isEngineAvailable(engine)) {
      if (engine !== "mock") {
        log.warn(`Engine "${engine}" not available (missing API key), falling back to mock`);
        engine = "mock";
      }
    }

    log.info("Pipeline started", { callId, callerId, mode, engine });

    // Load call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { id: true, transcript: true },
    });

    if (!call) {
      return NextResponse.json({ ok: false, error: "Call not found", logs: log.getLogs() }, { status: 404 });
    }

    // =====================================================
    // LOAD GUARDRAILS & PIPELINE CONFIG
    // =====================================================
    const guardrails = await loadGuardrails(log);
    const pipelineStages = await loadPipelineStages(log);

    // =====================================================
    // SPEC-DRIVEN PIPELINE EXECUTION
    // Stages are loaded from PIPELINE-001 spec (or GUARD-001 fallback)
    // =====================================================

    const pipelineCtx: PipelineContext = {
      callId,
      callerId,
      call,
      engine,
      guardrails,
      pipelineStages,
      mode: mode as "prep" | "prompt",
      force,
      log,
      request,
      results: {},
    };

    const { summary, prompt } = await runSpecDrivenPipeline(pipelineCtx);

    if (mode === "prep") {
      log.info("Prep complete", summary);
      return NextResponse.json({
        ok: true,
        mode: "prep",
        message: `Prep complete: ${summary.scoresCreated || 0} scores, ${summary.memoriesCreated || 0} memories, ${summary.callTargetsCreated || 0} targets, ${summary.agentMeasurements || 0} agent measurements`,
        data: summary,
        logs: log.getLogs(),
        duration: log.getDuration(),
      });
    }

    // Mode is "prompt" - COMPOSE stage was already run by spec-driven pipeline
    log.info("Prompt mode complete");

    return NextResponse.json({
      ok: true,
      mode: "prompt",
      message: `Full pipeline complete with prompt`,
      data: summary,
      prompt,
      logs: log.getLogs(),
      duration: log.getDuration(),
    });

  } catch (error: any) {
    log.error("Pipeline failed", { error: error.message, stack: error.stack });
    return NextResponse.json({
      ok: false,
      error: error.message,
      logs: log.getLogs(),
      duration: log.getDuration(),
    }, { status: 500 });
  }
  // NOTE: Do NOT call prisma.$disconnect() in API routes - it breaks the shared client
}
