import { NextResponse } from "next/server";
import { PrismaClient, AnalysisOutputType, MemoryCategory } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { calculateAdaptScores, AdaptCalculationResult } from "@/lib/analysis/AdaptCalculator";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/analysis/run
 * Unified analysis endpoint that handles both MEASURE and LEARN specs
 *
 * Body: {
 *   transcript: string,           // The transcript text to analyze
 *   callId?: string,              // Optional call ID for storing results
 *   callerId?: string,            // Optional caller ID for storing memories
 *   specs?: string[],             // Optional: specific spec slugs to analyze
 *   domains?: string[],           // Optional: filter by domains (personality, memory, etc.)
 *   outputTypes?: ("MEASURE" | "LEARN")[],  // Optional: filter by output type
 *   model?: string,               // Optional: Claude model (default: claude-3-haiku-20240307)
 *   storeResults?: boolean,       // Whether to store results
 * }
 *
 * Returns:
 * - measures: Record<parameterId, score>
 * - learned: Array<{category, key, value, evidence}>
 * - stored: { callScores, callerMemories }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      transcript,
      callId,
      callerId,
      specs: specSlugs,
      domains,
      outputTypes,
      model = "claude-3-haiku-20240307",
      storeResults = false,
    } = body;

    if (!transcript) {
      return NextResponse.json(
        { ok: false, error: "transcript is required" },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Load applicable specs
    const where: any = { isActive: true };
    if (specSlugs?.length) {
      where.slug = { in: specSlugs };
    }
    if (domains?.length) {
      where.domain = { in: domains };
    }
    if (outputTypes?.length) {
      where.outputType = { in: outputTypes };
    }

    const allSpecs = await prisma.analysisSpec.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      include: {
        triggers: {
          orderBy: { sortOrder: "asc" },
          include: {
            actions: {
              orderBy: { sortOrder: "asc" },
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    definition: true,
                    scaleType: true,
                    interpretationHigh: true,
                    interpretationLow: true,
                    scoringAnchors: {
                      orderBy: [{ score: "asc" }, { sortOrder: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (allSpecs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No active analysis specs found matching criteria" },
        { status: 404 }
      );
    }

    // Separate specs by output type
    const measureSpecs = allSpecs.filter((s) => s.outputType === "MEASURE");
    const learnSpecs = allSpecs.filter((s) => s.outputType === "LEARN");

    // Build prompts for each type
    const measurePrompt = measureSpecs.length > 0 ? buildMeasurePrompt(measureSpecs, transcript) : null;
    const learnPrompt = learnSpecs.length > 0 ? buildLearnPrompt(learnSpecs, transcript) : null;

    const anthropic = new Anthropic({ apiKey });
    const startTime = Date.now();

    // Run both analyses in parallel if needed
    const [measureResult, learnResult] = await Promise.all([
      measurePrompt ? runMeasureAnalysis(anthropic, model, measurePrompt) : null,
      learnPrompt ? runLearnAnalysis(anthropic, model, learnPrompt) : null,
    ]);

    const analysisTime = Date.now() - startTime;

    // Process results
    const measures: Record<string, number> = {};
    const learned: Array<{
      category: string;
      key: string;
      value: string;
      evidence: string;
    }> = [];

    if (measureResult?.measures) {
      Object.assign(measures, measureResult.measures);
    }

    if (learnResult?.learned) {
      learned.push(...learnResult.learned);
    }

    // Store results if requested
    let stored = null;
    let adaptResult: AdaptCalculationResult | null = null;

    if (storeResults) {
      stored = await storeAnalysisResults(callId, callerId, measures, learned);

      // Calculate ADAPT scores after storing MEASURE results
      // This computes deltas and goal progress based on the new scores
      if (callId && callerId && stored.analysisRunId) {
        try {
          adaptResult = await calculateAdaptScores(callId, stored.analysisRunId);
          console.log(`ADAPT: Calculated ${adaptResult.adaptScores.length} adapt scores for call ${callId}`);
        } catch (adaptError: any) {
          console.warn("ADAPT calculation warning:", adaptError.message);
          // Don't fail the whole analysis if ADAPT fails
        }
      }
    }

    return NextResponse.json({
      ok: true,
      callId,
      callerId,
      model,
      analysisTime,
      usage: {
        measureTokens: measureResult?.usage || null,
        learnTokens: learnResult?.usage || null,
      },
      measures,
      learned,
      stored,
      adapt: adaptResult ? {
        previousCallId: adaptResult.previousCallId,
        callSequence: adaptResult.callSequence,
        scores: adaptResult.adaptScores.map(s => ({
          parameterId: s.parameterId,
          parameterName: s.parameterName,
          type: s.parameterType,
          score: s.score,
          evidence: s.evidence,
        })),
      } : null,
      summary: {
        specsAnalyzed: allSpecs.length,
        measureSpecs: measureSpecs.length,
        learnSpecs: learnSpecs.length,
        parametersScored: Object.keys(measures).length,
        factsLearned: learned.length,
        adaptScoresComputed: adaptResult?.adaptScores.length || 0,
      },
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to run analysis" },
      { status: 500 }
    );
  }
}

/**
 * Build prompt for MEASURE specs
 */
function buildMeasurePrompt(specs: any[], transcript: string): string {
  const lines: string[] = [
    `You are analyzing a call transcript to score behavioral indicators.`,
    ``,
    `# Transcript`,
    ``,
    transcript,
    ``,
    `# Scoring Calibration`,
    ``,
  ];

  // Collect unique parameters
  const parameters = new Map<string, any>();
  const triggers: any[] = [];

  for (const spec of specs) {
    for (const trigger of spec.triggers) {
      triggers.push({
        specSlug: spec.slug,
        specName: spec.name,
        triggerId: trigger.id,
        triggerName: trigger.name,
        given: trigger.given,
        when: trigger.when,
        then: trigger.then,
        actions: trigger.actions.filter((a: any) => a.parameter),
      });

      for (const action of trigger.actions) {
        if (action.parameter && !parameters.has(action.parameter.parameterId)) {
          parameters.set(action.parameter.parameterId, action.parameter);
        }
      }
    }
  }

  // Add calibration for each parameter
  for (const [, param] of parameters) {
    lines.push(`## ${param.name} (${param.parameterId})`);
    lines.push(`${param.definition}`);
    lines.push(`Scale: ${param.interpretationLow} (0) → ${param.interpretationHigh} (1)`);
    lines.push(``);

    for (const anchor of param.scoringAnchors || []) {
      lines.push(`Score ${anchor.score}${anchor.isGold ? "*" : ""}:`);
      lines.push(`"${anchor.example}"`);
      if (anchor.rationale) {
        lines.push(`(${anchor.rationale})`);
      }
      lines.push(``);
    }
  }

  lines.push(`# What to Score`);
  lines.push(``);
  lines.push(`Score each parameter based on evidence from the transcript.`);
  lines.push(``);
  lines.push(`Parameters to score: ${Array.from(parameters.keys()).join(", ")}`);
  lines.push(``);
  lines.push(`# Output Format`);
  lines.push(``);
  lines.push(`Return JSON only:`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "measures": {`);
  lines.push(`    "PARAMETER_ID": 0.75,`);
  lines.push(`    ...`);
  lines.push(`  },`);
  lines.push(`  "evidence": {`);
  lines.push(`    "PARAMETER_ID": "Quote or description supporting the score"`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push("```");

  return lines.join("\n");
}

/**
 * Build prompt for LEARN specs
 */
function buildLearnPrompt(specs: any[], transcript: string): string {
  const lines: string[] = [
    `You are learning facts about the caller from a call transcript.`,
    ``,
    `# Transcript`,
    ``,
    transcript,
    ``,
    `# What to Learn`,
    ``,
  ];

  // Collect learn actions
  const learnActions: any[] = [];

  for (const spec of specs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.learnCategory) {
          learnActions.push({
            description: action.description,
            category: action.learnCategory,
            keyPrefix: action.learnKeyPrefix,
            keyHint: action.learnKeyHint,
          });
        }
      }
    }
  }

  for (const action of learnActions) {
    lines.push(`- ${action.description}`);
    lines.push(`  Category: ${action.category}`);
    if (action.keyPrefix) {
      lines.push(`  Key format: ${action.keyPrefix}*`);
    }
    if (action.keyHint) {
      lines.push(`  Hint: ${action.keyHint}`);
    }
    lines.push(``);
  }

  lines.push(`# Categories`);
  lines.push(``);
  lines.push(`- FACT: Immutable facts (location, job, etc.)`);
  lines.push(`- PREFERENCE: User preferences (contact method, style)`);
  lines.push(`- EVENT: Time-bound events (meetings, requests)`);
  lines.push(`- TOPIC: Topics discussed (interests, concerns)`);
  lines.push(`- RELATIONSHIP: People mentioned (family, colleagues)`);
  lines.push(`- CONTEXT: Situational info (traveling, busy period)`);
  lines.push(``);
  lines.push(`# Output Format`);
  lines.push(``);
  lines.push(`Return JSON with all learned information. Only include items you found evidence for.`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "learned": [`);
  lines.push(`    {`);
  lines.push(`      "category": "FACT",`);
  lines.push(`      "key": "location",`);
  lines.push(`      "value": "London",`);
  lines.push(`      "evidence": "I live in London"`);
  lines.push(`    }`);
  lines.push(`  ]`);
  lines.push(`}`);
  lines.push("```");

  return lines.join("\n");
}

/**
 * Run MEASURE analysis
 */
async function runMeasureAnalysis(
  anthropic: Anthropic,
  model: string,
  prompt: string
): Promise<{ measures: Record<string, number>; evidence: Record<string, string>; usage: any } | null> {
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    const result = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText);

    return {
      measures: result.measures || {},
      evidence: result.evidence || {},
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("Measure analysis error:", error);
    return null;
  }
}

/**
 * Run LEARN analysis
 */
async function runLearnAnalysis(
  anthropic: Anthropic,
  model: string,
  prompt: string
): Promise<{ learned: any[]; usage: any } | null> {
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    const result = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText);

    return {
      learned: result.learned || [],
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("Learn analysis error:", error);
    return null;
  }
}

/**
 * Store analysis results
 */
async function storeAnalysisResults(
  callId: string | undefined,
  callerId: string | undefined,
  measures: Record<string, number>,
  learned: Array<{ category: string; key: string; value: string; evidence: string }>
) {
  let callScoresCreated = 0;
  let callerMemoriesCreated = 0;
  let analysisRunId: string | null = null;

  // Store measures as CallScore
  if (callId && Object.keys(measures).length > 0) {
    const analysisRun = await prisma.analysisRun.create({
      data: {
        status: "COMPLETED",
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: {
          type: "unified_analysis",
          callerId,
        },
      },
    });

    analysisRunId = analysisRun.id;

    const scoresToCreate = Object.entries(measures).map(([parameterId, score]) => ({
      analysisRunId: analysisRun.id,
      callId,
      parameterId,
      score,
      confidence: 1.0,
    }));

    await prisma.callScore.createMany({ data: scoresToCreate });
    callScoresCreated = scoresToCreate.length;
  }

  // Store learned facts as CallerMemory
  if (callerId && learned.length > 0) {
    const memoriesToCreate = learned.map((e) => ({
      callerId,
      callId: callId || null,
      category: e.category as MemoryCategory,
      source: "EXTRACTED" as const,  // Keep DB value for backwards compatibility
      key: e.key,
      value: String(e.value),
      evidence: e.evidence,
      confidence: 0.8,
      extractedBy: "unified_analysis",
    }));

    await prisma.callerMemory.createMany({ data: memoriesToCreate });
    callerMemoriesCreated = memoriesToCreate.length;
  }

  return {
    analysisRunId,
    callScoresCreated,
    callerMemoriesCreated,
  };
}
