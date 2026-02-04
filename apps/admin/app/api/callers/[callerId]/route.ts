import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/callers/[callerId]
 *
 * Get comprehensive caller data including:
 * - Basic profile
 * - Personality profile and observations
 * - Memories and summary
 * - Calls
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    // Fetch all caller data in parallel
    const [caller, personality, observations, memories, memorySummary, calls, identities, scores, callerTargets] = await Promise.all([
      // Basic caller info
      prisma.caller.findUnique({
        where: { id: callerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          externalId: true,
          createdAt: true,
          domainId: true,
          domain: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      }),

      // Personality profile
      prisma.callerPersonality.findUnique({
        where: { callerId: callerId },
        select: {
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
          confidenceScore: true,
          lastAggregatedAt: true,
          observationsUsed: true,
          preferredTone: true,
          preferredLength: true,
          technicalLevel: true,
        },
      }),

      // Personality observations
      prisma.personalityObservation.findMany({
        where: { callerId: callerId },
        orderBy: { observedAt: "desc" },
        take: 50,
        select: {
          id: true,
          callId: true,
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
          confidence: true,
          observedAt: true,
        },
      }),

      // Active memories (not superseded, not expired)
      prisma.callerMemory.findMany({
        where: {
          callerId: callerId,
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: [{ category: "asc" }, { confidence: "desc" }],
        take: 100,
        select: {
          id: true,
          category: true,
          key: true,
          value: true,
          evidence: true,
          confidence: true,
          extractedAt: true,
          expiresAt: true,
        },
      }),

      // Memory summary
      prisma.callerMemorySummary.findUnique({
        where: { callerId: callerId },
        select: {
          factCount: true,
          preferenceCount: true,
          eventCount: true,
          topicCount: true,
          keyFacts: true,
          preferences: true,
          topTopics: true,
        },
      }),

      // Calls with analysis status
      prisma.call.findMany({
        where: { callerId: callerId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          source: true,
          externalId: true,
          transcript: true,
          createdAt: true,
          callSequence: true,
          _count: {
            select: {
              scores: true,
              behaviorMeasurements: true,
            },
          },
          rewardScore: {
            select: { id: true },
          },
        },
      }),

      // Caller identities (phone numbers, external IDs, etc.)
      prisma.callerIdentity.findMany({
        where: { callerId: callerId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          externalId: true,
          nextPrompt: true,
          nextPromptComposedAt: true,
          nextPromptInputs: true,
          segmentId: true,
          segment: {
            select: { name: true },
          },
        },
      }),

      // Call scores
      prisma.callScore.findMany({
        where: {
          call: { callerId: callerId },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          callId: true,
          parameterId: true,
          score: true,
          confidence: true,
          evidence: true,
          reasoning: true,
          scoredBy: true,
          scoredAt: true,
          analysisSpecId: true,
          createdAt: true,
          parameter: {
            select: {
              name: true,
              definition: true,
            },
          },
          analysisSpec: {
            select: {
              id: true,
              slug: true,
              name: true,
              outputType: true,
            },
          },
          call: {
            select: {
              createdAt: true,
            },
          },
        },
      }),

      // CallerTargets - personalized behavior targets computed by ADAPT specs
      prisma.callerTarget.findMany({
        where: { callerId: callerId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          parameterId: true,
          targetValue: true,
          callsUsed: true,
          confidence: true,
          decayHalfLife: true,
          lastUpdatedAt: true,
          createdAt: true,
          updatedAt: true,
          parameter: {
            select: {
              name: true,
              definition: true,
              interpretationLow: true,
              interpretationHigh: true,
              domainGroup: true,
            },
          },
        },
      }),
    ]);

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Get counts
    const [callCount, memoryCount, observationCount, promptsCount, measurementsCount] = await Promise.all([
      prisma.call.count({ where: { callerId: callerId } }),
      prisma.callerMemory.count({
        where: {
          callerId: callerId,
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      }),
      prisma.personalityObservation.count({ where: { callerId: callerId } }),
      prisma.composedPrompt.count({ where: { callerId: callerId } }),
      prisma.behaviorMeasurement.count({
        where: {
          call: { callerId: callerId },
        },
      }),
    ]);

    // Get behavior targets count for this caller
    // First get caller's identity and find the published playbook for their domain
    const [callerIdentity, publishedPlaybook] = await Promise.all([
      prisma.callerIdentity.findFirst({
        where: { callerId: callerId },
        select: {
          id: true,
          segmentId: true,
        },
      }),
      // Find the published playbook for the caller's domain
      caller.domainId
        ? prisma.playbook.findFirst({
            where: {
              domainId: caller.domainId,
              status: "PUBLISHED",
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    // Count targets at various levels (SYSTEM is always available)
    let targetsCount = 0;
    const [systemTargets, segmentTargets, callerScopeTargets, playbookTargets] = await Promise.all([
      prisma.behaviorTarget.count({
        where: { scope: "SYSTEM", effectiveUntil: null },
      }),
      callerIdentity?.segmentId
        ? prisma.behaviorTarget.count({
            where: { scope: "SEGMENT", segmentId: callerIdentity.segmentId, effectiveUntil: null },
          })
        : Promise.resolve(0),
      callerIdentity?.id
        ? prisma.behaviorTarget.count({
            where: { scope: "CALLER", callerIdentityId: callerIdentity.id, effectiveUntil: null },
          })
        : Promise.resolve(0),
      // Use the published playbook from the caller's domain for PLAYBOOK scope
      publishedPlaybook?.id
        ? prisma.behaviorTarget.count({
            where: { scope: "PLAYBOOK", playbookId: publishedPlaybook.id, effectiveUntil: null },
          })
        : Promise.resolve(0),
    ]);
    targetsCount = systemTargets + segmentTargets + callerScopeTargets + playbookTargets;

    // Get memory counts per call for status
    const memoryCountsByCall = await prisma.callerMemory.groupBy({
      by: ["callId"],
      where: {
        callerId: callerId,
        supersededById: null,
        callId: { not: null },
      },
      _count: { id: true },
    });
    const memoryCountMap = new Map(
      memoryCountsByCall.map((m) => [m.callId, m._count.id])
    );

    // Transform calls to include analysis status
    const callsWithStatus = calls.map((call) => ({
      id: call.id,
      source: call.source,
      externalId: call.externalId,
      transcript: call.transcript,
      createdAt: call.createdAt,
      callSequence: call.callSequence,
      // Analysis status flags
      hasScores: call._count.scores > 0,
      hasMemories: (memoryCountMap.get(call.id) || 0) > 0,
      hasBehaviorMeasurements: call._count.behaviorMeasurements > 0,
      hasRewardScore: !!call.rewardScore,
    }));

    return NextResponse.json({
      ok: true,
      caller: {
        ...caller,
        personality,
        _count: {
          calls: callCount,
          memories: memoryCount,
          personalityObservations: observationCount,
        },
      },
      personality,
      observations,
      memories,
      memorySummary,
      calls: callsWithStatus,
      identities,
      scores,
      callerTargets,
      counts: {
        calls: callCount,
        memories: memoryCount,
        observations: observationCount,
        prompts: promptsCount,
        targets: targetsCount,
        callerTargets: callerTargets.length,
        measurements: measurementsCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch caller" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/callers/[callerId]
 *
 * Update caller profile (name, email, phone, domainId)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await req.json();

    // Allowed fields to update
    const { name, email, phone, domainId } = body;

    // Build update data
    const updateData: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      domainId?: string | null;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (domainId !== undefined) updateData.domainId = domainId;

    // If domainId provided, verify it exists
    if (domainId) {
      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
      });
      if (!domain) {
        return NextResponse.json(
          { ok: false, error: "Domain not found" },
          { status: 400 }
        );
      }
    }

    const updatedCaller = await prisma.caller.update({
      where: { id: callerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        externalId: true,
        createdAt: true,
        domainId: true,
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      caller: updatedCaller,
    });
  } catch (error: any) {
    console.error("Error updating caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update caller" },
      { status: 500 }
    );
  }
}
