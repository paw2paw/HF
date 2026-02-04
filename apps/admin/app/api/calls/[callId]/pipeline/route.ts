/**
 * POST /api/calls/[callId]/pipeline
 *
 * Unified pipeline endpoint that runs the full analysis in batched AI calls.
 *
 * Pipeline Stages (in order):
 *   1. LEARN  - Extract data about the caller (memories, personality scores)
 *   2. MEASURE - Score agent behavior in the call
 *   3. ADAPT  - Compute personalized targets for next call
 *   4. COMPOSE - Build the final prompt (optional, mode="prompt")
 *
 * Request body:
 * - callerId: string (required)
 * - mode: "prep" | "prompt" (required)
 *   - prep: Run LEARN + MEASURE + ADAPT stages
 *   - prompt: Run prep + COMPOSE stage
 * - engine: "mock" | "claude" | "openai" (optional, defaults to "claude")
 */

import { NextRequest, NextResponse } from "next/server";
import { MemoryCategory } from "@prisma/client";
import { getAICompletion, AIEngine, isEngineAvailable } from "@/lib/ai/client";
import { prisma } from "@/lib/prisma";

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
  learnActions: Array<{ category: string; keyPrefix: string; keyHint: string; description: string }>
): string {
  const lines: string[] = [
    `You are analyzing a call transcript to:`,
    `1. Score the CALLER on multiple behavioral/personality parameters`,
    `2. Extract facts and preferences about the caller`,
    ``,
    `# TRANSCRIPT`,
    ``,
    transcript.slice(0, 6000),
    ``,
    `# PARAMETERS TO SCORE`,
    `Score each parameter from 0.0 to 1.0 based on evidence from the transcript.`,
    ``,
  ];

  for (const param of measureParams) {
    lines.push(`- ${param.parameterId}: ${param.name}`);
    if (param.definition) {
      lines.push(`  Definition: ${param.definition}`);
    }
  }

  lines.push(``);
  lines.push(`# FACTS TO EXTRACT`);
  lines.push(`Look for information matching these categories:`);
  lines.push(``);

  for (const action of learnActions) {
    lines.push(`- ${action.category}: ${action.description}`);
    if (action.keyPrefix) lines.push(`  Key prefix: ${action.keyPrefix}`);
    if (action.keyHint) lines.push(`  Hint: ${action.keyHint}`);
  }

  lines.push(``);
  lines.push(`# OUTPUT FORMAT`);
  lines.push(`Return JSON with this exact structure:`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "scores": {`);
  lines.push(`    "PARAM-ID": { "score": 0.75, "confidence": 0.8, "reasoning": "brief explanation" },`);
  lines.push(`    ...`);
  lines.push(`  },`);
  lines.push(`  "memories": [`);
  lines.push(`    { "category": "FACT", "key": "location", "value": "London", "evidence": "I live in London", "confidence": 0.9 },`);
  lines.push(`    ...`);
  lines.push(`  ]`);
  lines.push(`}`);
  lines.push("```");
  lines.push(``);
  lines.push(`Only include memories you found clear evidence for. Return empty arrays if nothing found.`);

  return lines.join("\n");
}

/**
 * Build a BATCHED prompt for MEASURE specs
 * This scores all agent behavior parameters in ONE AI call
 */
function buildBatchedAgentPrompt(
  transcript: string,
  agentParams: Array<{ parameterId: string; name: string; definition: string | null }>
): string {
  const lines: string[] = [
    `You are evaluating the AGENT's behavior in this call transcript.`,
    `Score how well the agent performed on each behavioral dimension.`,
    ``,
    `# TRANSCRIPT`,
    ``,
    transcript.slice(0, 6000),
    ``,
    `# AGENT BEHAVIORS TO SCORE`,
    `Score each from 0.0 (poor) to 1.0 (excellent):`,
    ``,
  ];

  for (const param of agentParams) {
    lines.push(`- ${param.parameterId}: ${param.name}`);
    if (param.definition) {
      lines.push(`  ${param.definition}`);
    }
  }

  lines.push(``);
  lines.push(`# OUTPUT FORMAT`);
  lines.push(`Return COMPACT JSON (no extra whitespace):`);
  lines.push("```json");
  lines.push(`{"scores":{"PARAM-ID":{"score":0.75,"confidence":0.8,"evidence":["brief quote"]},...}}`);
  lines.push("```");
  lines.push(`Keep evidence to ONE short quote per parameter to save space.`);

  return lines.join("\n");
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

  // Collect unique parameters to score
  const paramMap = new Map<string, { parameterId: string; name: string; definition: string | null }>();
  for (const spec of measureSpecs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId && !paramMap.has(action.parameterId)) {
          const param = await prisma.parameter.findUnique({
            where: { parameterId: action.parameterId },
            select: { parameterId: true, name: true, definition: true },
          });
          if (param) {
            paramMap.set(param.parameterId, param);
          }
        }
      }
    }
  }

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
    log.info(`Mock caller analysis complete`, { scoresCreated });
  } else {
    // Real AI: single batched call
    const prompt = buildBatchedCallerPrompt(transcript, measureParams, learnActions);

    try {
      const result = await getAICompletion({
        engine,
        messages: [
          { role: "system", content: "You are an expert behavioral analyst. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        maxTokens: 2048,
        temperature: 0.3,
      });

      log.debug("AI caller analysis response", { model: result.model, tokens: result.usage });

      // Parse response
      let jsonContent = result.content.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(jsonContent);

      // Store scores
      if (parsed.scores) {
        for (const [parameterId, scoreData] of Object.entries(parsed.scores as Record<string, any>)) {
          const score = Math.max(0, Math.min(1, scoreData.score || 0.5));
          const confidence = Math.max(0, Math.min(1, scoreData.confidence || 0.7));

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
                evidence: [scoreData.reasoning || "AI batched analysis"],
                scoredBy: `${engine}_batched_v1`,
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
                evidence: [scoreData.reasoning || "AI batched analysis"],
                scoredBy: `${engine}_batched_v1`,
              },
            });
          }
          scoresCreated++;
        }
      }

      // Store memories
      if (parsed.memories && Array.isArray(parsed.memories)) {
        for (const mem of parsed.memories) {
          if (mem.category && mem.key && mem.value) {
            // Map LLM category to valid MemoryCategory enum
            const mappedCategory = mapToMemoryCategory(mem.category);

            await prisma.callerMemory.create({
              data: {
                callerId,
                callId: call.id,
                category: mappedCategory,
                key: mem.key,
                value: mem.value,
                evidence: mem.evidence || "AI extraction",
                confidence: mem.confidence || 0.8,
                extractedBy: `${engine}_batched_v1`,
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

  // Collect unique agent parameters
  const paramMap = new Map<string, { parameterId: string; name: string; definition: string | null }>();
  for (const spec of agentSpecs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId && !paramMap.has(action.parameterId)) {
          const param = await prisma.parameter.findUnique({
            where: { parameterId: action.parameterId },
            select: { parameterId: true, name: true, definition: true },
          });
          if (param) {
            paramMap.set(param.parameterId, param);
          }
        }
      }
    }
  }

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
  } else {
    // Real AI: single batched call
    const prompt = buildBatchedAgentPrompt(transcript, agentParams);

    try {
      // More tokens for agent analysis with many parameters
      // ~100 tokens per param (score + confidence + evidence array)
      const estimatedTokens = Math.max(2048, agentParams.length * 120);

      const result = await getAICompletion({
        engine,
        messages: [
          { role: "system", content: "You are an expert at evaluating conversational AI behavior. Always respond with valid JSON. Keep evidence arrays brief (1-2 short quotes max per parameter)." },
          { role: "user", content: prompt },
        ],
        maxTokens: estimatedTokens,
        temperature: 0.3,
      });

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
        // Try to fix truncated JSON - add closing braces
        let fixed = jsonContent;
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
          const actualValue = Math.max(0, Math.min(1, scoreData.score || 0.5));
          const confidence = Math.max(0, Math.min(1, scoreData.confidence || 0.7));
          const evidence = Array.isArray(scoreData.evidence) ? scoreData.evidence : [scoreData.evidence || "AI analysis"];

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
    "B5-O": "openness",
    "B5-C": "conscientiousness",
    "B5-E": "extraversion",
    "B5-A": "agreeableness",
    "B5-N": "neuroticism",
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
// ADAPT & SUPERVISE SPEC RUNNERS
// =====================================================

/**
 * Build prompt for ADAPT specs to compute personalized targets
 */
function buildAdaptPrompt(
  transcript: string,
  callScores: Array<{ parameterId: string; score: number; confidence: number }>,
  callerProfile: Record<string, any> | null,
  targetParams: Array<{ parameterId: string; name: string; definition: string | null }>
): string {
  const lines: string[] = [
    `You are computing personalized behavioral targets for an AI agent's next interaction with this caller.`,
    `Based on the caller's personality scores and the current call analysis, determine optimal target values.`,
    ``,
    `# TRANSCRIPT SUMMARY`,
    transcript.slice(0, 3000),
    ``,
    `# CALLER PERSONALITY SCORES (0-1 scale)`,
  ];

  for (const score of callScores) {
    lines.push(`- ${score.parameterId}: ${score.score.toFixed(2)} (confidence: ${score.confidence.toFixed(2)})`);
  }

  if (callerProfile) {
    lines.push(``);
    lines.push(`# CALLER PROFILE`);
    lines.push(JSON.stringify(callerProfile, null, 2).slice(0, 1000));
  }

  lines.push(``);
  lines.push(`# TARGET PARAMETERS TO COMPUTE`);
  lines.push(`For each parameter, compute an optimal target value (0.0-1.0) for the AGENT to exhibit:`);
  lines.push(``);

  for (const param of targetParams) {
    lines.push(`- ${param.parameterId}: ${param.name}`);
    if (param.definition) lines.push(`  ${param.definition}`);
  }

  lines.push(``);
  lines.push(`# OUTPUT FORMAT`);
  lines.push(`Return JSON:`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "targets": {`);
  lines.push(`    "PARAM-ID": { "value": 0.65, "confidence": 0.8, "reasoning": "brief explanation" },`);
  lines.push(`    ...`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push("```");

  return lines.join("\n");
}

/**
 * Run ADAPT specs to compute personalized CallTargets
 * These specs compute what target values the agent should aim for based on caller profile
 */
async function runAdaptSpecs(
  callId: string,
  callerId: string,
  engine: AIEngine,
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

  // Collect unique parameters that ADAPT specs compute targets for
  const paramMap = new Map<string, { parameterId: string; name: string; definition: string | null }>();
  for (const spec of fullSpecs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId && !paramMap.has(action.parameterId)) {
          const param = await prisma.parameter.findUnique({
            where: { parameterId: action.parameterId },
            select: { parameterId: true, name: true, definition: true },
          });
          if (param) paramMap.set(param.parameterId, param);
        }
      }
    }
  }

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

  if (engine === "mock") {
    // Mock: compute targets as slight adjustments from call scores
    for (const param of targetParams) {
      const callScore = callScores.find(s => s.parameterId === param.parameterId);
      // Target is based on caller score with some adjustment toward middle
      const baseValue = callScore?.score ?? 0.5;
      const targetValue = baseValue + (0.5 - baseValue) * 0.2; // Nudge 20% toward center

      await prisma.callTarget.upsert({
        where: { callId_parameterId: { callId, parameterId: param.parameterId } },
        create: {
          callId,
          parameterId: param.parameterId,
          targetValue,
          confidence: 0.7,
          sourceSpecSlug: "mock_adapt",
          reasoning: "Mock adaptation based on caller score",
        },
        update: {
          targetValue,
          confidence: 0.7,
          sourceSpecSlug: "mock_adapt",
          reasoning: "Mock adaptation based on caller score",
        },
      });
      targetsCreated++;
    }
  } else {
    // Real AI: compute targets
    const prompt = buildAdaptPrompt(
      call?.transcript || "",
      callScores,
      callerProfile?.parameterValues as Record<string, any> | null,
      targetParams
    );

    try {
      const result = await getAICompletion({
        engine,
        messages: [
          { role: "system", content: "You are an expert at personalizing AI agent behavior based on caller profiles. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        maxTokens: 1024,
        temperature: 0.3,
      });

      let jsonContent = result.content.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(jsonContent);

      if (parsed.targets) {
        for (const [parameterId, targetData] of Object.entries(parsed.targets as Record<string, any>)) {
          const targetValue = Math.max(0, Math.min(1, targetData.value || 0.5));
          const confidence = Math.max(0, Math.min(1, targetData.confidence || 0.7));

          await prisma.callTarget.upsert({
            where: { callId_parameterId: { callId, parameterId } },
            create: {
              callId,
              parameterId,
              targetValue,
              confidence,
              sourceSpecSlug: `${engine}_adapt`,
              reasoning: targetData.reasoning || "AI-computed target",
            },
            update: {
              targetValue,
              confidence,
              sourceSpecSlug: `${engine}_adapt`,
              reasoning: targetData.reasoning || "AI-computed target",
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
 * Validate/clamp targets to safe ranges (hardcoded guardrails)
 * Keeps targets within 0.2-0.8 to avoid extremes
 */
async function validateTargets(
  callId: string,
  log: ReturnType<typeof createLogger>
): Promise<{ adjustments: number }> {
  const targets = await prisma.callTarget.findMany({
    where: { callId },
  });

  if (targets.length === 0) {
    return { adjustments: 0 };
  }

  // Clamp targets to safe range (avoid extremes)
  let adjustments = 0;
  for (const target of targets) {
    let newValue = target.targetValue;
    let adjusted = false;

    if (newValue < 0.2) {
      newValue = 0.2;
      adjusted = true;
    } else if (newValue > 0.8) {
      newValue = 0.8;
      adjusted = true;
    }

    if (adjusted) {
      await prisma.callTarget.update({
        where: { id: target.id },
        data: {
          targetValue: newValue,
          reasoning: `${target.reasoning || ""} [clamped to safe range]`.trim(),
        },
      });
      adjustments++;
    }
  }

  log.info(`Targets validated`, { adjustments });
  return { adjustments };
}

/**
 * Aggregate CallTargets to CallerTargets (moving average for prompt composition)
 */
async function aggregateCallerTargets(
  callId: string,
  callerId: string,
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

  // Compute weighted average with time decay (30-day half-life)
  const halfLifeDays = 30;
  const now = new Date();
  let aggregated = 0;

  for (const [parameterId, targets] of Object.entries(byParameter)) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const t of targets) {
      const ageMs = now.getTime() - t.date.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decayWeight = Math.exp((-Math.log(2) * ageDays) / halfLifeDays);
      const weight = decayWeight * t.confidence;

      weightedSum += t.value * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      const avgValue = weightedSum / totalWeight;

      await prisma.callerTarget.upsert({
        where: { callerId_parameterId: { callerId, parameterId } },
        create: {
          callerId,
          parameterId,
          targetValue: avgValue,
          confidence: Math.min(0.95, 0.5 + targets.length * 0.1), // Confidence grows with more data
          callsUsed: targets.length,
          lastUpdatedAt: now,
          decayHalfLife: halfLifeDays,
        },
        update: {
          targetValue: avgValue,
          confidence: Math.min(0.95, 0.5 + targets.length * 0.1),
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
    // PIPELINE EXECUTION
    // Order: LEARN → MEASURE → ADAPT (→ COMPOSE if mode="prompt")
    // =====================================================

    // ===== LEARN STAGE =====
    // Extract data about the caller (memories, personality scores)
    log.info("LEARN: Extracting caller data");
    const callerResult = await runBatchedCallerAnalysis(call, callerId, engine, log);
    const deltaResult = await computeAdapt(callId, callerId, log);
    const personalityResult = await aggregatePersonality(callId, callerId, log);

    // ===== MEASURE STAGE =====
    // Score agent behavior in the call
    log.info("MEASURE: Scoring agent behavior");
    const agentResult = await runBatchedAgentAnalysis(call, callerId, engine, log);
    const rewardResult = await computeReward(callId, log);

    // ===== ADAPT STAGE =====
    // Compute personalized targets for next call
    log.info("ADAPT: Computing personalized targets");
    const adaptResult = await runAdaptSpecs(callId, callerId, engine, log);
    const validateResult = await validateTargets(callId, log);
    const callerTargetResult = await aggregateCallerTargets(callId, callerId, log);

    // Summary for prep mode
    const summary = {
      playbookUsed: callerResult.playbookUsed,
      scoresCreated: callerResult.scoresCreated,
      memoriesCreated: callerResult.memoriesCreated,
      deltasComputed: deltaResult.deltasComputed,
      callTargetsCreated: adaptResult.targetsCreated,
      targetsValidated: validateResult.adjustments,
      callerTargetsAggregated: callerTargetResult.aggregated,
      agentMeasurements: agentResult.measurementsCreated,
      rewardScore: rewardResult.overallScore,
      personalityObservationCreated: personalityResult.observationCreated,
      personalityProfileUpdated: personalityResult.profileUpdated,
    };

    if (mode === "prep") {
      log.info("Prep complete", summary);
      return NextResponse.json({
        ok: true,
        mode: "prep",
        message: `Prep complete: ${summary.scoresCreated} scores, ${summary.memoriesCreated} memories, ${summary.callTargetsCreated} targets, ${summary.agentMeasurements} agent measurements`,
        data: summary,
        logs: log.getLogs(),
        duration: log.getDuration(),
      });
    }

    // Mode is "prompt" - compose the prompt
    log.info("Step 9: Compose prompt");

    // Call the compose-prompt endpoint logic
    const composeResult = await fetch(`${request.nextUrl.origin}/api/callers/${callerId}/compose-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggerCallId: callId }),
    });

    const composeData = await composeResult.json();

    if (!composeData.ok) {
      log.error("Prompt composition failed", { error: composeData.error });
      return NextResponse.json({
        ok: false,
        mode: "prompt",
        error: `Prep succeeded but prompt composition failed: ${composeData.error}`,
        data: summary,
        logs: log.getLogs(),
        duration: log.getDuration(),
      }, { status: 500 });
    }

    log.info("Prompt composed successfully");

    return NextResponse.json({
      ok: true,
      mode: "prompt",
      message: `Full pipeline complete with prompt`,
      data: {
        ...summary,
        promptId: composeData.id,
        promptLength: composeData.prompt?.length || 0,
      },
      prompt: composeData.prompt,
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
  } finally {
    await prisma.$disconnect();
  }
}
