import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/bdd-analysis/run
 * Execute BDD analysis on a transcript using Claude
 *
 * Body: {
 *   transcript: string,           // The transcript text to analyze
 *   callId?: string,              // Optional call ID for storing results
 *   callerId?: string,            // Optional caller ID for personality tracking
 *   features?: string[],          // Optional: specific feature slugs to analyze
 *   category?: string,            // Optional: filter features by category (e.g., "personality")
 *   model?: string,               // Optional: Claude model to use (default: claude-3-haiku-20240307)
 *   storeResults?: boolean,       // Whether to store results in CallScore table
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      transcript,
      callId,
      callerId,
      features: featureSlugs,
      category,
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

    // Load applicable features
    const where: any = { isActive: true };
    if (featureSlugs?.length) {
      where.slug = { in: featureSlugs };
    }
    if (category) {
      where.category = category;
    }

    const allFeatures = await prisma.bddFeature.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      include: {
        scenarios: {
          orderBy: { sortOrder: "asc" },
          include: {
            criteria: {
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

    if (allFeatures.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No active BDD features found matching criteria" },
        { status: 404 }
      );
    }

    // Build analysis structure
    const { scenarios, parameters, analysisPrompt } = buildAnalysisConfig(
      allFeatures,
      transcript
    );

    // Call Claude
    const anthropic = new Anthropic({ apiKey });

    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
    });
    const analysisTime = Date.now() - startTime;

    // Extract JSON from response
    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let analysisResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[1]);
      } else {
        // Try parsing the whole response as JSON
        analysisResult = JSON.parse(responseText);
      }
    } catch (parseError) {
      return NextResponse.json({
        ok: false,
        error: "Failed to parse LLM response as JSON",
        rawResponse: responseText,
        analysisTime,
      });
    }

    // Process and aggregate results
    const processedResults = processAnalysisResults(
      analysisResult,
      scenarios,
      parameters
    );

    // Store results if requested
    let storedInfo = null;
    if (storeResults && callId) {
      storedInfo = await storeCallScores(callId, callerId, processedResults);
    }

    return NextResponse.json({
      ok: true,
      callId,
      callerId,
      model,
      analysisTime,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stored: storedInfo,
      ...processedResults,
    });
  } catch (error: any) {
    console.error("BDD analysis error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to run BDD analysis" },
      { status: 500 }
    );
  }
}

/**
 * Build analysis configuration and prompt
 */
function buildAnalysisConfig(features: any[], transcript: string) {
  const scenarios: any[] = [];
  const parameters = new Map<string, any>();

  for (const feature of features) {
    for (const scenario of feature.scenarios) {
      const scenarioConfig = {
        featureSlug: feature.slug,
        featureName: feature.name,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        given: scenario.given,
        when: scenario.when,
        then: scenario.then,
        criteria: scenario.criteria.map((c: any) => ({
          criterionId: c.id,
          description: c.description,
          weight: c.weight,
          parameterId: c.parameter.parameterId,
          parameterName: c.parameter.name,
        })),
      };
      scenarios.push(scenarioConfig);

      for (const c of scenario.criteria) {
        if (!parameters.has(c.parameter.parameterId)) {
          parameters.set(c.parameter.parameterId, c.parameter);
        }
      }
    }
  }

  const analysisPrompt = buildPrompt(scenarios, parameters, transcript);

  return {
    scenarios,
    parameters: Object.fromEntries(parameters),
    analysisPrompt,
  };
}

/**
 * Build the LLM prompt
 */
function buildPrompt(
  scenarios: any[],
  parameters: Map<string, any>,
  transcript: string
): string {
  const lines: string[] = [
    `You are analyzing a call transcript to score behavioral indicators.`,
    ``,
    `# Transcript`,
    ``,
    transcript,
    ``,
    `# Scoring Calibration`,
    ``,
    `Use these calibrated examples to guide your scoring. Interpolate between anchor points.`,
    ``,
  ];

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

  lines.push(`# Scenarios to Evaluate`);
  lines.push(``);

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    lines.push(`## Scenario ${i + 1}: ${s.scenarioName}`);
    lines.push(`Given: ${s.given}`);
    lines.push(`When: ${s.when}`);
    lines.push(`Then: ${s.then}`);
    lines.push(``);
    lines.push(`Criteria:`);
    for (const c of s.criteria) {
      lines.push(`- [${c.criterionId}] ${c.description} → ${c.parameterName}`);
    }
    lines.push(``);
  }

  lines.push(`# Instructions`);
  lines.push(``);
  lines.push(`1. For each scenario, determine if it applies to this transcript`);
  lines.push(`2. For applicable scenarios, score each criterion (0-1) based on calibration`);
  lines.push(`3. Provide brief evidence from the transcript`);
  lines.push(``);
  lines.push(`Return JSON only:`);
  lines.push(`\`\`\`json`);
  lines.push(`{`);
  lines.push(`  "scenarioResults": [`);
  lines.push(`    {`);
  lines.push(`      "scenarioId": "scenario-uuid",`);
  lines.push(`      "applies": true,`);
  lines.push(`      "criterionScores": [`);
  lines.push(`        {`);
  lines.push(`          "criterionId": "criterion-uuid",`);
  lines.push(`          "score": 0.7,`);
  lines.push(`          "evidence": "Quote or description from transcript"`);
  lines.push(`        }`);
  lines.push(`      ]`);
  lines.push(`    }`);
  lines.push(`  ]`);
  lines.push(`}`);
  lines.push(`\`\`\``);

  return lines.join("\n");
}

/**
 * Process LLM results and aggregate scores
 */
function processAnalysisResults(
  llmResult: any,
  scenarios: any[],
  parameters: Record<string, any>
) {
  const scenarioResults = llmResult.scenarioResults || [];

  // Map scenario IDs to config
  const scenarioMap = new Map(scenarios.map((s) => [s.scenarioId, s]));

  // Aggregate scores by parameter
  const parameterScores: Record<
    string,
    {
      parameterId: string;
      parameterName: string;
      scores: Array<{ score: number; weight: number; source: string }>;
      weightedAverage: number | null;
    }
  > = {};

  // Initialize parameter scores
  for (const [parameterId, param] of Object.entries(parameters)) {
    parameterScores[parameterId] = {
      parameterId,
      parameterName: (param as any).name,
      scores: [],
      weightedAverage: null,
    };
  }

  // Process each scenario result
  const processedScenarios = scenarioResults.map((sr: any) => {
    const scenarioConfig = scenarioMap.get(sr.scenarioId);
    if (!scenarioConfig) {
      return { ...sr, matched: false };
    }

    // Map criterion scores
    const criterionScores = (sr.criterionScores || []).map((cs: any) => {
      const criterionConfig = scenarioConfig.criteria.find(
        (c: any) => c.criterionId === cs.criterionId
      );

      if (criterionConfig && cs.score !== null && cs.score !== undefined) {
        // Add to parameter aggregation
        parameterScores[criterionConfig.parameterId]?.scores.push({
          score: cs.score,
          weight: criterionConfig.weight,
          source: `${scenarioConfig.featureSlug}:${scenarioConfig.scenarioName}`,
        });
      }

      return {
        ...cs,
        description: criterionConfig?.description,
        parameterId: criterionConfig?.parameterId,
        weight: criterionConfig?.weight,
      };
    });

    return {
      scenarioId: sr.scenarioId,
      featureSlug: scenarioConfig.featureSlug,
      scenarioName: scenarioConfig.scenarioName,
      applies: sr.applies,
      criterionScores,
    };
  });

  // Calculate weighted averages
  for (const [parameterId, data] of Object.entries(parameterScores)) {
    if (data.scores.length > 0) {
      const totalWeight = data.scores.reduce((sum, s) => sum + s.weight, 0);
      const weightedSum = data.scores.reduce(
        (sum, s) => sum + s.score * s.weight,
        0
      );
      data.weightedAverage =
        totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 1000) / 1000 : null;
    }
  }

  return {
    scenarioResults: processedScenarios,
    parameterScores,
    summary: {
      scenariosEvaluated: scenarios.length,
      scenariosApplied: processedScenarios.filter((s: any) => s.applies).length,
      parametersScored: Object.values(parameterScores).filter(
        (p) => p.weightedAverage !== null
      ).length,
    },
  };
}

/**
 * Store scores in CallScore table via AnalysisRun
 */
async function storeCallScores(
  callId: string,
  callerId: string | undefined,
  results: any
) {
  // Create an AnalysisRun for this BDD analysis
  const analysisRun = await prisma.analysisRun.create({
    data: {
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: {
        type: "bdd_analysis",
        callerId,
        summary: results.summary,
      },
    },
  });

  const scoresToCreate = [];

  for (const [parameterId, data] of Object.entries(results.parameterScores) as any) {
    if (data.weightedAverage !== null) {
      scoresToCreate.push({
        analysisRunId: analysisRun.id,
        callId,
        parameterId,
        score: data.weightedAverage,
        confidence: 1.0, // Could be derived from anchor distances
        evidence: JSON.stringify({
          scores: data.scores,
          scenarioCount: data.scores.length,
        }),
      });
    }
  }

  if (scoresToCreate.length > 0) {
    await prisma.callScore.createMany({
      data: scoresToCreate,
    });
  }

  return {
    analysisRunId: analysisRun.id,
    scoresCreated: scoresToCreate.length,
  };
}
