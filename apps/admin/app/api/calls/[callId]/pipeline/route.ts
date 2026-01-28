/**
 * POST /api/calls/[callId]/pipeline
 *
 * Unified pipeline endpoint that runs the full analysis in a single batched AI call.
 * This is much more cost-efficient than running separate AI calls for each op.
 *
 * Request body:
 * - callerId: string (required)
 * - mode: "prep" | "prompt" (required)
 *   - prep: Run MEASURE + LEARN + MEASURE_AGENT + REWARD + ADAPT (prepares all data)
 *   - prompt: Run prep + compose the final prompt
 * - engine: "mock" | "claude" | "openai" (optional, defaults to "mock")
 *
 * AI Optimization Strategy:
 * - Instead of N separate AI calls (one per parameter), we batch all scoring into ONE call
 * - The prompt includes all parameters to score, and the AI returns all scores at once
 * - This reduces API calls from ~20 to 1-2 (one for MEASURE+LEARN, one for MEASURE_AGENT)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, MemoryCategory } from "@prisma/client";
import { getAICompletion, AIEngine, isEngineAvailable } from "@/lib/ai/client";

const prisma = new PrismaClient();

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
 * Build a BATCHED prompt for MEASURE_AGENT specs
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
}> {
  const transcript = call.transcript || "";

  // Load MEASURE specs for caller
  const measureSpecs = await prisma.analysisSpec.findMany({
    where: { outputType: "MEASURE", isActive: true, isDirty: false },
    include: { triggers: { include: { actions: true } } },
  });

  // Load LEARN specs
  const learnSpecs = await prisma.analysisSpec.findMany({
    where: { outputType: "LEARN", isActive: true, isDirty: false },
    include: { triggers: { include: { actions: true } } },
  });

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
    return { scoresCreated: 0, memoriesCreated: 0 };
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

  return { scoresCreated, memoriesCreated };
}

/**
 * Run batched agent analysis (MEASURE_AGENT)
 */
async function runBatchedAgentAnalysis(
  call: { id: string; transcript: string | null },
  engine: AIEngine,
  log: ReturnType<typeof createLogger>
): Promise<{ measurementsCreated: number }> {
  const transcript = call.transcript || "";

  // Load MEASURE_AGENT specs
  const agentSpecs = await prisma.analysisSpec.findMany({
    where: { outputType: "MEASURE_AGENT", isActive: true, isDirty: false },
    include: { triggers: { include: { actions: true } } },
  });

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
    log.warn("No MEASURE_AGENT specs found");
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

    // Validate engine
    let engine: AIEngine = "mock";
    if (requestedEngine && ["mock", "claude", "openai"].includes(requestedEngine)) {
      if (isEngineAvailable(requestedEngine)) {
        engine = requestedEngine;
      } else {
        log.warn(`Engine ${requestedEngine} not available, using mock`);
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

    // Step 1: Batched caller analysis (MEASURE + LEARN)
    log.info("Step 1: Caller analysis (MEASURE + LEARN)");
    const callerResult = await runBatchedCallerAnalysis(call, callerId, engine, log);

    // Step 2: Batched agent analysis (MEASURE_AGENT)
    log.info("Step 2: Agent analysis (MEASURE_AGENT)");
    const agentResult = await runBatchedAgentAnalysis(call, engine, log);

    // Step 3: Reward
    log.info("Step 3: Compute reward");
    const rewardResult = await computeReward(callId, log);

    // Step 4: Adapt
    log.info("Step 4: Compute adapt");
    const adaptResult = await computeAdapt(callId, callerId, log);

    // Step 5: Personality aggregation
    log.info("Step 5: Aggregate personality");
    const personalityResult = await aggregatePersonality(callId, callerId, log);

    // Summary for prep mode
    const summary = {
      scoresCreated: callerResult.scoresCreated,
      memoriesCreated: callerResult.memoriesCreated,
      agentMeasurements: agentResult.measurementsCreated,
      rewardScore: rewardResult.overallScore,
      deltasComputed: adaptResult.deltasComputed,
      personalityObservationCreated: personalityResult.observationCreated,
      personalityProfileUpdated: personalityResult.profileUpdated,
    };

    if (mode === "prep") {
      log.info("Prep complete", summary);
      return NextResponse.json({
        ok: true,
        mode: "prep",
        message: `Prep complete: ${summary.scoresCreated} scores, ${summary.memoriesCreated} memories, ${summary.agentMeasurements} agent measurements, personality ${summary.personalityProfileUpdated ? "updated" : "skipped"}`,
        data: summary,
        logs: log.getLogs(),
        duration: log.getDuration(),
      });
    }

    // Mode is "prompt" - compose the prompt
    log.info("Step 6: Compose prompt");

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
