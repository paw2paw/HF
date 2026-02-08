/**
 * AdaptCalculator - Computes ADAPT parameters (deltas, goals)
 *
 * This service runs AFTER MEASURE specs complete and:
 * 1. Loads previous call scores for the user
 * 2. Computes deltas (current - previous)
 * 3. Computes goal progress (current / target)
 * 4. Stores results as CallScores for ADAPT parameters
 */

import { PrismaClient, ParameterType } from "@prisma/client";

const prisma = new PrismaClient();

export interface AdaptResult {
  parameterId: string;
  parameterName: string;
  parameterType: ParameterType;
  score: number;
  confidence: number;
  evidence: string;
  baseParameterId?: string;
  previousValue?: number;
  currentValue?: number;
  goalTarget?: number;
}

export interface AdaptCalculationResult {
  callId: string;
  callerId: string;
  adaptScores: AdaptResult[];
  previousCallId?: string;
  callSequence: number;
}

/**
 * Calculate ADAPT parameter scores for a call
 *
 * @param callId - The call to calculate ADAPT scores for
 * @param analysisRunId - The analysis run to attach scores to
 * @returns Calculated ADAPT scores
 */
export async function calculateAdaptScores(
  callId: string,
  analysisRunId: string
): Promise<AdaptCalculationResult> {
  // 1. Get the call with caller info
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      caller: true,
      scores: {
        include: { parameter: true },
      },
    },
  });

  if (!call) {
    throw new Error(`Call not found: ${callId}`);
  }

  if (!call.callerId) {
    throw new Error(`Call ${callId} has no callerId - cannot calculate ADAPT scores`);
  }

  // 2. Get all ADAPT parameters
  const adaptParameters = await prisma.parameter.findMany({
    where: {
      parameterType: { in: ["ADAPT", "GOAL"] },
    },
  });

  if (adaptParameters.length === 0) {
    return {
      callId,
      callerId: call.callerId,
      adaptScores: [],
      callSequence: call.callSequence || 1,
    };
  }

  // 3. Find previous call for this caller
  const previousCall = await prisma.call.findFirst({
    where: {
      callerId: call.callerId,
      id: { not: callId },
      createdAt: { lt: call.createdAt },
    },
    orderBy: { createdAt: "desc" },
    include: {
      scores: {
        include: { parameter: true },
      },
    },
  });

  // 4. Determine call sequence
  const callSequence = previousCall
    ? (previousCall.callSequence || 0) + 1
    : 1;

  // Update call with sequence and previous call link
  await prisma.call.update({
    where: { id: callId },
    data: {
      callSequence,
      previousCallId: previousCall?.id || null,
    },
  });

  // 5. Build score maps for easy lookup
  const currentScores = new Map<string, number>();
  for (const score of call.scores) {
    if (score.score !== null) {
      currentScores.set(score.parameterId, score.score);
    }
  }

  const previousScores = new Map<string, number>();
  if (previousCall) {
    for (const score of previousCall.scores) {
      if (score.score !== null) {
        previousScores.set(score.parameterId, score.score);
      }
    }
  }

  // 6. Calculate ADAPT scores
  const adaptScores: AdaptResult[] = [];

  for (const param of adaptParameters) {
    if (param.parameterType === "ADAPT" && param.baseParameterId) {
      // Delta calculation
      const currentValue = currentScores.get(param.baseParameterId);
      const previousValue = previousScores.get(param.baseParameterId);

      if (currentValue !== undefined) {
        let delta: number;
        let confidence: number;
        let evidence: string;

        if (previousValue !== undefined) {
          delta = currentValue - previousValue;
          confidence = 0.9; // High confidence when we have both values
          evidence = `Delta: ${currentValue.toFixed(2)} - ${previousValue.toFixed(2)} = ${delta.toFixed(2)}`;
        } else {
          // No previous value - delta is 0 (no change from "baseline")
          delta = 0;
          confidence = 0.5; // Lower confidence - no comparison available
          evidence = `First call for caller - no previous ${param.baseParameterId} score to compare`;
        }

        adaptScores.push({
          parameterId: param.parameterId,
          parameterName: param.name,
          parameterType: param.parameterType,
          score: delta,
          confidence,
          evidence,
          baseParameterId: param.baseParameterId,
          previousValue,
          currentValue,
        });
      }
    } else if (param.parameterType === "GOAL" && param.baseParameterId && param.goalTarget) {
      // Goal progress calculation
      const currentValue = currentScores.get(param.baseParameterId);

      if (currentValue !== undefined) {
        // Calculate progress as percentage toward goal (capped at 1.0)
        const progress = Math.min(currentValue / param.goalTarget, 1.0);
        const evidence = `Goal progress: ${currentValue.toFixed(2)} / ${param.goalTarget.toFixed(2)} = ${(progress * 100).toFixed(0)}%`;

        adaptScores.push({
          parameterId: param.parameterId,
          parameterName: param.name,
          parameterType: param.parameterType,
          score: progress,
          confidence: 0.95, // Goal progress is straightforward
          evidence,
          baseParameterId: param.baseParameterId,
          currentValue,
          goalTarget: param.goalTarget,
        });
      }
    }
  }

  // 7. Store ADAPT scores as CallScores
  for (const adaptScore of adaptScores) {
    await prisma.callScore.upsert({
      where: {
        analysisRunId_callId_parameterId: {
          analysisRunId,
          callId,
          parameterId: adaptScore.parameterId,
        },
      },
      create: {
        analysisRunId,
        callId,
        parameterId: adaptScore.parameterId,
        score: adaptScore.score,
        confidence: adaptScore.confidence,
        evidence: adaptScore.evidence ? [adaptScore.evidence] : [],
      },
      update: {
        score: adaptScore.score,
        confidence: adaptScore.confidence,
        evidence: adaptScore.evidence ? [adaptScore.evidence] : [],
      },
    });
  }

  return {
    callId,
    callerId: call.callerId,
    adaptScores,
    previousCallId: previousCall?.id,
    callSequence,
  };
}

/**
 * Calculate session momentum - average delta over last N calls
 *
 * @param callerId - Caller to calculate momentum for
 * @param parameterId - Base parameter to track (e.g., "engagement")
 * @param windowSize - Number of calls to consider (default 3)
 */
export async function calculateSessionMomentum(
  callerId: string,
  parameterId: string,
  windowSize: number = 3
): Promise<{ momentum: number; confidence: number; evidence: string }> {
  // Get last N calls with scores for this parameter
  const recentCalls = await prisma.call.findMany({
    where: { callerId },
    orderBy: { createdAt: "desc" },
    take: windowSize + 1, // Need N+1 to calculate N deltas
    include: {
      scores: {
        where: { parameterId },
      },
    },
  });

  if (recentCalls.length < 2) {
    return {
      momentum: 0,
      confidence: 0.3,
      evidence: `Insufficient calls (${recentCalls.length}) to calculate momentum`,
    };
  }

  // Calculate deltas between consecutive calls
  const deltas: number[] = [];
  for (let i = 0; i < recentCalls.length - 1; i++) {
    const current = recentCalls[i].scores[0]?.score;
    const previous = recentCalls[i + 1].scores[0]?.score;

    if (current !== null && current !== undefined && previous !== null && previous !== undefined) {
      deltas.push(current - previous);
    }
  }

  if (deltas.length === 0) {
    return {
      momentum: 0,
      confidence: 0.3,
      evidence: `No valid score pairs found for ${parameterId}`,
    };
  }

  // Average the deltas
  const momentum = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  const confidence = Math.min(0.5 + deltas.length * 0.15, 0.95);
  const evidence = `Average of ${deltas.length} deltas: [${deltas.map(d => d.toFixed(2)).join(", ")}] = ${momentum.toFixed(3)}`;

  return { momentum, confidence, evidence };
}

/**
 * Get user's current ADAPT state
 * Useful for prompt generation
 */
export async function getUserAdaptState(callerId: string): Promise<{
  latestCall?: {
    id: string;
    callSequence: number;
    createdAt: Date;
  };
  adaptScores: Record<string, number>;
  trendingUp: string[];
  trendingDown: string[];
  goalProgress: Record<string, { progress: number; target: number }>;
}> {
  // Get latest call with ADAPT scores
  const latestCall = await prisma.call.findFirst({
    where: { callerId },
    orderBy: { createdAt: "desc" },
    include: {
      scores: {
        include: {
          parameter: true,
        },
      },
    },
  });

  if (!latestCall) {
    return {
      adaptScores: {},
      trendingUp: [],
      trendingDown: [],
      goalProgress: {},
    };
  }

  const adaptScores: Record<string, number> = {};
  const goalProgress: Record<string, { progress: number; target: number }> = {};
  const trendingUp: string[] = [];
  const trendingDown: string[] = [];

  for (const score of latestCall.scores) {
    if (score.parameter.parameterType === "ADAPT") {
      adaptScores[score.parameterId] = score.score || 0;

      // Track trends
      if (score.score && score.score > 0.1) {
        trendingUp.push(score.parameter.baseParameterId || score.parameterId);
      } else if (score.score && score.score < -0.1) {
        trendingDown.push(score.parameter.baseParameterId || score.parameterId);
      }
    } else if (score.parameter.parameterType === "GOAL") {
      goalProgress[score.parameter.baseParameterId || score.parameterId] = {
        progress: score.score || 0,
        target: score.parameter.goalTarget || 1.0,
      };
    }
  }

  return {
    latestCall: {
      id: latestCall.id,
      callSequence: latestCall.callSequence || 1,
      createdAt: latestCall.createdAt,
    },
    adaptScores,
    trendingUp,
    trendingDown,
    goalProgress,
  };
}
