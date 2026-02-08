import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/bdd-analysis
 * Get analysis configuration: all active BDD features with their calibration data
 * This endpoint provides everything needed to run BDD analysis on a transcript
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const featureSlug = url.searchParams.get("feature");

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (featureSlug) where.slug = featureSlug;

    const features = await prisma.bddFeature.findMany({
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

    // Build calibration prompt sections for each unique parameter
    const parameterCalibrations = new Map<string, any>();

    for (const feature of features) {
      for (const scenario of feature.scenarios) {
        for (const criterion of scenario.criteria) {
          const param = criterion.parameter;
          if (!parameterCalibrations.has(param.parameterId)) {
            parameterCalibrations.set(param.parameterId, {
              parameterId: param.parameterId,
              name: param.name,
              definition: param.definition,
              scaleType: param.scaleType,
              interpretationHigh: param.interpretationHigh,
              interpretationLow: param.interpretationLow,
              anchors: param.scoringAnchors,
              calibrationPrompt: buildCalibrationPrompt(param),
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      features,
      parameters: Object.fromEntries(parameterCalibrations),
      featureCount: features.length,
      parameterCount: parameterCalibrations.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch BDD analysis config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bdd-analysis
 * Run BDD analysis on a transcript
 *
 * Body: {
 *   transcript: string,           // The transcript text to analyze
 *   callId?: string,              // Optional call ID for storing results
 *   features?: string[],          // Optional: specific feature slugs to analyze
 *   category?: string,            // Optional: filter features by category
 *   dryRun?: boolean,             // If true, return prompts without calling LLM
 * }
 *
 * Returns:
 * - matchedScenarios: which scenarios apply to this transcript
 * - scores: per-criterion scores with rationale
 * - aggregatedScores: per-parameter weighted averages
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcript, callId, features: featureSlugs, category, dryRun } = body;

    if (!transcript) {
      return NextResponse.json(
        { ok: false, error: "transcript is required" },
        { status: 400 }
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

    // Build the analysis structure
    const analysisConfig = buildAnalysisConfig(allFeatures, transcript);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        config: analysisConfig,
        message: "Dry run - no LLM calls made. Use this config to run analysis.",
      });
    }

    // For now, return the analysis config with placeholder scores
    // In production, this would call an LLM to score each criterion
    const placeholderResults = buildPlaceholderResults(analysisConfig);

    return NextResponse.json({
      ok: true,
      callId,
      transcript: transcript.substring(0, 200) + "...", // Preview only
      ...placeholderResults,
      note: "Placeholder scores - integrate with LLM service for real analysis",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to run BDD analysis" },
      { status: 500 }
    );
  }
}

/**
 * Build a calibration prompt section for a parameter
 */
function buildCalibrationPrompt(param: any): string {
  const lines: string[] = [
    `## ${param.name} (${param.parameterId})`,
    ``,
    `**Definition:** ${param.definition}`,
    ``,
    `**Scale:** ${param.interpretationLow} (0) → ${param.interpretationHigh} (1)`,
    ``,
    `### Calibration Examples:`,
  ];

  for (const anchor of param.scoringAnchors || []) {
    lines.push(``);
    lines.push(`**Score ${anchor.score}${anchor.isGold ? " (Gold Standard)" : ""}:**`);
    lines.push(`> "${anchor.example}"`);
    if (anchor.rationale) {
      lines.push(`*Rationale:* ${anchor.rationale}`);
    }
    if (anchor.positiveSignals?.length) {
      lines.push(`*Positive signals:* ${anchor.positiveSignals.join(", ")}`);
    }
    if (anchor.negativeSignals?.length) {
      lines.push(`*Negative signals:* ${anchor.negativeSignals.join(", ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build analysis configuration from features
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

      // Collect unique parameters
      for (const c of scenario.criteria) {
        if (!parameters.has(c.parameter.parameterId)) {
          parameters.set(c.parameter.parameterId, {
            ...c.parameter,
            calibrationPrompt: buildCalibrationPrompt(c.parameter),
          });
        }
      }
    }
  }

  // Build the full analysis prompt
  const analysisPrompt = buildAnalysisPrompt(scenarios, parameters, transcript);

  return {
    scenarios,
    parameters: Object.fromEntries(parameters),
    analysisPrompt,
    transcriptLength: transcript.length,
  };
}

/**
 * Build the full analysis prompt for the LLM
 */
function buildAnalysisPrompt(
  scenarios: any[],
  parameters: Map<string, any>,
  transcript: string
): string {
  const lines: string[] = [
    `# Call Analysis Task`,
    ``,
    `Analyze the following transcript and score each criterion based on the calibration examples provided.`,
    ``,
    `## Transcript`,
    ``,
    "```",
    transcript,
    "```",
    ``,
    `## Scoring Calibration`,
    ``,
    `Use these calibrated examples to guide your scoring. Interpolate between anchor points.`,
    ``,
  ];

  // Add calibration for each parameter
  for (const [, param] of parameters) {
    lines.push(param.calibrationPrompt);
    lines.push(``);
  }

  lines.push(`## Scenarios to Evaluate`);
  lines.push(``);

  for (const scenario of scenarios) {
    lines.push(`### ${scenario.featureName}: ${scenario.scenarioName}`);
    lines.push(``);
    lines.push(`**Given:** ${scenario.given}`);
    lines.push(`**When:** ${scenario.when}`);
    lines.push(`**Then:** ${scenario.then}`);
    lines.push(``);
    lines.push(`**Criteria to score:**`);
    for (const c of scenario.criteria) {
      lines.push(`- ${c.description} → Score on ${c.parameterName} (0-1)`);
    }
    lines.push(``);
  }

  lines.push(`## Output Format`);
  lines.push(``);
  lines.push(`For each criterion, provide:`);
  lines.push(`1. Whether the scenario applies to this transcript (true/false)`);
  lines.push(`2. The score (0-1) based on calibration examples`);
  lines.push(`3. Brief rationale referencing specific transcript evidence`);
  lines.push(``);
  lines.push(`Return as JSON:`);
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "scenarioResults": [`);
  lines.push(`    {`);
  lines.push(`      "scenarioId": "...",`);
  lines.push(`      "applies": true,`);
  lines.push(`      "criterionScores": [`);
  lines.push(`        {`);
  lines.push(`          "criterionId": "...",`);
  lines.push(`          "score": 0.75,`);
  lines.push(`          "rationale": "Caller showed moderate curiosity by asking...",`);
  lines.push(`          "evidence": "What if we tried..."`);
  lines.push(`        }`);
  lines.push(`      ]`);
  lines.push(`    }`);
  lines.push(`  ]`);
  lines.push(`}`);
  lines.push("```");

  return lines.join("\n");
}

/**
 * Build placeholder results for demo/testing
 */
function buildPlaceholderResults(config: any) {
  const scenarioResults = config.scenarios.map((s: any) => ({
    scenarioId: s.scenarioId,
    featureSlug: s.featureSlug,
    scenarioName: s.scenarioName,
    applies: true, // Placeholder - LLM would determine this
    criterionScores: s.criteria.map((c: any) => ({
      criterionId: c.criterionId,
      description: c.description,
      parameterId: c.parameterId,
      weight: c.weight,
      score: null, // Placeholder - LLM would provide
      rationale: "Requires LLM analysis",
      evidence: null,
    })),
  }));

  // Aggregate by parameter (will have null scores until LLM runs)
  const parameterScores: Record<string, any> = {};
  for (const [parameterId, param] of Object.entries(config.parameters) as any) {
    parameterScores[parameterId] = {
      parameterId,
      parameterName: param.name,
      scores: [], // Would contain weighted scores from all criteria
      weightedAverage: null,
    };
  }

  return {
    scenarioResults,
    parameterScores,
    analysisPrompt: config.analysisPrompt,
    promptTokenEstimate: Math.ceil(config.analysisPrompt.length / 4),
  };
}
