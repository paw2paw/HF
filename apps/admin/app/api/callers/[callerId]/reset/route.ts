import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * POST /api/callers/[callerId]/reset
 *
 * Reset all analysis data for a caller while preserving source calls/transcripts.
 *
 * Deletes:
 * - CallScores (for all calls belonging to this caller)
 * - BehaviorMeasurement (for all calls belonging to this caller)
 * - RewardScore (for all calls belonging to this caller)
 * - PromptSlugSelection (for caller)
 * - CallerMemory
 * - CallerMemorySummary
 * - PersonalityObservation
 * - CallerPersonality
 * - CallerPersonalityProfile
 * - ComposedPrompt
 * - CallTarget (per-call computed targets)
 * - CallerTarget (aggregated caller-level targets)
 * - BehaviorTarget (CALLER-scoped, via CallerIdentity) [DEPRECATED]
 * - Clears CallerIdentity fields (promptStackId, nextPrompt, callerPrompt, snapshots, stats)
 *
 * Preserves:
 * - Caller record
 * - Call records (transcripts only - all analysis artifacts removed)
 * - CallerIdentity records (structure preserved, data cleared)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    // Verify caller exists
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: { id: true, name: true, email: true },
    });

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Get all call IDs for this caller (for deleting call-linked artifacts)
    const calls = await prisma.call.findMany({
      where: { callerId },
      select: { id: true },
    });
    const callIds = calls.map((c) => c.id);

    // Get all CallerIdentity IDs for this caller (for CALLER-scoped BehaviorTargets)
    const callerIdentities = await prisma.callerIdentity.findMany({
      where: { callerId },
      select: { id: true },
    });
    const callerIdentityIds = callerIdentities.map((ci) => ci.id);

    // Delete all analysis data in transaction
    const result = await prisma.$transaction(async (tx) => {
      // === CALL-LINKED ARTIFACTS ===

      // 1. Delete CallScores for all calls
      const scoresDeleted = await tx.callScore.deleteMany({
        where: { callId: { in: callIds } },
      });

      // 2. Delete BehaviorMeasurement for all calls
      const measurementsDeleted = await tx.behaviorMeasurement.deleteMany({
        where: { callId: { in: callIds } },
      });

      // 3. Delete RewardScore for all calls
      const rewardScoresDeleted = await tx.rewardScore.deleteMany({
        where: { callId: { in: callIds } },
      });

      // 3b. Delete CallTargets for all calls (new specType architecture)
      const callTargetsDeleted = await tx.callTarget.deleteMany({
        where: { callId: { in: callIds } },
      });

      // 4. Delete PromptSlugSelection for caller (also linked to calls)
      const slugSelectionsDeleted = await tx.promptSlugSelection.deleteMany({
        where: { callerId },
      });

      // === CALLER-LINKED ARTIFACTS ===

      // 5. Delete CallerMemory
      const memoriesDeleted = await tx.callerMemory.deleteMany({
        where: { callerId },
      });

      // 6. Delete CallerMemorySummary
      const summaryDeleted = await tx.callerMemorySummary.deleteMany({
        where: { callerId },
      });

      // 7. Delete PersonalityObservation
      const observationsDeleted = await tx.personalityObservation.deleteMany({
        where: { callerId },
      });

      // 8. Delete CallerPersonalityProfile
      const profilesDeleted = await tx.callerPersonalityProfile.deleteMany({
        where: { callerId },
      });

      // 9. Delete CallerPersonality
      const personalityDeleted = await tx.callerPersonality.deleteMany({
        where: { callerId },
      });

      // 10. Delete ComposedPrompt
      const promptsDeleted = await tx.composedPrompt.deleteMany({
        where: { callerId },
      });

      // 10b. Delete CallerTargets (new specType architecture)
      const callerTargetsDeleted = await tx.callerTarget.deleteMany({
        where: { callerId },
      });

      // === CALLER IDENTITY ARTIFACTS ===

      // 11. Delete CALLER-scoped BehaviorTargets (linked via CallerIdentity)
      const behaviorTargetsDeleted = await tx.behaviorTarget.deleteMany({
        where: {
          callerIdentityId: { in: callerIdentityIds },
          scope: "CALLER",
        },
      });

      // 12. Clear all CallerIdentity fields (preserve structure, clear data)
      const identitiesUpdated = await tx.callerIdentity.updateMany({
        where: { callerId },
        data: {
          // Prompt stack assignment
          promptStackId: null,
          // Next call prompt state
          nextPrompt: null,
          nextPromptComposedAt: null,
          nextPromptInputs: Prisma.DbNull,
          // Current prompt state
          callerPrompt: null,
          promptComposedAt: null,
          promptSnapshot: Prisma.DbNull,
          // Stats
          callCount: 0,
          lastCallAt: null,
        },
      });

      // 13. Reset call sequence numbers on calls (but preserve calls themselves)
      const callSequenceReset = await tx.call.updateMany({
        where: { callerId },
        data: {
          callSequence: null,
          previousCallId: null,
        },
      });

      return {
        scores: scoresDeleted.count,
        behaviorMeasurements: measurementsDeleted.count,
        rewardScores: rewardScoresDeleted.count,
        callTargets: callTargetsDeleted.count,
        slugSelections: slugSelectionsDeleted.count,
        memories: memoriesDeleted.count,
        memorySummary: summaryDeleted.count,
        observations: observationsDeleted.count,
        personalityProfiles: profilesDeleted.count,
        personality: personalityDeleted.count,
        prompts: promptsDeleted.count,
        callerTargets: callerTargetsDeleted.count,
        behaviorTargets: behaviorTargetsDeleted.count,
        identitiesCleared: identitiesUpdated.count,
        callSequencesReset: callSequenceReset.count,
        callsPreserved: callIds.length,
      };
    });

    return NextResponse.json({
      ok: true,
      message: `Reset complete for caller ${caller.name || caller.email || callerId}`,
      deleted: result,
    });
  } catch (error: any) {
    console.error("Error resetting caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to reset caller" },
      { status: 500 }
    );
  }
}
