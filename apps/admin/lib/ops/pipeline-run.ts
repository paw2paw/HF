/**
 * pipeline-run.ts
 *
 * End-to-End Pipeline Operation
 *
 * Chains together all the analysis operations:
 * 1. Process transcripts → Call + Caller records
 * 2. Analyze personality → CallScore + CallerPersonality
 * 3. Extract memories → CallerMemory + CallerMemorySummary
 * 4. Generate prompts → Ready for LLM use
 *
 * This provides a single operation that takes raw transcripts and produces
 * prompt-ready caller profiles.
 */

import { PrismaClient } from "@prisma/client";
import { processTranscripts } from "./transcripts-process";
import { analyzePersonality } from "./personality-analyze";
import { extractMemories } from "./memory-extract";

const prisma = new PrismaClient();

export interface PipelineOptions {
  verbose?: boolean;
  plan?: boolean;
  mock?: boolean;              // Use mock scoring/extraction
  filepath?: string;           // Process specific transcript file
  callerId?: string;           // Process specific caller only
  limit?: number;              // Max calls to process per step
  skipTranscripts?: boolean;   // Skip transcript processing
  skipPersonality?: boolean;   // Skip personality analysis
  skipMemory?: boolean;        // Skip memory extraction
  generatePrompts?: boolean;   // Generate prompts after analysis
}

export interface PipelineResult {
  success: boolean;
  stages: {
    transcripts?: {
      filesProcessed: number;
      callsExtracted: number;
      callersCreated: number;
      errors: string[];
    };
    personality?: {
      callsAnalyzed: number;
      scoresCreated: number;
      profilesAggregated: number;
      errors: string[];
    };
    memory?: {
      callsProcessed: number;
      memoriesExtracted: number;
      memoriesStored: number;
      errors: string[];
    };
    prompts?: {
      callersProcessed: number;
      promptsGenerated: number;
      errors: string[];
    };
  };
  summary: {
    totalCallers: number;
    callersWithPersonality: number;
    callersWithMemories: number;
    callersReadyForPrompts: number;
  };
  errors: string[];
}

export async function runPipeline(
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const {
    verbose = false,
    plan = false,
    mock = true,
    filepath,
    callerId,
    limit = 100,
    skipTranscripts = false,
    skipPersonality = false,
    skipMemory = false,
    generatePrompts = true,
  } = options;

  const result: PipelineResult = {
    success: false,
    stages: {},
    summary: {
      totalCallers: 0,
      callersWithPersonality: 0,
      callersWithMemories: 0,
      callersReadyForPrompts: 0,
    },
    errors: [],
  };

  if (plan) {
    console.log("\n📋 PIPELINE PLAN\n");
    console.log("This operation chains multiple analysis steps:\n");

    if (!skipTranscripts) {
      console.log("1️⃣  TRANSCRIPTS:PROCESS");
      console.log("   - Scan for JSON files in HF_KB_PATH/sources/transcripts/");
      console.log("   - Extract calls and create User records");
      console.log("   - Output: Call + User records in database\n");
    }

    if (!skipPersonality) {
      console.log("2️⃣  PERSONALITY:ANALYZE");
      console.log("   - Load MEASURE-type AnalysisSpecs");
      console.log("   - Score each call against specs");
      console.log(`   - Mode: ${mock ? "MOCK (pattern-based)" : "LLM (real scoring)"}`);
      console.log("   - Output: CallScore + UserPersonality records\n");
    }

    if (!skipMemory) {
      console.log("3️⃣  MEMORY:EXTRACT");
      console.log("   - Load LEARN-type AnalysisSpecs");
      console.log("   - Extract key-value memories from transcripts");
      console.log(`   - Mode: ${mock ? "MOCK (pattern-based)" : "LLM (real extraction)"}`);
      console.log("   - Output: UserMemory + UserMemorySummary records\n");
    }

    if (generatePrompts) {
      console.log("4️⃣  PROMPT GENERATION (Ready)");
      console.log("   - Users now have personality + memories");
      console.log("   - Call GET /api/prompt/generate to see available users");
      console.log("   - Call POST /api/prompt/generate { callerId: '...' } to generate\n");
    }

    console.log("Effects:");
    console.log("- Reads: Transcript files, AnalysisSpecs, Parameters");
    console.log("- Writes: ProcessedFile, Call, User, CallScore, UserPersonality,");
    console.log("          UserMemory, UserMemorySummary");
    console.log("\nRun without --plan to execute.\n");

    return result;
  }

  console.log("\n🚀 RUNNING END-TO-END PIPELINE\n");
  const startTime = Date.now();

  try {
    // Stage 1: Process Transcripts
    if (!skipTranscripts) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1️⃣  PROCESSING TRANSCRIPTS\n");

      const transcriptResult = await processTranscripts({
        autoDetectType: true,
        createCallers: true,
        filepath,
      });

      result.stages.transcripts = {
        filesProcessed: transcriptResult.filesProcessed,
        callsExtracted: transcriptResult.callsExtracted,
        callersCreated: transcriptResult.callersCreated,
        errors: transcriptResult.errors,
      };

      if (transcriptResult.errors.length > 0) {
        result.errors.push(...transcriptResult.errors.map((e) => `[transcripts] ${e}`));
      }

      if (verbose) {
        console.log(`   Files: ${transcriptResult.filesProcessed}`);
        console.log(`   Calls: ${transcriptResult.callsExtracted}`);
        console.log(`   Callers: ${transcriptResult.callersCreated}`);
      }
    }

    // Stage 2: Personality Analysis
    if (!skipPersonality) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("2️⃣  ANALYZING PERSONALITY\n");

      const personalityResult = await analyzePersonality({
        verbose,
        mock,
        callerId,
        limit,
        aggregate: true,
        halfLifeDays: 30,
      });

      result.stages.personality = {
        callsAnalyzed: personalityResult.callsAnalyzed,
        scoresCreated: personalityResult.scoresCreated,
        profilesAggregated: personalityResult.profilesAggregated,
        errors: personalityResult.errors,
      };

      if (personalityResult.errors.length > 0) {
        result.errors.push(...personalityResult.errors.map((e) => `[personality] ${e}`));
      }
    }

    // Stage 3: Memory Extraction
    if (!skipMemory) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("3️⃣  EXTRACTING MEMORIES\n");

      const memoryResult = await extractMemories({
        verbose,
        mock,
        callerId,
        limit,
        aggregate: true,
        confidenceThreshold: 0.5,
      });

      result.stages.memory = {
        callsProcessed: memoryResult.callsProcessed,
        memoriesExtracted: memoryResult.memoriesExtracted,
        memoriesStored: memoryResult.memoriesStored,
        errors: memoryResult.errors,
      };

      if (memoryResult.errors.length > 0) {
        result.errors.push(...memoryResult.errors.map((e) => `[memory] ${e}`));
      }
    }

    // Stage 4: Summary & Prompt Readiness
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("4️⃣  CHECKING PROMPT READINESS\n");

    // Get summary counts
    const [totalCallers, callersWithPersonality, callersWithMemories] = await Promise.all([
      prisma.caller.count(),
      prisma.callerPersonality.count(),
      prisma.callerMemory.count({
        where: { supersededById: null },
      }).then(async () => {
        // Count distinct callers with memories
        const callers = await prisma.callerMemory.groupBy({
          by: ["callerId"],
          where: { supersededById: null },
        });
        return callers.length;
      }),
    ]);

    // Callers ready for prompts = have both personality AND memories
    const readyCallers = await prisma.caller.findMany({
      where: {
        personality: { isNot: null },
        memories: { some: { supersededById: null } },
      },
      select: { id: true, name: true, email: true },
    });

    result.summary = {
      totalCallers,
      callersWithPersonality,
      callersWithMemories,
      callersReadyForPrompts: readyCallers.length,
    };

    if (generatePrompts && readyCallers.length > 0) {
      result.stages.prompts = {
        callersProcessed: readyCallers.length,
        promptsGenerated: 0, // We don't auto-generate, just mark as ready
        errors: [],
      };

      console.log(`   ✅ ${readyCallers.length} caller(s) ready for prompt generation:\n`);
      for (const caller of readyCallers.slice(0, 5)) {
        console.log(`      - ${caller.name || caller.email || caller.id}`);
      }
      if (readyCallers.length > 5) {
        console.log(`      ... and ${readyCallers.length - 5} more`);
      }

      console.log("\n   To generate prompts:");
      console.log("   POST /api/prompt/generate { \"callerId\": \"<caller-id>\" }");
    } else if (readyCallers.length === 0) {
      console.log("   ⚠️  No callers ready for prompts yet");
      console.log("      Need: personality scores + memories");
    }

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ PIPELINE COMPLETE\n");
    console.log(`   Duration: ${duration}s`);
    console.log(`   Total callers: ${totalCallers}`);
    console.log(`   With personality: ${callersWithPersonality}`);
    console.log(`   With memories: ${callersWithMemories}`);
    console.log(`   Ready for prompts: ${readyCallers.length}`);

    if (result.errors.length > 0) {
      console.log(`\n   ⚠️  Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach((e) => console.log(`      - ${e}`));
    }

    result.success = result.errors.length === 0;
    return result;

  } catch (error: any) {
    console.error("\n❌ Pipeline failed:", error.message);
    result.errors.push(`Pipeline error: ${error.message}`);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  const options: PipelineOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    plan: args.includes("--plan"),
    mock: !args.includes("--no-mock"),
    filepath: args.find((a) => a.startsWith("--file="))?.split("=")[1],
    callerId: args.find((a) => a.startsWith("--user="))?.split("=")[1],
    limit: parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100"),
    skipTranscripts: args.includes("--skip-transcripts"),
    skipPersonality: args.includes("--skip-personality"),
    skipMemory: args.includes("--skip-memory"),
    generatePrompts: !args.includes("--no-prompts"),
  };

  runPipeline(options)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
