/**
 * personality-analyze.ts
 *
 * Spec-Driven Personality Analysis
 *
 * Extracts personality traits from call transcripts using AnalysisSpecs as the scoring rubric.
 * Each MEASURE-type AnalysisSpec defines how to score a parameter, including:
 * - promptTemplate: The LLM prompt with {{transcript}}, {{anchors}}, etc.
 * - linked Parameter with scoringAnchors for calibration examples
 *
 * Flow:
 * 1. Query AnalysisSpecs where outputType = MEASURE and isActive = true
 * 2. For each call without a PersonalityObservation:
 *    a. For each spec, render promptTemplate with transcript + anchors
 *    b. Call LLM to score (or mock for testing)
 *    c. Store result in CallScore table
 * 3. Aggregate call scores into CallerPersonality (with decay weighting)
 *
 * Fallback: If no AnalysisSpecs exist, falls back to legacy Parameter-name matching.
 */

import { PrismaClient, AnalysisOutputType } from "@prisma/client";
import { TRAITS } from "@/lib/registry";

const prisma = new PrismaClient();

interface PersonalityAnalyzerOptions {
  verbose?: boolean;
  plan?: boolean;
  mock?: boolean;           // Use mock scoring instead of LLM
  callId?: string;          // Analyze specific call
  callerId?: string;          // Analyze calls for specific caller
  limit?: number;           // Max calls to process
  aggregate?: boolean;      // Re-aggregate CallerPersonality after scoring
  halfLifeDays?: number;    // Decay half-life for aggregation
  specSlug?: string;        // Only run specific spec (for testing)
}

interface AnalysisSpecWithRelations {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  domain: string | null;
  promptTemplate: string | null;
  outputType: AnalysisOutputType;
  promptSlug: {
    id: string;
    slug: string;
    parameters: Array<{
      parameter: {
        parameterId: string;
        name: string;
        definition: string | null;
        scoringAnchors: Array<{
          example: string;
          score: number;
          rationale: string | null;
        }>;
      };
    }>;
  } | null;
}

interface ScoringResult {
  score: number;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

interface AnalysisResult {
  callsAnalyzed: number;
  scoresCreated: number;
  profilesAggregated: number;
  specsUsed: number;
  errors: string[];
  scores: Array<{
    callId: string;
    specSlug: string;
    parameterId: string;
    score: number;
    confidence: number;
  }>;
}

// Default trait mapping (loaded from AGGREGATE spec when available)
// Maps parameterId -> CallerPersonality field name
const DEFAULT_TRAIT_MAPPING: Record<string, string> = {
  // New PERS-* parameter IDs
  "PERS-OPENNESS": "openness",
  "PERS-CONSCIENTIOUSNESS": "conscientiousness",
  "PERS-EXTRAVERSION": "extraversion",
  "PERS-AGREEABLENESS": "agreeableness",
  "PERS-NEUROTICISM": "neuroticism",
  // Legacy B5-* parameter IDs (for backwards compatibility)
  [TRAITS.B5_O]: "openness",
  [TRAITS.B5_C]: "conscientiousness",
  [TRAITS.B5_E]: "extraversion",
  [TRAITS.B5_A]: "agreeableness",
  [TRAITS.B5_N]: "neuroticism",
};

// Cached trait mapping (loaded from spec)
let cachedTraitMapping: Record<string, string> | null = null;

/**
 * Load trait mapping from AGGREGATE spec
 * Returns mapping of parameterId -> personality field name
 */
async function loadTraitMapping(): Promise<Record<string, string>> {
  if (cachedTraitMapping) {
    return cachedTraitMapping;
  }

  const spec = await prisma.analysisSpec.findFirst({
    where: {
      outputType: "AGGREGATE",
      isActive: true,
      scope: "SYSTEM",
    },
  });

  if (!spec?.config) {
    return DEFAULT_TRAIT_MAPPING;
  }

  const config = spec.config as any;
  if (config.traitMapping && typeof config.traitMapping === "object") {
    cachedTraitMapping = config.traitMapping as Record<string, string>;
    return cachedTraitMapping;
  }

  return DEFAULT_TRAIT_MAPPING;
}

/**
 * Get reverse mapping (field name -> parameterId) for legacy mode
 */
function getReverseTraitMapping(mapping: Record<string, string>): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [paramId, fieldName] of Object.entries(mapping)) {
    reverse[fieldName] = paramId;
  }
  return reverse;
}

export async function analyzePersonality(
  options: PersonalityAnalyzerOptions = {}
): Promise<AnalysisResult> {
  const {
    verbose = false,
    plan = false,
    mock = true,  // Default to mock until LLM integration
    callId,
    callerId,
    limit = 50,
    aggregate = true,
    halfLifeDays = 30,
    specSlug,
  } = options;

  const result: AnalysisResult = {
    callsAnalyzed: 0,
    scoresCreated: 0,
    profilesAggregated: 0,
    specsUsed: 0,
    errors: [],
    scores: [],
  };

  if (plan) {
    console.log("\n📋 PERSONALITY ANALYZER PLAN (Spec-Driven)\n");
    console.log("Steps:");
    console.log("1. Query AnalysisSpecs where outputType=MEASURE and isActive=true");
    if (specSlug) {
      console.log(`   - Filtering to spec: ${specSlug}`);
    }
    console.log("2. Find calls to analyze:");
    if (callId) {
      console.log(`   - Specific call: ${callId}`);
    } else if (callerId) {
      console.log(`   - Calls for caller: ${callerId}`);
    } else {
      console.log(`   - Up to ${limit} unscored calls`);
    }
    console.log("3. For each call × spec:");
    console.log("   - Render spec's promptTemplate with transcript + anchors");
    console.log("   - Score via LLM (or mock if --mock)");
    console.log("   - Store CallScore record");
    if (aggregate) {
      console.log("4. Aggregate scores into CallerPersonality with time decay");
      console.log(`   - Half-life: ${halfLifeDays} days`);
    }
    console.log("\nEffects:");
    console.log("- Reads: AnalysisSpec, Call, Parameter, ParameterScoringAnchor");
    console.log("- Writes: CallScore");
    if (aggregate) {
      console.log("- Updates: CallerPersonality");
    }
    console.log("\nRun without --plan to execute.\n");
    return result;
  }

  try {
    // Step 1: Get MEASURE-type AnalysisSpecs
    if (verbose) console.log("\n🔍 Loading MEASURE AnalysisSpecs...");

    const specWhere: any = {
      outputType: "MEASURE",
      isActive: true,
    };
    if (specSlug) {
      specWhere.slug = specSlug;
    }

    const specs = await prisma.analysisSpec.findMany({
      where: specWhere,
      include: {
        promptSlug: {
          include: {
            parameters: {
              include: {
                parameter: {
                  include: {
                    scoringAnchors: {
                      orderBy: { score: "asc" },
                      take: 5, // Limit anchors for prompt size
                    },
                  },
                },
              },
            },
          },
        },
        // Also include triggers/actions for parameter linking
        triggers: {
          include: {
            actions: {
              where: { parameterId: { not: null } },
              include: {
                parameter: {
                  include: {
                    scoringAnchors: {
                      orderBy: { score: "asc" },
                      take: 5,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { priority: "desc" },
    });

    if (specs.length === 0) {
      // Fallback to legacy mode
      if (verbose) {
        console.log("⚠️  No MEASURE AnalysisSpecs found, using legacy mode");
      }
      return await legacyAnalyzePersonality(options);
    }

    result.specsUsed = specs.length;
    if (verbose) {
      console.log(`✅ Found ${specs.length} MEASURE spec(s):`);
      specs.forEach((s) => {
        // Check both promptSlug.parameters AND triggers.actions.parameter
        const paramFromSlug = s.promptSlug?.parameters[0]?.parameter.parameterId;
        const paramFromTrigger = s.triggers?.[0]?.actions?.[0]?.parameter?.parameterId;
        const paramId = paramFromSlug || paramFromTrigger;
        console.log(`   - ${s.slug} → ${paramId || "(no param)"}`);
      });
    }

    // Step 2: Find calls to analyze
    if (verbose) console.log("\n📞 Finding calls to analyze...");

    const callWhere: any = {
      callerId: { not: null },
      // Filter for non-empty transcripts (transcript is a required String field)
      transcript: { not: "" },
    };

    if (callId) {
      callWhere.id = callId;
    } else if (callerId) {
      callWhere.callerId = callerId;
    }

    // Exclude calls that already have scores for ALL active specs
    // (This is a simplification - ideally check per-spec)
    if (!callId && !callerId) {
      const scoredCallIds = await prisma.callScore.findMany({
        where: {
          analysisSpecId: { in: specs.map((s) => s.id) },
        },
        select: { callId: true },
        distinct: ["callId"],
      });
      const scoredSet = new Set(scoredCallIds.map((c) => c.callId));

      if (scoredSet.size > 0) {
        callWhere.id = { notIn: Array.from(scoredSet) };
      }
    }

    const calls = await prisma.call.findMany({
      where: callWhere,
      take: callId ? 1 : limit,
      orderBy: { createdAt: "desc" },
      include: {
        caller: { select: { id: true, name: true } },
      },
    });

    if (calls.length === 0) {
      const msg = callId
        ? `Call ${callId} not found or already scored`
        : "No unscored calls found";
      console.log(`⚠️  ${msg}`);
      result.errors.push(msg);
      return result;
    }

    if (verbose) {
      console.log(`✅ Found ${calls.length} call(s) to analyze`);
    }

    // Step 3: Score each call with each spec
    const callerIds = new Set<string>();

    for (const call of calls) {
      if (!call.callerId || !call.transcript) continue;

      result.callsAnalyzed++;
      callerIds.add(call.callerId);

      if (verbose) {
        console.log(`\n📊 Analyzing call ${call.id.substring(0, 8)}...`);
      }

      for (const spec of specs) {
        try {
          // Get the parameter - check promptSlug first, then triggers/actions
          let parameter: any = null;
          let anchors: any[] = [];

          // Method 1: Via promptSlug.parameters
          const paramLink = spec.promptSlug?.parameters[0];
          if (paramLink) {
            parameter = paramLink.parameter;
            anchors = parameter.scoringAnchors || [];
          }

          // Method 2: Via triggers.actions.parameter
          if (!parameter && spec.triggers) {
            for (const trigger of spec.triggers) {
              for (const action of trigger.actions) {
                if (action.parameter) {
                  parameter = action.parameter;
                  anchors = parameter.scoringAnchors || [];
                  break;
                }
              }
              if (parameter) break;
            }
          }

          if (!parameter) {
            if (verbose) {
              console.log(`   ⏭️  Skipping ${spec.slug} (no linked parameter)`);
            }
            continue;
          }

          // Score the call
          const scoring = await scoreWithSpec(
            call.transcript,
            spec as AnalysisSpecWithRelations,
            parameter,
            anchors,
            mock,
            verbose
          );

          // Store CallScore
          await prisma.callScore.create({
            data: {
              callId: call.id,
              callerId: call.callerId,
              analysisSpecId: spec.id,
              parameterId: parameter.parameterId,
              score: scoring.score,
              confidence: scoring.confidence,
              evidence: scoring.evidence,
              reasoning: scoring.reasoning,
              scoredAt: new Date(),
              scoredBy: mock ? "mock_v1" : "llm_v1",
            },
          });

          result.scoresCreated++;
          result.scores.push({
            callId: call.id,
            specSlug: spec.slug,
            parameterId: parameter.parameterId,
            score: scoring.score,
            confidence: scoring.confidence,
          });

          if (verbose) {
            console.log(
              `   ✓ ${spec.slug}: ${scoring.score.toFixed(2)} (conf: ${scoring.confidence.toFixed(2)})`
            );
          }
        } catch (err: any) {
          const errMsg = `Error scoring ${spec.slug} for call ${call.id}: ${err.message}`;
          if (verbose) console.error(`   ❌ ${errMsg}`);
          result.errors.push(errMsg);
        }
      }
    }

    // Step 4: Aggregate into CallerPersonality
    if (aggregate && callerIds.size > 0) {
      if (verbose) {
        console.log(`\n🔄 Aggregating profiles for ${callerIds.size} caller(s)...`);
      }

      for (const uid of callerIds) {
        try {
          await aggregateCallerPersonality(uid, halfLifeDays, verbose);
          result.profilesAggregated++;
        } catch (err: any) {
          result.errors.push(`Aggregation error for ${uid}: ${err.message}`);
        }
      }
    }

    // Summary
    console.log("\n✅ PERSONALITY ANALYSIS COMPLETE\n");
    console.log(`Specs used: ${result.specsUsed}`);
    console.log(`Calls analyzed: ${result.callsAnalyzed}`);
    console.log(`Scores created: ${result.scoresCreated}`);
    if (aggregate) {
      console.log(`Profiles aggregated: ${result.profilesAggregated}`);
    }
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach((err) => console.log(`   - ${err}`));
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more`);
      }
    }

    return result;
  } catch (error) {
    console.error("❌ Error during personality analysis:", error);
    result.errors.push(String(error));
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Score a call using an AnalysisSpec
 */
async function scoreWithSpec(
  transcript: string,
  spec: AnalysisSpecWithRelations,
  parameter: {
    parameterId: string;
    name: string;
    definition: string | null;
  },
  anchors: Array<{ example: string; score: number; rationale: string | null }>,
  mock: boolean,
  verbose: boolean
): Promise<ScoringResult> {
  // Build anchor examples text
  const anchorExamples = anchors
    .map(
      (a) =>
        `Score ${a.score.toFixed(1)}: "${a.example.substring(0, 200)}..."\n  ${a.rationale || ""}`
    )
    .join("\n\n");

  // Get or build the prompt template
  let promptTemplate = spec.promptTemplate;

  if (!promptTemplate) {
    // Default template if spec doesn't have one
    promptTemplate = `Analyze this call transcript for the personality trait: {{parameter.name}}

Definition: {{parameter.definition}}

Calibration examples:
{{anchors}}

---
TRANSCRIPT:
{{transcript}}
---

Score the person on this trait from 0.0 (very low) to 1.0 (very high).

Return JSON:
{
  "score": <number 0-1>,
  "confidence": <number 0-1>,
  "evidence": [<quote1>, <quote2>, ...],
  "reasoning": "<brief explanation>"
}`;
  }

  // Render template
  const renderedPrompt = promptTemplate
    .replace(/\{\{parameter\.name\}\}/g, parameter.name)
    .replace(/\{\{parameter\.definition\}\}/g, parameter.definition || "")
    .replace(/\{\{anchors\}\}/g, anchorExamples)
    .replace(/\{\{transcript\}\}/g, transcript.substring(0, 4000))
    .replace(/\{\{spec\.name\}\}/g, spec.name)
    .replace(/\{\{spec\.description\}\}/g, spec.description || "");

  if (verbose) {
    console.log(`   [${mock ? "MOCK" : "LLM"}] Scoring ${parameter.name}...`);
  }

  if (mock) {
    // Mock scoring based on transcript length and content
    let baseScore = 0.5;

    // Simple heuristics for mock scoring
    const transcriptLower = transcript.toLowerCase();

    // Openness indicators
    if (parameter.parameterId.includes("O") || parameter.name.toLowerCase().includes("open")) {
      if (transcriptLower.includes("curious") || transcriptLower.includes("interesting")) {
        baseScore += 0.15;
      }
      if (transcriptLower.includes("always done it") || transcriptLower.includes("traditional")) {
        baseScore -= 0.1;
      }
    }

    // Extraversion indicators
    if (parameter.parameterId.includes("E") || parameter.name.toLowerCase().includes("extrav")) {
      if (transcriptLower.includes("excited") || transcriptLower.includes("love talking")) {
        baseScore += 0.15;
      }
      if (transcriptLower.includes("quiet") || transcriptLower.includes("prefer email")) {
        baseScore -= 0.1;
      }
    }

    // Add some randomness
    baseScore += (Math.random() - 0.5) * 0.2;

    // Clamp to 0-1
    const score = Math.max(0, Math.min(1, baseScore));

    return {
      score,
      confidence: 0.6 + Math.random() * 0.2,
      evidence: ["[Mock scoring - enable LLM for real analysis]"],
      reasoning: `Mock score based on keyword heuristics for ${parameter.name}`,
    };
  }

  // TODO: Real LLM call
  // const response = await callLLM(renderedPrompt);
  // return JSON.parse(response);

  throw new Error("LLM scoring not yet implemented. Use --mock flag.");
}

/**
 * Aggregate call scores into CallerPersonality with time decay
 */
async function aggregateCallerPersonality(
  callerId: string,
  halfLifeDays: number,
  verbose: boolean
): Promise<void> {
  // Get all call scores for this caller
  const scores = await prisma.callScore.findMany({
    where: { callerId },
    include: {
      call: { select: { createdAt: true } },
      analysisSpec: { select: { slug: true } },
    },
    orderBy: { scoredAt: "desc" },
  });

  if (scores.length === 0) {
    if (verbose) console.log(`   ⏭️  No scores for caller ${callerId}`);
    return;
  }

  // Group scores by parameterId
  const byParameter: Record<
    string,
    Array<{ score: number; confidence: number; date: Date }>
  > = {};

  for (const s of scores) {
    if (!byParameter[s.parameterId]) {
      byParameter[s.parameterId] = [];
    }
    byParameter[s.parameterId].push({
      score: s.score,
      confidence: s.confidence,
      date: s.call?.createdAt || s.scoredAt,
    });
  }

  // Calculate weighted averages with time decay
  const now = new Date();
  const aggregatedValues: Record<string, number> = {};
  const parameterConfidences: Record<string, number> = {};

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
      parameterConfidences[parameterId] = Math.min(
        1,
        totalWeight / paramScores.length
      );
    }
  }

  // Load trait mapping from spec
  const traitMapping = await loadTraitMapping();

  // Map to personality fields using spec-driven trait mapping
  const profileData: any = {
    lastAggregatedAt: now,
    observationsUsed: scores.length,
    confidenceScore: Object.values(parameterConfidences).reduce(
      (a, b) => a + b,
      0
    ) / Math.max(1, Object.keys(parameterConfidences).length),
    decayHalfLife: halfLifeDays,
  };

  // Apply trait mapping from spec
  for (const [parameterId, fieldName] of Object.entries(traitMapping)) {
    profileData[fieldName] = aggregatedValues[parameterId] ?? null;
  }

  // Upsert CallerPersonality
  await prisma.callerPersonality.upsert({
    where: { callerId },
    create: { callerId, ...profileData },
    update: profileData,
  });

  // Also update CallerPersonalityProfile with all parameter values
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

  if (verbose) {
    console.log(
      `   ✅ Aggregated ${scores.length} scores for caller ${callerId.substring(0, 8)}...`
    );
    for (const [pid, val] of Object.entries(aggregatedValues).slice(0, 5)) {
      console.log(`      ${pid}: ${val.toFixed(2)}`);
    }
  }
}

/**
 * Legacy fallback: analyze using Parameter name matching (no specs)
 */
async function legacyAnalyzePersonality(
  options: PersonalityAnalyzerOptions
): Promise<AnalysisResult> {
  console.log("\n⚠️  Running in LEGACY mode (no AnalysisSpecs)");
  console.log("   Create MEASURE-type AnalysisSpecs for spec-driven analysis.\n");

  const result: AnalysisResult = {
    callsAnalyzed: 0,
    scoresCreated: 0,
    profilesAggregated: 0,
    specsUsed: 0,
    errors: [],
    scores: [],
  };

  // Load trait mapping from spec
  const traitMapping = await loadTraitMapping();
  const reverseMapping = getReverseTraitMapping(traitMapping);
  const parameterIds = Object.keys(traitMapping);

  // Get parameters using spec-driven trait mapping
  const params = await prisma.parameter.findMany({
    where: {
      parameterId: { in: parameterIds },
    },
    include: {
      scoringAnchors: { take: 3 },
    },
  });

  if (params.length === 0) {
    result.errors.push("No Big Five parameters found in database");
    return result;
  }

  // Find calls
  const callWhere: any = {
    callerId: { not: null },
    transcript: { not: "" },
    personalityObservation: null,
  };

  if (options.callId) callWhere.id = options.callId;
  if (options.callerId) callWhere.callerId = options.callerId;

  const calls = await prisma.call.findMany({
    where: callWhere,
    take: options.callId ? 1 : (options.limit || 50),
    orderBy: { createdAt: "desc" },
  });

  if (calls.length === 0) {
    result.errors.push("No unprocessed calls found");
    return result;
  }

  const callerIds = new Set<string>();

  for (const call of calls) {
    if (!call.callerId || !call.transcript) continue;

    result.callsAnalyzed++;
    callerIds.add(call.callerId);

    const traitScores: Record<string, number | null> = {
      openness: null,
      conscientiousness: null,
      extraversion: null,
      agreeableness: null,
      neuroticism: null,
    };

    for (const param of params) {
      // Find trait name for this parameter using loaded mapping
      const traitName = traitMapping[param.parameterId];
      if (!traitName) continue;
      const score = 0.3 + Math.random() * 0.4; // Mock score
      traitScores[traitName as keyof typeof traitScores] = score;
      result.scoresCreated++;
    }

    // Create PersonalityObservation (legacy table)
    await prisma.personalityObservation.create({
      data: {
        callId: call.id,
        callerId: call.callerId,
        ...traitScores,
        observedAt: call.createdAt,
        confidence: 0.6,
        decayFactor: 1.0,
      },
    });
  }

  // Aggregate
  if (options.aggregate && callerIds.size > 0) {
    for (const uid of callerIds) {
      await aggregateCallerPersonality(uid, options.halfLifeDays || 30, options.verbose || false);
      result.profilesAggregated++;
    }
  }

  console.log("\n✅ LEGACY ANALYSIS COMPLETE");
  console.log(`Calls analyzed: ${result.callsAnalyzed}`);
  console.log(`Scores created: ${result.scoresCreated}`);

  return result;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  const options: PersonalityAnalyzerOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    plan: args.includes("--plan"),
    mock: !args.includes("--no-mock"),
    callId: args.find((a) => a.startsWith("--call="))?.split("=")[1],
    callerId: args.find((a) => a.startsWith("--user="))?.split("=")[1],
    limit: parseInt(
      args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "50"
    ),
    aggregate: !args.includes("--no-aggregate"),
    halfLifeDays: parseInt(
      args.find((a) => a.startsWith("--half-life="))?.split("=")[1] || "30"
    ),
    specSlug: args.find((a) => a.startsWith("--spec="))?.split("=")[1],
  };

  analyzePersonality(options)
    .then((result) => {
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
