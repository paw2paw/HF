/**
 * Shared caller data deletion utility.
 *
 * Used by:
 * - DELETE /api/callers/:callerId (right to erasure)
 * - POST /api/admin/retention/cleanup (automated retention)
 */

import { prisma } from "@/lib/prisma";

export interface DeletionCounts {
  callScores: number;
  behaviorMeasurements: number;
  callTargets: number;
  rewardScores: number;
  callerMemories: number;
  callerMemorySummaries: number;
  personalityObservations: number;
  callerPersonalities: number;
  callerPersonalityProfiles: number;
  promptSlugSelections: number;
  composedPrompts: number;
  callerTargets: number;
  callerAttributes: number;
  callerIdentities: number;
  goals: number;
  artifacts: number;
  inboundMessages: number;
  onboardingSessions: number;
  calls: number;
}

/**
 * Delete all data for a caller in a single transaction.
 * Returns counts of deleted records per table.
 */
export async function deleteCallerData(callerId: string): Promise<DeletionCounts> {
  const counts: DeletionCounts = {
    callScores: 0,
    behaviorMeasurements: 0,
    callTargets: 0,
    rewardScores: 0,
    callerMemories: 0,
    callerMemorySummaries: 0,
    personalityObservations: 0,
    callerPersonalities: 0,
    callerPersonalityProfiles: 0,
    promptSlugSelections: 0,
    composedPrompts: 0,
    callerTargets: 0,
    callerAttributes: 0,
    callerIdentities: 0,
    goals: 0,
    artifacts: 0,
    inboundMessages: 0,
    onboardingSessions: 0,
    calls: 0,
  };

  await prisma.$transaction(async (tx) => {
    // Get call IDs for FK-dependent deletes
    const callIds = await tx.call.findMany({
      where: { callerId },
      select: { id: true },
    });
    const callIdList = callIds.map((c) => c.id);

    // Delete call-related records first
    if (callIdList.length > 0) {
      counts.callScores = (await tx.callScore.deleteMany({ where: { callId: { in: callIdList } } })).count;
      counts.behaviorMeasurements = (await tx.behaviorMeasurement.deleteMany({ where: { callId: { in: callIdList } } })).count;
      counts.callTargets = (await tx.callTarget.deleteMany({ where: { callId: { in: callIdList } } })).count;
      counts.rewardScores = (await tx.rewardScore.deleteMany({ where: { callId: { in: callIdList } } })).count;
    }

    // Delete caller-related records
    counts.callerMemories = (await tx.callerMemory.deleteMany({ where: { callerId } })).count;
    counts.callerMemorySummaries = (await tx.callerMemorySummary.deleteMany({ where: { callerId } })).count;
    counts.personalityObservations = (await tx.personalityObservation.deleteMany({ where: { callerId } })).count;
    counts.callerPersonalities = (await tx.callerPersonality.deleteMany({ where: { callerId } })).count;
    counts.callerPersonalityProfiles = (await tx.callerPersonalityProfile.deleteMany({ where: { callerId } })).count;
    counts.promptSlugSelections = (await tx.promptSlugSelection.deleteMany({ where: { callerId } })).count;
    counts.composedPrompts = (await tx.composedPrompt.deleteMany({ where: { callerId } })).count;
    counts.callerTargets = (await tx.callerTarget.deleteMany({ where: { callerId } })).count;
    counts.callerAttributes = (await tx.callerAttribute.deleteMany({ where: { callerId } })).count;

    // Delete cascade-covered tables explicitly (for count tracking)
    counts.goals = (await tx.goal.deleteMany({ where: { callerId } })).count;
    counts.artifacts = (await tx.conversationArtifact.deleteMany({ where: { callerId } })).count;
    counts.inboundMessages = (await tx.inboundMessage.deleteMany({ where: { callerId } })).count;
    counts.onboardingSessions = (await tx.onboardingSession.deleteMany({ where: { callerId } })).count;

    // Delete caller identities
    counts.callerIdentities = (await tx.callerIdentity.deleteMany({ where: { callerId } })).count;

    // Delete calls
    counts.calls = (await tx.call.deleteMany({ where: { callerId } })).count;

    // Finally delete the caller
    await tx.caller.delete({ where: { id: callerId } });
  });

  return counts;
}
