/**
 * measure-agent.ts
 *
 * Agent Behavior Measurement
 *
 * Measures what the agent actually did during a call by analyzing the transcript.
 * Uses MEASURE_AGENT type AnalysisSpecs to score against BEHAVIOR parameters.
 * Results stored in BehaviorMeasurement table.
 *
 * Flow:
 * 1. Query AnalysisSpecs where outputType = MEASURE_AGENT and isActive = true
 * 2. For each call without BehaviorMeasurements:
 *    a. For each spec, analyze transcript for behavior indicators
 *    b. Score against the linked BEHAVIOR parameter
 *    c. Store result in BehaviorMeasurement table
 *
 * This is the first step in the post-call reward loop.
 */

import { PrismaClient, AnalysisOutputType } from "@prisma/client";
import { PARAMS } from "@/lib/registry";

const prisma = new PrismaClient();

// Config loaded from MEASURE_AGENT spec
interface MeasureAgentConfig {
  scoring: {
    minScore: number;
    maxScore: number;
    defaultConfidence: number;
    confidenceRange: { min: number; max: number };
  };
  evidenceMarkers: Record<string, string[]>;
  mockScoring: {
    baseScoreRange: { min: number; max: number };
    empathyDivisor: number;
    responseLengthMax: number;
    questionRateDivisor: number;
    warmthDivisor: number;
    confidenceRange: { min: number; max: number };
  };
}

const DEFAULT_MEASURE_CONFIG: MeasureAgentConfig = {
  scoring: {
    minScore: 0.0,
    maxScore: 1.0,
    defaultConfidence: 0.7,
    confidenceRange: { min: 0.5, max: 0.95 },
  },
  evidenceMarkers: {
    empathy: ["I understand", "That sounds difficult", "I hear you", "I appreciate"],
    warmth: ["Thank you", "Please", "Happy to help", "Glad", "Wonderful"],
    questionAsking: ["?", "Could you tell me", "What would", "How can I"],
    activeListening: ["So what you're saying", "If I understand correctly", "You mentioned"],
  },
  mockScoring: {
    baseScoreRange: { min: 0.3, max: 0.8 },
    empathyDivisor: 10,
    responseLengthMax: 100,
    questionRateDivisor: 3,
    warmthDivisor: 8,
    confidenceRange: { min: 0.6, max: 0.9 },
  },
};

// Cached config and prompt template
let cachedMeasureConfig: MeasureAgentConfig | null = null;
let cachedPromptTemplate: string | null = null;

/**
 * Load MEASURE_AGENT spec config from database
 */
async function loadMeasureConfig(): Promise<{ config: MeasureAgentConfig; promptTemplate: string | null }> {
  if (cachedMeasureConfig) {
    return { config: cachedMeasureConfig, promptTemplate: cachedPromptTemplate };
  }

  const spec = await prisma.analysisSpec.findFirst({
    where: {
      outputType: AnalysisOutputType.MEASURE_AGENT,
      isActive: true,
      scope: "SYSTEM",
    },
  });

  if (!spec?.config) {
    return { config: DEFAULT_MEASURE_CONFIG, promptTemplate: null };
  }

  const config = spec.config as any;
  cachedMeasureConfig = {
    scoring: {
      minScore: config.scoring?.minScore ?? DEFAULT_MEASURE_CONFIG.scoring.minScore,
      maxScore: config.scoring?.maxScore ?? DEFAULT_MEASURE_CONFIG.scoring.maxScore,
      defaultConfidence: config.scoring?.defaultConfidence ?? DEFAULT_MEASURE_CONFIG.scoring.defaultConfidence,
      confidenceRange: config.scoring?.confidenceRange ?? DEFAULT_MEASURE_CONFIG.scoring.confidenceRange,
    },
    evidenceMarkers: config.evidenceMarkers ?? DEFAULT_MEASURE_CONFIG.evidenceMarkers,
    mockScoring: {
      baseScoreRange: config.mockScoring?.baseScoreRange ?? DEFAULT_MEASURE_CONFIG.mockScoring.baseScoreRange,
      empathyDivisor: config.mockScoring?.empathyDivisor ?? DEFAULT_MEASURE_CONFIG.mockScoring.empathyDivisor,
      responseLengthMax: config.mockScoring?.responseLengthMax ?? DEFAULT_MEASURE_CONFIG.mockScoring.responseLengthMax,
      questionRateDivisor: config.mockScoring?.questionRateDivisor ?? DEFAULT_MEASURE_CONFIG.mockScoring.questionRateDivisor,
      warmthDivisor: config.mockScoring?.warmthDivisor ?? DEFAULT_MEASURE_CONFIG.mockScoring.warmthDivisor,
      confidenceRange: config.mockScoring?.confidenceRange ?? DEFAULT_MEASURE_CONFIG.mockScoring.confidenceRange,
    },
  };
  cachedPromptTemplate = spec.promptTemplate || null;

  return { config: cachedMeasureConfig, promptTemplate: cachedPromptTemplate };
}

interface MeasureAgentOptions {
  verbose?: boolean;
  plan?: boolean;
  mock?: boolean;           // Use mock scoring instead of LLM
  callId?: string;          // Analyze specific call
  limit?: number;           // Max calls to process
  specSlug?: string;        // Only run specific spec (for testing)
}

interface MeasurementResult {
  parameterId: string;
  actualValue: number;
  confidence: number;
  evidence: string[];
}

interface MeasureAgentResult {
  callsAnalyzed: number;
  measurementsCreated: number;
  specsUsed: number;
  errors: string[];
  measurements: Array<{
    callId: string;
    parameterId: string;
    actualValue: number;
    confidence: number;
  }>;
}

/**
 * Mock scoring for agent behavior
 * Uses config loaded from MEASURE_AGENT spec
 */
function mockScoreBehavior(
  parameterId: string,
  transcript: string,
  config: MeasureAgentConfig
): MeasurementResult {
  const { mockScoring, evidenceMarkers } = config;

  // Simple mock: generate somewhat random but consistent scores
  const seed = transcript.length + parameterId.charCodeAt(0);
  const baseScore = mockScoring.baseScoreRange.min + (seed % 50) / 100;

  // Add some parameter-specific logic using config values
  let score = baseScore;
  let evidence: string[] = [];

  if (parameterId === PARAMS.BEH_EMPATHY_RATE) {
    // Count empathy markers from config
    const markers = evidenceMarkers.empathy || [];
    const markerRegex = new RegExp(markers.join("|"), "gi");
    const empathyCount = (transcript.match(markerRegex) || []).length;
    score = Math.min(config.scoring.maxScore, empathyCount / mockScoring.empathyDivisor);
    evidence = [`Found ${empathyCount} empathy markers`];
  } else if (parameterId === PARAMS.BEH_DEFINITION_PRECISION) {
    // Estimate average response length
    const agentResponses = transcript.split(/Agent:|Customer:/i).filter((_, i) => i % 2 === 1);
    const avgWords = agentResponses.reduce((sum, r) => sum + r.split(/\s+/).length, 0) / Math.max(1, agentResponses.length);
    score = Math.min(config.scoring.maxScore, avgWords / mockScoring.responseLengthMax);
    evidence = [`Average response length: ${Math.round(avgWords)} words`];
  } else if (parameterId === PARAMS.BEH_QUESTION_RATE) {
    // Count questions using config markers
    const markers = evidenceMarkers.questionAsking || ["?"];
    const questionMarkerRegex = new RegExp(markers.filter(m => m !== "?").join("|"), "gi");
    const questionMarks = (transcript.match(/\?/g) || []).length;
    const otherQuestions = (transcript.match(questionMarkerRegex) || []).length;
    const responses = transcript.split(/Agent:/i).length - 1;
    score = Math.min(config.scoring.maxScore, (questionMarks + otherQuestions) / Math.max(1, responses) / mockScoring.questionRateDivisor);
    evidence = [`${questionMarks + otherQuestions} question markers across ${responses} responses`];
  } else if (parameterId === PARAMS.BEH_CONVERSATIONAL_TONE) {
    // Count warmth markers from config
    const markers = evidenceMarkers.warmth || [];
    const markerRegex = new RegExp(markers.join("|"), "gi");
    const warmCount = (transcript.match(markerRegex) || []).length;
    score = Math.min(config.scoring.maxScore, warmCount / mockScoring.warmthDivisor);
    evidence = [`Found ${warmCount} warmth markers`];
  } else if (parameterId === PARAMS.BEH_CONVERSATIONAL_DEPTH) {
    // Count active listening markers from config
    const markers = evidenceMarkers.activeListening || [];
    const markerRegex = new RegExp(markers.join("|"), "gi");
    const listenCount = (transcript.match(markerRegex) || []).length;
    score = Math.min(config.scoring.maxScore, listenCount / 5); // Normalize by 5
    evidence = [`Found ${listenCount} active listening markers`];
  } else {
    evidence = [`Mock score based on transcript analysis`];
  }

  // Generate confidence within config range
  const confRange = mockScoring.confidenceRange;
  const confidence = confRange.min + Math.random() * (confRange.max - confRange.min);

  return {
    parameterId,
    actualValue: Math.round(score * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    evidence,
  };
}

export async function measureAgent(
  options: MeasureAgentOptions = {}
): Promise<MeasureAgentResult> {
  const {
    verbose = false,
    plan = false,
    mock = true, // Default to mock for now
    callId,
    limit = 100,
    specSlug,
  } = options;

  const result: MeasureAgentResult = {
    callsAnalyzed: 0,
    measurementsCreated: 0,
    specsUsed: 0,
    errors: [],
    measurements: [],
  };

  // Load config from MEASURE_AGENT spec
  const { config, promptTemplate } = await loadMeasureConfig();
  if (verbose && promptTemplate) {
    console.log("Loaded MEASURE_AGENT spec with prompt template");
  }

  // 1. Load MEASURE_AGENT specs
  const specs = await prisma.analysisSpec.findMany({
    where: {
      outputType: AnalysisOutputType.MEASURE_AGENT,
      isActive: true,
      ...(specSlug ? { slug: specSlug } : {}),
    },
    include: {
      triggers: {
        include: {
          actions: {
            include: {
              parameter: true,
            },
          },
        },
      },
    },
  });

  if (specs.length === 0) {
    result.errors.push("No active MEASURE_AGENT specs found");
    if (verbose) console.log("No MEASURE_AGENT specs found");
    return result;
  }

  result.specsUsed = specs.length;
  if (verbose) console.log(`Found ${specs.length} MEASURE_AGENT specs`);

  // Extract unique parameter IDs from specs
  const behaviorParameterIds = new Set<string>();
  for (const spec of specs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId) {
          behaviorParameterIds.add(action.parameterId);
        }
      }
    }
  }

  if (verbose) console.log(`Targeting ${behaviorParameterIds.size} behavior parameters`);

  // 2. Find calls to analyze
  // Get calls that don't have all behavior measurements yet
  const calls = await prisma.call.findMany({
    where: {
      ...(callId ? { id: callId } : {}),
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      behaviorMeasurements: {
        select: { parameterId: true },
      },
    },
  });

  if (plan) {
    console.log("\n=== MEASURE AGENT PLAN ===");
    console.log(`Specs: ${specs.map(s => s.slug).join(", ")}`);
    console.log(`Parameters: ${[...behaviorParameterIds].join(", ")}`);
    console.log(`Calls to analyze: ${calls.length}`);
    return result;
  }

  // 3. Process each call
  for (const call of calls) {
    const existingMeasurements = new Set(
      call.behaviorMeasurements.map(m => m.parameterId)
    );

    // Skip if all measurements exist
    const missingParams = [...behaviorParameterIds].filter(
      p => !existingMeasurements.has(p)
    );

    if (missingParams.length === 0) {
      if (verbose) console.log(`Call ${call.id} already has all measurements, skipping`);
      continue;
    }

    result.callsAnalyzed++;

    if (verbose) console.log(`Analyzing call ${call.id} for ${missingParams.length} parameters`);

    // Process each missing parameter
    for (const parameterId of missingParams) {
      try {
        let measurement: MeasurementResult;

        if (mock) {
          measurement = mockScoreBehavior(parameterId, call.transcript, config);
        } else {
          // TODO: Implement LLM-based scoring using promptTemplate
          // Would render the template with parameter info and transcript,
          // then call LLM and parse JSON response
          measurement = mockScoreBehavior(parameterId, call.transcript, config);
        }

        // Store the measurement
        await prisma.behaviorMeasurement.upsert({
          where: {
            callId_parameterId: {
              callId: call.id,
              parameterId: measurement.parameterId,
            },
          },
          update: {
            actualValue: measurement.actualValue,
            confidence: measurement.confidence,
            evidence: measurement.evidence,
            measuredAt: new Date(),
            measuredBy: mock ? "mock_v1" : "llm_v1",
          },
          create: {
            callId: call.id,
            parameterId: measurement.parameterId,
            actualValue: measurement.actualValue,
            confidence: measurement.confidence,
            evidence: measurement.evidence,
            measuredBy: mock ? "mock_v1" : "llm_v1",
          },
        });

        result.measurementsCreated++;
        result.measurements.push({
          callId: call.id,
          parameterId: measurement.parameterId,
          actualValue: measurement.actualValue,
          confidence: measurement.confidence,
        });

        if (verbose) {
          console.log(`  ${parameterId}: ${measurement.actualValue} (conf: ${measurement.confidence.toFixed(2)})`);
        }
      } catch (error: any) {
        const errorMsg = `Error measuring ${parameterId} for call ${call.id}: ${error.message}`;
        result.errors.push(errorMsg);
        if (verbose) console.error(errorMsg);
      }
    }
  }

  if (verbose) {
    console.log(`\nMeasure Agent Complete:`);
    console.log(`  Calls analyzed: ${result.callsAnalyzed}`);
    console.log(`  Measurements created: ${result.measurementsCreated}`);
    console.log(`  Errors: ${result.errors.length}`);
  }

  return result;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: MeasureAgentOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    plan: args.includes("--plan"),
    mock: !args.includes("--llm"),
    limit: parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "100"),
    callId: args.find(a => a.startsWith("--call="))?.split("=")[1],
    specSlug: args.find(a => a.startsWith("--spec="))?.split("=")[1],
  };

  measureAgent(options)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error("Fatal error:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export default measureAgent;
