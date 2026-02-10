/**
 * POST /api/calls/[callId]/pipeline
 *
 * SPEC-DRIVEN pipeline endpoint that runs analysis in configurable stages.
 *
 * Pipeline stages are loaded from the SUPERVISE spec (GUARD-001), not hardcoded.
 * Each stage has:
 *   - name: Executor function name (e.g., "EXTRACT", "ADAPT")
 *   - order: Execution order (10, 20, 30...)
 *   - outputTypes: Which spec outputTypes are processed in this stage
 *   - requiresMode: Optional - skip stage unless mode matches
 *
 * Default stages (configurable in GUARD-001 spec):
 *   10. EXTRACT    - Learn + Measure caller data (batched)
 *   20. SCORE_AGENT - Measure behaviour (batched)
 *   30. AGGREGATE  - Aggregate personality profiles
 *   40. REWARD     - Compute reward scores
 *   50. ADAPT      - Compute personalized targets
 *   60. SUPERVISE  - Validate and clamp targets
 *  100. COMPOSE    - Build final prompt (mode="prompt" only)
 *
 * Request body:
 * - callerId: string (required)
 * - mode: "prep" | "prompt" (required)
 *   - prep: Run all stages except COMPOSE
 *   - prompt: Run all stages including COMPOSE
 * - engine: "mock" | "claude" | "openai" (optional, defaults to "claude")
 */

import { NextRequest, NextResponse } from "next/server";
import { MemoryCategory } from "@prisma/client";
import { AIEngine, isEngineAvailable } from "@/lib/ai/client";
import { getMeteredAICompletion, logMockAIUsage } from "@/lib/metering";
import { prisma } from "@/lib/prisma";
import { runAggregateSpecs } from "@/lib/pipeline/aggregate-runner";
import { runAdaptSpecs as runRuleBasedAdapt } from "@/lib/pipeline/adapt-runner";
import { trackGoalProgress } from "@/lib/goals/track-progress";
import { extractGoals } from "@/lib/goals/extract-goals";
import { loadPipelineStages, PipelineStage } from "@/lib/pipeline/config";
import { logAI } from "@/lib/logger";
import { TRAITS } from "@/lib/registry";

// =====================================================
// TRANSCRIPT LIMITS (from AIConfig)
// =====================================================

// Default transcript limits (in characters) per stage
const DEFAULT_TRANSCRIPT_LIMITS: Record<string, number> = {
  "pipeline.measure": 4000,
  "pipeline.learn": 4000,
  "pipeline.score_agent": 4000,
  "pipeline.adapt": 2500,
};

/**
 * Get transcript limit for a call point from AIConfig, with fallback to defaults
 */
async function getTranscriptLimit(callPoint: string): Promise<number> {
  try {
    const config = await prisma.aIConfig.findUnique({
      where: { callPoint },
    });
    // Use type assertion since Prisma types may be stale after migration
    const limit = (config as any)?.transcriptLimit;
    if (limit && typeof limit === "number") {
      return limit;
    }
  } catch {
    // Fallback to default on error
  }
  return DEFAULT_TRANSCRIPT_LIMITS[callPoint] ?? 4000;
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

  // TODO: System spec toggles not yet implemented - PlaybookSpec model doesn't exist
  // For now, include all system specs
  log.info(`Loaded ${allSystemSpecs.length} SYSTEM specs (system spec toggles not yet implemented)`, {
    outputTypes,
    playbookId,
  });

  return allSystemSpecs;
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
function buildBatchedCallerPrompt(
  transcript: string,
  measureParams: Array<{ parameterId: string; name: string; definition: string | null }>,
  learnActions: Array<{ category: string; keyPrefix: string; keyHint: string; description: string }>,
  transcriptLimit: number = 4000
): string {
  const paramList = measureParams.map(p => `${p.parameterId}:${p.name}`).join("|");
  const learnList = learnActions.map(a => `${a.category}:${a.description}`).join("|");

  return `Analyze transcript. Score caller 0-1 on params, extract facts.

TRANSCRIPT (analyze this):
${transcript.slice(0, transcriptLimit)}

PARAMS TO SCORE: ${paramList}

FACTS TO FIND: ${learnList}

Return compact JSON:
{"scores":{"PARAM-ID":{"s":0.75,"c":0.8},...},"memories":[{"cat":"FACT","key":"k","val":"v","c":0.9},...]}`;
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
  log.info(`Batched caller analysis`, { params: measureParams.length, learnActions: learnActions.length });

  if (measureParams.length === 0 && learnActions.length === 0) {
    log.warn("No MEASURE or LEARN specs found");
    return { scoresCreated: 0, memoriesCreated: 0, playbookUsed: playbookName };
  }

  let scoresCreated = 0;
  let memoriesCreated = 0;

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
    // Real AI: single batched call
    const transcriptLimit = await getTranscriptLimit("pipeline.measure");
    const prompt = buildBatchedCallerPrompt(transcript, measureParams, learnActions, transcriptLimit);

    try {
      const result = await getMeteredAICompletion({
        engine,
        messages: [
          { role: "system", content: "You are an expert behavioral analyst. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        maxTokens: 2048,
        temperature: 0.3,
      }, { callId: call.id, callerId, sourceOp: "pipeline:extract" });

      logAI("pipeline:extract", prompt, result.content, { usage: result.usage, callId: call.id, callerId });
      log.debug("AI caller analysis response", { model: result.model, tokens: result.usage });

      // Parse response
      let jsonContent = result.content.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // Sanitize JSON - fix unterminated fractional numbers
      jsonContent = jsonContent.replace(/(\d+\.)(?=\s*[,}\]]|$)/g, (_match, num) => num + '0');

      // Try parsing with recovery if needed
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseError) {
        log.warn("JSON parse failed in EXTRACT, attempting recovery", { contentLength: jsonContent.length });
        let fixed = jsonContent;

        // Remove incomplete trailing entries (everything after the last complete key-value pair)
        // Strategy: Remove everything from the last comma to the end if it's incomplete
        // First, check if there's an odd number of quotes (indicating unterminated string)
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // Odd number of quotes - find and remove the incomplete entry
          // Remove from the last comma before the unterminated quote to the end
          fixed = fixed.replace(/,\s*[^,]*$/g, '');
        }

        // Remove trailing commas before closing braces/brackets
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

        // Fix incomplete key-value pairs
        fixed = fixed.replace(/["']([^"']+)["']\s*:\s*$/g, '"$1": 0.5');

        // Count and add missing closing characters
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;

        for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) fixed += "}";

        try {
          parsed = JSON.parse(fixed);
          log.info("EXTRACT JSON recovery successful");
        } catch {
          throw parseError;
        }
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

      log.info(`AI caller analysis complete`, { scoresCreated, memoriesCreated });
    } catch (error: any) {
      log.error("AI caller analysis failed", { error: error.message });
      throw error;
    }
  }

  return { scoresCreated, memoriesCreated, playbookUsed: playbookName };
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
          data: { actualValue, confidence: 0.75, evidence: ["Mock batched"] },
        });
      } else {
        await prisma.behaviorMeasurement.create({
          data: { callId: call.id, parameterId: param.parameterId, actualValue, confidence: 0.75, evidence: ["Mock batched"] },
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
    // Real AI: single batched call
    const transcriptLimit = await getTranscriptLimit("pipeline.score_agent");
    const prompt = buildBatchedAgentPrompt(transcript, agentParams, transcriptLimit);

    try {
      // More tokens for agent analysis with many parameters
      // ~100 tokens per param (score + confidence + evidence array)
      // Add 25% buffer to prevent truncation
      const estimatedTokens = Math.max(2048, Math.ceil(agentParams.length * 150));

      const result = await getMeteredAICompletion({
        engine,
        messages: [
          { role: "system", content: "You are an expert at evaluating conversational AI behavior. Always respond with valid JSON. Keep evidence arrays brief (1-2 short quotes max per parameter)." },
          { role: "user", content: prompt },
        ],
        maxTokens: estimatedTokens,
        temperature: 0.3,
      }, { callId: call.id, callerId, sourceOp: "pipeline:score_agent" });

      logAI("pipeline:score_agent", prompt, result.content, { usage: result.usage, callId: call.id, callerId });
      log.debug("AI agent analysis response", { model: result.model, contentLength: result.content.length });

      let jsonContent = result.content.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // Try to recover truncated JSON by adding closing braces if needed
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseError) {
        log.warn("JSON parse failed, attempting recovery", { contentLength: jsonContent.length });
        // Try to fix truncated JSON
        let fixed = jsonContent;

        // Fix unterminated fractional numbers (e.g., "0." -> "0.0")
        // Match patterns like: 0., 1., etc at end of string or before closing brace/bracket
        fixed = fixed.replace(/(\d+\.)(?=\s*[,}\]]|$)/g, (_match, num) => num + '0');

        // Remove incomplete trailing entries (everything after the last complete key-value pair)
        // Strategy: Remove everything from the last comma to the end if it's incomplete
        // First, check if there's an odd number of quotes (indicating unterminated string)
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // Odd number of quotes - find and remove the incomplete entry
          // Remove from the last comma before the unterminated quote to the end
          fixed = fixed.replace(/,\s*[^,]*$/g, '');
        }

        // Remove trailing commas before closing braces/brackets
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

        // Fix incomplete key-value pairs at end (e.g., {"key": or "key")
        // If JSON ends with a key but no value, add a default value
        fixed = fixed.replace(/["']([^"']+)["']\s*:\s*$/g, '"$1": 0.5');
        fixed = fixed.replace(/["']([^"']+)["']\s*:\s*\{\s*["']([^"']+)["']\s*$/g, '"$1": {"$2": 0.5');

        // Count open vs close braces
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;

        // Add missing closing characters
        for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) fixed += "}";

        try {
          parsed = JSON.parse(fixed);
          log.info("JSON recovery successful");
        } catch {
          // Still failed - throw original error
          throw parseError;
        }
      }

      if (parsed.scores) {
        for (const [parameterId, scoreData] of Object.entries(parsed.scores as Record<string, any>)) {
          // Handle both full and compact keys: score/s, confidence/c, evidence/e
          const actualValue = Math.max(0, Math.min(1, scoreData.score ?? scoreData.s ?? 0.5));
          const confidence = Math.max(0, Math.min(1, scoreData.confidence ?? scoreData.c ?? 0.7));
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
  const config = (aggregateSpec?.config as any) || {};
  const traitMapping: Record<string, string> = config.traitMapping || {
    [TRAITS.B5_O]: "openness",
    [TRAITS.B5_C]: "conscientiousness",
    [TRAITS.B5_E]: "extraversion",
    [TRAITS.B5_A]: "agreeableness",
    [TRAITS.B5_N]: "neuroticism",
  };
  const halfLifeDays: number = config.halfLifeDays || 30;
  const defaultConfidence: number = config.defaultConfidence || 0.7;
  const defaultDecayFactor: number = config.defaultDecayFactor || 1.0;

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

  const config = (superviseSpec.config as any) || {};
  const parameters: Array<{ id: string; config?: any }> = config.parameters || [];

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
      maxRetries: aiConfig.maxRetries ?? DEFAULT_GUARDRAILS.aiSettings.maxRetries,
    },
    aggregation: {
      decayHalfLifeDays: aggConfig.decayHalfLifeDays ?? DEFAULT_GUARDRAILS.aggregation.decayHalfLifeDays,
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
    // Real AI: compute targets
    const transcriptLimit = await getTranscriptLimit("pipeline.adapt");
    const prompt = buildAdaptPrompt(
      call?.transcript || "",
      callScores,
      callerProfile?.parameterValues as Record<string, any> | null,
      targetParams,
      transcriptLimit
    );

    try {
      const result = await getMeteredAICompletion({
        engine,
        messages: [
          { role: "system", content: "You are an expert at personalizing AI behaviour based on caller profiles. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        maxTokens: 1024,
        temperature: aiSettings.temperature,
      }, { callId, callerId, sourceOp: "pipeline:adapt" });

      logAI("pipeline:adapt", prompt, result.content, { usage: result.usage, callId, callerId });
      let jsonContent = result.content.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // Sanitize JSON - fix unterminated fractional numbers
      jsonContent = jsonContent.replace(/(\d+\.)(?=\s*[,}\]]|$)/g, (_match, num) => num + '0');

      // Try parsing with recovery if needed
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseError) {
        log.warn("JSON parse failed in ADAPT, attempting recovery", { contentLength: jsonContent.length });
        let fixed = jsonContent;

        // Remove incomplete trailing entries (everything after the last complete key-value pair)
        // Strategy: Remove everything from the last comma to the end if it's incomplete
        // First, check if there's an odd number of quotes (indicating unterminated string)
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // Odd number of quotes - find and remove the incomplete entry
          // Remove from the last comma before the unterminated quote to the end
          fixed = fixed.replace(/,\s*[^,]*$/g, '');
        }

        // Remove trailing commas before closing braces/brackets
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

        // Fix incomplete key-value pairs
        fixed = fixed.replace(/["']([^"']+)["']\s*:\s*$/g, '"$1": 0.5');
        fixed = fixed.replace(/["']([^"']+)["']\s*:\s*\{\s*["']([^"']+)["']\s*$/g, '"$1": {"$2": 0.5');

        // Count and add missing closing characters
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;

        for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) fixed += "}";

        try {
          parsed = JSON.parse(fixed);
          log.info("ADAPT JSON recovery successful", {
            originalLength: jsonContent.length,
            fixedLength: fixed.length
          });
        } catch (recoveryError: any) {
          log.error("ADAPT JSON recovery also failed", {
            originalError: (parseError as Error).message,
            recoveryError: recoveryError.message,
            lastChars: fixed.slice(-200)
          });
          throw parseError;
        }
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
    const callerResult = await runBatchedCallerAnalysis(ctx.call, ctx.callerId, ctx.engine, ctx.log);
    const deltaResult = await computeAdapt(ctx.callId, ctx.callerId, ctx.log);
    return {
      playbookUsed: callerResult.playbookUsed,
      scoresCreated: callerResult.scoresCreated,
      memoriesCreated: callerResult.memoriesCreated,
      deltasComputed: deltaResult.deltasComputed,
    };
  },

  // SCORE_AGENT stage: Score agent behavior (batched)
  SCORE_AGENT: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);
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
  ADAPT: async (ctx, stage) => {
    ctx.log.info(`Stage ${stage.name}: ${stage.description}`);

    // 1. Run AI-based adapt specs (creates CallTarget entries)
    const adaptResult = await runAdaptSpecs(ctx.callId, ctx.callerId, ctx.engine, ctx.guardrails, ctx.log);

    // 2. Run rule-based adapt specs (creates/updates CallerTarget entries based on learner profile)
    const ruleBasedResult = await runRuleBasedAdapt(ctx.callerId);
    ctx.log.info(`Rule-based adapt completed`, {
      specsRun: ruleBasedResult.specsRun,
      targetsCreated: ruleBasedResult.targetsCreated,
      targetsUpdated: ruleBasedResult.targetsUpdated,
      errors: ruleBasedResult.errors
    });

    // 3. Extract goals from transcript (GOAL-001)
    const goalExtractionResult = await extractGoals(ctx.call, ctx.callerId, ctx.engine, ctx.log);
    ctx.log.info(`Goal extraction completed`, {
      goalsCreated: goalExtractionResult.goalsCreated,
      goalsUpdated: goalExtractionResult.goalsUpdated,
      goalsSkipped: goalExtractionResult.goalsSkipped,
      errors: goalExtractionResult.errors,
    });

    // 4. Track goal progress based on call outcomes
    const goalResult = await trackGoalProgress(ctx.callerId, ctx.callId);
    ctx.log.info(`Goal tracking completed`, {
      goalsUpdated: goalResult.updated,
      goalsCompleted: goalResult.completed,
    });

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
    // Build base URL from request headers
    const host = ctx.request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    const internalSecret = process.env.INTERNAL_API_SECRET || "hf-internal-dev-secret";

    const composeResult = await fetch(`${baseUrl}/api/callers/${ctx.callerId}/compose-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ triggerCallId: ctx.callId }),
    });
    const composeData = await composeResult.json();

    if (!composeData.ok) {
      throw new Error(`Prompt composition failed: ${composeData.error}`);
    }

    return {
      promptId: composeData.id,
      promptLength: composeData.prompt?.length || 0,
      prompt: composeData.prompt,
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

  // Stages that can run in parallel (no dependencies between them)
  const parallelStages = new Set(["EXTRACT", "SCORE_AGENT"]);

  // Execute stages - parallelize where possible
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
      // Run stages in parallel
      log.info(`Running ${parallelBatch.length} stages in parallel: ${parallelBatch.map(s => s.name).join(", ")}`);
      const startTime = Date.now();

      try {
        const results = await Promise.all(
          parallelBatch.map(async (s) => {
            const executor = stageExecutors[s.name];
            if (!executor) {
              log.warn(`No executor for stage ${s.name} - skipping`);
              return {};
            }
            return executor(ctx, s);
          })
        );

        // Merge all results
        for (const result of results) {
          Object.assign(ctx.results, result);
        }

        log.info(`Parallel stages completed in ${Date.now() - startTime}ms`);
      } catch (error: any) {
        log.error(`Parallel stages failed`, { error: error.message });
        throw error;
      }
    } else {
      // Run single stage
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
        log.error(`Stage ${stage.name} failed`, { error: error.message });
        throw error;
      }
      i++;
    }
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
    const { callId } = await params;
    const body = await request.json().catch(() => ({}));
    const { callerId, mode, engine: requestedEngine } = body;

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
