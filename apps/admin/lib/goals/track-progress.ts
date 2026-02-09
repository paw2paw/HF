/**
 * Goal Progress Tracking
 *
 * Updates goal progress based on call outcomes and curriculum completion.
 * Called after each call analysis to track progress toward goals.
 */

import { prisma } from "@/lib/prisma";
import { GoalType, GoalStatus } from "@prisma/client";
import { PARAMS } from "@/lib/registry";

export interface GoalProgressUpdate {
  goalId: string;
  progressDelta: number; // Amount to increment progress (0-1)
  evidence?: string;
}

/**
 * Track progress for all active goals after a call
 */
export async function trackGoalProgress(
  callerId: string,
  callId: string
): Promise<{ updated: number; completed: number }> {
  // Get active goals for this caller
  const goals = await prisma.goal.findMany({
    where: {
      callerId,
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
    include: {
      contentSpec: true,
    },
  });

  if (goals.length === 0) {
    return { updated: 0, completed: 0 };
  }

  let updatedCount = 0;
  let completedCount = 0;

  // Track progress for each goal type
  for (const goal of goals) {
    const progressUpdate = await calculateProgressUpdate(goal, callerId, callId);

    if (progressUpdate && progressUpdate.progressDelta > 0) {
      const newProgress = Math.min(1.0, goal.progress + progressUpdate.progressDelta);

      await prisma.goal.update({
        where: { id: goal.id },
        data: {
          progress: newProgress,
          updatedAt: new Date(),
          // Mark as completed if progress reaches 100%
          ...(newProgress >= 1.0 && {
            status: 'COMPLETED',
            completedAt: new Date(),
          }),
        },
      });

      updatedCount++;
      if (newProgress >= 1.0) {
        completedCount++;
      }
    }
  }

  return { updated: updatedCount, completed: completedCount };
}

/**
 * Calculate progress update for a specific goal based on call outcomes
 */
async function calculateProgressUpdate(
  goal: any,
  callerId: string,
  callId: string
): Promise<GoalProgressUpdate | null> {
  switch (goal.type as GoalType) {
    case 'LEARN':
      return await calculateLearnProgress(goal, callerId, callId);
    case 'CONNECT':
      return await calculateConnectProgress(goal, callerId, callId);
    case 'ACHIEVE':
    case 'CHANGE':
    case 'SUPPORT':
    case 'CREATE':
      // For other goal types, use a simple engagement-based heuristic
      return await calculateEngagementProgress(goal, callerId, callId);
    default:
      return null;
  }
}

/**
 * Calculate progress for LEARN goals based on curriculum completion
 */
async function calculateLearnProgress(
  goal: any,
  callerId: string,
  callId: string
): Promise<GoalProgressUpdate | null> {
  // If goal has a contentSpec, check curriculum progress
  if (goal.contentSpec) {
    // Get curriculum completion for this content
    const curriculumAttrs = await prisma.callerAttribute.findMany({
      where: {
        callerId,
        scope: 'CURRICULUM',
        domain: goal.contentSpec.domain,
        key: { contains: 'module_' },
      },
    });

    // Count completed modules
    const completedModules = curriculumAttrs.filter(
      attr => attr.stringValue === 'completed'
    ).length;

    // Get total modules from spec config
    const totalModules = (goal.contentSpec.config as any)?.curriculum?.modules?.length || 1;

    // Calculate progress as percentage of modules completed
    const curriculumProgress = completedModules / totalModules;

    // Only update if curriculum progress increased
    if (curriculumProgress > goal.progress) {
      return {
        goalId: goal.id,
        progressDelta: curriculumProgress - goal.progress,
        evidence: `Completed ${completedModules}/${totalModules} modules`,
      };
    }
  }

  // Fallback: small increment for engagement
  return {
    goalId: goal.id,
    progressDelta: 0.05, // 5% progress per engaged call
    evidence: `Engaged with learning content in call ${callId}`,
  };
}

/**
 * Calculate progress for CONNECT goals based on conversation quality
 */
async function calculateConnectProgress(
  goal: any,
  callerId: string,
  callId: string
): Promise<GoalProgressUpdate | null> {
  // Check for high engagement/connection scores
  const scores = await prisma.callScore.findMany({
    where: {
      callId,
      parameter: {
        parameterId: { in: [PARAMS.BEH_WARMTH, PARAMS.BEH_EMPATHY_RATE, PARAMS.BEH_INSIGHT_FREQUENCY] },
      },
    },
    include: {
      parameter: true,
    },
  });

  if (scores.length === 0) return null;

  // Average the connection-related scores
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  // Progress based on connection quality
  // High scores (>0.7) = more progress
  if (avgScore > 0.7) {
    return {
      goalId: goal.id,
      progressDelta: 0.1, // 10% progress for strong connection
      evidence: `High connection quality (avg score: ${avgScore.toFixed(2)})`,
    };
  } else if (avgScore > 0.5) {
    return {
      goalId: goal.id,
      progressDelta: 0.05, // 5% progress for moderate connection
      evidence: `Moderate connection quality (avg score: ${avgScore.toFixed(2)})`,
    };
  }

  return null;
}

/**
 * Generic engagement-based progress for other goal types
 */
async function calculateEngagementProgress(
  goal: any,
  callerId: string,
  callId: string
): Promise<GoalProgressUpdate | null> {
  // Check if caller was engaged in this call
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { transcript: true },
  });

  if (!call?.transcript) return null;

  // Simple heuristic: longer transcripts = more engagement
  const transcriptLength = call.transcript.length;

  if (transcriptLength > 1000) {
    // Long, engaged conversation
    return {
      goalId: goal.id,
      progressDelta: 0.05, // 5% progress
      evidence: `Engaged conversation (${transcriptLength} chars)`,
    };
  } else if (transcriptLength > 500) {
    // Moderate conversation
    return {
      goalId: goal.id,
      progressDelta: 0.02, // 2% progress
      evidence: `Moderate conversation (${transcriptLength} chars)`,
    };
  }

  return null;
}

/**
 * Manually update goal progress (for admin/testing)
 */
export async function updateGoalProgress(
  goalId: string,
  progress: number,
  evidence?: string
): Promise<void> {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progress: clampedProgress,
      updatedAt: new Date(),
      ...(clampedProgress >= 1.0 && {
        status: 'COMPLETED',
        completedAt: new Date(),
      }),
    },
  });
}
