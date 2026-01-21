/**
 * personality-analyze.ts
 *
 * Extracts personality traits from call transcripts using Parameters as scoring rubric.
 * Creates PersonalityObservation records (time series) instead of directly updating UserPersonality.
 *
 * Flow:
 * 1. Query Parameters table for personality-related parameters (openness, conscientiousness, etc.)
 * 2. For each call without a PersonalityObservation, analyze transcript content
 * 3. Score each personality trait using Parameter definitions as rubric
 * 4. Create PersonalityObservation record (time series data point)
 * 5. Optionally aggregate observations into UserPersonality (with decay)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PersonalityAnalyzerOptions {
  verbose?: boolean;
  plan?: boolean;
  callId?: string; // Analyze specific call, or all unprocessed calls if not provided
  aggregate?: boolean; // Whether to re-aggregate UserPersonality after creating observations
  halfLifeDays?: number; // Decay half-life for aggregation (default 30)
}

// Map Parameter names to PersonalityObservation fields
const PERSONALITY_TRAIT_MAPPING: Record<string, keyof PersonalityTraits> = {
  openness: "openness",
  conscientiousness: "conscientiousness",
  extraversion: "extraversion",
  agreeableness: "agreeableness",
  neuroticism: "neuroticism",
};

type PersonalityTraits = {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
};

interface AnalysisResult {
  callsAnalyzed: number;
  observationsCreated: number;
  profilesAggregated: number;
  traitsScored: number;
  errors: string[];
}

export async function analyzePersonality(
  options: PersonalityAnalyzerOptions = {}
): Promise<AnalysisResult> {
  const { verbose = false, plan = false, callId, aggregate = true, halfLifeDays = 30 } = options;

  const result: AnalysisResult = {
    callsAnalyzed: 0,
    observationsCreated: 0,
    profilesAggregated: 0,
    traitsScored: 0,
    errors: [],
  };

  if (plan) {
    console.log("\n📋 PERSONALITY ANALYZER PLAN\n");
    console.log("Steps:");
    console.log("1. Query Parameters table for personality-related parameters");
    console.log("2. Find calls without PersonalityObservation records");
    if (callId) {
      console.log("   - Analyzing specific call:", callId);
    } else {
      console.log("   - Analyzing ALL unprocessed calls");
    }
    console.log("3. For each call:");
    console.log("   - Score each personality trait using Parameter definitions");
    console.log("   - Create PersonalityObservation record");
    if (aggregate) {
      console.log("4. Re-aggregate UserPersonality profiles with time decay");
      console.log("   - Half-life:", halfLifeDays, "days");
    }
    console.log("\nEffects:");
    console.log("- Reads: Parameter table, Call table");
    console.log("- Writes: PersonalityObservation table");
    if (aggregate) {
      console.log("- Updates: UserPersonality table");
    }
    console.log("\nRun without --plan to execute.\n");
    return result;
  }

  try {
    // Step 1: Get personality-related Parameters
    if (verbose) console.log("\n🔍 Fetching personality parameters from knowledge bank...");

    const personalityParams = await prisma.parameter.findMany({
      where: {
        OR: [
          { name: { contains: "openness", mode: "insensitive" } },
          { name: { contains: "conscientiousness", mode: "insensitive" } },
          { name: { contains: "extraversion", mode: "insensitive" } },
          { name: { contains: "agreeableness", mode: "insensitive" } },
          { name: { contains: "neuroticism", mode: "insensitive" } },
        ],
      },
    });

    if (personalityParams.length === 0) {
      const msg =
        "⚠️  No personality parameters found in knowledge bank. Please create Parameters with names like 'openness', 'conscientiousness', etc.";
      console.log(msg);
      result.errors.push(msg);
      return result;
    }

    if (verbose) {
      console.log(`✅ Found ${personalityParams.length} personality parameters:`);
      personalityParams.forEach((p) => console.log(`   - ${p.name}`));
    }

    // Step 2: Find calls without PersonalityObservation
    const whereClause: any = callId
      ? { id: callId }
      : {
          personalityObservation: null, // Only calls without observations
          userId: { not: null }, // Must have a user
        };

    const calls = await prisma.call.findMany({
      where: whereClause,
      include: {
        user: true,
        controlSet: true,
        personalityObservation: true,
      },
    });

    if (calls.length === 0) {
      const msg = callId
        ? `⚠️  Call ${callId} not found or already has observation`
        : "⚠️  No unprocessed calls found";
      console.log(msg);
      result.errors.push(msg);
      return result;
    }

    if (verbose) {
      console.log(`\n📞 Found ${calls.length} call(s) to analyze`);
    }

    // Step 3: Analyze each call and create observations
    const userIds = new Set<string>();

    for (const call of calls) {
      if (!call.userId) {
        if (verbose) {
          console.log(`⏭️  Skipping call ${call.id} (no userId)`);
        }
        continue;
      }

      result.callsAnalyzed++;
      userIds.add(call.userId);

      if (verbose) {
        console.log(`\n📊 Analyzing call ${call.id} for user ${call.userId}...`);
        if (call.controlSet) {
          console.log(`   ControlSet: ${call.controlSet.name} (${call.controlSet.id})`);
        }
      }

      // Score each personality trait
      const personalityScores: PersonalityTraits = {
        openness: null,
        conscientiousness: null,
        extraversion: null,
        agreeableness: null,
        neuroticism: null,
      };

      let observationConfidence = 0;
      let traitsScored = 0;

      for (const param of personalityParams) {
        const traitField = PERSONALITY_TRAIT_MAPPING[param.name.toLowerCase()];
        if (!traitField) {
          if (verbose) {
            console.log(`   ⚠️  Unknown personality trait: ${param.name}`);
          }
          continue;
        }

        // Score this trait using the Parameter as a rubric
        const score = await scorePersonalityTrait(call.transcript, param, verbose);
        personalityScores[traitField] = score;
        result.traitsScored++;
        traitsScored++;

        if (verbose) {
          console.log(`   ✓ ${param.name}: ${score.toFixed(2)}`);
        }
      }

      // Calculate observation confidence based on transcript length and traits scored
      const transcriptLength = call.transcript?.length || 0;
      if (transcriptLength > 500 && traitsScored >= 3) {
        observationConfidence = 0.9;
      } else if (transcriptLength > 200 && traitsScored >= 2) {
        observationConfidence = 0.7;
      } else {
        observationConfidence = 0.5;
      }

      // Create PersonalityObservation
      await prisma.personalityObservation.create({
        data: {
          callId: call.id,
          userId: call.userId,
          controlSetId: call.controlSetId,
          ...personalityScores,
          observedAt: call.createdAt,
          confidence: observationConfidence,
          decayFactor: 1.0,
        },
      });

      result.observationsCreated++;

      if (verbose) {
        console.log(`   ✅ Created PersonalityObservation (confidence: ${observationConfidence.toFixed(2)})`);
      }
    }

    // Step 4: Aggregate UserPersonality profiles (if requested)
    if (aggregate && userIds.size > 0) {
      if (verbose) {
        console.log(`\n🔄 Aggregating personality profiles for ${userIds.size} user(s)...`);
      }

      for (const userId of userIds) {
        await aggregateUserPersonality(userId, halfLifeDays, verbose);
        result.profilesAggregated++;
      }
    }

    // Summary
    console.log("\n✅ PERSONALITY ANALYSIS COMPLETE\n");
    console.log(`Calls analyzed: ${result.callsAnalyzed}`);
    console.log(`Observations created: ${result.observationsCreated}`);
    console.log(`Total traits scored: ${result.traitsScored}`);
    if (aggregate) {
      console.log(`Profiles aggregated: ${result.profilesAggregated}`);
    }
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${result.errors.length}`);
      result.errors.forEach((err) => console.log(`   - ${err}`));
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
 * Score a personality trait using a Parameter as the rubric
 *
 * Uses the Parameter's definition, interpretationHigh, interpretationLow as context
 * to evaluate the transcript content.
 *
 * For now, this is a mock implementation. In production, this would call an LLM
 * with the Parameter definition as a scoring rubric.
 */
async function scorePersonalityTrait(
  transcriptText: string,
  parameter: any,
  verbose: boolean
): Promise<number> {
  // TODO: Replace with actual LLM call
  //
  // const prompt = `
  //   Analyze this transcript and score the person's ${parameter.name}.
  //
  //   Definition: ${parameter.definition}
  //
  //   High indicators (score near 1.0): ${parameter.interpretationHigh}
  //   Low indicators (score near 0.0): ${parameter.interpretationLow}
  //
  //   Transcript:
  //   ${transcriptText.substring(0, 4000)} // Limit for token length
  //
  //   Return ONLY a decimal score from 0.0 (very low) to 1.0 (very high).
  // `;
  //
  // const score = await callOpenAI(prompt);
  // return parseFloat(score);

  // Mock implementation: return random score for now
  const mockScore = 0.3 + Math.random() * 0.4; // Between 0.3 and 0.7

  if (verbose) {
    console.log(
      `   [MOCK] Scoring ${parameter.name} based on definition: "${parameter.definition?.substring(0, 60)}..."`
    );
  }

  return mockScore;
}

/**
 * Aggregate personality observations into UserPersonality profile with time decay
 *
 * Uses exponential decay: weight = exp(-ln(2) * age / halfLife)
 */
async function aggregateUserPersonality(
  userId: string,
  halfLifeDays: number,
  verbose: boolean
): Promise<void> {
  // Get all observations for this user
  const observations = await prisma.personalityObservation.findMany({
    where: { userId },
    orderBy: { observedAt: "desc" },
  });

  if (observations.length === 0) {
    if (verbose) {
      console.log(`   ⏭️  No observations for user ${userId}`);
    }
    return;
  }

  const now = new Date();

  // Aggregate each trait
  const aggregated: PersonalityTraits = {
    openness: aggregateTrait(observations, "openness", now, halfLifeDays),
    conscientiousness: aggregateTrait(observations, "conscientiousness", now, halfLifeDays),
    extraversion: aggregateTrait(observations, "extraversion", now, halfLifeDays),
    agreeableness: aggregateTrait(observations, "agreeableness", now, halfLifeDays),
    neuroticism: aggregateTrait(observations, "neuroticism", now, halfLifeDays),
  };

  // Calculate overall confidence
  const totalWeight = observations.reduce((sum, obs) => {
    const weight = calculateDecayWeight(obs.observedAt, now, halfLifeDays);
    return sum + weight * (obs.confidence ?? 1.0);
  }, 0);

  const confidenceScore = Math.min(1.0, totalWeight / observations.length);

  // Upsert UserPersonality
  await prisma.userPersonality.upsert({
    where: { userId },
    create: {
      userId,
      ...aggregated,
      lastAggregatedAt: now,
      observationsUsed: observations.length,
      confidenceScore,
      decayHalfLife: halfLifeDays,
    },
    update: {
      ...aggregated,
      lastAggregatedAt: now,
      observationsUsed: observations.length,
      confidenceScore,
      decayHalfLife: halfLifeDays,
    },
  });

  if (verbose) {
    console.log(`   ✅ Aggregated ${observations.length} observations for user ${userId}`);
    console.log(`      Openness: ${aggregated.openness?.toFixed(2) ?? "N/A"}`);
    console.log(`      Conscientiousness: ${aggregated.conscientiousness?.toFixed(2) ?? "N/A"}`);
    console.log(`      Confidence: ${confidenceScore.toFixed(2)}`);
  }
}

/**
 * Calculate decay weight for an observation based on age
 *
 * Uses exponential decay: weight = exp(-ln(2) * age / halfLife)
 */
function calculateDecayWeight(observedAt: Date, now: Date, halfLifeDays: number): number {
  const ageInDays = (now.getTime() - observedAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayConstant = Math.log(2) / halfLifeDays;
  return Math.exp(-decayConstant * ageInDays);
}

/**
 * Aggregate a single personality trait across observations with decay
 */
function aggregateTrait(
  observations: any[],
  trait: keyof PersonalityTraits,
  now: Date,
  halfLifeDays: number
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const obs of observations) {
    const traitValue = obs[trait];
    if (traitValue === null || traitValue === undefined) continue;

    const weight = calculateDecayWeight(obs.observedAt, now, halfLifeDays) * (obs.confidence ?? 1.0);
    weightedSum += traitValue * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: PersonalityAnalyzerOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    plan: args.includes("--plan"),
    callId: args.find((a) => a.startsWith("--call="))?.split("=")[1],
    aggregate: !args.includes("--no-aggregate"),
    halfLifeDays: parseInt(args.find((a) => a.startsWith("--half-life="))?.split("=")[1] || "30"),
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
